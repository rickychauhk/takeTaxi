import {
  Button,
  Card,
  Descriptions,
  Divider,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { Paginated } from '@taxima/shared';
import { HK_LICENSED_BANK_NAMES, validateHongKongBankAccountNumberField } from '@taxima/shared';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import ListPager from '../../components/ListPager';
import {
  antdHongKongPhoneRules,
  formatHongKongPhoneDisplay,
  toE164HongKong,
} from '../../firebase/phone';
import { labelDocumentReviewStatus, labelDriverDocumentType } from '../../i18n/crmLabels';
type DriverRow = {
  id: string;
  phone: string;
  displayName: string | null;
  isInternalMember?: boolean;
  internalLabel?: string | null;
  driverTier?: 'admin' | 'partner' | 'public';
  verificationStatus?: 'pending' | 'approved' | 'rejected';
  suspensionActive?: boolean;
  suspendedPermanent?: boolean;
  suspendedUntilHk?: string | null;
  suspendedReason?: string | null;
  vehiclePlate?: string | null;
  pointsBalance?: number;
  offDutyPhone?: string | null;
  licenseNumber?: string | null;
  vehiclePlateExpiry?: string | null;
  vehicleModel?: string | null;
  firstRegistrationDate?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
};

type DriverDocument = {
  id: string;
  docType: string;
  reviewStatus: string;
  fileUrl: string;
};

const tierOptions = [
  { value: 'admin', label: '管理員級' },
  { value: 'partner', label: '合作方（貨主／優惠碼）' },
  { value: 'public', label: '公海' },
];

const vehicleModelOptions = [
  { value: '混燃', label: '混燃' },
  { value: '六人車', label: '六人車' },
  { value: '輪椅', label: '輪椅' },
];

const bankOptions = HK_LICENSED_BANK_NAMES.map((name) => ({ value: name, label: name }));

const dateYmdRule = {
  pattern: /^\d{4}-\d{2}-\d{2}$/,
  message: '請用 YYYY-MM-DD 格式',
} as const;

export default function DriversPage() {
  const [phoneSearch, setPhoneSearch] = useState('');
  const [phoneQuery, setPhoneQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DriverRow | null>(null);
  const [form] = Form.useForm();
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerDriver, setLedgerDriver] = useState<DriverRow | null>(null);
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
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailDriver, setDetailDriver] = useState<DriverRow | null>(null);
  const [detailDocs, setDetailDocs] = useState<DriverDocument[]>([]);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<DriverRow | null>(null);
  const [suspendForm] = Form.useForm<{ mode: 'days' | 'permanent'; days?: number; reason?: string }>();

  const formatPoints = (v: string | number | undefined) => {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? String(Math.round(n)) : '0';
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Paginated<DriverRow>>('/admin/drivers', {
        params: { phone: phoneQuery || undefined, page, pageSize: 10 },
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
  }, [phoneQuery, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [phoneQuery]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ driverTier: 'public', isInternalMember: false, verificationStatus: 'pending' });
    setModalOpen(true);
  };

  const openEdit = (row: DriverRow) => {
    setEditing(row);
    form.setFieldsValue({
      phone: formatHongKongPhoneDisplay(row.phone),
      offDutyPhone: formatHongKongPhoneDisplay(row.offDutyPhone),
      displayName: row.displayName,
      licenseNumber: row.licenseNumber,
      driverTier: row.driverTier,
      isInternalMember: Boolean(row.isInternalMember),
      verificationStatus: row.verificationStatus,
      vehiclePlate: row.vehiclePlate,
      vehiclePlateExpiry: row.vehiclePlateExpiry,
      vehicleModel: row.vehicleModel,
      firstRegistrationDate: row.firstRegistrationDate,
      bankName: row.bankName,
      bankAccountNumber: row.bankAccountNumber,
      pointsBalance: Math.round(Number(row.pointsBalance ?? 0)),
      pointsAdjustReason: undefined,
    });
    setModalOpen(true);
  };

  const openSuspend = (row: DriverRow) => {
    setSuspendTarget(row);
    suspendForm.setFieldsValue({ mode: 'days', days: 7, reason: undefined });
    setSuspendOpen(true);
  };

  const submitSuspend = async () => {
    if (!suspendTarget) return;
    const v = await suspendForm.validateFields();
    const permanent = v.mode === 'permanent';
    await api.patch(`/admin/drivers/${suspendTarget.id}/suspend`, {
      permanent,
      days: permanent ? undefined : v.days,
      reason: v.reason?.trim() || undefined,
    });
    message.success(permanent ? '已永久停用' : `已停用 ${v.days} 日`);
    setSuspendOpen(false);
    if (detailDriver?.id === suspendTarget.id) {
      await openDetail(suspendTarget);
    }
    load();
  };

  const doUnsuspend = async (row: DriverRow) => {
    await api.patch(`/admin/drivers/${row.id}/unsuspend`);
    message.success('已解除停用');
    if (detailDriver?.id === row.id) {
      await openDetail(row);
    }
    load();
  };

  const suspensionTag = (r: DriverRow) => {
    if (!r.suspensionActive) return '—';
    if (r.suspendedPermanent) {
      return <Tag color="red">永久停用</Tag>;
    }
    return (
      <Tag color="volcano">
        停用至 {r.suspendedUntilHk ?? '—'}
      </Tag>
    );
  };

  const openDetail = async (row: DriverRow) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailDriver(row);
    setDetailDocs([]);
    try {
      const { data } = await api.get<{ driver: DriverRow; documents: DriverDocument[] }>(
        `/admin/drivers/${row.id}`,
      );
      setDetailDriver(data.driver);
      setDetailDocs(data.documents ?? []);
    } catch {
      message.error('無法載入司機詳情');
    } finally {
      setDetailLoading(false);
    }
  };

  const openLedger = async (row: DriverRow) => {
    setLedgerDriver(row);
    setLedgerPage(1);
    setLedgerOpen(true);
    await loadLedger(row.id, 1);
  };

  const loadLedger = async (driverId: string, page: number) => {
    setLedgerLoading(true);
    try {
      const { data } = await api.get<{
        driver: { pointsBalance: number };
        items: typeof ledgerRows;
        total: number;
        totalPages: number;
      }>(`/admin/drivers/${driverId}/point-ledger`, { params: { page, pageSize: 10 } });
      setLedgerBalance(data.driver?.pointsBalance ?? 0);
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

  return (
    <Card>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>
          司機
        </Typography.Title>
        <Button type="primary" onClick={openCreate}>
          新增司機
        </Button>
      </Space>

      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder="以電話搜尋"
          style={{ width: 220 }}
          value={phoneSearch}
          onChange={(e) => setPhoneSearch(e.target.value)}
          onSearch={(v) => {
            setPhoneQuery(v.trim());
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
        scroll={{ x: 960 }}
        columns={[
          { title: '編號', dataIndex: 'id', width: 72 },
          {
            title: '電話',
            dataIndex: 'phone',
            render: (v: string) => formatHongKongPhoneDisplay(v),
          },
          { title: '姓名', dataIndex: 'displayName' },
          { title: '車牌', dataIndex: 'vehiclePlate', width: 120, render: (v: string | null) => v ?? '—' },
          {
            title: '收款銀行',
            dataIndex: 'bankName',
            width: 140,
            ellipsis: true,
            render: (v: string | null | undefined) => v ?? '—',
          },
          {
            title: '自己人',
            width: 88,
            render: (_, r) =>
              r.isInternalMember ? <Tag color="gold">{r.internalLabel ?? '自己人'}</Tag> : '—',
          },
          {
            title: '級別',
            dataIndex: 'driverTier',
            width: 140,
            render: (t: string | undefined, r) => (
              <Select
                size="small"
                style={{ width: 132 }}
                value={t}
                options={tierOptions}
                onChange={async (driverTier) => {
                  await api.patch(`/admin/drivers/${r.id}/tier`, { driverTier });
                  message.success('已更新級別');
                  load();
                }}
              />
            ),
          },
          {
            title: '審批',
            dataIndex: 'verificationStatus',
            width: 100,
            render: (s: string | undefined) =>
              s === 'approved' ? (
                <Tag color="green">已審批</Tag>
              ) : s === 'rejected' ? (
                <Tag color="red">已拒絕</Tag>
              ) : (
                <Tag color="orange">待審批</Tag>
              ),
          },
          {
            title: '停用',
            width: 140,
            render: (_, r) => suspensionTag(r),
          },
          {
            title: '積分',
            dataIndex: 'pointsBalance',
            width: 88,
            render: (v: number | undefined) => formatPoints(v),
          },
          {
            title: '操作',
            fixed: 'right',
            width: 360,
            render: (_, r) => (
              <Space size="small" wrap>
                <Button size="small" type="link" onClick={() => void openDetail(r)}>
                  詳情
                </Button>
                {r.suspensionActive ? (
                  <Button size="small" onClick={() => void doUnsuspend(r)}>
                    解除停用
                  </Button>
                ) : (
                  <Button size="small" danger onClick={() => openSuspend(r)}>
                    停用
                  </Button>
                )}
                <Button size="small" onClick={() => void openLedger(r)}>
                  積分明細
                </Button>
                <Button size="small" onClick={() => openEdit(r)}>
                  修改
                </Button>
                {r.verificationStatus !== 'approved' && (
                  <Button
                    size="small"
                    type="primary"
                    onClick={async () => {
                      await api.patch(`/admin/drivers/${r.id}/approve`);
                      message.success('已一鍵審批');
                      load();
                    }}
                  >
                    一鍵審批
                  </Button>
                )}
                <Popconfirm
                  title="確定移除該司機？"
                  onConfirm={async () => {
                    await api.delete(`/admin/drivers/${r.id}`);
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
        title={editing ? '修改司機' : '新增司機'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={async () => {
          const v = await form.validateFields();
          const phoneE164 = toE164HongKong(String(v.phone ?? ''));
          const offDutyE164 = toE164HongKong(String(v.offDutyPhone ?? ''));
          if (phoneE164 === offDutyE164) {
            message.error('收工電話不可與開工電話相同');
            return;
          }
          const profilePayload = {
            phone: phoneE164,
            offDutyPhone: offDutyE164,
            displayName: String(v.displayName ?? '').trim(),
            licenseNumber: String(v.licenseNumber ?? '').trim().toUpperCase(),
            vehiclePlate: String(v.vehiclePlate ?? '').trim().toUpperCase(),
            vehiclePlateExpiry: String(v.vehiclePlateExpiry ?? '').trim(),
            vehicleModel: String(v.vehicleModel ?? '').trim(),
            firstRegistrationDate: String(v.firstRegistrationDate ?? '').trim(),
            bankName: String(v.bankName ?? '').trim(),
            bankAccountNumber: String(v.bankAccountNumber ?? '').replace(/\s+/g, '').replace(/-/g, ''),
            driverTier: v.driverTier,
            isInternalMember: Boolean(v.isInternalMember),
            verificationStatus: v.verificationStatus,
          };
          if (editing) {
            await api.put(`/admin/drivers/${editing.id}`, profilePayload);
            const newBalance = Math.max(0, Math.round(Number(v.pointsBalance ?? 0)));
            const oldBalance = Math.round(Number(editing.pointsBalance ?? 0));
            if (newBalance !== oldBalance) {
              await api.patch(`/admin/drivers/${editing.id}/points`, {
                pointsBalance: newBalance,
                reason: typeof v.pointsAdjustReason === 'string' ? v.pointsAdjustReason.trim() : undefined,
              });
            }
            message.success('已更新');
          } else {
            await api.post('/admin/drivers', profilePayload);
            message.success('已新增');
          }
          setModalOpen(false);
          load();
        }}
        width={640}
      >
        <Form form={form} layout="vertical">
          <Typography.Text type="secondary">與司機 App 登記相同之必填資料</Typography.Text>
          <Divider style={{ margin: '12px 0' }} />
          <Form.Item name="displayName" label="名字" rules={[{ required: true, message: '請輸入名字' }]}>
            <Input placeholder="司機姓名" />
          </Form.Item>
          <Form.Item
            name="phone"
            label="開工電話（顯示給乘客）"
            rules={[...antdHongKongPhoneRules('開工電話')]}
          >
            <Input placeholder="例如 91234567" inputMode="tel" />
          </Form.Item>
          <Form.Item
            name="offDutyPhone"
            label="收工電話"
            rules={[...antdHongKongPhoneRules('收工電話')]}
          >
            <Input placeholder="8 位數字" inputMode="tel" />
          </Form.Item>
          <Form.Item
            name="licenseNumber"
            label="執照號碼"
            rules={[{ required: true, message: '請輸入執照號碼' }]}
          >
            <Input placeholder="例如 S123456(1)" style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item
            name="vehiclePlate"
            label="車牌號碼"
            rules={[
              { required: true, message: '請輸入車牌' },
              { max: 32, message: '最多 32 字' },
            ]}
          >
            <Input placeholder="例如 AB1234" style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item
            name="vehiclePlateExpiry"
            label="車牌到期日"
            rules={[{ required: true, message: '請輸入日期' }, dateYmdRule]}
          >
            <Input placeholder="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="vehicleModel" label="車型" rules={[{ required: true, message: '請選擇車型' }]}>
            <Select placeholder="請選擇車型" options={vehicleModelOptions} />
          </Form.Item>
          <Form.Item
            name="firstRegistrationDate"
            label="首次登記日期"
            rules={[{ required: true, message: '請輸入日期' }, dateYmdRule]}
          >
            <Input placeholder="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="bankName" label="銀行" rules={[{ required: true, message: '請選擇銀行' }]}>
            <Select
              showSearch
              placeholder="請選擇銀行"
              options={bankOptions}
              filterOption={(input, option) =>
                (option?.label ?? '').toString().includes(input.trim())
              }
            />
          </Form.Item>
          <Form.Item
            name="bankAccountNumber"
            label="銀行戶口號碼"
            rules={[
              { required: true, message: '請輸入戶口號碼' },
              {
                validator: (_: unknown, value: string) => {
                  const err = validateHongKongBankAccountNumberField('銀行戶口號碼', value ?? '');
                  return err ? Promise.reject(new Error(err)) : Promise.resolve();
                },
              },
            ]}
          >
            <Input placeholder="6–20 位數字" inputMode="numeric" />
          </Form.Item>
          <Divider style={{ margin: '12px 0' }} />
          <Form.Item name="driverTier" label="級別">
            <Select options={tierOptions} />
          </Form.Item>
          <Form.Item name="isInternalMember" label="自己人" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="verificationStatus" label="審批狀態">
            <Select
              options={[
                { value: 'pending', label: '待審批' },
                { value: 'approved', label: '已審批' },
                { value: 'rejected', label: '已拒絕' },
              ]}
            />
          </Form.Item>
          {editing ? (
            <>
              <Form.Item
                name="pointsBalance"
                label="積分結餘"
                rules={[{ type: 'number', min: 0, message: '積分不可為負' }]}
              >
                <InputNumber min={0} precision={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="pointsAdjustReason" label="調整備註（選填）">
                <Input maxLength={128} placeholder="例如：活動補償" />
              </Form.Item>
            </>
          ) : null}
        </Form>
      </Modal>

      <Modal
        title={detailDriver ? `司機詳情 · ${detailDriver.displayName ?? '—'}` : '司機詳情'}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={640}
      >
        {detailLoading ? (
          <Typography.Text type="secondary">載入中…</Typography.Text>
        ) : detailDriver ? (
          <>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="編號">{detailDriver.id}</Descriptions.Item>
              <Descriptions.Item label="開工電話">{formatHongKongPhoneDisplay(detailDriver.phone)}</Descriptions.Item>
              <Descriptions.Item label="收工電話">
                {formatHongKongPhoneDisplay(detailDriver.offDutyPhone)}
              </Descriptions.Item>
              <Descriptions.Item label="姓名">{detailDriver.displayName ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="執照號碼">{detailDriver.licenseNumber ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="車牌">{detailDriver.vehiclePlate ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="車牌到期日">{detailDriver.vehiclePlateExpiry ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="車型">{detailDriver.vehicleModel ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="首次登記">{detailDriver.firstRegistrationDate ?? '—'}</Descriptions.Item>
            </Descriptions>
            <Typography.Title level={5} style={{ marginTop: 8, marginBottom: 8 }}>
              收款資料
            </Typography.Title>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="銀行">{detailDriver.bankName ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="銀行戶口號碼">
                {detailDriver.bankAccountNumber ?? '—'}
              </Descriptions.Item>
            </Descriptions>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="審批">
                {detailDriver.verificationStatus === 'approved' ? (
                  <Tag color="green">已審批</Tag>
                ) : detailDriver.verificationStatus === 'rejected' ? (
                  <Tag color="red">已拒絕</Tag>
                ) : (
                  <Tag color="orange">待審批</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="級別">
                {tierOptions.find((o) => o.value === detailDriver.driverTier)?.label ?? detailDriver.driverTier}
              </Descriptions.Item>
              <Descriptions.Item label="自己人">
                {detailDriver.isInternalMember ? detailDriver.internalLabel ?? '自己人' : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="停用狀態">{suspensionTag(detailDriver)}</Descriptions.Item>
              {detailDriver.suspensionActive && detailDriver.suspendedReason ? (
                <Descriptions.Item label="停用備註">{detailDriver.suspendedReason}</Descriptions.Item>
              ) : null}
            </Descriptions>
            <Space style={{ marginBottom: 16 }}>
              {detailDriver.suspensionActive ? (
                <Button type="primary" onClick={() => void doUnsuspend(detailDriver)}>
                  解除停用
                </Button>
              ) : (
                <Button danger onClick={() => openSuspend(detailDriver)}>
                  停用司機
                </Button>
              )}
            </Space>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              上傳文件
            </Typography.Title>
            {detailDocs.length === 0 ? (
              <Typography.Text type="secondary">尚未上傳行車證、司機證或其他文件</Typography.Text>
            ) : (
              detailDocs.map((doc) => (
                <div key={doc.id} style={{ marginBottom: 16 }}>
                  <Typography.Text style={{ display: 'block', marginBottom: 8 }}>
                    {labelDriverDocumentType(doc.docType)} · {labelDocumentReviewStatus(doc.reviewStatus)}
                  </Typography.Text>
                  <Image src={doc.fileUrl} alt={doc.docType} style={{ maxWidth: '100%' }} />
                </div>
              ))
            )}
          </>
        ) : null}
      </Modal>

      <Modal
        title={suspendTarget ? `停用司機 · ${suspendTarget.displayName ?? suspendTarget.id}` : '停用司機'}
        open={suspendOpen}
        onCancel={() => setSuspendOpen(false)}
        onOk={() => void submitSuspend()}
        okText="確認停用"
        okButtonProps={{ danger: true }}
        destroyOnClose
      >
        <Form form={suspendForm} layout="vertical" initialValues={{ mode: 'days', days: 7 }}>
          <Form.Item name="mode" label="停用方式" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'days', label: '停用指定日數（到期自動解除）' },
                { value: 'permanent', label: '永久停用（須手動解除）' },
              ]}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.mode !== cur.mode}>
            {({ getFieldValue }) =>
              getFieldValue('mode') === 'days' ? (
                <Form.Item
                  name="days"
                  label="日數"
                  rules={[
                    { required: true, message: '請輸入日數' },
                    { type: 'number', min: 1, max: 3650, message: '1–3650 日' },
                  ]}
                >
                  <InputNumber min={1} max={3650} precision={0} style={{ width: '100%' }} />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item name="reason" label="備註（選填）">
            <Input.TextArea maxLength={255} rows={2} placeholder="例如：違規接單" />
          </Form.Item>
          <Typography.Text type="secondary">
            停用後司機不可上線、接單或射柯打；進行中行程不受影響。限期停用每分鐘檢查一次是否到期。
          </Typography.Text>
        </Form>
      </Modal>

      <Modal
        title={
          ledgerDriver
            ? `積分明細 · ${ledgerDriver.displayName ?? '—'} (${formatHongKongPhoneDisplay(ledgerDriver.phone)})`
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
                r.refType === 'order_trip' && r.refId
                  ? `訂單 #${r.refId}`
                  : r.refType === 'admin_adjust' && r.refId
                    ? `管理員 #${r.refId}`
                    : (r.refId ?? '—'),
            },
          ]}
        />
        <ListPager
          page={ledgerPage}
          totalPages={ledgerTotalPages}
          total={ledgerTotal}
          onChange={(p) => {
            setLedgerPage(p);
            if (ledgerDriver) void loadLedger(ledgerDriver.id, p);
          }}
        />
      </Modal>
    </Card>
  );
}
