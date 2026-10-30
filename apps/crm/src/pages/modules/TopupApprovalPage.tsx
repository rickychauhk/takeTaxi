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
  transferAt?: string | null;
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
  const [geminiReviewId, setGeminiReviewId] = useState<string | null>(null);
  const [viewReviewNote, setViewReviewNote] = useState<{
    topupId: string;
    note: string;
    kind: 'rejected' | 'approved';
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Topup[]>('/admin/point-topups', {
        params: { status: 'pending,rejected,approved' },
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
        司機於 App 選擇套餐、付款方式並上傳過數證明。待審可批核或拒絕；批核後積分即時入帳。已批核、已拒絕紀錄均保留於此列表供查閱（拒絕會
        Push 通知司機）。
      </Typography.Paragraph>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        scroll={{ x: 1280 }}
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
            title: '憑證日期時間',
            dataIndex: 'transferAt',
            width: 168,
            render: (v: string | null | undefined) =>
              v ? new Date(v).toLocaleString('zh-HK', { hour12: false }) : '—',
          },
          {
            title: '狀態',
            dataIndex: 'status',
            width: 96,
            render: (s: string) => statusTag(s),
          },
          {
            title: '審批備註',
            dataIndex: 'reviewNote',
            width: 180,
            ellipsis: { showTitle: false },
            render: (v: string | null | undefined, row) => {
              const note = v?.trim();
              if ((row.status !== 'rejected' && row.status !== 'approved') || !note) return '—';
              const kind = row.status === 'rejected' ? 'rejected' : 'approved';
              return (
                <Typography.Link
                  title="點擊查看完整內容"
                  onClick={() => setViewReviewNote({ topupId: row.id, note, kind })}
                  style={{ maxWidth: 168, display: 'inline-block' }}
                  ellipsis
                >
                  {note}
                </Typography.Link>
              );
            },
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
            width: 220,
            render: (_, row) =>
              row.status === 'pending' ? (
                <Space wrap>
                  <Button
                    size="small"
                    loading={geminiReviewId === row.id}
                    onClick={async () => {
                      setGeminiReviewId(row.id);
                      try {
                        const { data } = await api.post<{ outcome: string }>(
                          `/admin/point-topups/${row.id}/gemini-review`,
                        );
                        const outcome = data?.outcome;
                        if (outcome === 'approved') {
                          message.success('Gemini 已批核，積分已入帳並已通知司機');
                        } else if (outcome === 'rejected') {
                          message.warning('Gemini 已拒絕，已 Push 通知司機');
                        } else if (outcome === 'manual') {
                          message.info('Gemini 未能自動判定，請人工審批');
                        } else {
                          message.info('此申請已非待審狀態或已跳過');
                        }
                        load();
                      } catch (e: unknown) {
                        const msg =
                          e && typeof e === 'object' && 'response' in e
                            ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? '')
                            : '';
                        message.error(msg || 'AI 審批失敗');
                      } finally {
                        setGeminiReviewId(null);
                      }
                    }}
                  >
                    AI 審批
                  </Button>
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
        title={
          viewReviewNote
            ? `${viewReviewNote.kind === 'rejected' ? '拒絕原因' : '批核備註'}（編號 ${viewReviewNote.topupId}）`
            : ''
        }
        open={!!viewReviewNote}
        onCancel={() => setViewReviewNote(null)}
        footer={[
          <Button key="close" type="primary" onClick={() => setViewReviewNote(null)}>
            關閉
          </Button>,
        ]}
        destroyOnClose
      >
        <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {viewReviewNote?.note}
        </Typography.Paragraph>
      </Modal>
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
