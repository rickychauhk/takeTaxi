import {
  Alert,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import type { Paginated } from '@taxima/shared';
import { ORDER_RECORDS_PAGE_SIZE } from '@taxima/shared';
import type { Dayjs } from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import ListPager from '../../components/ListPager';
import OrderChatTranscript from '../../components/OrderChatTranscript';
import { labelOrderStatusEventNote } from '@taxima/shared';
import { formatHongKongPhoneDisplay } from '../../firebase/phone';
import {
  labelActorType,
  labelDriverTier,
  labelOrderStatus,
  labelOrderType,
} from '../../i18n/crmLabels';

type Row = {
  orderId: string;
  orderType: string;
  status: string;
  driverPhone: string;
  driverName: string | null;
  vehiclePlate: string | null;
  passengerId: string | null;
  passengerName: string | null;
  passengerPhone?: string | null;
  acceptedAtHk: string | null;
  orderCreatedAtHk?: string | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  fareEstimate: string | null;
  fareFinal: string | null;
  passengerPointsRedeemed?: number | null;
  passengerPointsDiscountHkd?: number | null;
  passengerPointsHkdPerPointAtOrder?: number | null;
  driverPointsCostAtOrder?: number | null;
  driverPointsBusySurcharge?: number | null;
  driverPostBountyPoints?: number | null;
  pointsDeductedFromVehiclePlate?: string | null;
  bountyFromVehiclePlate?: string | null;
  driverBusyRegionRewardPoints?: number | null;
  driverBusyRegionFromArea?: string | null;
  driverBusyRegionToArea?: string | null;
  stopCount?: number;
};

function formatPointsWithPlate(
  points: number | null | undefined,
  plate: string | null | undefined,
): string {
  if (points == null) return '—';
  const plateLabel = plate?.trim() ? ` · ${plate.trim()}` : '';
  return `${points}${plateLabel}`;
}

type OrderDetail = {
  orderId: string;
  orderType: string;
  status: string;
  fareEstimate: string | null;
  fareFinal: string | null;
  passengerPointsRedeemed?: number | null;
  passengerPointsDiscountHkd?: number | null;
  passengerPointsHkdPerPointAtOrder?: number | null;
  driverPointsCostAtOrder?: number | null;
  driverPointsBusySurcharge?: number | null;
  driverPostBountyPoints?: number | null;
  pointsDeductedFromVehiclePlate?: string | null;
  bountyFromVehiclePlate?: string | null;
  postedByDriver?: {
    id: string;
    phone: string;
    displayName: string | null;
    vehiclePlate: string | null;
  } | null;
  driverBusyRegionRewardPoints?: number | null;
  driverBusyRegionFromArea?: string | null;
  driverBusyRegionToArea?: string | null;
  placedAtHk: string | null;
  updatedAtHk: string | null;
  acceptedAtHk: string | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  stopCount: number;
  stops: { seq: number; addressText: string | null; lat: number; lng: number }[];
  driver: {
    id: string;
    phone: string;
    displayName: string | null;
    vehiclePlate: string | null;
    licenseNumber: string | null;
    driverTier: string;
  } | null;
  passengerPhone?: string | null;
  passenger: {
    id: string;
    displayName: string | null;
    phone?: string | null;
  } | null;
  tipHkd: number;
  remark: string | null;
  bookingOptionLines: string[];
  statusEvents: {
    id: string;
    fromStatus: string | null;
    toStatus: string;
    actorType: string;
    actorId: string | null;
    note: string | null;
    atHk: string | null;
  }[];
};

export default function DriverAcceptanceRecordsPage() {
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState('');
  const [dateFrom, setDateFrom] = useState<Dayjs | null>(null);
  const [dateTo, setDateTo] = useState<Dayjs | null>(null);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<OrderDetail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Paginated<Row>>('/admin/order-records/driver-acceptances', {
        params: {
          phone: phone || undefined,
          dateFrom: dateFrom ? dateFrom.format('YYYY-MM-DD') : undefined,
          dateTo: dateTo ? dateTo.format('YYYY-MM-DD') : undefined,
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
  }, [phone, dateFrom, dateTo, page]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (orderId: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const { data } = await api.get<OrderDetail>(`/admin/orders/${orderId}/detail`);
      setDetail(data);
    } catch {
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const runSearch = () => {
    setPhone(phoneInput.trim());
    setPage(1);
  };

  return (
    <Card>
      <Typography.Title level={4}>司機接單紀錄</Typography.Title>
      <Typography.Paragraph type="secondary">點擊列可查看柯打詳情。</Typography.Paragraph>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder="司機電話"
          style={{ width: 160 }}
          value={phoneInput}
          onChange={(e) => setPhoneInput(e.target.value)}
          onSearch={runSearch}
        />
        <DatePicker.RangePicker
          placeholder={['從日期', '到日期']}
          value={dateFrom || dateTo ? [dateFrom, dateTo] : null}
          onChange={(range) => {
            setDateFrom(range?.[0] ?? null);
            setDateTo(range?.[1] ?? null);
            setPage(1);
          }}
          allowClear
        />
        <Button onClick={runSearch}>搜尋</Button>
        <Button onClick={load}>重新整理</Button>
        <Button
          onClick={() => {
            setPhoneInput('');
            setPhone('');
            setDateFrom(null);
            setDateTo(null);
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
          description="請按「清除篩選」或重新登入；示範司機電話可搜 90011101。"
        />
      )}

      <Table
        locale={{ emptyText: <Empty description="尚無資料" /> }}
        rowKey="orderId"
        loading={loading}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 1620 }}
        onRow={(record) => ({
          onClick: () => void openDetail(record.orderId),
          style: { cursor: 'pointer' },
        })}
        columns={[
          { title: '訂單 ID', dataIndex: 'orderId', width: 88 },
          { title: '接單時間 (HK)', dataIndex: 'acceptedAtHk', width: 168 },
          { title: '司機電話', dataIndex: 'driverPhone', width: 120 },
          { title: '司機', dataIndex: 'driverName', width: 100 },
          {
            title: '車牌',
            dataIndex: 'vehiclePlate',
            width: 100,
            render: (v: string | null) => v?.trim() || '—',
          },
          { title: '乘客 ID', dataIndex: 'passengerId', width: 88 },
          { title: '乘客', dataIndex: 'passengerName', width: 100 },
          {
            title: '乘客電話',
            dataIndex: 'passengerPhone',
            width: 120,
            render: (v: string | null | undefined) => formatHongKongPhoneDisplay(v),
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
            title: '用積分',
            dataIndex: 'passengerPointsRedeemed',
            width: 72,
            render: (v: number | null | undefined) => (v != null ? String(v) : '—'),
          },
          {
            title: '積分抵扣',
            width: 88,
            render: (_, r) =>
              r.passengerPointsDiscountHkd != null ? `$${Math.round(r.passengerPointsDiscountHkd)}` : '—',
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
            title: '接單扣積分',
            width: 140,
            render: (_, r) =>
              formatPointsWithPlate(
                r.driverPointsCostAtOrder,
                r.pointsDeductedFromVehiclePlate ?? r.vehiclePlate,
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
            title: '懸賞積分（出自車牌）',
            width: 148,
            render: (_, r) => {
              if (r.driverPostBountyPoints == null || r.driverPostBountyPoints <= 0) return '—';
              const plate = r.bountyFromVehiclePlate?.trim();
              return plate ? `${r.driverPostBountyPoints} · ${plate}` : String(r.driverPostBountyPoints);
            },
          },
          {
            title: '地區獎賞',
            width: 140,
            render: (_, r) => {
              if (r.driverBusyRegionRewardPoints == null || r.driverBusyRegionRewardPoints <= 0) return '—';
              const from = r.driverBusyRegionFromArea?.trim();
              const to = r.driverBusyRegionToArea?.trim();
              if (from && to) return `+${r.driverBusyRegionRewardPoints} · ${from}→${to}`;
              return `+${r.driverBusyRegionRewardPoints}`;
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

      <Drawer
        title={detail ? `柯打詳情 #${detail.orderId}` : '柯打詳情'}
        width={560}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        loading={detailLoading}
      >
        {detail && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="狀態">
                <Tag>{labelOrderStatus(detail.status)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="類型">{labelOrderType(detail.orderType)}</Descriptions.Item>
              <Descriptions.Item label="落單時間 (HK)">{detail.placedAtHk ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="接單時間 (HK)">{detail.acceptedAtHk ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="最後更新 (HK)">{detail.updatedAtHk ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="估價">{detail.fareEstimate ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="實收">{detail.fareFinal ?? '—'}</Descriptions.Item>
              {detail.passengerPointsRedeemed != null && detail.passengerPointsRedeemed > 0 ? (
                <>
                  <Descriptions.Item label="使用積分">{detail.passengerPointsRedeemed}</Descriptions.Item>
                  <Descriptions.Item label="積分抵扣">
                    HK${Math.round(detail.passengerPointsDiscountHkd ?? 0)}
                  </Descriptions.Item>
                  <Descriptions.Item label="落單兌換率">
                    {detail.passengerPointsHkdPerPointAtOrder != null
                      ? `HK$${Math.round(detail.passengerPointsHkdPerPointAtOrder)}/分`
                      : '—'}
                  </Descriptions.Item>
                </>
              ) : null}
              {detail.tipHkd > 0 ? (
                <Descriptions.Item label="貼士">HK${detail.tipHkd}</Descriptions.Item>
              ) : null}
              {detail.driverPointsCostAtOrder != null ? (
                <Descriptions.Item label="接單扣積分（車牌）">
                  {formatPointsWithPlate(
                    detail.driverPointsCostAtOrder,
                    detail.pointsDeductedFromVehiclePlate ?? detail.driver?.vehiclePlate,
                  )}
                </Descriptions.Item>
              ) : null}
              {detail.driverPointsBusySurcharge != null && detail.driverPointsBusySurcharge > 0 ? (
                <Descriptions.Item label="繁忙時段獎賞（平台）">
                  +{Math.round(detail.driverPointsBusySurcharge)} 積分
                </Descriptions.Item>
              ) : null}
              {detail.driverBusyRegionRewardPoints != null && detail.driverBusyRegionRewardPoints > 0 ? (
                <Descriptions.Item label="繁忙地區獎賞">
                  +{detail.driverBusyRegionRewardPoints}
                  {detail.driverBusyRegionFromArea && detail.driverBusyRegionToArea
                    ? `（${detail.driverBusyRegionFromArea} → ${detail.driverBusyRegionToArea}）`
                    : null}
                </Descriptions.Item>
              ) : null}
              {detail.driverPostBountyPoints != null && detail.driverPostBountyPoints > 0 ? (
                <Descriptions.Item label="懸賞積分（出自車牌）">
                  {detail.bountyFromVehiclePlate?.trim()
                    ? `${detail.driverPostBountyPoints} · ${detail.bountyFromVehiclePlate.trim()}`
                    : detail.driverPostBountyPoints}
                  {detail.postedByDriver?.phone
                    ? `（發單 ${detail.postedByDriver.displayName ?? '—'} ${detail.postedByDriver.phone}）`
                    : null}
                </Descriptions.Item>
              ) : null}
            </Descriptions>

            <div>
              <Typography.Title level={5}>路線</Typography.Title>
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="上車">{detail.pickupAddress ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="落車">{detail.dropoffAddress ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="站數">{detail.stopCount}</Descriptions.Item>
              </Descriptions>
              {detail.stops.length > 0 && (
                <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  {detail.stops.map((s) => (
                    <span key={s.seq}>
                      {s.seq + 1}. {s.addressText} ({s.lat.toFixed(5)}, {s.lng.toFixed(5)})
                      <br />
                    </span>
                  ))}
                </Typography.Paragraph>
              )}
            </div>

            {detail.driver && (
              <div>
                <Typography.Title level={5}>司機</Typography.Title>
                <Descriptions bordered size="small" column={1}>
                  <Descriptions.Item label="姓名">{detail.driver.displayName ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="電話">{detail.driver.phone}</Descriptions.Item>
                  <Descriptions.Item label="車牌">{detail.driver.vehiclePlate ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="駕照編號">{detail.driver.licenseNumber ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="級別">
                    {labelDriverTier(detail.driver.driverTier)}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            )}

            {(detail.passenger || detail.passengerPhone?.trim()) && (
              <div>
                <Typography.Title level={5}>乘客</Typography.Title>
                <Descriptions bordered size="small" column={1}>
                  {detail.passenger ? (
                    <Descriptions.Item label="編號">{detail.passenger.id}</Descriptions.Item>
                  ) : null}
                  <Descriptions.Item label="姓名">{detail.passenger?.displayName ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="電話">
                    {formatHongKongPhoneDisplay(
                      detail.passenger?.phone ?? detail.passengerPhone ?? null,
                    )}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            )}

            {detail.bookingOptionLines.length > 0 && (
              <div>
                <Typography.Title level={5}>叫車選項</Typography.Title>
                <Space wrap>
                  {detail.bookingOptionLines.map((line) => (
                    <Tag key={line}>{line}</Tag>
                  ))}
                </Space>
                {detail.remark ? (
                  <Typography.Paragraph style={{ marginTop: 8 }}>備註：{detail.remark}</Typography.Paragraph>
                ) : null}
              </div>
            )}

            <div>
              <Typography.Title level={5}>行程訊息</Typography.Title>
              <OrderChatTranscript orderId={detail.orderId} orderStatus={detail.status} />
            </div>

            <div>
              <Typography.Title level={5}>狀態紀錄</Typography.Title>
              <Timeline
                items={detail.statusEvents.map((e) => {
                  const noteLabel = labelOrderStatusEventNote(e.note);
                  return {
                    children: (
                      <div>
                        <Typography.Text strong>
                          {e.fromStatus ? labelOrderStatus(e.fromStatus) : '—'} →{' '}
                          {labelOrderStatus(e.toStatus)}
                        </Typography.Text>
                        <br />
                        <Typography.Text type="secondary">
                          {e.atHk} · {labelActorType(e.actorType)}
                          {e.actorId ? ` #${e.actorId}` : ''}
                        </Typography.Text>
                        {noteLabel ? (
                          <>
                            <br />
                            <Typography.Text type="secondary">
                              {noteLabel.kind === 'driver_report' ? '司機回報：' : '備註：'}
                              {noteLabel.text}
                            </Typography.Text>
                          </>
                        ) : null}
                      </div>
                    ),
                  };
                })}
              />
            </div>
          </Space>
        )}
      </Drawer>
    </Card>
  );
}
