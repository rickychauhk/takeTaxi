import {
  Button,
  Card,
  Form,
  Image,
  InputNumber,
  Modal,
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
import type { Paginated } from '@taxima/shared';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import HtmlEditorField from '../../components/HtmlEditorField';
import ListPager from '../../components/ListPager';
import { validateAdImageFile } from '../../utils/adImage';
import { htmlForEditor, wrapWebviewHtml } from '../../utils/webviewHtml';

type AdRow = {
  id: number;
  targetApp: 'passenger' | 'driver' | 'both';
  imagePath: string | null;
  imageUrl: string | null;
  htmlContent: string | null;
  sortOrder: number;
  status: 'active' | 'paused' | 'removed';
  impressionCount: string;
  clickCount: string;
};

const targetOptions = [
  { value: 'passenger', label: '乘客 App' },
  { value: 'driver', label: '司機 App' },
  { value: 'both', label: '兩者' },
];

const defaultHtml = `<h1>廣告標題</h1>
<p>點擊廣告後於 App WebView 顯示的內容。</p>`;

export default function AdsPage() {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdRow | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Paginated<AdRow>>('/admin/ads', { params: { page, pageSize: 10 } });
      setRows(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setFileList([]);
    form.resetFields();
    form.setFieldsValue({ targetApp: 'both', sortOrder: 0, htmlContent: defaultHtml });
    setModalOpen(true);
  };

  const openEdit = async (row: AdRow) => {
    setEditing(row);
    setFileList([]);
    const { data } = await api.get<AdRow>(`/admin/ads/${row.id}`);
    form.setFieldsValue({
      targetApp: data.targetApp,
      sortOrder: data.sortOrder,
      htmlContent: htmlForEditor(data.htmlContent ?? ''),
    });
    setModalOpen(true);
  };

  const submit = async () => {
    const v = await form.validateFields();
    const file = fileList[0]?.originFileObj as File | undefined;
    if (!editing && !file) {
      message.error('請上傳 Splash 封面圖');
      return;
    }
    if (!v.htmlContent?.trim()) {
      message.error('請填寫 WebView HTML');
      return;
    }
    if (file) {
      const err = await validateAdImageFile(file);
      if (err) {
        message.error(err);
        return;
      }
    }
    const fd = new FormData();
    fd.append('targetApp', v.targetApp);
    fd.append('htmlContent', wrapWebviewHtml(v.htmlContent));
    fd.append('sortOrder', String(v.sortOrder ?? 0));
    if (file) fd.append('file', file);

    if (editing) {
      await api.put(`/admin/ads/${editing.id}`, fd);
      message.success('已更新廣告');
    } else {
      await api.post('/admin/ads', fd);
      message.success('已新增廣告');
    }
    setModalOpen(false);
    setPage(1);
    load();
  };

  return (
    <Card>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            廣告管理
          </Typography.Title>
          <Typography.Text type="secondary">
            Splash 封面 JPG/PNG、≤2MB；用戶<strong>點擊</strong>後 App WebView 顯示下方 HTML（非開啟圖片本身）。
            乘客 App 最多 <strong>1</strong> 則 Splash（對象：乘客或兩者）；司機 App 最多 <strong>3</strong> 則（對象：司機或兩者），依排序逐則顯示，關閉後顯示下一則。
          </Typography.Text>
        </div>
        <Button type="primary" onClick={openCreate}>
          新增廣告
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 960 }}
        columns={[
          {
            title: '啟動畫面',
            width: 100,
            render: (_, r) =>
              r.imageUrl ? (
                <Image src={r.imageUrl} width={56} height={99} style={{ objectFit: 'cover' }} alt="splash" />
              ) : (
                '—'
              ),
          },
          { title: '編號', dataIndex: 'id', width: 64 },
          {
            title: '對象',
            dataIndex: 'targetApp',
            width: 100,
            render: (t: string) => targetOptions.find((o) => o.value === t)?.label ?? t,
          },
          {
            title: '內嵌網頁',
            width: 88,
            render: (_, r) =>
              r.htmlContent?.trim() ? <Tag color="blue">網頁內容</Tag> : <Tag>未設定</Tag>,
          },
          { title: '排序', dataIndex: 'sortOrder', width: 72 },
          {
            title: '狀態',
            dataIndex: 'status',
            width: 88,
            render: (s: string) =>
              s === 'active' ? (
                <Tag color="green">投放中</Tag>
              ) : s === 'paused' ? (
                <Tag color="orange">已暫停</Tag>
              ) : (
                <Tag>已移除</Tag>
              ),
          },
          { title: '曝光', dataIndex: 'impressionCount', width: 88 },
          { title: '點擊', dataIndex: 'clickCount', width: 88 },
          {
            title: '操作',
            fixed: 'right',
            width: 260,
            render: (_, r) => (
              <Space size="small" wrap>
                <Button size="small" onClick={() => openEdit(r)}>
                  修改
                </Button>
                {r.status === 'active' && (
                  <Button
                    size="small"
                    onClick={async () => {
                      await api.patch(`/admin/ads/${r.id}/status/paused`);
                      message.success('已暫停');
                      load();
                    }}
                  >
                    暫停
                  </Button>
                )}
                {r.status === 'paused' && (
                  <Button
                    size="small"
                    type="primary"
                    onClick={async () => {
                      await api.patch(`/admin/ads/${r.id}/status/active`);
                      message.success('已恢復投放');
                      load();
                    }}
                  >
                    恢復
                  </Button>
                )}
                <Popconfirm
                  title="確定移除這則廣告？"
                  onConfirm={async () => {
                    await api.patch(`/admin/ads/${r.id}/status/removed`);
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
        title={editing ? '修改廣告' : '新增廣告'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={submit}
        width={720}
        destroyOnClose
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="targetApp" label="投放對象" rules={[{ required: true }]}>
            <Select options={targetOptions} />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序（數字越小越前）">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="htmlContent"
            label="內嵌網頁內容（用戶點擊廣告後顯示）"
            rules={[{ required: true, message: '請填寫 HTML' }]}
          >
            <HtmlEditorField hint="可含 inline CSS；App 會載入 GET /api/v1/public/ads/:id/webview 的 html 欄位" />
          </Form.Item>
          <Form.Item
            label={`Splash 封面圖（JPG/PNG，≤2MB）${editing ? '（留空則不換圖）' : ''}`}
            required={!editing}
          >
            <Upload
              accept="image/jpeg,image/png"
              maxCount={1}
              fileList={fileList}
              beforeUpload={async (file) => {
                const err = await validateAdImageFile(file);
                if (err) {
                  message.error(err);
                  return Upload.LIST_IGNORE;
                }
                setFileList([{ uid: file.uid, name: file.name, originFileObj: file }]);
                return false;
              }}
              onRemove={() => setFileList([])}
            >
              <Button>選擇封面圖</Button>
            </Upload>
            <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              封面僅用於 App 全屏輪播展示，與 WebView 內容分開
            </Typography.Text>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
