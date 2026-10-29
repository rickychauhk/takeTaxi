import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Typography,
  message,
} from 'antd';
import type { Paginated } from '@taxima/shared';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { antdHongKongPhoneRules, antdHongKongPhoneRulesOptional } from '../../firebase/phone';
import ListPager from '../../components/ListPager';

type PassengerRow = {
  id: string;
  displayName: string | null;
  phone?: string | null;
  email?: string | null;
  pointsBalance?: string | number;
};

export default function PassengersPage() {
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState<PassengerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PassengerRow | null>(null);
  const [form] = Form.useForm();
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerPassenger, setLedgerPassenger] = useState<PassengerRow | null>(null);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerBalance, setLedgerBalance] = useState(0);
  const [ledgerRows, setLedgerRows] = useState<
    {
      id: string;
      deltaPoints: number;
      balanceAfter: number;
      reason: string;
      refType: string | null;
      refId: string | null;
      createdAtHk: string | null;
    }[]
  >([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Paginated<PassengerRow>>('/admin/passengers', {
        params: { q: searchQuery || undefined, page, pageSize: 10 },
      });
      setRows(data.items ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (row: PassengerRow) => {
    setEditing(row);
    form.setFieldsValue({
      displayName: row.displayName,
      phone: row.phone ?? '',
    });
    setModalOpen(true);
  };

  const openLedger = async (row: PassengerRow) => {
    setLedgerPassenger(row);
    setLedgerPage(1);
    setLedgerOpen(true);
    await loadLedger(row.id, 1);
  };

  const loadLedger = async (passengerId: string, page: number) => {
    setLedgerLoading(true);
    try {
      const { data } = await api.get<{
        passenger: { pointsBalance: number };
        items: typeof ledgerRows;
        total: number;
        totalPages: number;
      }>(`/admin/passengers/${passengerId}/point-ledger`, { params: { page, pageSize: 10 } });
      setLedgerBalance(data.passenger?.pointsBalance ?? 0);
      setLedgerRows(data.items ?? []);
      setLedgerTotal(data.total ?? 0);
      setLedgerTotalPages(data.totalPages ?? 1);
    } catch {
      setLedgerRows([]);
      setLedgerTotal(0);
      setLedgerTotalPages(1);
    } finally {
      setLedgerLoading(false);
    }
  };

  const formatPoints = (v: string | number | undefined) => {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? String(Math.round(n)) : '0';
  };

  return (
    <Card>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>
          乘客
        </Typography.Title>
        <Button type="primary" onClick={openCreate}>
          新增乘客
        </Button>
      </Space>

      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder="以 ID、姓名或電話搜尋"
          style={{ width: 220 }}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onSearch={(v) => {
            setSearchQuery(v.trim());
            setPage(1);
          }}
        />
        <Button onClick={load}>重新整理</Button>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={false}
        columns={[
          { title: '編號', dataIndex: 'id', width: 72 },
          { title: '姓名', dataIndex: 'displayName', render: (v: string | null) => v ?? '—' },
          { title: '電話', dataIndex: 'phone', width: 140, render: (v: string | null) => v ?? '—' },
          { title: '電郵', dataIndex: 'email' },
          {
            title: '積分',
            dataIndex: 'pointsBalance',
            width: 88,
            render: (v: string | number | undefined) => formatPoints(v),
          },
          {
            title: '操作',
            width: 220,
            render: (_, r) => (
              <Space size="small">
                <Button size="small" onClick={() => void openLedger(r)}>
                  積分明細
                </Button>
                <Button size="small" onClick={() => openEdit(r)}>
                  修改
                </Button>
                <Popconfirm
                  title="確定移除該乘客？"
                  onConfirm={async () => {
                    await api.delete(`/admin/passengers/${r.id}`);
                    message.success('已移除');
                    load();
                  }}
                >
                  <Button size="small" danger>
                    移除
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <ListPager page={page} totalPages={totalPages} total={total} onChange={setPage} />

      <Modal
        title={editing ? '修改乘客' : '新增乘客'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={async () => {
          const v = await form.validateFields();
          if (editing) {
            await api.put(`/admin/passengers/${editing.id}`, {
              displayName: v.displayName,
              phone: v.phone?.trim() || null,
            });
            message.success('已更新');
          } else {
            await api.post('/admin/passengers', {
              displayName: v.displayName,
              phone: v.phone?.trim() || undefined,
            });
            message.success('已新增');
          }
          setModalOpen(false);
          load();
        }}
        width={480}
      >
        <Form form={form} layout="vertical">
          {editing ? (
            <Form.Item label="積分結餘">
              <Input readOnly value={formatPoints(editing.pointsBalance)} />
            </Form.Item>
          ) : null}
          <Form.Item name="displayName" label="姓名">
            <Input />
          </Form.Item>
          <Form.Item
            name="phone"
            label="電話"
            rules={editing ? [...antdHongKongPhoneRulesOptional()] : [...antdHongKongPhoneRules()]}
          >
            <Input placeholder="例如 91234567 或 +85291234567" inputMode="tel" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          ledgerPassenger
            ? `積分明細 · ${ledgerPassenger.displayName ?? '—'} (#${ledgerPassenger.id})`
            : '積分明細'
        }
        open={ledgerOpen}
        onCancel={() => setLedgerOpen(false)}
        footer={null}
        width={720}
      >
        <Typography.Paragraph style={{ marginBottom: 12 }}>
          目前結餘：<Typography.Text strong>{formatPoints(ledgerBalance)}</Typography.Text> 積分
        </Typography.Paragraph>
        <Table
          rowKey="id"
          size="small"
          loading={ledgerLoading}
          dataSource={ledgerRows}
          pagination={false}
          columns={[
            { title: '時間 (HK)', dataIndex: 'createdAtHk', width: 168 },
            {
              title: '變動',
              dataIndex: 'deltaPoints',
              width: 72,
              render: (v: number) => (v > 0 ? `+${v}` : String(v)),
            },
            { title: '結餘', dataIndex: 'balanceAfter', width: 72 },
            { title: '原因', dataIndex: 'reason' },
            {
              title: '關聯',
              width: 100,
              render: (_, r) =>
                r.refType === 'order_trip' && r.refId ? `訂單 #${r.refId}` : (r.refId ?? '—'),
            },
          ]}
        />
        <ListPager
          page={ledgerPage}
          totalPages={ledgerTotalPages}
          total={ledgerTotal}
          onChange={(p) => {
            setLedgerPage(p);
            if (ledgerPassenger) void loadLedger(ledgerPassenger.id, p);
          }}
        />
      </Modal>
    </Card>
  );
}
