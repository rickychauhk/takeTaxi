import { Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';

type Row = {
  id: number;
  labelZh: string;
  labelEn: string | null;
  sortOrder: number;
  isActive: boolean;
  actionType: 'message' | 'cancel_order' | 'release_to_hall';
};

export default function OrderChatQuickRepliesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Row[]>('/admin/order-chat/quick-replies');
      setRows(data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ sortOrder: 0, isActive: true, actionType: 'message' });
    setOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    form.setFieldsValue(row);
    setOpen(true);
  };

  const save = async () => {
    const v = await form.validateFields();
    if (editing) {
      await api.patch(`/admin/order-chat/quick-replies/${editing.id}`, v);
      message.success('已更新');
    } else {
      await api.post('/admin/order-chat/quick-replies', v);
      message.success('已新增');
    }
    setOpen(false);
    void load();
  };

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={openCreate}>
          新增快捷訊息
        </Button>
        <Button onClick={() => void load()}>重新整理</Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={false}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 64 },
          { title: '中文', dataIndex: 'labelZh' },
          { title: 'English', dataIndex: 'labelEn', render: (v: string | null) => v ?? '—' },
          { title: '排序', dataIndex: 'sortOrder', width: 72 },
          {
            title: '動作',
            dataIndex: 'actionType',
            width: 120,
            render: (t: string) =>
              t === 'cancel_order'
                ? '取消柯打'
                : t === 'release_to_hall'
                  ? '返回大廳（換師傅）'
                  : '純訊息',
          },
          {
            title: '啟用',
            dataIndex: 'isActive',
            width: 72,
            render: (v: boolean) => (v ? '是' : '否'),
          },
          {
            title: '操作',
            width: 160,
            render: (_, row) => (
              <Space>
                <Button size="small" onClick={() => openEdit(row)}>
                  編輯
                </Button>
                <Popconfirm title="確定刪除？" onConfirm={() => void api.delete(`/admin/order-chat/quick-replies/${row.id}`).then(load)}>
                  <Button size="small" danger>
                    刪除
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? '編輯快捷訊息' : '新增快捷訊息'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void save()}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="labelZh" label="中文" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="labelEn" label="English">
            <Input />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="actionType" label="動作">
            <Select
              options={[
                { value: 'message', label: '只發送文字' },
                { value: 'cancel_order', label: '發送後取消柯打' },
                { value: 'release_to_hall', label: '發送後返回大廳（乘客換師傅）' },
              ]}
            />
          </Form.Item>
          <Form.Item name="isActive" label="啟用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
