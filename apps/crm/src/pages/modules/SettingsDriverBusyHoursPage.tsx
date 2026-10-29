import { Button, Card, InputNumber, Select, Space, Switch, TimePicker, Typography, message } from 'antd';
import {
  HK_AREA_OPTIONS,
  WEEKDAY_LABELS_ZH,
  emptyDriverBusyHoursConfig,
  emptyDriverBusyRegionRewardsConfig,
  parseDriverBusyHoursConfig,
  parseDriverBusyRegionRewardsConfig,
  serializeDriverBusyHoursConfig,
  serializeDriverBusyRegionRewardsConfig,
  type BusyTimeSlot,
  type DriverBusyHoursConfig,
  type DriverBusyRegionRewardRule,
  type DriverBusyRegionRewardsConfig,
  type WeekdayKey,
} from '@taxima/shared';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';

const BASE_KEY = 'driver_points_per_order';
const EXTRA_KEY = 'driver_busy_extra_points_per_order';
const HOURS_KEY = 'driver_busy_hours_json';
const REGION_REWARDS_KEY = 'driver_busy_region_rewards_json';

const WEEKDAY_ORDER: WeekdayKey[] = ['1', '2', '3', '4', '5', '6', '7'];

function slotToRange(slot: BusyTimeSlot): [Dayjs, Dayjs] {
  return [dayjs(slot.start, 'HH:mm'), dayjs(slot.end, 'HH:mm')];
}

function rangeToSlot(range: [Dayjs, Dayjs] | null): BusyTimeSlot | null {
  if (!range?.[0]?.isValid() || !range[1]?.isValid()) return null;
  const start = range[0].format('HH:mm');
  const end = range[1].format('HH:mm');
  if (range[0].hour() * 60 + range[0].minute() >= range[1].hour() * 60 + range[1].minute()) {
    return null;
  }
  return { start, end };
}

