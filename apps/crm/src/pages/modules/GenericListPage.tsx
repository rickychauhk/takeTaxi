import { Card, Table, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { labelColumnKey } from '../../i18n/crmLabels';

export default function GenericListPage({ title, endpoint }: { title: string; endpoint: string }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(endpoint);
        setRows(Array.isArray(data) ? data : [data]);
      } finally {
        setLoading(false);
      }
    })();
  }, [endpoint]);

  const columns =
    rows[0] != null
      ? Object.keys(rows[0])
          .slice(0, 8)
          .map((k) => ({ title: labelColumnKey(k), dataIndex: k, key: k, ellipsis: true }))
      : [];

  return (
    <Card>
      <Typography.Title level={4}>{title}</Typography.Title>
      <Table rowKey={(r) => String(r.id ?? JSON.stringify(r))} loading={loading} dataSource={rows} columns={columns} />
    </Card>
  );
}
