import { Button, Card, Space, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import HtmlEditorField from '../../components/HtmlEditorField';
import { htmlForEditor, wrapWebviewHtml } from '../../utils/webviewHtml';

const SETTING_KEY = 'passenger_ride_tips_html';

const defaultHtml = `<p><strong>搭車秘笈</strong></p>
<ul>
  <li>落單前確認上車點同目的地，必要時喺備註寫清楚座數或特殊需要。</li>
  <li>等候司機接單時請保持 App 開啟，方便司機聯絡你。</li>
  <li>如需代他人叫車，可勾選「幫人 call 車」並填寫客人 8 位電話。</li>
  <li>行程中如有問題，可透過 App 訊息或致電司機；緊急情況請致電 999。</li>
</ul>`;

export default function RideTipsEditorPage() {
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
      <Typography.Title level={4}>乘客搭車秘笈</Typography.Title>
      <Typography.Paragraph type="secondary">
        乘客 App 側欄「搭車秘笈」會以 WebView 顯示此 HTML，請使用下方編輯器排版圖文。
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
