import { Alert, Button, Card, DatePicker, Empty, Input, Space, Table, TimePicker, Typography } from 'antd';
import type { Paginated } from '@taxima/shared';
import { ORDER_RECORDS_PAGE_SIZE } from '@taxima/shared';
import { Dayjs } from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import ListPager from '../../components/ListPager';
import OrderRecordDetailDrawer from '../../components/OrderRecordDetailDrawer';
import { labelOrderStatus, labelOrderType } from '../../i18n/crmLabels';

type Row = {
  orderId: string;
  orderType: string;
  status: string;
  passengerId: string;
  passengerName: string | null;
  driverPhone: string | null;
  driverName: string | null;
  placedAtHk: string | null;
  scheduledAtHk: string | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  fareEstimate: string | null;
  fareFinal: string | null;
  estimateDistanceKm: number | null;
  tripDistanceKm: number | null;
  passengerPointsAwarded: number | null;
  passengerPointsRedeemed: number | null;
  passengerPointsDiscountHkd: number | null;
  passengerPointsHkdPerPointAtOrder: number | null;
  passengerPointsBalance: number;
  driverPointsCostAtOrder?: number | null;
  driverPointsBusySurcharge?: number | null;
  driverVehiclePlate?: string | null;
  pointsDeductedFromVehiclePlate?: string | null;
  driverPostBountyPoints?: number | null;
  bountyFromVehiclePlate?: string | null;
};

function formatAcceptPointsCell(
  points: number | null | undefined,
  plate: string | null | undefined,
): string {
  if (points == null) return '—';
  const plateLabel = plate?.trim() ? ` · ${plate.trim()}` : '';
  return `${points}${plateLabel}`;
}

