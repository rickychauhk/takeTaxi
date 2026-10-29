import { Button, Card, Select, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import {
  PASSENGER_NEARBY_DRIVERS_RADIUS_KM_OPTIONS,
  PASSENGER_NEARBY_DRIVERS_RADIUS_KM_SETTING_KEY,
  parsePassengerNearbyDriversRadiusKm,
  type PassengerNearbyDriversRadiusKm,
} from '@taxima/shared';
import { api } from '../../api/client';

export default function SettingsPassengerNearbyDriversPage() {
  const [radiusKm, setRadiusKm] = useState<PassengerNearbyDriversRadiusKm>(2);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await api.get(`/admin/settings/${PASSENGER_NEARBY_DRIVERS_RADIUS_KM_SETTING_KEY}`);
      setRadiusKm(parsePassengerNearbyDriversRadiusKm(data.settingValue));
    })();
  }, []);

  return (
    <Card>
      <Typography.Title level={4}>乘客 App · 附近司機顯示範圍</Typography.Title>
      <Typography.Paragraph type="secondary">
        乘客叫車地圖上顯示在線司機的搜尋半徑（以上車點為中心）。只會顯示近期有上報 GPS 的司機。
      </Typography.Paragraph>
      <Typography.Text>半徑（公里）</Typography.Text>
      <Select<PassengerNearbyDriversRadiusKm>
        style={{ width: 200, display: 'block', marginTop: 8 }}
        value={radiusKm}
        onChange={setRadiusKm}
        options={PASSENGER_NEARBY_DRIVERS_RADIUS_KM_OPTIONS.map((km) => ({
          value: km,
          label: `${km} KM`,
        }))}
      />
      <Button
        type="primary"
        style={{ marginTop: 16 }}
        loading={loading}
        onClick={async () => {
          setLoading(true);
          try {
            await api.put(`/admin/settings/${PASSENGER_NEARBY_DRIVERS_RADIUS_KM_SETTING_KEY}`, {
              value: String(radiusKm),
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
