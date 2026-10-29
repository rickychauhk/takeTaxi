import { Button, Card, Form, Input, Modal, Space, Switch, Table, Tag, Typography, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { labelDriverTier } from '../../i18n/crmLabels';

type Promo = {
  id: number;
  code: string;
  description: string | null;
  marksInternalMember: boolean;
  isActive: boolean;
  redemptionCount: number;
  createdAt: string;
};

type InternalDriver = {
  id: string;
  phone: string;
  displayName: string | null;
  internalLabel: string;
  promoCodeUsed: string | null;
  driverTier: string;
};

export default function PromosPage() {
  const [rows, setRows] = useState<Promo[]>([]);
  const [internalDrivers, setInternalDrivers] = useState<InternalDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [promos, drivers] = await Promise.all([
        api.get<Promo[]>('/admin/promos'),
        api.get<InternalDriver[]>('/admin/promos/internal-drivers'),
      ]);
      setRows(promos.data);
      setInternalDrivers(drivers.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            優惠碼管理
          </Typography.Title>
          <Button type="primary" onClick={() => setModalOpen(true)}>
            新增優惠碼
          </Button>
        </Space>
        <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
          司機註冊或兌換有效優惠碼後，若該碼標記「自己人」，會員資料會顯示「自己人」並提升為 partner tier。
        </Typography.Paragraph>
        <Table
          style={{ marginTop: 16 }}
          rowKey="id"
          loading={loading}
          dataSource={rows}
          columns={[
            { title: '優惠碼', dataIndex: 'code' },
            { title: '說明', dataIndex: 'description', ellipsis: true },
            {
              title: '對應自己人',
              dataIndex: 'marksInternalMember',
              render: (v: boolean) => (v ? <Tag color="gold">是</Tag> : <Tag>否</Tag>),
            },
            {
              title: '狀態',
              dataIndex: 'isActive',
              render: (v: boolean) => (v ? <Tag color="green">有效</Tag> : <Tag>已移除</Tag>),
            },
            { title: '兌換人數', dataIndex: 'redemptionCount' },
            {
              title: '操作',
              render: (_, row) => (
                <Space>
                  <Button
                    size="small"
                    danger
                    disabled={!row.isActive}
                    onClick={async () => {
                      await api.delete(`/admin/promos/${row.id}`);
                      message.success('已移除優惠碼');
                      load();
                    }}
                  >
                    移除
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Card>
        <Typography.Title level={5}>透過優惠碼成為「自己人」的司機</Typography.Title>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={internalDrivers}
          columns={[
            { title: '編號', dataIndex: 'id', width: 80 },
            { title: '電話', dataIndex: 'phone' },
            { title: '姓名', dataIndex: 'displayName' },
            {
              title: '身份',
              dataIndex: 'internalLabel',
              render: () => <Tag color="gold">自己人</Tag>,
            },
            { title: '使用優惠碼', dataIndex: 'promoCodeUsed' },
            {
              title: '級別',
              dataIndex: 'driverTier',
              render: (t: string) => labelDriverTier(t),
            },
          ]}
        />
      </Card>

      <Modal
        title="新增優惠碼"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={async () => {
          const v = await form.validateFields();
          await api.post('/admin/promos', {
            code: v.code,
            description: v.description,
            marksInternalMember: v.marksInternalMember ?? true,
          });
          message.success('已新增');
          form.resetFields();
          setModalOpen(false);
          load();
        }}
      >
        <Form form={form} layout="vertical" initialValues={{ marksInternalMember: true }}>
          <Form.Item name="code" label="優惠碼" rules={[{ required: true, message: '請輸入優惠碼' }]}>
            <Input placeholder="例如 PARTNER2026" />
          </Form.Item>
          <Form.Item name="description" label="說明">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="marksInternalMember" label="兌換後標記為「自己人」" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
