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
