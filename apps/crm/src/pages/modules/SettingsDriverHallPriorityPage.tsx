import { Button, Card, InputNumber, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import {
  DRIVER_HALL_PRIORITY_PREVIEW_SECONDS_DEFAULT,
  DRIVER_HALL_PRIORITY_PREVIEW_SECONDS_MAX,
  DRIVER_HALL_PRIORITY_PREVIEW_SECONDS_SETTING_KEY,
  parseDriverHallPriorityPreviewSeconds,
} from '@taxima/shared';
import { api } from '../../api/client';

export default function SettingsDriverHallPriorityPage() {
  const [seconds, setSeconds] = useState(DRIVER_HALL_PRIORITY_PREVIEW_SECONDS_DEFAULT);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await api.get(`/admin/settings/${DRIVER_HALL_PRIORITY_PREVIEW_SECONDS_SETTING_KEY}`);
      setSeconds(parseDriverHallPriorityPreviewSeconds(data.settingValue));
    })();
  }, []);

  return (
    <Card>
      <Typography.Title level={4}>司機大廳 · 優先預覽秒數</Typography.Title>
      <Typography.Paragraph type="secondary">
        新柯打落到大廳後，<strong>管理員級</strong>司機及 CRM 標記為 <strong>自己人</strong> 的司機，可較{' '}
        <strong>公海</strong>（一般級別）提早看到訂單。合作方級別若未勾自己人，與公海相同。
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary">
        設定為 0 表示所有人同時見到大廳柯打（無提前）。儲存後 API 約 15 秒內生效。
      </Typography.Paragraph>
      <Typography.Text>提前秒數</Typography.Text>
      <InputNumber
        min={0}
        max={DRIVER_HALL_PRIORITY_PREVIEW_SECONDS_MAX}
        precision={0}
        style={{ width: 200, display: 'block', marginTop: 8 }}
        value={seconds}
        onChange={(v) => setSeconds(parseDriverHallPriorityPreviewSeconds(v ?? 0))}
        addonAfter="秒"
      />
      <Button
        type="primary"
        style={{ marginTop: 16 }}
        loading={loading}
        onClick={async () => {
          setLoading(true);
          try {
            await api.put(`/admin/settings/${DRIVER_HALL_PRIORITY_PREVIEW_SECONDS_SETTING_KEY}`, {
              value: String(seconds),
            });
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
