import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import {
  labelDisplayStyle,
  labelScreenGroup,
  labelSelectionMode,
} from '../../i18n/crmLabels';

type CategoryRow = {
  id: number;
  code: string;
  labelZh: string;
  labelEn: string;
  selectionMode: 'single' | 'multi';
  displayStyle: 'chip' | 'tunnel' | 'vehicle';
  screenGroup: 'preferences' | 'extras';
  sortOrder: number;
  isActive: boolean;
};

type OptionRow = {
  id: number;
  categoryId: number;
  code: string;
  labelZh: string;
  labelEn: string;
  iconKey: string | null;
  sortOrder: number;
  isActive: boolean;
  category?: CategoryRow;
};

export default function BookingOptionsPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [loadingCat, setLoadingCat] = useState(true);
  const [loadingOpt, setLoadingOpt] = useState(true);
  const [catModal, setCatModal] = useState(false);
  const [optModal, setOptModal] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoryRow | null>(null);
  const [editingOpt, setEditingOpt] = useState<OptionRow | null>(null);
  const [catForm] = Form.useForm();
  const [optForm] = Form.useForm();

  const loadCategories = useCallback(async () => {
    setLoadingCat(true);
    try {
      const { data } = await api.get<CategoryRow[]>('/admin/booking-option-categories');
      setCategories(data);
    } finally {
      setLoadingCat(false);
    }
  }, []);

  const loadOptions = useCallback(async () => {
    setLoadingOpt(true);
    try {
      const { data } = await api.get<OptionRow[]>('/admin/booking-options');
      setOptions(data);
    } finally {
      setLoadingOpt(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
    void loadOptions();
  }, [loadCategories, loadOptions]);

  const openCatCreate = () => {
    setEditingCat(null);
    catForm.resetFields();
    catForm.setFieldsValue({
      selectionMode: 'single',
      displayStyle: 'chip',
      screenGroup: 'preferences',
      sortOrder: 0,
      isActive: true,
    });
    setCatModal(true);
  };

  const openCatEdit = (row: CategoryRow) => {
    setEditingCat(row);
    catForm.setFieldsValue(row);
    setCatModal(true);
  };

  const submitCat = async () => {
    const v = await catForm.validateFields();
    if (editingCat) {
      await api.patch(`/admin/booking-option-categories/${editingCat.id}`, v);
      message.success('已更新分類');
    } else {
      await api.post('/admin/booking-option-categories', v);
      message.success('已新增分類');
    }
    setCatModal(false);
    await loadCategories();
    await loadOptions();
  };

  const openOptCreate = () => {
    setEditingOpt(null);
    optForm.resetFields();
    optForm.setFieldsValue({
      categoryId: categories[0]?.id,
      sortOrder: 0,
      isActive: true,
    });
    setOptModal(true);
  };

  const openOptEdit = (row: OptionRow) => {
    setEditingOpt(row);
    optForm.setFieldsValue({
      categoryId: row.categoryId,
      code: row.code,
      labelZh: row.labelZh,
      labelEn: row.labelEn,
      iconKey: row.iconKey,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    });
    setOptModal(true);
  };

  const submitOpt = async () => {
    const v = await optForm.validateFields();
    if (editingOpt) {
      await api.patch(`/admin/booking-options/${editingOpt.id}`, v);
      message.success('已更新選項');
    } else {
      await api.post('/admin/booking-options', v);
      message.success('已新增選項');
    }
    setOptModal(false);
    await loadOptions();
  };

  const catById = new Map(categories.map((c) => [c.id, c]));

  return (
    <>
      <Tabs
        items={[
          {
            key: 'options',
            label: '叫車選項',
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Button type="primary" onClick={openOptCreate} disabled={!categories.length}>
                    新增選項
                  </Button>
                </Space>
                <Table<OptionRow>
                  rowKey="id"
                  loading={loadingOpt}
                  dataSource={options}
                  pagination={{ pageSize: 20 }}
                  columns={[
                    { title: '編號', dataIndex: 'id', width: 64 },
                    {
                      title: '分類',
                      render: (_, r) => catById.get(r.categoryId)?.labelZh ?? r.categoryId,
                    },
                    { title: '代碼', dataIndex: 'code', width: 140 },
                    { title: '繁中標籤', dataIndex: 'labelZh' },
                    { title: '英文', dataIndex: 'labelEn' },
                    { title: '圖示鍵', dataIndex: 'iconKey', width: 120 },
                    { title: '排序', dataIndex: 'sortOrder', width: 72 },
                    {
                      title: '狀態',
                      width: 88,
                      render: (_, r) =>
                        r.isActive ? <Tag color="green">啟用</Tag> : <Tag>停用</Tag>,
                    },
                    {
                      title: '操作',
                      width: 160,
                      render: (_, r) => (
                        <Space>
                          <Button size="small" onClick={() => openOptEdit(r)}>
                            編輯
                          </Button>
                          <Popconfirm title="確定移除？" onConfirm={() => api.delete(`/admin/booking-options/${r.id}`).then(loadOptions)}>
                            <Button size="small" danger>
                              移除
                            </Button>
                          </Popconfirm>
                        </Space>
                      ),
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'categories',
            label: '分類管理',
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Button type="primary" onClick={openCatCreate}>
                    新增分類
                  </Button>
                </Space>
                <Table<CategoryRow>
                  rowKey="id"
                  loading={loadingCat}
                  dataSource={categories}
                  pagination={false}
                  columns={[
                    { title: '代碼', dataIndex: 'code' },
                    { title: '繁中', dataIndex: 'labelZh' },
                    { title: '英文', dataIndex: 'labelEn' },
                    {
                      title: '選擇',
                      dataIndex: 'selectionMode',
                      width: 88,
                      render: (m: CategoryRow['selectionMode']) => labelSelectionMode(m),
                    },
                    {
                      title: '樣式',
                      dataIndex: 'displayStyle',
                      width: 100,
                      render: (s: CategoryRow['displayStyle']) => labelDisplayStyle(s),
                    },
                    {
                      title: '畫面',
                      dataIndex: 'screenGroup',
                      width: 120,
                      render: (g: CategoryRow['screenGroup']) => labelScreenGroup(g),
                    },
                    { title: '排序', dataIndex: 'sortOrder', width: 72 },
                    {
                      title: '狀態',
                      width: 88,
                      render: (_, r) =>
                        r.isActive ? <Tag color="green">啟用</Tag> : <Tag>停用</Tag>,
                    },
                    {
                      title: '操作',
                      width: 160,
                      render: (_, r) => (
                        <Space>
                          <Button size="small" onClick={() => openCatEdit(r)}>
                            編輯
                          </Button>
                          <Popconfirm
                            title="移除分類會一併刪除其下選項，確定？"
                            onConfirm={() =>
                              api.delete(`/admin/booking-option-categories/${r.id}`).then(async () => {
                                await loadCategories();
                                await loadOptions();
                              })
                            }
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
              </>
            ),
          },
        ]}
      />

      <Modal
        title={editingCat ? '編輯分類' : '新增分類'}
        open={catModal}
        onCancel={() => setCatModal(false)}
        onOk={() => void submitCat()}
        destroyOnClose
      >
        <Form form={catForm} layout="vertical">
          <Form.Item name="code" label="代碼" rules={[{ required: true }]}>
            <Input disabled={!!editingCat} placeholder="例如 tunnel" />
          </Form.Item>
          <Form.Item name="labelZh" label="繁中名稱" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="labelEn" label="英文名稱" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="selectionMode" label="選擇模式" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'single', label: '單選' },
                { value: 'multi', label: '多選' },
              ]}
            />
          </Form.Item>
          <Form.Item name="displayStyle" label="乘客 App 顯示樣式" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'chip', label: '標籤按鈕' },
                { value: 'tunnel', label: '隧道圖示' },
                { value: 'vehicle', label: '車類圖示' },
              ]}
            />
          </Form.Item>
          <Form.Item name="screenGroup" label="乘客 App 區塊" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'preferences', label: '偏好（隧道／停站等）' },
                { value: 'extras', label: '其他選項' },
              ]}
            />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isActive" label="啟用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingOpt ? '編輯選項' : '新增選項'}
        open={optModal}
        onCancel={() => setOptModal(false)}
        onOk={() => void submitOpt()}
        destroyOnClose
      >
        <Form form={optForm} layout="vertical">
          <Form.Item name="categoryId" label="分類" rules={[{ required: true }]}>
            <Select
              options={categories.map((c) => ({
                value: c.id,
                label: `${c.labelZh} (${c.code})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="code" label="代碼" rules={[{ required: true }]}>
            <Input placeholder="例如 cht" />
          </Form.Item>
          <Form.Item name="labelZh" label="繁中標籤" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="labelEn" label="英文標籤" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="iconKey" label="圖示鍵（可選）">
            <Input placeholder="例如 tunnel_red、vehicle_hybrid" />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isActive" label="啟用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
