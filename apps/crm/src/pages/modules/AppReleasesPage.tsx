import { AndroidOutlined, CloudUploadOutlined, DownloadOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';

type ReleaseRow = {
  id: string;
  app: 'passenger' | 'driver';
  version: string;
  releaseNotes: string | null;
  fileName: string;
  fileSizeBytes: string;
  isActiveUat: boolean;
  isActiveProd: boolean;
  deployedUatAt: string | null;
  deployedProdAt: string | null;
  createdAt: string;
  downloadUrl: string;
};

const appOptions = [
  { value: 'driver', label: '司機 App' },
  { value: 'passenger', label: '乘客 App' },
];

function formatBytes(raw: string | number) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('zh-HK');
}

export default function AppReleasesPage() {
  const [rows, setRows] = useState<ReleaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<ReleaseRow[]>('/admin/mobile-app-releases');
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const uploadRelease = async () => {
    const v = await form.validateFields();
    const file = fileList[0]?.originFileObj as File | undefined;
    if (!file) {
      message.error('請選擇 APK 檔案');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.apk')) {
      message.error('只接受 .apk');
      return;
    }
    const fd = new FormData();
    fd.append('app', v.app);
    fd.append('version', v.version.trim());
    if (v.releaseNotes?.trim()) fd.append('releaseNotes', v.releaseNotes.trim());
    fd.append('apk', file);

    setSubmitting(true);
    try {
      await api.post('/admin/mobile-app-releases', fd);
      message.success('已上傳 APK');
      form.resetFields();
      form.setFieldsValue({ app: 'driver' });
      setFileList([]);
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const downloadRelease = async (row: ReleaseRow) => {
    const { data } = await api.get<Blob>(`/admin/mobile-app-releases/${row.id}/download`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${row.app}-${row.version}.apk`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deploy = async (id: string, environment: 'uat' | 'prod') => {
    await api.patch(`/admin/mobile-app-releases/${id}/deploy`, { environment });
    message.success(environment === 'uat' ? '已標記為 UAT 現行版' : '已標記為 PROD 現行版');
    await load();
  };

  const columns = [
    {
      title: 'App',
      dataIndex: 'app',
      width: 100,
      render: (app: ReleaseRow['app']) => (app === 'driver' ? '司機' : '乘客'),
    },
    { title: '版本', dataIndex: 'version', width: 100 },
    {
      title: '檔案',
      dataIndex: 'fileName',
      ellipsis: true,
      render: (_: string, row: ReleaseRow) => (
        <Typography.Text type="secondary">
          {row.fileName} · {formatBytes(row.fileSizeBytes)}
        </Typography.Text>
      ),
    },
    {
      title: 'UAT',
      width: 160,
      render: (_: unknown, row: ReleaseRow) =>
        row.isActiveUat ? (
          <Tag color="blue">現行 · {formatTime(row.deployedUatAt)}</Tag>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: 'PROD',
      width: 160,
      render: (_: unknown, row: ReleaseRow) =>
        row.isActiveProd ? (
          <Tag color="green">現行 · {formatTime(row.deployedProdAt)}</Tag>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    { title: '上傳時間', dataIndex: 'createdAt', width: 170, render: formatTime },
    {
      title: '操作',
      width: 280,
      render: (_: unknown, row: ReleaseRow) => (
        <Space wrap size="small">
          <Button size="small" icon={<DownloadOutlined />} onClick={() => downloadRelease(row)}>
            下載
          </Button>
          <Popconfirm title="設為 UAT 現行版？" onConfirm={() => deploy(row.id, 'uat')}>
            <Button size="small" type={row.isActiveUat ? 'primary' : 'default'}>
              發佈 UAT
            </Button>
          </Popconfirm>
          <Popconfirm title="設為 PROD 現行版？" onConfirm={() => deploy(row.id, 'prod')}>
            <Button size="small" type={row.isActiveProd ? 'primary' : 'default'} danger={row.isActiveProd}>
              發佈 PROD
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        <AndroidOutlined /> Android APK 發佈
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        上傳 APK 供管理員下載；「發佈 UAT / PROD」會在本 CRM 所連的 API 環境標記現行版本（UAT 與 PROD
        若為不同主機，請分別登入對應 CRM 上傳並發佈）。
      </Typography.Paragraph>

      <Card title="上傳新版本">
        <Form form={form} layout="vertical" initialValues={{ app: 'driver' }}>
          <Form.Item name="app" label="App" rules={[{ required: true }]}>
            <Select options={appOptions} style={{ maxWidth: 240 }} />
          </Form.Item>
          <Form.Item
            name="version"
            label="版本號"
            rules={[{ required: true, message: '例如 1.0.3 或 1.0.3-uat' }]}
          >
            <Input placeholder="1.0.3" style={{ maxWidth: 240 }} />
          </Form.Item>
          <Form.Item name="releaseNotes" label="備註（選填）">
            <Input.TextArea rows={2} placeholder="更新內容摘要" />
          </Form.Item>
          <Form.Item label="APK 檔案" required>
            <Upload
              accept=".apk,application/vnd.android.package-archive"
              maxCount={1}
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList: fl }) => setFileList(fl)}
            >
              <Button icon={<CloudUploadOutlined />}>選擇 APK</Button>
            </Upload>
          </Form.Item>
          <Button type="primary" loading={submitting} onClick={uploadRelease}>
            上傳
          </Button>
        </Form>
      </Card>

      <Card title="版本紀錄">
        <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={{ pageSize: 10 }} />
      </Card>
    </Space>
  );
}
