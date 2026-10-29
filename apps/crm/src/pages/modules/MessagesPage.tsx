import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Radio,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';

type MessageRow = {
  id: string;
  audience: string;
  title: string;
  body: string;
  deliveryStatus: string;
  pushRecipientCount: number | null;
  pushDetail: string | null;
  targetPhones: string | null;
  phoneAppTarget: string | null;
  createdAt: string;
};

const AUDIENCE_LABEL: Record<string, string> = {
  all_drivers: '全部司機',
  all_passengers: '全部乘客',
  all_members: '全部會員（司機＋乘客）',
  phones: '指定電話',
};

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  queued: { text: '排隊中', color: 'default' },
  sent: { text: '已發送', color: 'green' },
  failed: { text: '失敗', color: 'red' },
};

export default function MessagesPage() {
  const [rows, setRows] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const audience = Form.useWatch('audience', form) as string | undefined;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<MessageRow[]>('/admin/messages');
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <Card>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            訊息中心
          </Typography.Title>
          <Button type="primary" onClick={() => setModalOpen(true)}>
            新增訊息
          </Button>
        </Space>
        <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
          發送 OneSignal Push 至司機 App 或乘客 App。App 登入後會以會員編號綁定推送；指定電話時請輸入香港 8
          位本地號碼。
        </Typography.Paragraph>
        <Table
          style={{ marginTop: 16 }}
          rowKey="id"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 960 }}
          columns={[
            { title: '編號', dataIndex: 'id', width: 72 },
            {
              title: '對象',
              dataIndex: 'audience',
              width: 200,
              render: (v: string, row) => {
                const base = AUDIENCE_LABEL[v] ?? v;
                if (v !== 'phones' || !row.targetPhones) return base;
                try {
                  const phones = JSON.parse(row.targetPhones) as string[];
                  const app =
                    row.phoneAppTarget === 'driver'
                      ? '司機'
                      : row.phoneAppTarget === 'passenger'
                        ? '乘客'
                        : '司機＋乘客';
                  return `${base}（${app}：${phones.join('、')}）`;
                } catch {
                  return base;
                }
              },
            },
            { title: '標題', dataIndex: 'title', width: 160, ellipsis: true },
            { title: '內容', dataIndex: 'body', ellipsis: true },
            {
              title: 'Push 人數',
              dataIndex: 'pushRecipientCount',
              width: 96,
              render: (n: number | null) => (n != null ? n : '—'),
            },
            {
              title: '狀態',
              dataIndex: 'deliveryStatus',
              width: 96,
              render: (v: string) => {
                const s = STATUS_LABEL[v] ?? { text: v, color: 'default' };
                return <Tag color={s.color}>{s.text}</Tag>;
              },
            },
            {
              title: '時間',
              dataIndex: 'createdAt',
              width: 172,
              render: (v: string) => (v ? new Date(v).toLocaleString('zh-Hant', { hour12: false }) : '—'),
            },
          ]}
          expandable={{
            expandedRowRender: (row) =>
              row.pushDetail ? (
                <Typography.Text type="secondary" style={{ whiteSpace: 'pre-wrap' }}>
                  {row.pushDetail}
                </Typography.Text>
              ) : null,
            rowExpandable: (row) => !!row.pushDetail,
          }}
        />
      </Card>

      <Modal
        title="新增訊息（Push）"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        confirmLoading={submitting}
        okText="發送"
        onOk={async () => {
          const values = await form.validateFields();
          setSubmitting(true);
          try {
            await api.post('/admin/messages', values);
            message.success('訊息已發送');
            setModalOpen(false);
            form.resetFields();
            load();
          } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string | string[] } } };
            const raw = err.response?.data?.message;
            const text = Array.isArray(raw) ? raw.join('\n') : raw ?? '發送失敗';
            message.error(text);
          } finally {
            setSubmitting(false);
          }
        }}
        width={560}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ audience: 'all_drivers', phoneAppTarget: 'both' }}
        >
          <Form.Item name="audience" label="發送對象" rules={[{ required: true }]}>
            <Radio.Group>
              <Space direction="vertical">
                <Radio value="all_drivers">全部司機</Radio>
                <Radio value="all_passengers">全部乘客</Radio>
                <Radio value="all_members">全部會員（司機＋乘客）</Radio>
                <Radio value="phones">指定電話號碼</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>
          {audience === 'phones' ? (
            <>
              <Form.Item
                name="phones"
                label="電話（可多個，逗號或換行分隔）"
                rules={[{ required: true, message: '請輸入電話' }]}
              >
                <Input.TextArea rows={3} placeholder="例如：91234567, 62345678" />
              </Form.Item>
              <Form.Item name="phoneAppTarget" label="推送 App" rules={[{ required: true }]}>
                <Radio.Group>
                  <Radio value="driver">司機 App</Radio>
                  <Radio value="passenger">乘客 App</Radio>
                  <Radio value="both">兩邊都試（有帳號就推）</Radio>
                </Radio.Group>
              </Form.Item>
            </>
          ) : null}
          <Form.Item name="title" label="Push 標題" rules={[{ required: true, message: '請填寫標題' }]}>
            <Input maxLength={120} showCount />
          </Form.Item>
          <Form.Item name="body" label="Push 內容" rules={[{ required: true, message: '請填寫內容' }]}>
            <Input.TextArea rows={4} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
