import { Button, Card, Space, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import HtmlEditorField from '../../components/HtmlEditorField';
import { htmlForEditor, wrapWebviewHtml } from '../../utils/webviewHtml';

const defaultContactHtml = `<h1>聯絡我們</h1>
<p>如有查詢，歡迎透過以下方式聯絡我們。</p>
<ul>
  <li>電郵：support@taxima.hk</li>
  <li>電話：+852 0000 0000</li>
</ul>`;

export default function ContactUsEditorPage() {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exists, setExists] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get<{ settingKey: string; settingValue: string | null }>(
          '/admin/settings/contact_us_html',
        );
        const raw = data.settingValue?.trim() ?? '';
        setExists(Boolean(raw));
        setHtml(raw ? htmlForEditor(data.settingValue ?? '') : defaultContactHtml);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Card loading={loading}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <Typography.Title level={4} style={{ marginBottom: 4 }}>
            聯絡我們 HTML
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {exists
              ? '編輯後儲存，乘客／司機 App 的「聯絡我們」頁面會更新。'
              : '尚未建立內容，編輯後按「儲存」即可新增。'}
          </Typography.Paragraph>
        </div>
        <HtmlEditorField
          value={html}
          onChange={setHtml}
          hint="支援視覺編輯、HTML 原始碼與 App 預覽；儲存時會包裝成適合 WebView 的完整 HTML。"
        />
        <Space>
          <Button
            type="primary"
            loading={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await api.put('/admin/settings/contact_us_html', {
                  value: wrapWebviewHtml(html),
                });
                setExists(true);
                message.success(exists ? '已更新' : '已新增');
              } finally {
                setSaving(false);
              }
            }}
          >
            {exists ? '儲存修改' : '新增並儲存'}
          </Button>
          <Button
            onClick={() => {
              setHtml(defaultContactHtml);
              message.info('已載入預設範本（尚未儲存）');
            }}
          >
            載入預設範本
          </Button>
        </Space>
      </Space>
    </Card>
  );
}
