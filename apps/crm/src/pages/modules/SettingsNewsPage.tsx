import { Button, Card, Input, message, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function SettingsNewsPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await api.get('/admin/settings/news_url');
      setUrl(data.settingValue ?? '');
    })();
  }, []);

  return (
    <Card>
      <Typography.Title level={4}>最新消息 URL</Typography.Title>
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
      <Button
        type="primary"
        style={{ marginTop: 16 }}
        loading={loading}
        onClick={async () => {
          setLoading(true);
          try {
            await api.put('/admin/settings/news_url', { value: url });
            message.success('已更新');
          } finally {
            setLoading(false);
          }
        }}
      >
        儲存
      </Button>
    </Card>
  );
}
