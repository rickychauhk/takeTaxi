import { Empty, Spin, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

type ChatRow = {
  id: string;
  senderRole: 'passenger' | 'driver';
  body: string;
  createdAt: string;
};

type Props = {
  orderId: string;
  orderStatus?: string;
};

export default function OrderChatTranscript({ orderId, orderStatus }: Props) {
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<ChatRow[]>(`/admin/orders/${orderId}/chat/messages`);
      setRows(data ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 4000);
    return () => clearInterval(id);
  }, [load]);

  if (loading && !rows.length) {
    return <Spin />;
  }

  if (orderStatus === 'completed' || orderStatus === 'cancelled') {
    return (
      <Typography.Text type="secondary">柯打已結束，行程訊息已刪除。</Typography.Text>
    );
  }

  if (!rows.length) {
    return <Empty description="暫無司機↔乘客訊息" />;
  }

  return (
    <div style={{ maxHeight: 280, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((m) => (
        <div
          key={m.id}
          style={{
            alignSelf: m.senderRole === 'passenger' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            padding: '8px 12px',
            borderRadius: 12,
            background: m.senderRole === 'passenger' ? '#fff1f0' : '#f5f5f5',
            border: m.senderRole === 'passenger' ? '1px solid #ffccc7' : '1px solid #eee',
          }}
        >
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {m.senderRole === 'passenger' ? '乘客' : '司機'} ·{' '}
            {new Date(m.createdAt).toLocaleString('zh-HK', { hour12: false })}
          </Typography.Text>
          <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{m.body}</div>
        </div>
      ))}
    </div>
  );
}
