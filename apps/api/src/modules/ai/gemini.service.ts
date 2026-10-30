import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { readFile } from 'fs/promises';
import { basename, join } from 'path';
import { DocumentsService } from '../documents/documents.service';
import { SettingsService } from '../settings/settings.service';
import {
  GEMINI_API_KEY_SETTING,
  GEMINI_DEFAULT_IMAGE_MODEL_SETTING,
  GEMINI_IMAGE_MODELS,
  type GeminiImageModelKey,
  resolveGeminiImageModelKey,
} from './gemini-models';
import { maskGeminiApiKeyForDisplay } from './gemini-key.util';

const uploadDir = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');

export type PointTopupGeminiVerdict = {
  approve: boolean;
  rejectReasonZh: string;
  receiptShowsTransferProof: boolean;
  receiptAmountMatches: boolean;
  receiptPayeeMatches: boolean;
  summaryZh: string;
  /** 憑證上可見的轉帳／交易時間（香港） */
  receiptHasVisibleDatetime: boolean;
  receiptTransferAtIso: string;
};

const TOPUP_RECEIPT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    approve: { type: 'boolean', description: '全部核對通過才 true' },
    rejectReasonZh: {
      type: 'string',
      description: '拒絕時給司機看的繁中原因；批准時可留空字串',
    },
    receiptShowsTransferProof: {
      type: 'boolean',
      description: '圖片是否為有效轉帳／FPS 成功憑證',
    },
    receiptAmountMatches: {
      type: 'boolean',
      description: '憑證上金額是否與應付 HKD 一致（允許小數點差）',
    },
    receiptPayeeMatches: {
      type: 'boolean',
      description: '收款方／FPS 識別／户口號碼是否與平台指定收款資料一致',
    },
    summaryZh: { type: 'string', description: '審批員可讀的簡短繁中摘要' },
    receiptHasVisibleDatetime: {
      type: 'boolean',
      description: '憑證圖片是否清楚顯示轉帳／交易日期時間',
    },
    receiptTransferAtIso: {
      type: 'string',
      description:
        '憑證上的日期時間，ISO8601 香港時間（例 2026-10-30T14:35:00+08:00）；無則空字串',
    },
  },
  required: [
    'approve',
    'rejectReasonZh',
    'receiptShowsTransferProof',
    'receiptAmountMatches',
    'receiptPayeeMatches',
    'summaryZh',
    'receiptHasVisibleDatetime',
    'receiptTransferAtIso',
  ],
} as const;

const TOPUP_RECEIPT_DATETIME_JSON_SCHEMA = {
  type: 'object',
  properties: {
    receiptHasVisibleDatetime: { type: 'boolean' },
    receiptTransferAtIso: { type: 'string' },
  },
  required: ['receiptHasVisibleDatetime', 'receiptTransferAtIso'],
} as const;