export default function PassengerOrderRecordsPage() {
  const [passengerIdInput, setPassengerIdInput] = useState('');
  const [passengerId, setPassengerId] = useState('');
  const [date, setDate] = useState<Dayjs | null>(null);
  const [time, setTime] = useState<Dayjs | null>(null);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Paginated<Row>>('/admin/order-records/passenger-orders', {
        params: {
          passengerId: passengerId || undefined,
          date: date ? date.format('YYYY-MM-DD') : undefined,
          time: time ? time.format('HH:mm') : undefined,
          page,
          pageSize: ORDER_RECORDS_PAGE_SIZE,
        },
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
  }, [passengerId, date, time, page]);

  useEffect(() => {
    load();
  }, [load]);

  const runSearch = () => {
    setPassengerId(passengerIdInput.trim());
    setPage(1);
  };

  return (
    <Card>
      <Typography.Title level={4}>乘客落柯打紀錄</Typography.Title>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder="乘客 ID"
          style={{ width: 160 }}
          value={passengerIdInput}
          onChange={(e) => setPassengerIdInput(e.target.value)}
          onSearch={runSearch}
        />
        <DatePicker
          placeholder="日期"
          value={date}
          onChange={(d) => {
            setDate(d);
            setPage(1);
          }}
          allowClear
        />
        <TimePicker
          placeholder="時間 (HH:mm)"
          format="HH:mm"
          value={time}
          onChange={(t) => {
            setTime(t);
            setPage(1);
          }}
          allowClear
        />
        <Button onClick={runSearch}>搜尋</Button>
        <Button onClick={load}>重新整理</Button>
        <Button
          onClick={() => {
            setPassengerIdInput('');
            setPassengerId('');
            setDate(null);
            setTime(null);
            setPage(1);
          }}
        >
          清除篩選
        </Button>
      </Space>

      {!loading && total === 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="沒有符合條件的紀錄"
          description="請按「清除篩選」或重新登入；可按乘客 ID 篩選。"
        />
      )}

      <Table
        locale={{ emptyText: <Empty description="尚無資料" /> }}
        rowKey="orderId"
        loading={loading}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 1280 }}
        onRow={(record) => ({
          onClick: () => setDetailOrderId(record.orderId),
          style: { cursor: 'pointer' },
        })}
        columns={[
          { title: '訂單 ID', dataIndex: 'orderId', width: 88 },
          { title: '落單時間 (HK)', dataIndex: 'placedAtHk', width: 168 },
          { title: '預約時間 (HK)', dataIndex: 'scheduledAtHk', width: 168 },
          { title: '乘客 ID', dataIndex: 'passengerId', width: 88 },
          { title: '乘客', dataIndex: 'passengerName', width: 100 },
          { title: '司機電話', dataIndex: 'driverPhone', width: 120 },
          { title: '司機', dataIndex: 'driverName', width: 100 },
          {
            title: '接單車牌',
            dataIndex: 'driverVehiclePlate',
            width: 96,
            render: (v: string | null | undefined) => v?.trim() || '—',
          },
          {
            title: '類型',
            dataIndex: 'orderType',
            width: 96,
            render: (t: string) => labelOrderType(t),
          },
          {
            title: '狀態',
            dataIndex: 'status',
            width: 96,
            render: (s: string) => labelOrderStatus(s),
          },
          { title: '上車', dataIndex: 'pickupAddress', ellipsis: true },
          { title: '落車', dataIndex: 'dropoffAddress', ellipsis: true },
          { title: '估價', dataIndex: 'fareEstimate', width: 80 },
          { title: '實收', dataIndex: 'fareFinal', width: 80 },
          {
            title: '計分公里',
            width: 88,
            render: (_, r) => {
              const km = r.tripDistanceKm ?? r.estimateDistanceKm;
              return km != null ? String(km) : '—';
            },
          },
          {
            title: '獲得積分',
            dataIndex: 'passengerPointsAwarded',
            width: 88,
            render: (v: number | null) => (v != null ? String(v) : '—'),
          },
          {
            title: '使用積分',
            dataIndex: 'passengerPointsRedeemed',
            width: 88,
            render: (v: number | null) => (v != null ? String(v) : '—'),
          },
          {
            title: '積分抵扣',
            dataIndex: 'passengerPointsDiscountHkd',
            width: 88,
            render: (v: number | null) =>
              v != null && Number.isFinite(v) ? `$${Math.round(v)}` : '—',
          },
          {
            title: '兌換率',
            width: 88,
            render: (_, r) =>
              r.passengerPointsHkdPerPointAtOrder != null
                ? `$${Math.round(r.passengerPointsHkdPerPointAtOrder)}/分`
                : '—',
          },
          {
            title: '乘客積分',
            dataIndex: 'passengerPointsBalance',
            width: 88,
            render: (v: number) => String(Math.round(Number(v ?? 0))),
          },
          {
            title: '接單扣積分',
            width: 132,
            render: (_, r) =>
              formatAcceptPointsCell(
                r.driverPointsCostAtOrder,
                r.pointsDeductedFromVehiclePlate ?? r.driverVehiclePlate,
              ),
          },
          {
            title: '繁忙獎賞',
            width: 88,
            render: (_, r) => {
              const n = r.driverPointsBusySurcharge;
              if (n == null || n <= 0) return '—';
              return `+${Math.round(n)}`;
            },
          },
          {
            title: '懸賞（出自車牌）',
            width: 128,
            render: (_, r) => {
              if (r.driverPostBountyPoints == null || r.driverPostBountyPoints <= 0) return '—';
              const plate = r.bountyFromVehiclePlate?.trim();
              return plate ? `${r.driverPostBountyPoints} · ${plate}` : String(r.driverPostBountyPoints);
            },
          },
        ]}
      />

      <ListPager
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={ORDER_RECORDS_PAGE_SIZE}
        onChange={setPage}
      />

      <OrderRecordDetailDrawer orderId={detailOrderId} onClose={() => setDetailOrderId(null)} />
    </Card>
  );
}
