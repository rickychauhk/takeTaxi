import { Button, Card, Space, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import HtmlEditorField from '../../components/HtmlEditorField';
import { htmlForEditor, wrapWebviewHtml } from '../../utils/webviewHtml';

const SETTING_KEY = 'passenger_company_price_notice_html';

const defaultHtml = `<p><strong>公司價收費</strong></p>
<ul>
  <li>預估 $94 或以上：85 折</li>
  <li>預估 $80－$93：固定 $80</li>
  <li>預估不足 $80：按 App 預估收費</li>
</ul>
<p>附加費（隧道費、行李等）及多站行程另計。請向司機索取收據。</p>
<p>落單後請致電司機確認價錢，多謝配合 🙏</p>`;

export default function CompanyPriceNoticeEditorPage() {
  const [html, setHtml] = useState('');
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get<{ settingKey: string; settingValue: string }>(
          `/admin/settings/${SETTING_KEY}`,
        );
        const raw = data.settingValue?.trim() ?? '';
        setExists(!!raw);
        setHtml(raw ? htmlForEditor(raw) : htmlForEditor(wrapWebviewHtml(defaultHtml)));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/settings/${SETTING_KEY}`, {
        value: wrapWebviewHtml(html),
      });
      setExists(true);
      message.success('已儲存');
    } catch {
      message.error('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card loading={loading}>
      <Typography.Title level={4}>乘客公司價告示</Typography.Title>
      <Typography.Paragraph type="secondary">
        乘客取消「正價」落柯打時，App 會以 WebView 顯示此 HTML。主色為紅色按鈕，內容可含收費規則及免責說明。
      </Typography.Paragraph>
      <HtmlEditorField value={html} onChange={setHtml} />
      <Space style={{ marginTop: 16 }}>
        <Button type="primary" loading={saving} onClick={save}>
          {exists ? '儲存修改' : '新增並儲存'}
        </Button>
        <Button onClick={() => setHtml(htmlForEditor(wrapWebviewHtml(defaultHtml)))}>
          載入預設範本
        </Button>
      </Space>
    </Card>
  );
}
