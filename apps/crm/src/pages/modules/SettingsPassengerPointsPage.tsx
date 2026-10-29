import { Button, Card, InputNumber, Switch, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';

const SETTING_KEY = 'passenger_points_per_km';
const HKD_PER_POINT_KEY = 'passenger_points_hkd_per_point';
const REDEEM_ENABLED_KEY = 'passenger_points_redeem_enabled';

function parseFlag(raw: unknown): boolean {
  const v = String(raw ?? '1').trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  return true;
}

export default function SettingsPassengerPointsPage() {
  const [rate, setRate] = useState<number>(0);
  const [hkdPerPoint, setHkdPerPoint] = useState<number>(1);
  const [redeemEnabled, setRedeemEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const [kmRes, hkdRes, redeemRes] = await Promise.all([
        api.get(`/admin/settings/${SETTING_KEY}`),
        api.get(`/admin/settings/${HKD_PER_POINT_KEY}`),
        api.get(`/admin/settings/${REDEEM_ENABLED_KEY}`),
      ]);
      const n = Number(kmRes.data.settingValue ?? 0);
      setRate(Number.isFinite(n) && n >= 0 ? n : 0);
      const h = Number(hkdRes.data.settingValue ?? 1);
      setHkdPerPoint(Number.isFinite(h) && h >= 0 ? h : 1);
      setRedeemEnabled(parseFlag(redeemRes.data.settingValue));
    })();
  }, []);

  return (
    <Card>
      <Typography.Title level={4}>乘客行程積分</Typography.Title>
      <Typography.Paragraph type="secondary">
        乘客完成行程後，行程公里為叫車時預估駕駛路程（確認叫車頁路線公里）四捨五入至整數；積分 =
        該公里 × 每公里積分（整數，無小數）。預設每公里積分為 0。
      </Typography.Paragraph>
      <Typography.Text>每公里積分</Typography.Text>
      <InputNumber
        min={0}
        step={1}
        precision={0}
        style={{ width: 200, display: 'block', marginTop: 8 }}
        value={rate}
        onChange={(v) => setRate(typeof v === 'number' ? v : 0)}
      />
      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Switch checked={redeemEnabled} onChange={setRedeemEnabled} />
        <Typography.Text>允許乘客 App 使用積分抵扣車資</Typography.Text>
      </div>
      <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
        關閉後，乘客確認叫車頁將無法選擇使用積分；已完成行程賺取積分不受影響。
      </Typography.Paragraph>

      <Typography.Text style={{ display: 'block', marginTop: 20 }}>每積分兌換車資 (HKD)</Typography.Text>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
        乘客落柯打時可用積分抵扣車資，例如 1 積分 = HK$1 則車資總價減 $1。預設 1。
      </Typography.Paragraph>
      <InputNumber
        min={0}
        step={1}
        precision={0}
        style={{ width: 200, display: 'block', marginTop: 8 }}
        value={hkdPerPoint}
        onChange={(v) => setHkdPerPoint(typeof v === 'number' ? v : 0)}
      />
      <Button
        type="primary"
        style={{ marginTop: 16 }}
        loading={loading}
        onClick={async () => {
          setLoading(true);
          try {
            const whole = Math.max(0, Math.round(rate));
            const hkd = Math.max(0, Math.round(hkdPerPoint));
            await Promise.all([
              api.put(`/admin/settings/${SETTING_KEY}`, { value: String(whole) }),
              api.put(`/admin/settings/${HKD_PER_POINT_KEY}`, { value: String(hkd) }),
              api.put(`/admin/settings/${REDEEM_ENABLED_KEY}`, {
                value: redeemEnabled ? '1' : '0',
              }),
            ]);
            setRate(whole);
            setHkdPerPoint(hkd);
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
