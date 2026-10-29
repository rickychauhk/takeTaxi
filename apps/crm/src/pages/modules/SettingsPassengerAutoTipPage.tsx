import { Button, Card, InputNumber, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import {
  defaultPassengerAutoTipHkdPublic,
  type PassengerAutoTipHkdPublic,
} from '@taxima/shared';
import { api } from '../../api/client';

const FIELD_LABELS: Record<keyof PassengerAutoTipHkdPublic, string> = {
  wheelchairTipHkd: '輪椅',
  safeDrivingTipHkd: '安全駕駛',
  fiveSeatTipHkd: '五人車（更多選項 · 5座）',
  sixSeatTipHkd: '六人車（確認叫車頁 6座 或 更多選項 · 6座）',
  largeLuggageTipHkd: '多行李／大尾箱（更多選項 · 大尾箱）',
};

const KEY_BY_FIELD: Record<keyof PassengerAutoTipHkdPublic, string> = {
  wheelchairTipHkd: 'passenger_tip_hkd_wheelchair',
  safeDrivingTipHkd: 'passenger_tip_hkd_safe_driving',
  fiveSeatTipHkd: 'passenger_tip_hkd_five_seat',
  sixSeatTipHkd: 'passenger_tip_hkd_six_seat',
  largeLuggageTipHkd: 'passenger_tip_hkd_large_luggage',
};

const DEFAULT_BY_FIELD = defaultPassengerAutoTipHkdPublic();

function parseStored(raw: unknown, fallback: number): number {
  const n = Math.round(Number(String(raw ?? '').trim()));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

export default function SettingsPassengerAutoTipPage() {
  const [values, setValues] = useState<PassengerAutoTipHkdPublic>(() => DEFAULT_BY_FIELD);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const entries = await Promise.all(
          (Object.keys(KEY_BY_FIELD) as (keyof PassengerAutoTipHkdPublic)[]).map(async (field) => {
            const key = KEY_BY_FIELD[field];
            const { data } = await api.get<{ settingValue: string }>(`/admin/settings/${key}`);
            return [field, parseStored(data.settingValue, DEFAULT_BY_FIELD[field])] as const;
          }),
        );
        setValues(Object.fromEntries(entries) as PassengerAutoTipHkdPublic);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const next = { ...values };
      for (const field of Object.keys(KEY_BY_FIELD) as (keyof PassengerAutoTipHkdPublic)[]) {
        next[field] = Math.max(0, Math.round(next[field]));
      }
      await Promise.all(
        (Object.keys(KEY_BY_FIELD) as (keyof PassengerAutoTipHkdPublic)[]).map((field) =>
          api.put(`/admin/settings/${KEY_BY_FIELD[field]}`, { value: String(next[field]) }),
        ),
      );
      setValues(next);
      message.success('已儲存');
    } catch {
      message.error('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card loading={loading}>
      <Typography.Title level={4}>乘客自動貼士</Typography.Title>
      <Typography.Paragraph type="secondary">
        乘客勾選下列需求時，確認叫車頁會自動顯示貼士並套用對應金額。若同時符合多項，以<strong>最高</strong>
        金額為準。預設每項 $10（可在下方修改）。
      </Typography.Paragraph>

      {(Object.keys(FIELD_LABELS) as (keyof PassengerAutoTipHkdPublic)[]).map((field) => (
        <div key={field} style={{ marginBottom: 16 }}>
          <Typography.Text>{FIELD_LABELS[field]} (HKD)</Typography.Text>
          <InputNumber
            min={0}
            max={9999}
            step={1}
            precision={0}
            style={{ width: 200, display: 'block', marginTop: 8 }}
            value={values[field]}
            onChange={(v) => setValues((prev) => ({ ...prev, [field]: typeof v === 'number' ? v : 0 }))}
          />
        </div>
      ))}

      <Button type="primary" loading={saving} onClick={save}>
        儲存
      </Button>
    </Card>
  );
}
