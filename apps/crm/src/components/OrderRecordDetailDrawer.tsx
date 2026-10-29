import { Descriptions, Drawer, Spin, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { formatHongKongPhoneDisplay } from '../firebase/phone';
import { labelOrderStatus, labelOrderType } from '../i18n/crmLabels';
import OrderChatTranscript from './OrderChatTranscript';

type Detail = {
  orderId: string;
  orderType: string;
  status: string;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  placedAtHk: string | null;
  passengerPhone?: string | null;
  passenger: { displayName: string | null; phone?: string | null } | null;
  driver: { displayName: string | null; vehiclePlate: string | null } | null;
};

type Props = {
  orderId: string | null;
  onClose: () => void;
};

export default function OrderRecordDetailDrawer({ orderId, onClose }: Props) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const { data } = await api.get<Detail>(`/admin/orders/${orderId}/detail`);
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (orderId) void load();
    else setDetail(null);
  }, [orderId, load]);

  return (
    <Drawer
      title={orderId ? `柯打 #${orderId}` : '柯打詳情'}
      width={520}
      open={!!orderId}
      onClose={onClose}
      destroyOnClose
    >
      {loading ? (
        <Spin />
      ) : detail ? (
        <>
          <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="類型">{labelOrderType(detail.orderType)}</Descriptions.Item>
            <Descriptions.Item label="狀態">{labelOrderStatus(detail.status)}</Descriptions.Item>
            <Descriptions.Item label="落單 (HK)">{detail.placedAtHk ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="乘客">{detail.passenger?.displayName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="乘客電話">
              {formatHongKongPhoneDisplay(
                detail.passenger?.phone ?? detail.passengerPhone ?? null,
              )}
            </Descriptions.Item>
            <Descriptions.Item label="司機">{detail.driver?.displayName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="車牌">{detail.driver?.vehiclePlate?.trim() || '—'}</Descriptions.Item>
            <Descriptions.Item label="上車">{detail.pickupAddress ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="落車">{detail.dropoffAddress ?? '—'}</Descriptions.Item>
          </Descriptions>
          <Typography.Title level={5}>行程訊息</Typography.Title>
          <OrderChatTranscript orderId={detail.orderId} orderStatus={detail.status} />
        </>
      ) : (
        <Typography.Text type="secondary">無法載入詳情</Typography.Text>
      )}
    </Drawer>
  );
}