function newRuleId() {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function SettingsDriverBusyHoursPage() {
  const [basePoints, setBasePoints] = useState(0);
  const [busyExtra, setBusyExtra] = useState(0);
  const [config, setConfig] = useState<DriverBusyHoursConfig>(() => emptyDriverBusyHoursConfig());
  const [regionConfig, setRegionConfig] = useState<DriverBusyRegionRewardsConfig>(() =>
    emptyDriverBusyRegionRewardsConfig(),
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const [baseRes, extraRes, hoursRes, regionRes] = await Promise.all([
        api.get(`/admin/settings/${BASE_KEY}`),
        api.get(`/admin/settings/${EXTRA_KEY}`),
        api.get(`/admin/settings/${HOURS_KEY}`),
        api.get(`/admin/settings/${REGION_REWARDS_KEY}`),
      ]);
      const b = Number(baseRes.data.settingValue ?? 0);
      setBasePoints(Number.isFinite(b) && b >= 0 ? Math.round(b) : 0);
      const e = Number(extraRes.data.settingValue ?? 0);
      setBusyExtra(Number.isFinite(e) && e >= 0 ? Math.round(e) : 0);
      setConfig(parseDriverBusyHoursConfig(hoursRes.data.settingValue));
      setRegionConfig(parseDriverBusyRegionRewardsConfig(regionRes.data.settingValue));
    })();
  }, []);

  const updateDaySlots = (day: WeekdayKey, slots: BusyTimeSlot[]) => {
    setConfig((prev) => ({
      ...prev,
      weekdays: { ...prev.weekdays, [day]: slots },
    }));
  };

  const addSlot = (day: WeekdayKey) => {
    const slots = [...(config.weekdays[day] ?? []), { start: '07:00', end: '09:00' }];
    updateDaySlots(day, slots);
  };

  const removeSlot = (day: WeekdayKey, index: number) => {
    const slots = [...(config.weekdays[day] ?? [])];
    slots.splice(index, 1);
    updateDaySlots(day, slots);
  };

  const updateRegionRule = (id: string, patch: Partial<DriverBusyRegionRewardRule>) => {
    setRegionConfig((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const addRegionRule = () => {
    setRegionConfig((prev) => ({
      ...prev,
      rules: [
        ...prev.rules,
        {
          id: newRuleId(),
          fromArea: HK_AREA_OPTIONS[0]?.value ?? '尖沙咀',
          toArea: HK_AREA_OPTIONS[1]?.value ?? '荃灣',
          rewardPoints: 3,
        },
      ],
    }));
  };

  const removeRegionRule = (id: string) => {
    setRegionConfig((prev) => ({
      ...prev,
      rules: prev.rules.filter((r) => r.id !== id),
    }));
  };

  const save = async () => {
    setLoading(true);
    try {
      const normalized = parseDriverBusyHoursConfig(serializeDriverBusyHoursConfig(config));
      const normalizedRegion = parseDriverBusyRegionRewardsConfig(
        serializeDriverBusyRegionRewardsConfig(regionConfig),
      );
      const base = Math.max(0, Math.round(basePoints));
      const extra = Math.max(0, Math.round(busyExtra));
      await Promise.all([
        api.put(`/admin/settings/${BASE_KEY}`, { value: String(base) }),
        api.put(`/admin/settings/${EXTRA_KEY}`, { value: String(extra) }),
        api.put(`/admin/settings/${HOURS_KEY}`, { value: serializeDriverBusyHoursConfig(normalized) }),
        api.put(`/admin/settings/${REGION_REWARDS_KEY}`, {
          value: serializeDriverBusyRegionRewardsConfig(normalizedRegion),
        }),
      ]);
      setBasePoints(base);
      setBusyExtra(extra);
      setConfig(normalized);
      setRegionConfig(normalizedRegion);
      message.success('已更新');
    } finally {
      setLoading(false);
    }
  };

  const areaSelectOptions = HK_AREA_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

  return (
    <Card>
      <Typography.Title level={4}>司機繁忙時段與接單積分</Typography.Title>
      <Typography.Paragraph type="secondary">
        以下設定<strong>只適用乘客 App 落嘅柯打</strong>。落單時間以<strong>伺服器香港時間（HKT）</strong>
        為準。司機接單時扣減<strong>基本每柯打積分</strong>；繁忙時段另發<strong>繁忙時段獎賞積分</strong>；符合地區配對再另發地區獎賞。
        <strong>司機出貨柯打</strong>唔套用本頁規則，接單司機所得積分以出貨時<strong>貨主設定的懸賞</strong>為準（完成行程後發放）。
      </Typography.Paragraph>

      <Typography.Text>基本每柯打積分（司機接單）</Typography.Text>
      <InputNumber
        min={0}
        step={1}
        precision={0}
        style={{ width: 200, display: 'block', marginTop: 8, marginBottom: 16 }}
        value={basePoints}
        onChange={(v) => setBasePoints(typeof v === 'number' ? v : 0)}
      />

      <Typography.Text>繁忙時段獎賞積分（平台發放）</Typography.Text>
      <InputNumber
        min={0}
        step={1}
        precision={0}
        style={{ width: 200, display: 'block', marginTop: 8, marginBottom: 16 }}
        value={busyExtra}
        onChange={(v) => setBusyExtra(typeof v === 'number' ? v : 0)}
      />

      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Switch
          checked={config.enabled}
          onChange={(checked) => setConfig((c) => ({ ...c, enabled: checked }))}
        />
        <Typography.Text>啟用繁忙時段獎賞</Typography.Text>
      </div>

      {WEEKDAY_ORDER.map((day) => (
        <Card
          key={day}
          size="small"
          title={WEEKDAY_LABELS_ZH[day]}
          style={{ marginBottom: 12 }}
          extra={
            <Button size="small" onClick={() => addSlot(day)}>
              新增時段
            </Button>
          }
        >
          {(config.weekdays[day] ?? []).length === 0 ? (
            <Typography.Text type="secondary">未設定繁忙時段</Typography.Text>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }}>
              {(config.weekdays[day] ?? []).map((slot, idx) => (
                <Space key={`${day}-${idx}`} wrap>
                  <TimePicker.RangePicker
                    format="HH:mm"
                    value={slotToRange(slot)}
                    onChange={(range) => {
                      const next = rangeToSlot(range as [Dayjs, Dayjs] | null);
                      if (!next) {
                        message.warning('結束時間必須晚於開始時間');
                        return;
                      }
                      const slots = [...(config.weekdays[day] ?? [])];
                      slots[idx] = next;
                      updateDaySlots(day, slots);
                    }}
                  />
                  <Button size="small" danger onClick={() => removeSlot(day, idx)}>
                    移除
                  </Button>
                </Space>
              ))}
            </Space>
          )}
        </Card>
      ))}

      <Typography.Title level={5} style={{ marginTop: 24 }}>
        繁忙時段地區配對獎賞
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        落單時間在<strong>上述繁忙時段</strong>內，且上車／落車地址分別符合所選「起點地區 →
        終點地區」時，司機<strong>接單成功</strong>後會獲得該組設定的獎賞積分（寫入司機積分結餘）。
        每組路線需獨立設定獎賞分數；方向相反視為不同組合。
        <br />
        油尖旺、尖沙咀、旺角、油麻地、佐敦（含英文如 Tsim Sha Tsui）視為<strong>同一分區</strong>
        ，例如設定「尖沙咀 → 尖沙咀」時，上車旺角、落車尖沙咀亦會配對。
      </Typography.Paragraph>

      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Switch
          checked={regionConfig.enabled}
          onChange={(checked) => setRegionConfig((c) => ({ ...c, enabled: checked }))}
        />
        <Typography.Text>啟用地區配對獎賞</Typography.Text>
        <Button size="small" onClick={addRegionRule}>
          新增地區組合
        </Button>
      </div>

      {regionConfig.rules.length === 0 ? (
        <Typography.Text type="secondary">尚未設定地區配對獎賞</Typography.Text>
      ) : (
        <Space direction="vertical" style={{ width: '100%', marginBottom: 24 }}>
          {regionConfig.rules.map((rule) => (
            <Card key={rule.id} size="small">
              <Space wrap align="center">
                <Typography.Text>起點</Typography.Text>
                <Select
                  showSearch
                  optionFilterProp="label"
                  style={{ width: 160 }}
                  value={rule.fromArea}
                  options={areaSelectOptions}
                  onChange={(v) => updateRegionRule(rule.id, { fromArea: v })}
                />
                <Typography.Text>→ 終點</Typography.Text>
                <Select
                  showSearch
                  optionFilterProp="label"
                  style={{ width: 160 }}
                  value={rule.toArea}
                  options={areaSelectOptions}
                  onChange={(v) => updateRegionRule(rule.id, { toArea: v })}
                />
                <Typography.Text>獎賞積分</Typography.Text>
                <InputNumber
                  min={1}
                  precision={0}
                  value={rule.rewardPoints}
                  onChange={(v) =>
                    updateRegionRule(rule.id, { rewardPoints: Math.max(1, Math.round(Number(v ?? 1))) })
                  }
                />
                <Button size="small" danger onClick={() => removeRegionRule(rule.id)}>
                  移除
                </Button>
              </Space>
            </Card>
          ))}
        </Space>
      )}

      <Button type="primary" loading={loading} onClick={() => void save()}>
        儲存
      </Button>
    </Card>
  );
}
