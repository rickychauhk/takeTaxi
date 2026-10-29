import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { Paginated } from '@taxima/shared';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import ListPager from '../../components/ListPager';
import { labelRatingDirection } from '../../i18n/crmLabels';

type RatingRow = {
  id: string;
  orderId: string;
  direction: 'passenger_to_driver' | 'driver_to_passenger';
  directionLabel: string;
  passengerName: string | null;
  driverPhone: string | null;
  score: number;
  comment: string | null;
  createdAt: string;
  orderStatus: string | null;
};

const directionOptions = [
  { value: '', label: '全部方向' },
  { value: 'passenger_to_driver', label: '乘客 → 司機' },
  { value: 'driver_to_passenger', label: '司機 → 乘客' },
];

export default function RatingsPage() {
  const [page, setPage] = useState(1);
  const [orderId, setOrderId] = useState('');
  const [direction, setDirection] = useState<string>('');
  const [rows, setRows] = useState<RatingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RatingRow | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Paginated<RatingRow>>('/admin/ratings', {
        params: {
          page,
          pageSize: 20,
          orderId: orderId.trim() || undefined,
          direction: direction || undefined,
        },
      });
      setRows(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page, orderId, direction]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <Typography.Title level={4}>評分</Typography.Title>
      <Typography.Paragraph type="secondary">
        每個已完成行程可各有兩筆評分：乘客評司機、司機評乘客（1.0–5.0），以行程編號關聯。
      </Typography.Paragraph>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          placeholder="行程編號"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          style={{ width: 140 }}
          allowClear
        />
        <Select
          options={directionOptions}
          value={direction}
          onChange={setDirection}
          style={{ width: 180 }}
        />
        <Button
          onClick={() => {
            setPage(1);
            load();
          }}
        >
          搜尋
        </Button>
        <Button
          type="primary"
          onClick={() => {
            setEditing(null);
            form.resetFields();
            form.setFieldsValue({ direction: 'passenger_to_driver', score: 5 });
            setModalOpen(true);
          }}
        >
          新增評分
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={false}
        columns={[
          { title: '行程', dataIndex: 'orderId', width: 90 },
          {
            title: '方向',
            dataIndex: 'directionLabel',
            render: (_, r) => (
              <Tag color={r.direction === 'passenger_to_driver' ? 'blue' : 'green'}>
                {labelRatingDirection(r.direction)}
              </Tag>
            ),
          },
          { title: '乘客', dataIndex: 'passengerName', render: (v: string | null) => v ?? '—' },
          { title: '司機電話', dataIndex: 'driverPhone' },
          {
            title: '分數',
            dataIndex: 'score',
            width: 80,
            render: (v: number) => v.toFixed(1),
          },
          { title: '評語', dataIndex: 'comment', ellipsis: true },
          {
            title: '操作',
            width: 100,
            render: (_, row) => (
              <Button
                type="link"
                size="small"
                onClick={() => {
                  setEditing(row);
                  form.setFieldsValue({
                    orderId: row.orderId,
                    direction: row.direction,
                    score: row.score,
                    comment: row.comment,
                  });
                  setModalOpen(true);
                }}
              >
                修改
              </Button>
            ),
          },
        ]}
      />
      <ListPager page={page} totalPages={totalPages} total={total} onChange={setPage} />

      <Modal
        title={editing ? '修改評分' : '新增評分'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={async () => {
          const v = await form.validateFields();
          if (editing) {
            await api.put(`/admin/ratings/${editing.id}`, {
              score: v.score,
              comment: v.comment,
            });
            message.success('已更新');
          } else {
            await api.post('/admin/ratings', v);
            message.success('已新增');
          }
          setModalOpen(false);
          load();
        }}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="orderId" label="行程編號" rules={[{ required: true }]}>
            <Input disabled={Boolean(editing)} placeholder="例如 90001" />
          </Form.Item>
          <Form.Item name="direction" label="評分方向" rules={[{ required: true }]}>
            <Select
              disabled={Boolean(editing)}
              options={[
                { value: 'passenger_to_driver', label: '乘客 → 司機' },
                { value: 'driver_to_passenger', label: '司機 → 乘客' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="score"
            label="分數 (1.0–5.0，0.5 為單位)"
            rules={[{ required: true, type: 'number', min: 1, max: 5 }]}
          >
            <InputNumber min={1} max={5} step={0.5} precision={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="comment" label="評語">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
