import { Button, Card, Divider, Space, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import HtmlEditorField from '../../components/HtmlEditorField';
import { htmlForEditor, wrapWebviewHtml } from '../../utils/webviewHtml';

const PASSENGER_KEY = 'terms_passenger_html';
const DRIVER_KEY = 'terms_driver_html';

const defaultPassengerHtml = `<h1>搭的 · 乘客版使用條款</h1>
<p>使用本 App 即表示你同意以下條款。</p>
<ol>
  <li>你須提供真實聯絡電話以完成叫車及帳戶驗證。</li>
  <li>請準時於上車點等候；惡意取消或濫用平台可能導致帳戶受限。</li>
  <li>行程費用、積分抵扣及優惠以 App 及後台設定為準。</li>
</ol>`;

const defaultDriverHtml = `<h1>搭的 · 司機版使用條款</h1>
<p>使用本 App 即表示你同意以下條款。</p>
<ol>
  <li>你須為 CRM 登記之有效司機，並保持帳戶及車輛資料正確。</li>
  <li>接單後須依平台流程完成行程；已接柯打不可由司機自行取消。</li>
  <li>接單、懸賞及繁忙時段等積分規則以後台設定為準。</li>
</ol>`;

type TermsSlot = {
  settingKey: string;
  title: string;
  hint: string;
  defaultHtml: string;
};

const SLOTS: TermsSlot[] = [
  {
    settingKey: PASSENGER_KEY,
    title: '乘客 App 使用條款',
    hint: '乘客 App 設定內「使用條款」WebView 顯示此 HTML。',
    defaultHtml: defaultPassengerHtml,
  },
  {
    settingKey: DRIVER_KEY,
    title: '司機 App 使用條款',
    hint: '司機 App 設定內「使用條款」WebView 顯示此 HTML。',
    defaultHtml: defaultDriverHtml,
  },
];

function TermsSection({
  slot,
  html,
  exists,
  onChange,
  onSave,
  onLoadDefault,
  saving,
}: {
  slot: TermsSlot;
  html: string;
  exists: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
  onLoadDefault: () => void;
  saving: boolean;
}) {
  return (
    <Card size="small" style={{ marginBottom: 24 }}>
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        {slot.title}
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
        {exists ? '已建立內容，修改後按「儲存」即更新 App。' : slot.hint}
      </Typography.Paragraph>
      <HtmlEditorField value={html} onChange={onChange} />
      <Space style={{ marginTop: 16 }}>
        <Button type="primary" loading={saving} onClick={onSave}>
          {exists ? '儲存修改' : '新增並儲存'}
        </Button>
        <Button onClick={onLoadDefault}>載入預設範本</Button>
      </Space>
    </Card>
  );
}

export default function AppTermsEditorPage() {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [htmlByKey, setHtmlByKey] = useState<Record<string, string>>({});
  const [existsByKey, setExistsByKey] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const nextHtml: Record<string, string> = {};
        const nextExists: Record<string, boolean> = {};
        for (const slot of SLOTS) {
          const { data } = await api.get<{ settingKey: string; settingValue: string | null }>(
            `/admin/settings/${slot.settingKey}`,
          );
          const raw = data.settingValue?.trim() ?? '';
          nextExists[slot.settingKey] = Boolean(raw);
          nextHtml[slot.settingKey] = raw ? htmlForEditor(data.settingValue ?? '') : slot.defaultHtml;
        }
        setHtmlByKey(nextHtml);
        setExistsByKey(nextExists);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async (slot: TermsSlot) => {
    setSavingKey(slot.settingKey);
    try {
      const html = htmlByKey[slot.settingKey] ?? slot.defaultHtml;
      await api.put(`/admin/settings/${slot.settingKey}`, {
        value: wrapWebviewHtml(html),
      });
      setExistsByKey((prev) => ({ ...prev, [slot.settingKey]: true }));
      message.success(`${slot.title}已儲存`);
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return <Card loading />;
  }

  return (
    <Card>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        App 使用條款（WebView）
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        同一頁編輯乘客版與司機版 HTML；儲存後 App 即時從 API 讀取顯示。
      </Typography.Paragraph>
      <Divider />
      {SLOTS.map((slot) => (
        <TermsSection
          key={slot.settingKey}
          slot={slot}
          html={htmlByKey[slot.settingKey] ?? slot.defaultHtml}
          exists={Boolean(existsByKey[slot.settingKey])}
          onChange={(v) => setHtmlByKey((prev) => ({ ...prev, [slot.settingKey]: v }))}
          onSave={() => void save(slot)}
          onLoadDefault={() => {
            setHtmlByKey((prev) => ({ ...prev, [slot.settingKey]: slot.defaultHtml }));
            message.info('已載入預設範本（尚未儲存）');
          }}
          saving={savingKey === slot.settingKey}
        />
      ))}
    </Card>
  );
}
