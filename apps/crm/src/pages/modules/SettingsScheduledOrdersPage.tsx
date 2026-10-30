import { Button, Card, Switch, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';

const SETTING_KEY = 'scheduled_orders_enabled';

function parseFlag(raw: unknown): boolean {
  const v = String(raw ?? '1').trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  return true;
}

export default function SettingsScheduledOrdersPage() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await api.get<{ settingValue?: string }>(`/admin/settings/${SETTING_KEY}`);
      setEnabled(parseFlag(data.settingValue));
    })();
  }, []);

  return (
    <Card>
      <Typography.Title level={4}>預約叫車</Typography.Title>
      <Typography.Paragraph type="secondary">
        關閉後，乘客 App「更多選項」內的預約、司機 App 出貨頁「預約」按鈕及底部「預約」分頁均會隱藏；後端亦拒絕帶預約時間的落單。已存在的預約柯打不受影響。
      </Typography.Paragraph>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Switch checked={enabled} onChange={setEnabled} />
        <Typography.Text>{enabled ? '已開啟（顯示預約）' : '已關閉（隱藏預約）'}</Typography.Text>
      </div>
      <Button
        type="primary"
        loading={loading}
        onClick={async () => {
          setLoading(true);
          try {
            await api.put(`/admin/settings/${SETTING_KEY}`, { value: enabled ? '1' : '0' });
            message.success('已儲存');
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
