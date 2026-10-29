import { Button, Card, Image, Input, Modal, Space, Table, Tag, Typography, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { labelTopupStatus } from '../../i18n/crmLabels';

type Topup = {
  id: string;
  driverId: string;
  driverPhone: string | null;
  driverDisplayName: string | null;
  amountPoints: string;
  priceHkd: string | null;
  receiptUrl: string | null;
  bankName?: string | null;
  status: string;
  reviewNote?: string | null;
  createdAt: string;
};

function statusTag(status: string) {
  const label = labelTopupStatus(status);
  if (status === 'pending') return <Tag color="processing">{label}</Tag>;
  if (status === 'rejected') return <Tag color="error">{label}</Tag>;
  if (status === 'approved') return <Tag color="success">{label}</Tag>;
  return <Tag>{label}</Tag>;
}

export default function TopupApprovalPage() {
  const [rows, setRows] = useState<Topup[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<Topup | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Topup[]>('/admin/point-topups', {
        params: { status: 'pending,rejected' },
      });
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const closeRejectModal = () => {
    setRejectTarget(null);
    setRejectNote('');
  };

  const submitReject = async () => {
    const note = rejectNote.trim();
    if (!rejectTarget) return;
    if (!note) {
      message.error('請填寫拒絕原因');
      return;
    }
    setRejectSubmitting(true);
    try {
      await api.patch(`/admin/point-topups/${rejectTarget.id}/reject`, { note });
      message.success('已拒絕並已通知司機（紀錄仍保留於此列表）');
      closeRejectModal();
      load();
    } finally {
      setRejectSubmitting(false);
    }
  };

  return (
    <Card>
      <Typography.Title level={4}>司機積分購買審批</Typography.Title>
      <Typography.Paragraph type="secondary">
        司機於 App 選擇套餐、付款方式並上傳過數證明。批核後積分即時入帳並自列表移除；拒絕須填寫原因、Push
        通知司機，紀錄會保留於此列表供查閱。
      </Typography.Paragraph>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        scroll={{ x: 1100 }}
        columns={[
          { title: '編號', dataIndex: 'id', width: 88 },
          {
            title: '司機',
            render: (_, row) =>
              row.driverDisplayName || row.driverPhone
                ? `${row.driverDisplayName ?? '—'} (${row.driverPhone ?? row.driverId})`
                : row.driverId,
          },
          { title: '積分', dataIndex: 'amountPoints', width: 80 },
          {
            title: '金額 (HKD)',
            dataIndex: 'priceHkd',
            width: 100,
            render: (v: string | null) => v ?? '—',
          },
          {
            title: '付款方式',
            dataIndex: 'bankName',
            width: 120,
            render: (v: string | null | undefined) => v?.trim() || '—',
          },
          {
            title: '憑證',
            dataIndex: 'receiptUrl',
            width: 120,
            render: (url: string | null) =>
              url ? (
                <Image
                  src={url}
                  alt="receipt"
                  width={72}
                  height={72}
                  style={{ objectFit: 'cover', borderRadius: 6 }}
                  preview={{ src: url }}
                />
              ) : (
                '—'
              ),
          },
          {
            title: '狀態',
            dataIndex: 'status',
            width: 96,
            render: (s: string) => statusTag(s),
          },
          {
            title: '拒絕原因',
            dataIndex: 'reviewNote',
            width: 180,
            ellipsis: true,
            render: (v: string | null | undefined, row) =>
              row.status === 'rejected' && v?.trim() ? v.trim() : '—',
          },
          {
            title: '提交時間',
            dataIndex: 'createdAt',
            width: 168,
            render: (v: string) => (v ? new Date(v).toLocaleString('zh-HK') : '—'),
          },
          {
            title: '操作',
            fixed: 'right',
            width: 140,
            render: (_, row) =>
              row.status === 'pending' ? (
                <Space>
                  <Button
                    type="primary"
                    size="small"
                    onClick={async () => {
                      await api.patch(`/admin/point-topups/${row.id}/approve`, {});
                      message.success('已批核，積分已入帳並已通知司機');
                      load();
                    }}
                  >
                    批核
                  </Button>
                  <Button
                    danger
                    size="small"
                    onClick={() => {
                      setRejectTarget(row);
                      setRejectNote('');
                    }}
                  >
                    拒絕
                  </Button>
                </Space>
              ) : (
                <Typography.Text type="secondary">—</Typography.Text>
              ),
          },
        ]}
      />
      <Modal
        title="拒絕積分購買"
        open={!!rejectTarget}
        onCancel={closeRejectModal}
        onOk={() => void submitReject()}
        okText="確認拒絕"
        okButtonProps={{ danger: true, loading: rejectSubmitting }}
        cancelText="取消"
        destroyOnClose
      >
        <Typography.Paragraph type="secondary">
          原因會寫入審批紀錄，並以 Push 通知司機。此申請仍會保留在列表（狀態：已拒絕）。
        </Typography.Paragraph>
        <Input.TextArea
          rows={4}
          placeholder="例：憑證不清晰、金額不符、未收到款項…"
          maxLength={500}
          showCount
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
        />
      </Modal>
    </Card>
  );
}
