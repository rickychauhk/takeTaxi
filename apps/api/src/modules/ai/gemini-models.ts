export type GeminiImageModelKey = 'flash' | 'flash-lite' | 'pro';

/** 新 API 專案無法再呼叫 2.5；對應 Google 建議的 Flash / Flash-Lite / Pro 型號 */
export const GEMINI_IMAGE_MODELS: Record<
  GeminiImageModelKey,
  { apiModel: string; label: string; labelZh: string }
> = {
  flash: {
    apiModel: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    labelZh: 'Gemini 3.8 Flash',
  },
  'flash-lite': {
    apiModel: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite',
    labelZh: 'Gemini 3.1 Flash-Lite',
  },
  pro: {
    apiModel: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro',
    labelZh: 'Gemini 3.1 Pro',
  },
};

export const GEMINI_DEFAULT_IMAGE_MODEL_SETTING = 'gemini_default_image_model';
/** CRM 可寫入；優先於伺服器 GEMINI_API_KEY 環境變數 */
export const GEMINI_API_KEY_SETTING = 'gemini_api_key';

export function resolveGeminiImageModelKey(raw: string | undefined | null): GeminiImageModelKey {
  const v = String(raw ?? '').trim() as GeminiImageModelKey;
  if (v in GEMINI_IMAGE_MODELS) return v;
  return 'flash';
}
