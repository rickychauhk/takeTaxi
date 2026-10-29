import { Alert, Button, Card, Input, Select, Space, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';

const SETTING_KEY = 'gemini_default_image_model';

type ModelKey = 'flash' | 'flash-lite' | 'pro';

type GeminiConfig = {
  configured: boolean;
  apiKeySource: 'database' | 'environment' | null;
  apiKeyMasked: string | null;
  hasDatabaseKey: boolean;
  defaultModel: ModelKey;
  models: { key: ModelKey; labelZh: string; apiModel: string }[];
  apiKeySettingKey: string;
};

export default function SettingsGeminiPage() {
  const [config, setConfig] = useState<GeminiConfig | null>(null);
  const [defaultModel, setDefaultModel] = useState<ModelKey>('flash');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingModel, setSavingModel] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [clearingKey, setClearingKey] = useState(false);

  const load = async () => {
    const { data } = await api.get<GeminiConfig>('/admin/ai/gemini/config');
    setConfig(data);
    setDefaultModel(data.defaultModel);
  };

  useEffect(() => {
    void load();
  }, []);

  const modelOptions =
    config?.models.map((m) => ({
      value: m.key,
      label: `${m.labelZh}（${m.apiModel}）`,
    })) ?? [];

  const sourceLabel =
    config?.apiKeySource === 'database'
      ? 'CRM 資料庫（優先）'
      : config?.apiKeySource === 'environment'
        ? 'API 伺服器環境變數 GEMINI_API_KEY'
        : '未設定';

  return (
    <Card>
      <Typography.Title level={4}>Gemini 設定</Typography.Title>
      <Typography.Paragraph type="secondary">
        管理 Google Gemini API 金鑰與預設圖片分析模型。金鑰可在此儲存（寫入後台設定），或使用伺服器{' '}
        <Typography.Text code>GEMINI_API_KEY</Typography.Text>；兩者並存時以 CRM 儲存為準。
      </Typography.Paragraph>

      <Typography.Title level={5}>API 金鑰</Typography.Title>
      {config && !config.configured ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="尚未設定 Gemini API 金鑰"
          description="請在下方貼上 AI Studio 金鑰並儲存，或在 UAT／PROD 的 .env 設定 GEMINI_API_KEY 後重啟 API。"
        />
      ) : config?.configured ? (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message="Gemini API 已就緒"
          description={
            <>
              來源：{sourceLabel}
              {config.apiKeyMasked ? (
                <>
                  {' '}
                  · 目前金鑰：<Typography.Text code>{config.apiKeyMasked}</Typography.Text>
                </>
              ) : null}
            </>
          }
        />
      ) : null}

      <Input.Password
        style={{ maxWidth: 520 }}
        placeholder="貼上新的 API 金鑰（留空則不變更）"
        value={apiKeyInput}
        onChange={(e) => setApiKeyInput(e.target.value)}
        autoComplete="new-password"
      />
      <Space wrap style={{ marginTop: 12 }}>
        <Button
          type="primary"
          loading={savingKey}
          disabled={!apiKeyInput.trim()}
          onClick={async () => {
            setSavingKey(true);
            try {
              const { data } = await api.put<GeminiConfig>('/admin/ai/gemini/api-key', {
                apiKey: apiKeyInput.trim(),
              });
              setConfig(data);
              setApiKeyInput('');
              message.success('已儲存 API 金鑰');
            } catch (e: unknown) {
              const msg =
                e && typeof e === 'object' && 'response' in e
                  ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? '')
                  : '';
              message.error(msg || '儲存失敗');
            } finally {
              setSavingKey(false);
            }
          }}
        >
          儲存金鑰
        </Button>
        <Button
          danger
          loading={clearingKey}
          disabled={!config?.hasDatabaseKey}
          onClick={async () => {
            setClearingKey(true);
            try {
              const { data } = await api.put<GeminiConfig>('/admin/ai/gemini/api-key', { apiKey: '' });
              setConfig(data);
              setApiKeyInput('');
              message.success('已清除 CRM 內金鑰，改以環境變數為準（如有）');
            } catch {
              message.error('清除失敗');
            } finally {
              setClearingKey(false);
            }
          }}
        >
          清除 CRM 金鑰
        </Button>
      </Space>

      <Typography.Title level={5} style={{ marginTop: 32 }}>
        預設分析模型
      </Typography.Title>
      <Select
        style={{ width: '100%', maxWidth: 420, display: 'block' }}
        value={defaultModel}
        options={modelOptions}
        onChange={(v) => setDefaultModel(v)}
      />
      <Button
        type="primary"
        style={{ marginTop: 12 }}
        loading={savingModel}
        onClick={async () => {
          setSavingModel(true);
          try {
            await api.put(`/admin/settings/${SETTING_KEY}`, { value: defaultModel });
            message.success('已儲存預設模型');
            await load();
          } finally {
            setSavingModel(false);
          }
        }}
      >
        儲存預設模型
      </Button>
    </Card>
  );
}
