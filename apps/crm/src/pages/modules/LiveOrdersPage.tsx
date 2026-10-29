import {
  Badge,
  Button,
  Card,
  Form,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { Paginated } from '@taxima/shared';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import {
  connectAdminOrdersSocket,
  disconnectAdminOrdersSocket,
  type LiveOrderRow,
} from '../../realtime/adminOrdersSocket';
import { labelOrderStatus } from '../../i18n/crmLabels';

const statusColor: Record<string, string> = {
  pending: 'default',
  matching: 'processing',
  accepted: 'blue',
  en_route: 'cyan',
  in_trip: 'green',
  completed: 'success',
  cancelled: 'error',
};

type DriverOption = {
  id: string;
  displayName: string | null;
  phone: string;
  vehiclePlate?: string | null;
  driverTier?: string;
  verificationStatus?: string;
};

export default function LiveOrdersPage() {
  const [rows, setRows] = useState<LiveOrderRow[]>([]);
  const [connected, setConnected] = useState(false);
  const [acceptOrder, setAcceptOrder] = useState<LiveOrderRow | null>(null);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [form] = Form.useForm<{ driverId: string }>();
  const [socketGeneration, setSocketGeneration] = useState(0);

  useEffect(() => {
    connectAdminOrdersSocket({
      onSnapshot: setRows,
      onEvent: (payload) => {
        if (payload.type === 'removed') {
          setRows((prev) => prev.filter((r) => r.orderId !== payload.orderId));
          return;
        }
        const { type, order } = payload;
        if (order.status !== 'pending' && order.status !== 'matching') {
          setRows((prev) => prev.filter((r) => r.orderId !== order.orderId));
          return;
        }
        setRows((prev) => {
          const idx = prev.findIndex((r) => r.orderId === order.orderId);
          if (type === 'created' && idx < 0) return [order, ...prev];
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = order;
            return next;
          }
          return [order, ...prev];
        });
      },
      onConnectionChange: setConnected,
    });
    return () => disconnectAdminOrdersSocket();
  }, [socketGeneration]);

  const cancelLiveOrder = async (orderId: string) => {
    await api.patch(`/admin/orders/${orderId}/status`, { status: 'cancelled' });
    message.success(`柯打 #${orderId} 已取消`);
    setRows((prev) => prev.filter((r) => r.orderId !== orderId));
  };

  const loadDrivers = useCallback(async () => {
    setDriversLoading(true);
    try {
      const { data } = await api.get<Paginated<DriverOption>>('/admin/drivers', {
        params: { pageSize: 100 },
      });
      const list = (data.items ?? []).filter(
        (d) => d.driverTier !== 'admin' && d.verificationStatus === 'approved',
      );
      setDrivers(list);
      if (list[0]?.id) form.setFieldsValue({ driverId: list[0].id });
    } catch {
      setDrivers([]);
    } finally {
      setDriversLoading(false);
    }
  }, [form]);

  const openAccept = (row: LiveOrderRow) => {
    setAcceptOrder(row);
    form.resetFields();
    void loadDrivers();
  };

  const submitAccept = async () => {
    if (!acceptOrder) return;
    const v = await form.validateFields();
    setAccepting(true);
    try {
      await api.patch(`/admin/orders/${acceptOrder.orderId}/accept`, {
        driverId: v.driverId,
      });
      message.success('已接單（示範定位已設於上車點附近）');
      setAcceptOrder(null);
    } catch {
      /* interceptor shows error */
    } finally {
      setAccepting(false);
    }
  };

  return (
    <Card>
      <Space style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          即時柯打
        </Typography.Title>
        <Badge status={connected ? 'success' : 'error'} text={connected ? '即時連線已建立' : '連線中…'} />
        <Button onClick={() => setSocketGeneration((g) => g + 1)}>重新整理列表</Button>
      </Space>
      <Typography.Paragraph type="secondary">
        只顯示乘客 App 落嘅待派柯打（含上車／目的地）；示範種子單與後台手動建單已排除。管理員仍可代接並指派司機（測試環境會模擬司機定位於上車點附近）。
      </Typography.Paragraph>
      <Table<LiveOrderRow>
        rowKey="orderId"
        dataSource={rows}
        scroll={{ x: 1380 }}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: '暫無待派柯打 — 請用乘客 App 落單' }}
        columns={[
          { title: '柯打 #', dataIndex: 'orderId', width: 100 },
          {
            title: '狀態',
            dataIndex: 'status',
            width: 110,
            render: (s: string) => (
              <Tag color={statusColor[s] ?? 'default'}>{labelOrderStatus(s)}</Tag>
            ),
          },
          { title: '時間 (HK)', dataIndex: 'placedAtHk', width: 160 },
          {
            title: '乘客',
            width: 120,
            render: (_, r) => r.passengerName ?? (r.passengerId ? `#${r.passengerId}` : '—'),
          },
          {
            title: '起點',
            dataIndex: 'pickupAddress',
            width: 220,
            render: (v: string | null) => (
              <Typography.Text style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{v ?? '—'}</Typography.Text>
            ),
          },
          {
            title: '終點',
            dataIndex: 'dropoffAddress',
            width: 220,
            render: (v: string | null) => (
              <Typography.Text style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{v ?? '—'}</Typography.Text>
            ),
          },
          {
            title: '叫車選項',
            dataIndex: 'bookingOptionLines',
            width: 240,
            render: (lines: string[] | undefined) =>
              lines?.length ? (
                <Space direction="vertical" size={2}>
                  {lines.map((line) => (
                    <Tag key={line} style={{ whiteSpace: 'normal', height: 'auto', margin: 0 }}>
                      {line}
                    </Tag>
                  ))}
                </Space>
              ) : (
                '—'
              ),
          },
          { title: '估價', dataIndex: 'fareEstimate', width: 80 },
          {
            title: '接單積分',
            width: 96,
            render: (_, r) => {
              const cost = r.driverPointsCostAtOrder;
              const busy = r.driverPointsBusySurcharge;
              if (cost == null && (busy == null || busy <= 0)) return '—';
              const parts: string[] = [];
              if (cost != null && cost > 0) parts.push(`扣${cost}`);
              if (busy != null && busy > 0) parts.push(`獎+${busy}`);
              return parts.length ? parts.join(' · ') : '0';
            },
          },
          {
            title: '操作',
            fixed: 'right',
            width: 200,
            render: (_, row) => (
              <Space size="small">
                <Button type="primary" size="small" onClick={() => openAccept(row)}>
                  代接單
                </Button>
                <Popconfirm
                  title="取消此柯打？"
                  description="乘客 App 已取消但列表未更新時，或需強制關閉時使用。"
                  onConfirm={() => void cancelLiveOrder(row.orderId)}
                >
                  <Button size="small" danger>
                    取消
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={acceptOrder ? `代接柯打 #${acceptOrder.orderId}` : '接單'}
        open={!!acceptOrder}
        onCancel={() => setAcceptOrder(null)}
        onOk={() => void submitAccept()}
        confirmLoading={accepting}
        okText="確認接單"
        cancelText="取消"
      >
        <Typography.Paragraph type="secondary">
          會將柯打設為「已接單」，並把所選司機嘅定位設喺上車點附近（示範模式）。
        </Typography.Paragraph>
        <Form form={form} layout="vertical">
          <Form.Item
            name="driverId"
            label="指派司機"
            rules={[{ required: true, message: '請選擇司機' }]}
          >
            <Select
              loading={driversLoading}
              placeholder="選擇已審批司機"
              options={drivers.map((d) => ({
                value: d.id,
                label: `${d.displayName ?? '司機'} · ${d.vehiclePlate ?? '無車牌'} · ${d.phone}`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