export function parsePointTopupReceiptTransferAt(iso: string | null | undefined): Date | null {
  const s = iso?.trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

const DEFAULT_DRIVER_DOC_PROMPT = `你是香港 taxi 平台 CRM 的審批助手。請分析這張司機上傳證件／行車證圖片，以繁體中文回覆：
1. 文件類型（如行車證、駕駛執照、身分證明、車輛登記等）
2. 可讀到的關鍵欄位（姓名、車牌、到期日、編號等；看不清請註明）
3. 圖片清晰度與是否疑似篡改／遮擋
4. 對人工審批的建議（通過／需補交／拒絕）及簡短理由
請分點列出，勿捏造看不清的內容。`;

type ImagePayload = { mimeType: string; base64: string };

@Injectable()
export class GeminiService {
  constructor(
    private readonly settings: SettingsService,
    private readonly documents: DocumentsService,
  ) {}

  private envApiKey(): string | null {
    const k = process.env.GEMINI_API_KEY?.trim();
    return k || null;
  }

  private async dbApiKey(): Promise<string | null> {
    const k = await this.settings.getRawSettingValue(GEMINI_API_KEY_SETTING);
    return k || null;
  }

  /** 實際呼叫 Gemini 時使用：CRM 設定優先，其次 .env */
  async resolveApiKey(): Promise<string | null> {
    return (await this.dbApiKey()) ?? this.envApiKey();
  }

  async getConfigForAdmin() {
    const dbKey = await this.dbApiKey();
    const envKey = this.envApiKey();
    const effective = dbKey ?? envKey;
    const defaultModel = await this.getDefaultImageModelKey();
    return {
      configured: Boolean(effective),
      apiKeySource: dbKey ? ('database' as const) : envKey ? ('environment' as const) : null,
      apiKeyMasked: effective ? maskGeminiApiKeyForDisplay(effective) : null,
      hasDatabaseKey: Boolean(dbKey),
      defaultModel,
      models: this.listImageModels(),
      settingKey: GEMINI_DEFAULT_IMAGE_MODEL_SETTING,
      apiKeySettingKey: GEMINI_API_KEY_SETTING,
    };
  }

  async setApiKey(adminId: number, raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      await this.settings.upsert(adminId, GEMINI_API_KEY_SETTING, '');
      return;
    }
    if (trimmed.length < 20 || trimmed.length > 512) {
      throw new BadRequestException('API 金鑰格式不正確');
    }
    await this.settings.upsert(adminId, GEMINI_API_KEY_SETTING, trimmed);
  }

  listImageModels() {
    return (Object.keys(GEMINI_IMAGE_MODELS) as GeminiImageModelKey[]).map((key) => ({
      key,
      ...GEMINI_IMAGE_MODELS[key],
    }));
  }

  async getDefaultImageModelKey(): Promise<GeminiImageModelKey> {
    const row = await this.settings.getForAdmin(GEMINI_DEFAULT_IMAGE_MODEL_SETTING);
    const raw = String(row.settingValue ?? '').trim();
    return resolveGeminiImageModelKey(raw || process.env.GEMINI_DEFAULT_IMAGE_MODEL);
  }

  /** 司機積分充值：固定使用 Gemini 3.8 Flash 審核過數憑證 */
  async analyzePointTopupReceipt(input: {
    receiptImagePath: string;
    expectedPoints: number;
    expectedPriceHkd: number;
    packageLabel: string | null;
    paymentMethodTitle: string;
    paymentMethodDetail: string;
    driverDisplayName: string | null;
    driverPhone: string | null;
  }): Promise<PointTopupGeminiVerdict> {
    const apiKey = await this.resolveApiKey();
    if (!apiKey) {
      throw new ServiceUnavailableException('尚未設定 Gemini API 金鑰');
    }

    const modelMeta = GEMINI_IMAGE_MODELS.flash;
    const image = await this.loadImageFromReceiptPath(input.receiptImagePath);

    const prompt = `你是香港 taxi 平台「司機積分購買」自動審批員。請只根據圖片可見內容與下列申請資料核對，輸出 JSON（勿 markdown）。

【申請資料】
- 積分套餐：${input.packageLabel?.trim() || '（無標籤）'}
- 應入帳積分：${input.expectedPoints} 分
- 應付金額：HK$${input.expectedPriceHkd}
- 付款方式：${input.paymentMethodTitle}
- 平台指定收款資料（须與憑證一致）：${input.paymentMethodDetail}
- 司機姓名：${input.driverDisplayName?.trim() || '—'}
- 司機電話：${input.driverPhone?.trim() || '—'}

【審批規則】
1. 憑證须為轉帳／FPS／入數成功紀錄（截图或收據），唔係無關圖片。
2. 憑證上金額须為 HK$${input.expectedPriceHkd}（可接受同一數字的不同格式；明显唔同则 false）。
3. 收款方、FPS ID、银行户口號碼等须與「平台指定收款資料」匹配（允許空格、掩码 * 部分一致）。
4. 只有 1–3 全部成立时 approve=true；否则 approve=false，rejectReasonZh 用繁中说明具体问题（给司機睇）。
5. 看不清不要捏造；无法确认则判 false 并说明。
6. 若憑證上有轉帳／交易日期時間，讀取並填入 receiptTransferAtIso（香港時間 ISO8601，含 +08:00）；receiptHasVisibleDatetime=true。無日期時間則 receiptTransferAtIso 留空、receiptHasVisibleDatetime=false。`.slice(
      0,
      8000,
    );

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelMeta.apiModel}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }, { inline_data: { mime_type: image.mimeType, data: image.base64 } }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: TOPUP_RECEIPT_JSON_SCHEMA,
        },
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new BadRequestException(formatGeminiHttpError(res.status, text));
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new BadRequestException('Gemini 回應格式無效');
    }

    const rawText = this.extractText(parsed);
    let verdict: PointTopupGeminiVerdict;
    try {
      verdict = JSON.parse(rawText) as PointTopupGeminiVerdict;
    } catch {
      throw new BadRequestException('Gemini 審批 JSON 無效');
    }

    return {
      approve: Boolean(verdict.approve),
      rejectReasonZh: String(verdict.rejectReasonZh ?? '').trim(),
      receiptShowsTransferProof: Boolean(verdict.receiptShowsTransferProof),
      receiptAmountMatches: Boolean(verdict.receiptAmountMatches),
      receiptPayeeMatches: Boolean(verdict.receiptPayeeMatches),
      summaryZh: String(verdict.summaryZh ?? '').trim(),
      receiptHasVisibleDatetime: Boolean(verdict.receiptHasVisibleDatetime),
      receiptTransferAtIso: String(verdict.receiptTransferAtIso ?? '').trim(),
    };
  }

  /** 僅從憑證讀取轉帳日期時間（無完整審批上下文時） */
  async extractPointTopupReceiptTransferAt(receiptImagePath: string): Promise<{
    receiptHasVisibleDatetime: boolean;
    receiptTransferAtIso: string;
  }> {
    const apiKey = await this.resolveApiKey();
    if (!apiKey) {
      throw new ServiceUnavailableException('尚未設定 Gemini API 金鑰');
    }
    const modelMeta = GEMINI_IMAGE_MODELS.flash;
    const image = await this.loadImageFromReceiptPath(receiptImagePath);
    const prompt = `你是 OCR 助手。只讀這張香港銀行/FPS 轉帳憑證截图上的「交易／轉帳日期時間」。輸出 JSON（勿 markdown）。
若圖中有清楚日期時間：receiptHasVisibleDatetime=true，receiptTransferAtIso 為香港時間 ISO8601（例 2026-10-30T14:35:00+08:00）。
若無或看不清：receiptHasVisibleDatetime=false，receiptTransferAtIso 留空。勿捏造。`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelMeta.apiModel}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }, { inline_data: { mime_type: image.mimeType, data: image.base64 } }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: TOPUP_RECEIPT_DATETIME_JSON_SCHEMA,
        },
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new BadRequestException(formatGeminiHttpError(res.status, text));
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new BadRequestException('Gemini 回應格式無效');
    }

    const rawText = this.extractText(parsed);
    let out: { receiptHasVisibleDatetime?: boolean; receiptTransferAtIso?: string };
    try {
      out = JSON.parse(rawText) as typeof out;
    } catch {
      throw new BadRequestException('Gemini 日期 JSON 無效');
    }

    return {
      receiptHasVisibleDatetime: Boolean(out.receiptHasVisibleDatetime),
      receiptTransferAtIso: String(out.receiptTransferAtIso ?? '').trim(),
    };
  }

  async analyzeImageForAdmin(input: {
    model?: GeminiImageModelKey;
    documentId?: string;
    imageUrl?: string;
    prompt?: string;
  }) {
    const apiKey = await this.resolveApiKey();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        '尚未設定 Gemini API 金鑰，請於 CRM「Gemini 設定」或 API 伺服器 GEMINI_API_KEY 設定',
      );
    }

    const modelKey = input.model ?? (await this.getDefaultImageModelKey());
    const modelMeta = GEMINI_IMAGE_MODELS[modelKey];
    if (!modelMeta) {
      throw new BadRequestException('不支援的模型');
    }

    const image = await this.loadImage(input.documentId, input.imageUrl);
    const prompt = (input.prompt?.trim() || DEFAULT_DRIVER_DOC_PROMPT).slice(0, 8000);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelMeta.apiModel}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }, { inline_data: { mime_type: image.mimeType, data: image.base64 } }],
          },
        ],
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new BadRequestException(formatGeminiHttpError(res.status, text));
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new BadRequestException('Gemini 回應格式無效');
    }

    const analysis = this.extractText(parsed);
    return {
      model: modelKey,
      apiModel: modelMeta.apiModel,
      analysis,
    };
  }

  private extractText(body: unknown): string {
    const candidates = (body as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
      .candidates;
    const parts = candidates?.[0]?.content?.parts ?? [];
    const joined = parts.map((p) => p.text ?? '').join('').trim();
    if (!joined) {
      throw new BadRequestException('Gemini 未返回文字結果');
    }
    return joined;
  }

  async loadImageFromReceiptPath(receiptImagePath: string): Promise<ImagePayload> {
    const raw = receiptImagePath?.trim();
    if (!raw) throw new BadRequestException('缺少憑證圖片');
    const fileName = basename(raw.replace(/\\/g, '/'));
    const fullPath = join(uploadDir, fileName);
    const buf = await readFile(fullPath);
    if (buf.length > 15 * 1024 * 1024) {
      throw new BadRequestException('圖片過大（上限 15MB）');
    }
    return { mimeType: mimeFromName(fileName), base64: buf.toString('base64') };
  }

  private async loadImage(documentId?: string, imageUrl?: string): Promise<ImagePayload> {
    if (documentId?.trim()) {
      const doc = await this.documents.findById(documentId.trim());
      if (!doc) throw new NotFoundException('找不到文件');
      const fileName = basename(doc.filePath.replace(/\\/g, '/'));
      const fullPath = join(uploadDir, fileName);
      const buf = await readFile(fullPath);
      return { mimeType: mimeFromName(fileName), base64: buf.toString('base64') };
    }

    const url = imageUrl?.trim();
    if (!url) {
      throw new BadRequestException('請提供 documentId 或 imageUrl');
    }

    const uploadMatch = url.match(/\/api\/v1\/uploads\/([^/?#]+)/i);
    if (uploadMatch) {
      const fileName = decodeURIComponent(uploadMatch[1]!);
      const fullPath = join(uploadDir, fileName);
      const buf = await readFile(fullPath);
      return { mimeType: mimeFromName(fileName), base64: buf.toString('base64') };
    }

    if (!/^https?:\/\//i.test(url)) {
      throw new BadRequestException('imageUrl 須為完整網址或 /api/v1/uploads/… 路徑');
    }

    const res = await fetch(url);
    if (!res.ok) {
      throw new BadRequestException(`無法下載圖片 (${res.status})`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 15 * 1024 * 1024) {
      throw new BadRequestException('圖片過大（上限 15MB）');
    }
    const contentType = res.headers.get('content-type')?.split(';')[0]?.trim();
    return {
      mimeType: contentType && contentType.startsWith('image/') ? contentType : 'image/jpeg',
      base64: buf.toString('base64'),
    };
  }
}

function formatGeminiHttpError(status: number, body: string): string {
  let message = body.trim();
  if (message.startsWith('{')) {
    try {
      const data = JSON.parse(message) as { error?: { message?: string } };
      if (data.error?.message) message = data.error.message;
    } catch {
      /* keep raw */
    }
  }
  if (status === 402) {
    return 'Gemini API 預付點數已用完，請到 Google AI Studio 為專案充值或啟用帳單後再試。';
  }
  if (status === 404 && /no longer available to new users/i.test(message)) {
    return '此 Gemini 模型已不支援新專案，請聯絡技術更新 API 模型設定。';
  }
  return `Gemini API 錯誤 (${status})：${message.slice(0, 400) || '請求失敗'}`;
}

function mimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}
