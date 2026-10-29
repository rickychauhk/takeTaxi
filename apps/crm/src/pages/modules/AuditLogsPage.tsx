import { Button, Card, Input, Space, Table, Tag, Typography } from 'antd';
import type { Paginated } from '@taxima/shared';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import ListPager from '../../components/ListPager';
import { describeAuditLogAction } from '../../i18n/auditLogLabels';

type AuditRow = {
  id: string;
  actorType: string;
  actorId: number | null;
  actorDisplayName: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  payload: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
};

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Paginated<AuditRow>>('/admin/audit-logs', {
        params: { page, pageSize: 30, action: actionFilter.trim() || undefined },
      });
      setRows(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <Typography.Title level={4}>系統日誌</Typography.Title>
      <Typography.Paragraph type="secondary">
        記錄 CRM 管理員所有 API 操作（含查詢、新增、修改、刪除）；登入／登出另行記錄。
      </Typography.Paragraph>
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="篩選（功能或操作，例如：積分、批核、admin.get）"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          style={{ width: 360 }}
          allowClear
        />
        <Button
          onClick={() => {
            setPage(1);
            load();
          }}
        >
          搜尋
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 1100 }}
        columns={[
          {
            title: '時間',
            dataIndex: 'createdAt',
            width: 168,
            render: (v: string) => new Date(v).toLocaleString('zh-HK', { hour12: false }),
          },
          {
            title: '管理員',
            width: 120,
            render: (_, r) => {
              if (r.actorType === 'driver' && r.actorId != null) return `司機 #${r.actorId}`;
              if (r.actorType === 'system') return '系統';
              return r.actorDisplayName?.trim() || (r.actorId != null ? `#${r.actorId}` : '—');
            },
          },
          {
            title: '功能名稱',
            width: 140,
            render: (_, r) => describeAuditLogAction(r.action).functionName,
          },
          {
            title: '操作類型',
            width: 120,
            render: (_, r) => describeAuditLogAction(r.action).operationType,
          },
          {
            title: '資源',
            width: 140,
            render: (_, r) =>
              r.resourceType ? (
                <span>
                  {r.resourceType}
                  {r.resourceId ? ` / ${r.resourceId}` : ''}
                </span>
              ) : (
                '—'
              ),
          },
          {
            title: '結果',
            width: 88,
            render: (_, r) => {
              const outcome = r.payload?.outcome;
              if (outcome === 'error') return <Tag color="error">失敗</Tag>;
              if (outcome === 'success') return <Tag color="success">成功</Tag>;
              return <Tag>—</Tag>;
            },
          },
          { title: 'IP 位址', dataIndex: 'ipAddress', width: 120 },
        ]}
        expandable={{
          expandedRowRender: (r) => (
            <div style={{ fontSize: 12 }}>
              <Typography.Text type="secondary">技術識別：{r.action}</Typography.Text>
              <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(r.payload ?? {}, null, 2)}
              </pre>
            </div>
          ),
        }}
      />
      <ListPager page={page} totalPages={totalPages} total={total} onChange={setPage} />
    </Card>
  );
}
