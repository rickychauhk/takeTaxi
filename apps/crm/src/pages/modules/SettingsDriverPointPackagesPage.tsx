import { Button, Card, Input, InputNumber, Space, Switch, Table, Typography, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';

const INSTRUCTIONS_KEY = 'driver_points_topup_instructions';
const PAYMENT_METHODS_KEY = 'driver_points_topup_payment_methods';

type PaymentMethod = { id: string; title: string; detail: string };

function slugId(title: string, existing: Set<string>): string {
  const base =
    title
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_\u4e00-\u9fff-]/g, '')
      .slice(0, 32) || 'method';
  let id = base;
  let n = 2;
  while (existing.has(id)) {
    id = `${base}_${n}`;
    n += 1;
  }
  return id;
}

type Pkg = {
  id: string;
  points: number;
  priceHkd: string;
  label: string | null;
  sortOrder: number;
  isActive: boolean;
};

export default function SettingsDriverPointPackagesPage() {
  const [rows, setRows] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [instructions, setInstructions] = useState('');
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [savingPaymentMethods, setSavingPaymentMethods] = useState(false);
  const [payDraft, setPayDraft] = useState<(Partial<PaymentMethod> & { id?: string }) | null>(null);
  const [draft, setDraft] = useState<(Partial<Pkg> & { id?: string }) | null>(null);

  const persistPaymentMethods = useCallback(async (list: PaymentMethod[]) => {
    setSavingPaymentMethods(true);
    try {
      await api.put(`/admin/settings/${PAYMENT_METHODS_KEY}`, {
        value: JSON.stringify(list),
      });
      message.success('已儲存付款方式');
    } finally {
      setSavingPaymentMethods(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pkgRes, instRes, payRes] = await Promise.all([
        api.get<Pkg[]>('/admin/driver-point-packages'),
        api.get<{ settingValue?: string }>(`/admin/settings/${INSTRUCTIONS_KEY}`),
        api.get<{ settingValue?: string }>(`/admin/settings/${PAYMENT_METHODS_KEY}`),
      ]);
      setRows(pkgRes.data);
      setInstructions(instRes.data.settingValue ?? '');
      try {
        const parsed = JSON.parse(payRes.data.settingValue || '[]') as PaymentMethod[];
        setPaymentMethods(Array.isArray(parsed) ? parsed : []);
      } catch {
        setPaymentMethods([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <Typography.Title level={4}>司機積分充值套餐</Typography.Title>
      <Typography.Paragraph type="secondary">
        司機 App「購買積分」頁會列出套餐、付款方式（FPS、銀行入數等）及上傳憑證。批核請到「積分購買審批」。
      </Typography.Paragraph>

      <Typography.Title level={5}>付款方式（司機 App 內選擇）</Typography.Title>
      <Typography.Paragraph type="secondary">
        每項包含顯示名稱與付款指示（户口、FPS 電話等）。司機選中後會看到該段文字。
      </Typography.Paragraph>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={() => setPayDraft({ title: '', detail: '' })}>
          新增付款方式
        </Button>
        <Button
          loading={savingPaymentMethods}
          onClick={() => void persistPaymentMethods(paymentMethods)}
        >
          儲存付款方式清單
        </Button>
      </Space>
      {payDraft ? (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input
              placeholder="顯示名稱，例：FPS 轉數快"
              value={payDraft.title ?? ''}
              onChange={(e) => setPayDraft((d) => ({ ...d!, title: e.target.value }))}
            />
            <Input.TextArea
              rows={3}
              placeholder="付款指示（户口號碼、收款人、備註要求等）"
              value={payDraft.detail ?? ''}
              onChange={(e) => setPayDraft((d) => ({ ...d!, detail: e.target.value }))}
            />
            <Space>
              <Button
                type="primary"
                onClick={() => {
                  const title = payDraft.title?.trim() ?? '';
                  if (!title) {
                    message.error('請填寫名稱');
                    return;
                  }
                  const ids = new Set(paymentMethods.map((m) => m.id));
                  if (payDraft.id) ids.delete(payDraft.id);
                  const id = payDraft.id ?? slugId(title, ids);
                  const next: PaymentMethod = {
                    id,
                    title,
                    detail: payDraft.detail?.trim() ?? '',
                  };
                  const idx = paymentMethods.findIndex((m) => m.id === id);
                  const nextList =
                    idx >= 0
                      ? paymentMethods.map((m, i) => (i === idx ? next : m))
                      : [...paymentMethods, next];
                  setPaymentMethods(nextList);
                  setPayDraft(null);
                  void persistPaymentMethods(nextList);
                }}
              >
                加入清單
              </Button>
              <Button onClick={() => setPayDraft(null)}>取消</Button>
            </Space>
          </Space>
        </Card>
      ) : null}
      <Table
        rowKey="id"
        size="small"
        pagination={false}
        style={{ marginBottom: 24 }}
        dataSource={paymentMethods}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 120 },
          { title: '名稱', dataIndex: 'title', width: 140 },
          { title: '付款指示', dataIndex: 'detail', ellipsis: true },
          {
            title: '操作',
            width: 140,
            render: (_, row) => (
              <Space>
                <Button size="small" onClick={() => setPayDraft({ ...row })}>
                  編輯
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => {
                    const nextList = paymentMethods.filter((m) => m.id !== row.id);
                    setPaymentMethods(nextList);
                    void persistPaymentMethods(nextList);
                  }}
                >
                  刪除
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Typography.Title level={5}>補充說明（顯示於司機 App 套餐下方）</Typography.Title>
      <Input.TextArea
        rows={4}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        placeholder="例：請轉帳至 HSBC 123-456789-001，備註填司機電話。"
      />
      <Button
        type="primary"
        style={{ marginTop: 8, marginBottom: 24 }}
        loading={savingInstructions}
        onClick={async () => {
          setSavingInstructions(true);
          try {
            await api.put(`/admin/settings/${INSTRUCTIONS_KEY}`, { value: instructions });
            message.success('已儲存轉帳說明');
          } finally {
            setSavingInstructions(false);
          }
        }}
      >
        儲存轉帳說明
      </Button>

      <Space style={{ marginBottom: 12 }}>
        <Button
          type="primary"
          onClick={() =>
            setDraft({
              points: 100,
              priceHkd: '100',
              label: '',
              sortOrder: (rows.at(-1)?.sortOrder ?? 0) + 10,
              isActive: true,
            })
          }
        >
          新增套餐
        </Button>
      </Space>

      {draft ? (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space wrap>
            <InputNumber
              min={1}
              addonBefore="積分"
              value={draft.points}
              onChange={(v) => setDraft((d) => ({ ...d!, points: typeof v === 'number' ? v : 1 }))}
            />
            <InputNumber
              min={0}
              step={1}
              addonBefore="HK$"
              value={Number(draft.priceHkd ?? 0)}
              onChange={(v) =>
                setDraft((d) => ({ ...d!, priceHkd: String(typeof v === 'number' ? v : 0) }))
              }
            />
            <Input
              placeholder="顯示名稱（選填）"
              value={draft.label ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d!, label: e.target.value }))}
              style={{ width: 180 }}
            />
            <InputNumber
              addonBefore="排序"
              value={draft.sortOrder ?? 0}
              onChange={(v) => setDraft((d) => ({ ...d!, sortOrder: typeof v === 'number' ? v : 0 }))}
            />
            <Switch
              checked={draft.isActive !== false}
              onChange={(c) => setDraft((d) => ({ ...d!, isActive: c }))}
              checkedChildren="上架"
              unCheckedChildren="下架"
            />
            <Button
              type="primary"
              onClick={async () => {
                const body = {
                  points: draft.points!,
                  priceHkd: Number(draft.priceHkd),
                  label: draft.label || undefined,
                  sortOrder: draft.sortOrder ?? 0,
                  isActive: draft.isActive !== false,
                };
                if (draft.id) {
                  await api.put(`/admin/driver-point-packages/${draft.id}`, body);
                  message.success('已更新');
                } else {
                  await api.post('/admin/driver-point-packages', body);
                  message.success('已新增');
                }
                setDraft(null);
                load();
              }}
            >
              儲存
            </Button>
            <Button onClick={() => setDraft(null)}>取消</Button>
          </Space>
        </Card>
      ) : null}

      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={[
          { title: '積分', dataIndex: 'points' },
          { title: '價格 (HKD)', dataIndex: 'priceHkd' },
          { title: '名稱', dataIndex: 'label', render: (v: string | null) => v || '—' },
          { title: '排序', dataIndex: 'sortOrder' },
          {
            title: '狀態',
            dataIndex: 'isActive',
            render: (v: boolean) => (v ? '上架' : '下架'),
          },
          {
            title: '操作',
            render: (_, row) => (
              <Button
                size="small"
                onClick={() =>
                  setDraft({
                    id: row.id,
                    points: row.points,
                    priceHkd: row.priceHkd,
                    label: row.label,
                    sortOrder: row.sortOrder,
                    isActive: row.isActive,
                  })
                }
              >
                編輯
              </Button>
            ),
          },
        ]}
      />
    </Card>
  );
}
