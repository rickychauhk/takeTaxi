import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  addressForCrmDisplay,
  driverCancelReportStatusNote,
  DRIVER_CANCEL_REPORT_LABELS,
  isDriverCancelReportCode,
  isDriverPostBountyPoints,
  ORDER_RECORDS_PAGE_SIZE,
  resolveBusyRegionRewardAtAccept,
  formatHongKongPhoneValidationMessage,
  validateHongKongLocalPhone,
} from '@taxima/shared';
import { paginated, parsePageQuery } from '../../common/pagination';
import { AuditService } from '../audit/audit.service';
import { BookingOptionEntity } from '../booking-options/booking-option.entity';
import { DriverEntity } from '../drivers/driver.entity';
import { DriversService } from '../drivers/drivers.service';
import { DriverOrderPointsService } from '../drivers/driver-order-points.service';
import { PassengerEntity } from '../passengers/passenger.entity';
import { PassengerPointsService } from '../passengers/passenger-points.service';
import { OneSignalDriverService } from '../notifications/onesignal-driver.service';
import { OneSignalPassengerService } from '../notifications/onesignal-passenger.service';
import { PassengersService } from '../passengers/passengers.service';
import {
  applyHkDateRangeFilter,
  applyHkDateTimeFilter,
  formatHkDateTime,
} from './order-datetime-filter';
import { OrderStatusEventEntity } from './order-status-event.entity';
import { OrderStopEntity } from './order-stop.entity';
import { OrderEntity } from './order.entity';
import { OrderVisibilityService } from './order-visibility.service';
import { OrderNotificationsService } from '../realtime/order-notifications.service';
import type { DriverAvailableOrderDto } from './driver-available-order.types';
import { PASSENGER_MATCHING_WATCH_TTL_MS } from './passenger-matching-watch.constants';
import {
  haversineKm,
  isWithinDriverPickupRadius,
} from './driver-pickup-radius.util';
import { AdminMailService } from '../notifications/admin-mail.service';
import { LocationsService } from '../locations/locations.service';
import { OrderChatService } from '../order-chat/order-chat.service';
import { SettingsService } from '../settings/settings.service';
import { MapsPlaceSearchService } from '../maps/maps-place-search.service';
import { MapsService } from '../maps/maps.service';

const ACCEPTED_AT_SQL = `(SELECT e.created_at FROM order_status_events e WHERE e.order_id = o.id AND e.to_status = 'accepted' ORDER BY e.id ASC LIMIT 1)`;

/** 併發接單：慢一步的司機 API 回傳此訊息 */
const ORDER_TAKEN_BY_OTHER_DRIVER = '已被其他司機接單';

/** 司機大廳接單時距上車點超過此距離 → 電郵 admin + CRM 系統日誌（預約單除外） */
const DRIVER_FAR_PICKUP_ALERT_KM = 5;

/** 司機出貨 App 未 geocode 時的預設上車點（多單共用 → 大廳「距你」全同） */
const DRIVER_SHOOT_COORD_FALLBACK = { lat: 22.3193, lng: 114.1694 };

function isDriverShootFallbackCoord(lat: number, lng: number): boolean {
  return (
    Math.abs(lat - DRIVER_SHOOT_COORD_FALLBACK.lat) < 1e-4 &&
    Math.abs(lng - DRIVER_SHOOT_COORD_FALLBACK.lng) < 1e-4
  );
}

/** CRM「即時柯打」：只顯示未派司機 */
const ADMIN_LIVE_ORDER_STATUSES: OrderEntity['status'][] = ['pending', 'matching'];

/** UAT seed `005_demo_uat_data.sql` 固定 ID */
function isUatDemoOrderId(id: string): boolean {
  try {
    const n = BigInt(id);
    return n >= 90001n && n <= 90045n;
  } catch {
    return false;
  }
}

/** Demo 乘客 `005_demo_uat_data.sql`（20001–20008） */
function isDemoPassengerId(passengerId: string | null | undefined): boolean {
  if (!passengerId) return false;
  try {
    const n = BigInt(passengerId);
    return n >= 20001n && n <= 20008n;
  } catch {
    return false;
  }
}

const PASSENGER_PAYMENT_METHODS = ['octopus', 'alipay', 'wechat', 'fps'] as const;
type PassengerPaymentMethod = (typeof PASSENGER_PAYMENT_METHODS)[number];

const PAYMENT_METHOD_LABEL_ZH: Record<PassengerPaymentMethod, string> = {
  octopus: '八達通',
  alipay: '支付寶',
  wechat: 'WeChat Pay',
  fps: '轉數快',
};

type PassengerOrderPlacementNote = {
  remark?: string;
  tipHkd?: number;
  selectedOptionIds?: number[];
  sixSeat?: boolean;
  paymentMethods?: PassengerPaymentMethod[];
  scheduledAt?: string | null;
  pointsRedeemed?: number;
  pointsDiscountHkd?: number;
  grossFareHkd?: number;
  passengerContactCall?: boolean;
  passengerContactSms?: boolean;
  /** 幫人 call 車：司機致電嘅 8 位本地號碼 */
  orderContactPhone?: string;
  companyPrice?: boolean;
  safeDriving?: boolean;
};

/** 乘客重新叫車：還原落單參數（與 App rebookDraft 對齊） */
export type PassengerOrderRebookSnapshot = {
  fareEstimate: number;
  tipHkd: number;
  estimateDistanceMeters: number;
  pointsToRedeem: number;
  sixSeat: boolean;
  paymentMethods: PassengerPaymentMethod[];
  selectedOptionIds: number[];
  remark: string;
  scheduledAt: string | null;
  passengerContactCall: boolean;
  passengerContactSms: boolean;
  orderContactPhone: string | null;
  companyPrice: boolean;
  safeDriving: boolean;
};

function parsePassengerPlacementNote(note: string | null | undefined): PassengerOrderPlacementNote | null {
  if (!note?.trim()) return null;
  try {
    const parsed = JSON.parse(note) as PassengerOrderPlacementNote & { source?: string };
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.source === 'driver_post') return null;
    return parsed;
  } catch {
    return null;
  }
}

type DriverPostPlacementNote = {
  source: 'driver_post';
  remark?: string;
  tipHkd?: number;
  selectedOptionIds?: number[];
  sixSeat?: boolean;
  paymentMethods?: PassengerPaymentMethod[];
  scheduledAt?: string | null;
};

function parseDriverPostPlacementNote(
  note: string | null | undefined,
): DriverPostPlacementNote | null {
  if (!note?.trim()) return null;
  try {
    const parsed = JSON.parse(note) as DriverPostPlacementNote;
    if (!parsed || typeof parsed !== 'object' || parsed.source !== 'driver_post') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** 司機出貨柯打：大廳顯示直出種類、電話；非預約唔顯示用車時間 */
function guestPassengerPhoneFromRemark(remark: string | null | undefined): string | null {
  const guest = remark?.trim().match(/客人電話：([^·]+)/);
  return guest?.[1]?.trim() || null;
}

function resolveCrmPassengerPhone(
  passenger: Pick<PassengerEntity, 'phone'> | null | undefined,
  remark: string | null | undefined,
): string | null {
  const fromProfile = passenger?.phone?.trim();
  if (fromProfile) return fromProfile;
  return guestPassengerPhoneFromRemark(remark);
}

function parseDriverPostPhonesFromRemark(remark: string | null | undefined): {
  guestPhone: string | null;
  ownerPhone: string | null;
} {
  const r = remark?.trim() ?? '';
  const guest = r.match(/客人電話：([^·]+)/)?.[1]?.trim() || null;
  const owner = r.match(/貨主電話：([^·]+)/)?.[1]?.trim() || null;
  return { guestPhone: guest, ownerPhone: owner };
}

function applyDriverPostHallDisplayLines(
  lines: string[],
  remark: string | null,
  scheduledAt: string | null | undefined,
): { guestPhone: string | null; ownerPhone: string | null } {
  const r = remark?.trim() ?? '';

  if (!scheduledAt?.trim()) {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (/^用車時間：/.test(lines[i])) lines.splice(i, 1);
    }
  }

  const directMatch = r.match(/直出·(九折|9两|定食|千足金|公司|寵物)/);
  if (directMatch) {
    const label = directMatch[1] === '9两' ? '九折' : directMatch[1];
    if (!lines.some((l) => l.startsWith('直出：'))) {
      lines.unshift(`直出：${label}`);
    }
  }

  const phones = parseDriverPostPhonesFromRemark(r);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^客人電話：/.test(lines[i]) || /^貨主電話：/.test(lines[i])) {
      lines.splice(i, 1);
    }
  }

  const remarkIdx = lines.findIndex((l) => l.startsWith('備註：'));
  if (remarkIdx < 0) return phones;
  const body = lines[remarkIdx].slice('備註：'.length);
  const kept = body
    .split(/\s*·\s*/)
    .map((p) => p.trim())
    .filter(
      (p) =>
        p &&
        !/^直出·/.test(p) &&
        !/^客人電話：/.test(p) &&
        !/^貨主電話：/.test(p),
    );
  if (kept.length) lines[remarkIdx] = `備註：${kept.join(' · ')}`;
  else lines.splice(remarkIdx, 1);

  return phones;
}

@Injectable()
export class OrdersService {
  private readonly geocodedStopByAddress = new Map<
    string,
    { lat: number; lng: number; label: string }
  >();

  constructor(
    @InjectRepository(OrderEntity) private readonly orders: Repository<OrderEntity>,
    @InjectRepository(DriverEntity) private readonly drivers: Repository<DriverEntity>,
    @InjectRepository(PassengerEntity) private readonly passengers: Repository<PassengerEntity>,
    @InjectRepository(OrderStopEntity) private readonly stops: Repository<OrderStopEntity>,
    @InjectRepository(OrderStatusEventEntity) private readonly statusEvents: Repository<OrderStatusEventEntity>,
    @InjectRepository(BookingOptionEntity) private readonly bookingOptions: Repository<BookingOptionEntity>,
    private readonly visibility: OrderVisibilityService,
    private readonly audit: AuditService,
    private readonly orderNotifications: OrderNotificationsService,
    private readonly dataSource: DataSource,
    private readonly passengerMembers: PassengersService,
    private readonly passengerPoints: PassengerPointsService,
    private readonly driverOrderPoints: DriverOrderPointsService,
    private readonly driversService: DriversService,
    private readonly locations: LocationsService,
    private readonly oneSignalPassenger: OneSignalPassengerService,
    private readonly oneSignalDriver: OneSignalDriverService,
    private readonly orderChat: OrderChatService,
    private readonly adminMail: AdminMailService,
    private readonly mapsPlaceSearch: MapsPlaceSearchService,
    private readonly maps: MapsService,
    private readonly settings: SettingsService,
  ) {}

  /** 大廳顯示：司機→上車點行車公里（Distance Matrix） */
  private async attachPickupDrivingDistanceKm(
    dtos: DriverAvailableOrderDto[],
    driverPosition: { lat: number; lng: number },
  ): Promise<DriverAvailableOrderDto[]> {
    if (!dtos.length) return dtos;
    const destinations: { lat: number; lng: number }[] = [];
    const indexByOrder: number[] = [];
    for (let i = 0; i < dtos.length; i++) {
      const d = dtos[i]!;
      const lat = d.pickupLat;
      const lng = d.pickupLng;
      if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        indexByOrder.push(-1);
        continue;
      }
      indexByOrder.push(destinations.length);
      destinations.push({ lat, lng });
    }
    if (!destinations.length) return dtos;

    const kms = await this.maps.drivingDistanceMatrixKm(driverPosition, destinations);
    return dtos.map((dto, i) => {
      const destIdx = indexByOrder[i];
      if (destIdx < 0) return dto;
      const km = kms[destIdx];
      if (km == null || !Number.isFinite(km)) return dto;
      return { ...dto, pickupDistanceKm: km };
    });
  }

  /** DB 內仍為出貨 fallback 的上／落車點：geocode 並寫回（大廳距離、舊單修正） */
  private async geocodeOrderStopIfFallback(stop: OrderStopEntity): Promise<OrderStopEntity> {
    const lat = Number(stop.lat);
    const lng = Number(stop.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return stop;
    if (!isDriverShootFallbackCoord(lat, lng)) return stop;
    const address = stop.addressText?.trim();
    if (!address || address.length < 2) return stop;

    const cached = this.geocodedStopByAddress.get(address);
    if (cached) {
      return {
        ...stop,
        lat: String(cached.lat),
        lng: String(cached.lng),
        addressText: cached.label || stop.addressText,
      };
    }

    const hit = await this.mapsPlaceSearch.geocodeAddressHongKong(address);
    if (!hit) return stop;

    const resolved = {
      lat: hit.latitude,
      lng: hit.longitude,
      label: hit.label?.trim() || address,
    };
    this.geocodedStopByAddress.set(address, resolved);

    try {
      await this.stops.update(
        { id: stop.id },
        { lat: String(resolved.lat), lng: String(resolved.lng), addressText: resolved.label },
      );
    } catch {
      /* 仍用記憶體結果組 DTO */
    }

    return {
      ...stop,
      lat: String(resolved.lat),
      lng: String(resolved.lng),
      addressText: resolved.label,
    };
  }

  private async resolveFallbackStopsInMap(stopMap: Map<string, OrderStopEntity[]>): Promise<void> {
    const jobs: Promise<void>[] = [];
    for (const stops of stopMap.values()) {
      for (let i = 0; i < stops.length; i++) {
        const idx = i;
        jobs.push(
          this.geocodeOrderStopIfFallback(stops[idx]!).then((resolved) => {
            stops[idx] = resolved;
          }),
        );
      }
    }
    await Promise.all(jobs);
  }

  /** 出貨 stop 仍為 fallback 座標時，用地址文字 geocode */
  private async resolveDriverPostStopCoords(stop: {
    lat: number;
    lng: number;
    label: string;
  }): Promise<{ lat: number; lng: number; label: string }> {
    const lat = Number(stop.lat);
    const lng = Number(stop.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return stop;
    if (!isDriverShootFallbackCoord(lat, lng)) return stop;
    const label = stop.label?.trim();
    if (!label || label.length < 2) return stop;
    const hit = await this.mapsPlaceSearch.geocodeAddressHongKong(label);
    if (!hit) return stop;
    return {
      lat: hit.latitude,
      lng: hit.longitude,
      label: hit.label?.trim() || label,
    };
  }

  private async filterDtosByDriverPickupRadius(
    driverId: string,
    dtos: DriverAvailableOrderDto[],
    maxPickupRadiusKm: number | null | undefined,
    driverPosition?: { lat: number; lng: number } | null,
  ): Promise<DriverAvailableOrderDto[]> {
    if (maxPickupRadiusKm == null || maxPickupRadiusKm <= 0) return dtos;
    /** 設了接單公里數時必須用 App 即時 GPS；勿用 live_locations 舊座標誤判 */
    const pos = driverPosition ?? null;
    if (!pos) {
      return dtos.filter(
        (dto) =>
          dto.orderType === 'driver_posted' && dto.postedByDriverId === driverId,
      );
    }
    return dtos.filter(
      (dto) =>
        (dto.orderType === 'driver_posted' && dto.postedByDriverId === driverId) ||
        isWithinDriverPickupRadius(
          pos.lat,
          pos.lng,
          dto.pickupLat,
          dto.pickupLng,
          maxPickupRadiusKm,
        ),
    );
  }

  private async toAdminLiveRow(orderId: string) {
    const rows = await this.listLiveOrdersForAdmin();
    return rows.find((r) => r.orderId === orderId) ?? null;
  }

  private async notifyAdminOrder(type: 'created' | 'updated', orderId: string) {
    const order = await this.toAdminLiveRow(orderId);
    if (order) {
      this.orderNotifications.publishAdminOrderEvent({ type, order });
    } else if (type === 'updated') {
      this.orderNotifications.publishAdminOrderEvent({ type: 'removed', orderId });
    }
    await this.notifyDriverSockets(orderId, type);
    if (type === 'created') {
      this.scheduleDriverVisibilityReminders(orderId);
    }
  }

  private scheduleDriverVisibilityReminders(orderId: string) {
    const adminSec = Number(process.env.ORDER_ADMIN_PREVIEW_SECONDS ?? 2);
    const delaysMs = [adminSec * 1000, (adminSec + 2) * 1000, (adminSec + 5) * 1000];
    for (const ms of delaysMs) {
      setTimeout(() => {
        void this.notifyDriverSockets(orderId, 'updated');
      }, ms);
    }
  }

  private passengerPointsRedemptionFromOrder(o: OrderEntity) {
    const passengerPointsRedeemed =
      o.passengerPointsRedeemed != null && o.passengerPointsRedeemed !== ''
        ? Math.round(Number(o.passengerPointsRedeemed))
        : null;
    const passengerPointsDiscountHkd =
      o.passengerPointsDiscountHkd != null && o.passengerPointsDiscountHkd !== ''
        ? Number(o.passengerPointsDiscountHkd)
        : null;
    const passengerPointsHkdPerPointAtOrder =
      o.passengerPointsHkdPerPointAtOrder != null && o.passengerPointsHkdPerPointAtOrder !== ''
        ? Number(o.passengerPointsHkdPerPointAtOrder)
        : null;
    return {
      passengerPointsRedeemed,
      passengerPointsDiscountHkd,
      passengerPointsHkdPerPointAtOrder,
    };
  }

  /** CRM 接單積分／繁忙獎賞／地區配對：只適用乘客 App 柯打；出貨以貨主懸賞為準 */
  private usesPassengerAppDriverPointsRules(
    order: Pick<OrderEntity, 'orderType'>,
  ): boolean {
    return order.orderType !== 'driver_posted';
  }

  private toDriverAvailableDto(
    o: OrderEntity,
    stopMap: Map<string, OrderStopEntity[]>,
  ): DriverAvailableOrderDto {
    const passengerPtsRules = this.usesPassengerAppDriverPointsRules(o);
    const stops = stopMap.get(o.id);
    const summary = this.mapStopSummary(stops);
    const pickupStop = stops?.[0];
    const dropoffStop = stops && stops.length > 1 ? stops[stops.length - 1] : undefined;
    return {
      orderId: o.id,
      orderType: o.orderType,
      postedByDriverId: o.postedByDriverId ?? null,
      status: o.status,
      fareEstimate: o.fareEstimate,
      pickupAddress: summary.pickup,
      dropoffAddress: summary.dropoff,
      stopCount: summary.stopCount,
      pickupLat: pickupStop ? this.stopCoord(pickupStop) : null,
      pickupLng: pickupStop?.lng != null ? Number(pickupStop.lng) : null,
      dropoffLat: dropoffStop ? this.stopCoord(dropoffStop) : null,
      dropoffLng: dropoffStop?.lng != null ? Number(dropoffStop.lng) : null,
      createdAt: o.createdAt.toISOString(),
      scheduledAt: o.scheduledAt ? o.scheduledAt.toISOString() : null,
      ...this.passengerPointsRedemptionFromOrder(o),
      driverPointsCostAtOrder: (() => {
        if (passengerPtsRules) {
          return o.driverPointsCostAtOrder != null && o.driverPointsCostAtOrder !== ''
            ? Math.round(Number(o.driverPointsCostAtOrder))
            : null;
        }
        const bounty =
          o.driverPostBountyPoints != null && o.driverPostBountyPoints !== ''
            ? Math.round(Number(o.driverPostBountyPoints))
            : 0;
        return bounty > 0 ? bounty : null;
      })(),
      driverPointsBusySurcharge:
        passengerPtsRules &&
        o.driverPointsBusySurcharge != null &&
        o.driverPointsBusySurcharge !== ''
          ? Math.round(Number(o.driverPointsBusySurcharge))
          : null,
      driverPostBountyPoints:
        o.driverPostBountyPoints != null && o.driverPostBountyPoints !== ''
          ? Math.round(Number(o.driverPostBountyPoints))
          : null,
      driverBusyRegionRewardPoints: null,
      driverBusyRegionFromArea: null,
      driverBusyRegionToArea: null,
      passengerPhone: null,
      passengerContactCall: false,
      passengerContactSms: false,
      bookingOptionLines: [],
    };
  }

  private async attachBookingOptionLinesToDriverDtos(
    dtos: DriverAvailableOrderDto[],
  ): Promise<DriverAvailableOrderDto[]> {
    if (!dtos.length) return dtos;
    const bookingMap = await this.buildPassengerBookingDisplay(dtos.map((d) => d.orderId));
    return dtos.map((dto) => {
      const booking = bookingMap.get(dto.orderId);
      return {
        ...dto,
        bookingOptionLines: booking?.bookingOptionLines ?? [],
        driverPostGuestPhone: booking?.driverPostGuestPhone ?? null,
        driverPostOwnerPhone: booking?.driverPostOwnerPhone ?? null,
      };
    });
  }

  private async attachPassengerContactPrefsToDriverDtos(
    dtos: DriverAvailableOrderDto[],
  ): Promise<DriverAvailableOrderDto[]> {
    if (!dtos.length) return dtos;
    const orderIds = dtos.map((d) => d.orderId);
    const events = await this.statusEvents.find({
      where: { orderId: In(orderIds), toStatus: 'matching', actorType: 'passenger' },
      order: { id: 'ASC' },
    });
    const noteByOrder = new Map<string, PassengerOrderPlacementNote>();
    for (const e of events) {
      if (noteByOrder.has(e.orderId)) continue;
      const parsed = parsePassengerPlacementNote(e.note);
      if (parsed) noteByOrder.set(e.orderId, parsed);
    }
    return dtos.map((dto) => {
      const n = noteByOrder.get(dto.orderId);
      if (!n) return dto;
      return {
        ...dto,
        passengerContactCall: !!n.passengerContactCall,
        passengerContactSms: !!n.passengerContactSms,
      };
    });
  }

  private async passengerPhoneForAssignedOrder(order: OrderEntity): Promise<string | null> {
    if (!order.driverId) return null;
    const note = await this.passengerPlacementNoteForOrder(order.id);
    const override = note?.orderContactPhone?.trim();
    if (override) {
      const v = validateHongKongLocalPhone(override);
      if (v.ok) return v.local8;
    }
    if (!order.passengerId) return null;
    const passenger = await this.passengers.findOneBy({ id: order.passengerId });
    const phone = passenger?.phone?.trim();
    return phone || null;
  }

  /** 司機待接柯打：附繁忙地區獎賞預覽（WebSocket / GET available） */
  private async attachBusyRegionRewardPreview(
    dtos: DriverAvailableOrderDto[],
    orders: OrderEntity[],
  ): Promise<DriverAvailableOrderDto[]> {
    if (!dtos.length) return dtos;
    const orderById = new Map(orders.map((o) => [o.id, o]));
    const [busyHours, regionRewards] = await Promise.all([
      this.driverOrderPoints.getBusyHoursConfig(),
      this.driverOrderPoints.getBusyRegionRewardsConfig(),
    ]);
    return dtos.map((dto) => {
      const order = orderById.get(dto.orderId);
      if (!order || !this.usesPassengerAppDriverPointsRules(order)) return dto;
      const placedAt = order.createdAt;
      const rule = resolveBusyRegionRewardAtAccept({
        placedAt,
        pickupAddress: dto.pickupAddress,
        dropoffAddress: dto.dropoffAddress,
        busyHours,
        regionRewards,
      });
      if (!rule) return dto;
      return {
        ...dto,
        driverBusyRegionRewardPoints: rule.rewardPoints,
        driverBusyRegionFromArea: rule.fromArea,
        driverBusyRegionToArea: rule.toArea,
      };
    });
  }

  /** 乘客預約單：用車時間行顯示完整 HKT 日期時間 */
  private enrichScheduledVehicleTimeOnDriverDtos(
    dtos: DriverAvailableOrderDto[],
    orders: OrderEntity[],
  ): DriverAvailableOrderDto[] {
    const scheduledById = new Map(
      orders
        .filter((o) => o.scheduledAt)
        .map((o) => [o.id, o.scheduledAt!.toISOString()] as const),
    );
    return dtos.map((dto) => {
      const iso = dto.scheduledAt?.trim() || scheduledById.get(dto.orderId);
      if (!iso) return dto;
      const timeLine = `用車時間：${formatHkDateTime(iso)}`;
      const lines = [...(dto.bookingOptionLines ?? [])];
      let replaced = false;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('用車時間：')) {
          lines[i] = timeLine;
          replaced = true;
          break;
        }
      }
      if (!replaced && !lines.some((l) => l.startsWith('預約時間：'))) {
        lines.unshift(timeLine);
      }
      return {
        ...dto,
        scheduledAt: iso,
        bookingOptionLines: lines,
      };
    });
  }

  private async buildDriverAvailableDtosForOrders(
    orders: OrderEntity[],
    stopMap: Map<string, OrderStopEntity[]>,
  ): Promise<DriverAvailableOrderDto[]> {
    await this.resolveFallbackStopsInMap(stopMap);
    const dtos = orders.map((o) => this.toDriverAvailableDto(o, stopMap));
    const withBusy = await this.attachBusyRegionRewardPreview(dtos, orders);
    const withContact = await this.attachPassengerContactPrefsToDriverDtos(withBusy);
    const withBooking = await this.attachBookingOptionLinesToDriverDtos(withContact);
    return this.enrichScheduledVehicleTimeOnDriverDtos(withBooking, orders);
  }

  /** 舊版出貨：發單時預扣懸賞 → 完成後發予接單司機（新版改為接單扣接單人、入帳出貨人） */
  private async payoutDriverPostBountyOnTripComplete(
    order: OrderEntity,
    orderId: string,
  ): Promise<void> {
    const posterId = order.postedByDriverId;
    const accepterId = order.driverId;
    const bounty = this.bountyPointsFrom(order);
    if (!posterId || !accepterId || bounty <= 0) return;

    const posterPaidOnAccept = await this.driverOrderPoints.hasLedgerEntry(
      posterId,
      'driver_post_bounty_poster_payout',
      orderId,
    );
    if (posterPaidOnAccept) return;

    await this.driverOrderPoints.rewardDriverPostBountyToAccepter(orderId, accepterId, bounty);
    this.orderNotifications.emitDriverPostedOrderNotice(posterId, {
      orderId,
      kind: 'accepted',
      message: `柯打 #${orderId} 已完成，懸賞 ${bounty} 積分已發放予接單司機。`,
    });
  }

  private bountyPointsFrom(order: OrderEntity): number {
    if (order.driverPostBountyPoints == null || order.driverPostBountyPoints === '') return 0;
    const n = Math.round(Number(order.driverPostBountyPoints));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  /** 接單扣減：乘客 App 用落單快照；出貨用柯打分數（接單司機付給出貨人） */
  private acceptPointsChargeForOrder(order: OrderEntity): string | null {
    if (this.usesPassengerAppDriverPointsRules(order)) {
      return order.driverPointsCostAtOrder;
    }
    const bounty = this.bountyPointsFrom(order);
    return bounty > 0 ? String(bounty) : null;
  }

  private async applyDriverPostBountyOnAccept(
    order: OrderEntity,
    accepterDriverId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const posterId = order.postedByDriverId;
    const bounty = this.bountyPointsFrom(order);
    if (!posterId || bounty <= 0 || this.usesPassengerAppDriverPointsRules(order)) return;
    await this.driverOrderPoints.rewardDriverPostBountyToPoster(
      order.id,
      posterId,
      bounty,
      manager,
    );
  }

  private async filterDriverPostedLiveOrders(orders: OrderEntity[]) {
    if (!orders.length) return [];
    const ids = orders.map((o) => o.id);
    const stopMap = await this.attachStops(ids);
    return orders.filter((o) => {
      if (o.orderType !== 'driver_posted' || !o.postedByDriverId) return false;
      if (o.status !== 'matching' && o.status !== 'pending') return false;
      return (stopMap.get(o.id)?.length ?? 0) >= 2;
    });
  }

  private async filterOpenOrdersForDrivers(orders: OrderEntity[]) {
    const [passenger, posted] = await Promise.all([
      this.filterPassengerAppLiveOrders(orders),
      this.filterDriverPostedLiveOrders(orders),
    ]);
    const byId = new Map<string, OrderEntity>();
    for (const o of [...passenger, ...posted]) byId.set(o.id, o);
    return [...byId.values()];
  }

  private async notifyDriverSockets(orderId: string, eventType: 'created' | 'updated' = 'updated') {
    const order = await this.orders.findOneBy({ id: orderId });
    if (!order) {
      this.orderNotifications.broadcastDriverOrderRemoved(orderId);
      return;
    }
    const live = await this.filterOpenOrdersForDrivers([order]);
    const row = live[0];
    if (!row || !ADMIN_LIVE_ORDER_STATUSES.includes(row.status)) {
      this.orderNotifications.broadcastDriverOrderRemoved(orderId);
      return;
    }
    const stopMap = await this.attachStops([orderId]);
    const [dto] = await this.buildDriverAvailableDtosForOrders([row], stopMap);
    await this.orderNotifications.emitDriverOrderToEligibleDrivers(
      row,
      dto,
      this.visibility,
      eventType,
    );
    if (eventType === 'created') {
      void this.orderNotifications.pushNewOrderToEligibleOnlineDrivers(row, dto, this.visibility);
    }
  }

  /** 只保留乘客 App 落嘅待派柯打（有站點 + matching 事件 actor=passenger） */
  /** 即時待派單：乘客 App 須持續心跳，否則唔顯示喺司機大廳 */
  private requiresPassengerMatchingWatch(order: Pick<OrderEntity, 'scheduledAt' | 'status'>) {
    if (order.status !== 'matching' && order.status !== 'pending') return false;
    if (!order.scheduledAt) return true;
    return order.scheduledAt.getTime() <= Date.now();
  }

  private passengerMatchingWatchEffectiveAt(order: Pick<OrderEntity, 'passengerMatchingWatchAt' | 'createdAt'>) {
    return order.passengerMatchingWatchAt ?? order.createdAt;
  }

  isPassengerPresentInMatchingHall(order: OrderEntity): boolean {
    if (!this.requiresPassengerMatchingWatch(order)) return true;
    const at = this.passengerMatchingWatchEffectiveAt(order).getTime();
    return Date.now() - at <= PASSENGER_MATCHING_WATCH_TTL_MS;
  }

  /** Sweeper：仍 matching/pending 但心跳過期嘅即時乘客單 */
  async listInstantMatchingOrdersMissingPassengerWatch(): Promise<string[]> {
    const open = await this.orders.find({
      where: [{ status: 'matching' }, { status: 'pending' }],
      order: { updatedAt: 'DESC' },
      take: 200,
    });
    const passengerLive = await this.filterPassengerAppLiveOrders(open, { skipWatchCheck: true });
    const liveIds = new Set(passengerLive.map((o) => o.id));
    return open
      .filter((o) => liveIds.has(o.id) && !this.isPassengerPresentInMatchingHall(o))
      .map((o) => o.id);
  }

  async touchPassengerMatchingWatch(orderId: string, passengerId: string) {
    const order = await this.orders.findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('Order not found');
    if (order.passengerId !== passengerId) {
      throw new ForbiddenException('此柯打不屬於你');
    }
    if (order.status !== 'matching' && order.status !== 'pending') {
      return { ok: true, watched: false };
    }
    const now = new Date();
    await this.orders.update({ id: orderId }, { passengerMatchingWatchAt: now });
    return { ok: true, watched: true };
  }

  private async filterPassengerAppLiveOrders(
    orders: OrderEntity[],
    opts?: { skipWatchCheck?: boolean },
  ) {
    if (!orders.length) return [];
    const ids = orders.map((o) => o.id);
    const stopMap = await this.attachStops(ids);
    const events = await this.statusEvents.find({
      where: { orderId: In(ids), toStatus: 'matching', actorType: 'passenger' },
      select: ['orderId'],
    });
    const passengerPlaced = new Set(events.map((e) => e.orderId));
    return orders.filter((o) => {
      if (isUatDemoOrderId(o.id) || isDemoPassengerId(o.passengerId)) return false;
      if (!passengerPlaced.has(o.id)) return false;
      if ((stopMap.get(o.id)?.length ?? 0) < 2) return false;
      if (!opts?.skipWatchCheck && !this.isPassengerPresentInMatchingHall(o)) return false;
      return true;
    });
  }

  /** 待派柯打（CRM WebSocket 快照 + 推送；已接單唔顯示） */
  async listLiveOrdersForAdmin() {
    const raw = await this.orders.find({
      where: { status: In(ADMIN_LIVE_ORDER_STATUSES) },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    const filtered = await this.filterPassengerAppLiveOrders(raw);
    const stopMap = await this.attachStops(filtered.map((o) => o.id));
    const passengerIds = filtered.map((o) => o.passengerId).filter(Boolean) as string[];
    const passengers = passengerIds.length
      ? await this.passengers.findBy({ id: In(passengerIds) })
      : [];
    const pMap = new Map(passengers.map((p) => [p.id, p]));
    const bookingMap = await this.buildPassengerBookingDisplay(filtered.map((o) => o.id));

    return filtered.map((o) => {
      const { pickup, dropoff, stopCount } = this.mapStopSummary(stopMap.get(o.id));
      const p = o.passengerId ? pMap.get(o.passengerId) : undefined;
      const booking = bookingMap.get(o.id) ?? {
        tipHkd: 0,
        remark: null,
        bookingOptionLines: [] as string[],
      };
      return {
        orderId: o.id,
        orderType: o.orderType,
        status: o.status,
        fareEstimate: o.fareEstimate,
        fareFinal: o.fareFinal,
        passengerId: p?.id ?? null,
        passengerName: p?.displayName ?? null,
        placedAtHk: formatHkDateTime(o.createdAt),
        pickupAddress: pickup,
        dropoffAddress: dropoff,
        stopCount,
        tipHkd: booking.tipHkd,
        remark: booking.remark,
        bookingOptionLines: booking.bookingOptionLines,
        driverPointsCostAtOrder:
          o.driverPointsCostAtOrder != null && o.driverPointsCostAtOrder !== ''
            ? Math.round(Number(o.driverPointsCostAtOrder))
            : null,
        driverPointsBusySurcharge:
          o.driverPointsBusySurcharge != null && o.driverPointsBusySurcharge !== ''
            ? Math.round(Number(o.driverPointsBusySurcharge))
            : null,
      };
    });
  }

  /** 乘客落單時寫入 matching event note（選項 ID、貼士、備註） */
  private async buildPassengerBookingDisplay(orderIds: string[]) {
    const out = new Map<
      string,
      {
        tipHkd: number;
        remark: string | null;
        bookingOptionLines: string[];
        driverPostGuestPhone?: string | null;
        driverPostOwnerPhone?: string | null;
      }
    >();
    if (!orderIds.length) return out;

    const events = await this.statusEvents.find({
      where: { orderId: In(orderIds), toStatus: 'matching' },
      order: { id: 'ASC' },
    });
    const noteByOrder = new Map<string, PassengerOrderPlacementNote>();
    const driverPostByOrder = new Map<string, DriverPostPlacementNote>();
    for (const e of events) {
      if (noteByOrder.has(e.orderId) || driverPostByOrder.has(e.orderId)) continue;
      const passenger = parsePassengerPlacementNote(e.note);
      if (passenger) {
        noteByOrder.set(e.orderId, passenger);
        continue;
      }
      const driverPost = parseDriverPostPlacementNote(e.note);
      if (driverPost) driverPostByOrder.set(e.orderId, driverPost);
    }

    const allOptionIds = new Set<number>();
    for (const n of noteByOrder.values()) {
      for (const id of n.selectedOptionIds ?? []) {
        if (Number.isFinite(id)) allOptionIds.add(id);
      }
    }
    for (const n of driverPostByOrder.values()) {
      for (const id of n.selectedOptionIds ?? []) {
        if (Number.isFinite(id)) allOptionIds.add(id);
      }
    }

    const optionRows = allOptionIds.size
      ? await this.bookingOptions.find({
          where: { id: In([...allOptionIds]) },
          relations: ['category'],
        })
      : [];
    const optionById = new Map(optionRows.map((o) => [o.id, o]));

    const appendBookingLinesFromNote = (
      n: Pick<
        PassengerOrderPlacementNote,
        | 'selectedOptionIds'
        | 'sixSeat'
        | 'tipHkd'
        | 'paymentMethods'
        | 'scheduledAt'
        | 'remark'
      >,
      lines: string[],
      opts: { passengerExtras?: boolean },
    ) => {
      const ids = n.selectedOptionIds ?? [];
      const selectedOpts = ids
        .map((id) => optionById.get(id))
        .filter((o): o is BookingOptionEntity => !!o);
      selectedOpts.sort(
        (a, b) =>
          (a.category?.sortOrder ?? 0) - (b.category?.sortOrder ?? 0) ||
          a.sortOrder - b.sortOrder,
      );
      for (const opt of selectedOpts) {
        const cat = opt.category?.labelZh ?? '選項';
        lines.push(`${cat}：${opt.labelZh}`);
      }
      if (opts.passengerExtras) {
        const passengerNote = n as PassengerOrderPlacementNote;
        if (passengerNote.companyPrice) {
          lines.push('價格：公司價');
        } else if (!lines.some((l) => l.startsWith('價格：'))) {
          lines.push('價格：正價');
        }
        if (passengerNote.safeDriving) {
          lines.push('駕駛偏好：安全駕駛');
        }
        const pointsRedeemed = Math.round(Number(passengerNote.pointsRedeemed ?? 0));
        if (pointsRedeemed > 0) {
          const discountHkd = Math.round(Number(passengerNote.pointsDiscountHkd ?? 0));
          lines.push(
            discountHkd > 0
              ? `乘客積分：${pointsRedeemed} 分（減 HK$${discountHkd}）`
              : `乘客積分：${pointsRedeemed} 分`,
          );
        }
        const contactBits: string[] = [];
        if (passengerNote.passengerContactCall) contactBits.push('致電給我');
        if (passengerNote.passengerContactSms) contactBits.push('短訊給我');
        if (contactBits.length) lines.push(`聯絡偏好：${contactBits.join('、')}`);
      }
      if (n.sixSeat && !lines.some((l) => l.includes('6座'))) {
        lines.push('座位：6座');
      }
      if (n.tipHkd && n.tipHkd > 0) {
        lines.push(`貼士：HK$${n.tipHkd}`);
      }
      const payMethods = (n.paymentMethods ?? []).filter((m): m is PassengerPaymentMethod =>
        (PASSENGER_PAYMENT_METHODS as readonly string[]).includes(m),
      );
      if (payMethods.length) {
        const labels = payMethods.map((m) => PAYMENT_METHOD_LABEL_ZH[m]);
        lines.push(`電子付款：${labels.join('、')}`);
      }
      if (n.scheduledAt) {
        lines.push(`預約時間：${formatHkDateTime(n.scheduledAt)}`);
      }
      const remark = n.remark?.trim() || null;
      if (remark) lines.push(`備註：${remark}`);
      return remark;
    };

    for (const orderId of orderIds) {
      const n = noteByOrder.get(orderId);
      const driverPost = driverPostByOrder.get(orderId);
      const lines: string[] = [];
      if (n) {
        const remark = appendBookingLinesFromNote(n, lines, { passengerExtras: true });
        out.set(orderId, { tipHkd: n.tipHkd ?? 0, remark, bookingOptionLines: lines });
      } else if (driverPost) {
        const remark = appendBookingLinesFromNote(driverPost, lines, { passengerExtras: false });
        const phones = applyDriverPostHallDisplayLines(lines, remark, driverPost.scheduledAt);
        out.set(orderId, {
          tipHkd: driverPost.tipHkd ?? 0,
          remark,
          bookingOptionLines: lines,
          driverPostGuestPhone: phones.guestPhone,
          driverPostOwnerPhone: phones.ownerPhone,
        });
      } else {
        out.set(orderId, { tipHkd: 0, remark: null, bookingOptionLines: [] });
      }
    }
    return out;
  }

  async createPassengerInstantOrder(input: {
    pickup: { lat: number; lng: number; label: string };
    dropoff: { lat: number; lng: number; label: string };
    fareEstimate: number;
    estimateDistanceMeters?: number;
    tipHkd?: number;
    appClientId: string;
    remark?: string;
    selectedOptionIds?: number[];
    sixSeat?: boolean;
    paymentMethods?: PassengerPaymentMethod[];
    scheduledAt?: string;
    passengerId?: string;
    pointsToRedeem?: number;
    passengerContactCall?: boolean;
    passengerContactSms?: boolean;
    orderContactPhone?: string;
    companyPrice?: boolean;
    safeDriving?: boolean;
  }) {
    const passenger = input.passengerId
      ? await this.passengerMembers.findActiveById(input.passengerId)
      : await this.passengerMembers.getOrCreateByAppClientId(input.appClientId);
    if (!passenger) throw new BadRequestException('Passenger not found');
    const passengerId = passenger.id;

    const grossFare =
      input.fareEstimate + (input.tipHkd && input.tipHkd > 0 ? input.tipHkd : 0);

    const [hkdPerPoint, redeemEnabled] = await Promise.all([
      this.passengerPoints.getHkdPerPoint(),
      this.passengerPoints.isPointsRedeemEnabled(),
    ]);
    const pointsRequested = input.pointsToRedeem ?? 0;
    if (!redeemEnabled && pointsRequested > 0) {
      throw new BadRequestException('積分抵扣功能已暫停');
    }
    const balance = Math.round(Number(passenger.pointsBalance ?? 0));
    const { pointsRedeemed, discountHkd, netFareHkd } = this.passengerPoints.computeRedemption({
      grossFareHkd: grossFare,
      pointsBalance: balance,
      pointsRequested: redeemEnabled ? pointsRequested : 0,
      hkdPerPoint,
    });

    let scheduledAtDate: Date | null = null;
    if (input.scheduledAt?.trim()) {
      if (!(await this.settings.isScheduledOrdersEnabled())) {
        throw new BadRequestException('預約叫車功能已暫停');
      }
      scheduledAtDate = new Date(input.scheduledAt);
      if (Number.isNaN(scheduledAtDate.getTime())) {
        throw new BadRequestException('Invalid scheduledAt');
      }
      if (scheduledAtDate.getTime() <= Date.now()) {
        throw new BadRequestException('scheduledAt must be in the future');
      }
    }

    let estimateDistanceKm: string | null = null;
    if (
      input.estimateDistanceMeters != null &&
      Number.isFinite(input.estimateDistanceMeters) &&
      input.estimateDistanceMeters >= 0
    ) {
      estimateDistanceKm = String(Math.round(input.estimateDistanceMeters / 1000));
    }

    const paymentMethods = (input.paymentMethods ?? []).filter((m): m is PassengerPaymentMethod =>
      (PASSENGER_PAYMENT_METHODS as readonly string[]).includes(m),
    );

    const safeDriving = !!input.safeDriving;
    const sixSeat = !!input.sixSeat;
    const seatExtrasRequireRegular = await this.bookingOptionIdsRequireRegularPrice(
      input.selectedOptionIds ?? [],
    );
    if (
      input.companyPrice &&
      (safeDriving || sixSeat || seatExtrasRequireRegular)
    ) {
      throw new BadRequestException('安全駕駛、五座或六座只可选用正价');
    }
    const companyPrice = !!input.companyPrice;

    let orderContactPhoneLocal: string | undefined;
    if (input.orderContactPhone?.trim()) {
      const phoneV = validateHongKongLocalPhone(input.orderContactPhone);
      if (!phoneV.ok) {
        throw new BadRequestException(formatHongKongPhoneValidationMessage(phoneV));
      }
      orderContactPhoneLocal = phoneV.local8;
    }

    const placedAt = new Date();
    const driverPtsSnapshot = await this.driverOrderPoints.snapshotForOrderPlacement(placedAt);

    const note = JSON.stringify({
      remark: input.remark ?? '',
      tipHkd: input.tipHkd ?? 0,
      selectedOptionIds: input.selectedOptionIds ?? [],
      sixSeat,
      paymentMethods,
      scheduledAt: scheduledAtDate ? scheduledAtDate.toISOString() : null,
      pointsRedeemed,
      pointsDiscountHkd: discountHkd,
      grossFareHkd: grossFare,
      passengerContactCall: !!input.passengerContactCall,
      passengerContactSms: !!input.passengerContactSms,
      ...(orderContactPhoneLocal ? { orderContactPhone: orderContactPhoneLocal } : {}),
      companyPrice,
      safeDriving,
    });

    const order = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(OrderEntity, {
          orderType: scheduledAtDate ? 'scheduled' : 'instant',
          passengerId,
          status: 'matching',
          passengerMatchingWatchAt: placedAt,
          fareEstimate: netFareHkd.toFixed(2),
          estimateDistanceKm,
          scheduledAt: scheduledAtDate,
          passengerPointsRedeemed: pointsRedeemed > 0 ? String(pointsRedeemed) : null,
          passengerPointsDiscountHkd: discountHkd > 0 ? discountHkd.toFixed(2) : null,
          passengerPointsHkdPerPointAtOrder:
            pointsRedeemed > 0 ? String(Math.round(hkdPerPoint)) : null,
          driverPointsCostAtOrder:
            driverPtsSnapshot.total > 0 ? String(driverPtsSnapshot.total) : null,
          driverPointsBusySurcharge:
            driverPtsSnapshot.busySurcharge > 0 ? String(driverPtsSnapshot.busySurcharge) : null,
        }),
      );

      await manager.save([
        manager.create(OrderStopEntity, {
          orderId: saved.id,
          seq: 0,
          addressText: input.pickup.label,
          lat: String(input.pickup.lat),
          lng: String(input.pickup.lng),
        }),
        manager.create(OrderStopEntity, {
          orderId: saved.id,
          seq: 1,
          addressText: input.dropoff.label,
          lat: String(input.dropoff.lat),
          lng: String(input.dropoff.lng),
        }),
      ]);

      if (pointsRedeemed > 0) {
        await this.passengerPoints.redeemPointsForOrder(
          saved.id,
          passengerId,
          pointsRedeemed,
          discountHkd,
          manager,
        );
      }

      await manager.save(
        manager.create(OrderStatusEventEntity, {
          orderId: saved.id,
          fromStatus: null,
          toStatus: 'matching',
          actorType: 'passenger',
          actorId: passengerId,
          note,
        }),
      );

      return saved;
    });

    await this.notifyAdminOrder('created', order.id);
    return order;
  }

  /** 司機射柯打：無乘客，懸賞積分由發單司機預扣，接單司機獲賞 */
  async createDriverPostedOrder(input: {
    driverId: string;
    pickup: { lat: number; lng: number; label: string };
    dropoff: { lat: number; lng: number; label: string };
    fareEstimate: number;
    estimateDistanceMeters?: number;
    bountyPoints: number;
    tipHkd?: number;
    remark?: string;
    selectedOptionIds?: number[];
    sixSeat?: boolean;
    paymentMethods?: PassengerPaymentMethod[];
    scheduledAt?: string;
  }) {
    const driver = await this.drivers.findOneBy({ id: input.driverId, isActive: true });
    if (!driver) throw new NotFoundException('司機不存在');
    this.driversService.assertDriverEligibleForDispatch(driver);

    const bounty = Math.round(input.bountyPoints ?? 0);
    if (!isDriverPostBountyPoints(bounty)) {
      throw new BadRequestException('懸賞積分只可選 0、3、5、8、12');
    }

    let estimateDistanceKm: string | null = null;
    if (
      input.estimateDistanceMeters != null &&
      Number.isFinite(input.estimateDistanceMeters) &&
      input.estimateDistanceMeters >= 0
    ) {
      estimateDistanceKm = String(Math.round(input.estimateDistanceMeters / 1000));
    }

    let scheduledAtDate: Date | null = null;
    if (input.scheduledAt?.trim()) {
      if (!(await this.settings.isScheduledOrdersEnabled())) {
        throw new BadRequestException('預約叫車功能已暫停');
      }
      scheduledAtDate = new Date(input.scheduledAt);
      if (Number.isNaN(scheduledAtDate.getTime())) {
        throw new BadRequestException('Invalid scheduledAt');
      }
      if (scheduledAtDate.getTime() <= Date.now()) {
        throw new BadRequestException('scheduledAt must be in the future');
      }
    }

    const paymentMethods = (input.paymentMethods ?? []).filter((m): m is PassengerPaymentMethod =>
      (PASSENGER_PAYMENT_METHODS as readonly string[]).includes(m),
    );

    const fare = Math.max(0, Math.round(input.fareEstimate * 100) / 100);

    const [pickupResolved, dropoffResolved] = await Promise.all([
      this.resolveDriverPostStopCoords(input.pickup),
      this.resolveDriverPostStopCoords(input.dropoff),
    ]);

    const note = JSON.stringify({
      source: 'driver_post',
      postedByDriverId: input.driverId,
      bountyPoints: bounty,
      remark: input.remark ?? '',
      tipHkd: input.tipHkd ?? 0,
      selectedOptionIds: input.selectedOptionIds ?? [],
      sixSeat: !!input.sixSeat,
      paymentMethods,
      scheduledAt: scheduledAtDate ? scheduledAtDate.toISOString() : null,
      grossFareHkd: fare,
    });

    const order = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(OrderEntity, {
          orderType: 'driver_posted',
          passengerId: null,
          postedByDriverId: input.driverId,
          status: 'matching',
          fareEstimate: fare.toFixed(2),
          estimateDistanceKm,
          scheduledAt: scheduledAtDate,
          driverPointsCostAtOrder: null,
          driverPointsBusySurcharge: null,
          driverPostBountyPoints: bounty > 0 ? String(bounty) : null,
        }),
      );

      await manager.save([
        manager.create(OrderStopEntity, {
          orderId: saved.id,
          seq: 0,
          addressText: pickupResolved.label,
          lat: String(pickupResolved.lat),
          lng: String(pickupResolved.lng),
        }),
        manager.create(OrderStopEntity, {
          orderId: saved.id,
          seq: 1,
          addressText: dropoffResolved.label,
          lat: String(dropoffResolved.lat),
          lng: String(dropoffResolved.lng),
        }),
      ]);

      await manager.save(
        manager.create(OrderStatusEventEntity, {
          orderId: saved.id,
          fromStatus: null,
          toStatus: 'matching',
          actorType: 'driver',
          actorId: input.driverId,
          note,
        }),
      );

      return saved;
    });

    await this.notifyAdminOrder('created', order.id);
    return {
      id: order.id,
      status: order.status,
      orderType: order.orderType,
      fareEstimate: order.fareEstimate,
      driverPostBountyPoints: bounty,
    };
  }

  listAdmin() {
    return this.orders.find({ order: { createdAt: 'DESC' }, take: 300 });
  }

  private async attachStops(orderIds: string[]) {
    if (!orderIds.length) return new Map<string, OrderStopEntity[]>();
    const rows = await this.stops.find({
      where: { orderId: In(orderIds) },
      order: { seq: 'ASC' },
    });
    const map = new Map<string, OrderStopEntity[]>();
    for (const s of rows) {
      const list = map.get(s.orderId) ?? [];
      list.push(s);
      map.set(s.orderId, list);
    }
    return map;
  }

  private stopCoord(stop: OrderStopEntity | undefined): number | null {
    if (!stop?.lat) return null;
    const n = Number(stop.lat);
    return Number.isFinite(n) ? n : null;
  }

  private mapStopSummary(stops: OrderStopEntity[] | undefined) {
    if (!stops?.length) return { pickup: null, dropoff: null, stopCount: 0 };
    const pickupStop = stops[0];
    const dropoffStop = stops.length > 1 ? stops[stops.length - 1] : undefined;
    const pickup = addressForCrmDisplay(
      pickupStop?.addressText ?? null,
      this.stopCoord(pickupStop),
      pickupStop?.lng != null ? Number(pickupStop.lng) : null,
    );
    const dropoff = addressForCrmDisplay(
      dropoffStop?.addressText ?? null,
      this.stopCoord(dropoffStop),
      dropoffStop?.lng != null ? Number(dropoffStop.lng) : null,
    );
    return { pickup, dropoff, stopCount: stops.length };
  }

  async listDriverAcceptanceRecords(filters: {
    phone?: string;
    date?: string;
    time?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
    pageSize?: string;
  }) {
    const { page, pageSize, skip } = parsePageQuery(
      filters.page,
      filters.pageSize,
      ORDER_RECORDS_PAGE_SIZE,
    );
    const eventAt = `COALESCE(${ACCEPTED_AT_SQL}, o.updated_at)`;

    const countQb = this.orders
      .createQueryBuilder('o')
      .innerJoin(DriverEntity, 'd', 'd.id = o.driver_id')
      .where('o.driver_id IS NOT NULL');
    if (filters.phone?.trim()) {
      countQb.andWhere('d.phone LIKE :phone', { phone: `%${filters.phone.trim()}%` });
    }
    if (filters.dateFrom?.trim() || filters.dateTo?.trim()) {
      applyHkDateRangeFilter(countQb, eventAt, filters.dateFrom, filters.dateTo, 'acc');
    } else {
      applyHkDateTimeFilter(countQb, eventAt, filters.date, filters.time, 'acc');
    }
    const total = await countQb.getCount();

    const qb = this.orders
      .createQueryBuilder('o')
      .innerJoin(DriverEntity, 'd', 'd.id = o.driver_id')
      .leftJoin(PassengerEntity, 'p', 'p.id = o.passenger_id')
      .select('o.id', 'orderId')
      .addSelect('o.order_type', 'orderType')
      .addSelect('o.status', 'status')
      .addSelect('o.fare_estimate', 'fareEstimate')
      .addSelect('o.fare_final', 'fareFinal')
      .addSelect('o.passenger_points_redeemed', 'passengerPointsRedeemed')
      .addSelect('o.passenger_points_discount_hkd', 'passengerPointsDiscountHkd')
      .addSelect('o.passenger_points_hkd_per_point_at_order', 'passengerPointsHkdPerPointAtOrder')
      .addSelect('o.driver_points_cost_at_order', 'driverPointsCostAtOrder')
      .addSelect('o.driver_points_busy_surcharge', 'driverPointsBusySurcharge')
      .addSelect('o.driver_post_bounty_points', 'driverPostBountyPoints')
      .addSelect('o.driver_busy_region_reward_points', 'driverBusyRegionRewardPoints')
      .addSelect('o.driver_busy_region_from_area', 'driverBusyRegionFromArea')
      .addSelect('o.driver_busy_region_to_area', 'driverBusyRegionToArea')
      .addSelect('o.posted_by_driver_id', 'postedByDriverId')
      .addSelect('o.created_at', 'orderCreatedAt')
      .addSelect('o.driver_id', 'driverId')
      .addSelect('d.phone', 'driverPhone')
      .addSelect('d.display_name', 'driverName')
      .addSelect('d.vehicle_plate', 'vehiclePlate')
      .leftJoin(DriverEntity, 'pd', 'pd.id = o.posted_by_driver_id')
      .addSelect('pd.vehicle_plate', 'bountyFromVehiclePlate')
      .addSelect('pd.phone', 'bountyFromDriverPhone')
      .addSelect('pd.display_name', 'bountyFromDriverName')
      .addSelect('o.passenger_id', 'passengerId')
      .addSelect('p.display_name', 'passengerName')
      .addSelect('p.phone', 'passengerPhone')
      .addSelect(`${eventAt}`, 'acceptedAt')
      .where('o.driver_id IS NOT NULL');

    if (filters.phone?.trim()) {
      qb.andWhere('d.phone LIKE :phone', { phone: `%${filters.phone.trim()}%` });
    }
    if (filters.dateFrom?.trim() || filters.dateTo?.trim()) {
      applyHkDateRangeFilter(qb, eventAt, filters.dateFrom, filters.dateTo, 'acc');
    } else {
      applyHkDateTimeFilter(qb, eventAt, filters.date, filters.time, 'acc');
    }

    const raw = await qb.orderBy(eventAt, 'DESC').offset(skip).limit(pageSize).getRawMany<{
      orderId: string;
      orderType: string;
      status: string;
      fareEstimate: string | null;
      fareFinal: string | null;
      passengerPointsRedeemed: string | null;
      passengerPointsDiscountHkd: string | null;
      passengerPointsHkdPerPointAtOrder: string | null;
      driverPointsCostAtOrder: string | null;
      driverPointsBusySurcharge: string | null;
      driverPostBountyPoints: string | null;
      driverBusyRegionRewardPoints: string | null;
      driverBusyRegionFromArea: string | null;
      driverBusyRegionToArea: string | null;
      postedByDriverId: string | null;
      orderCreatedAt: Date;
      driverId: string;
      driverPhone: string;
      driverName: string | null;
      vehiclePlate: string | null;
      bountyFromVehiclePlate: string | null;
      bountyFromDriverPhone: string | null;
      bountyFromDriverName: string | null;
      passengerId: string | null;
      passengerName: string | null;
      passengerPhone: string | null;
      acceptedAt: Date;
    }>();

    const stopMap = await this.attachStops(raw.map((r) => r.orderId));
    const bookingMap = await this.buildPassengerBookingDisplay(raw.map((r) => r.orderId));
    const items = raw.map((r) => {
      const { pickup, dropoff, stopCount } = this.mapStopSummary(stopMap.get(r.orderId));
      const remark = bookingMap.get(r.orderId)?.remark ?? null;
      const passengerPhone =
        r.passengerPhone?.trim() || guestPassengerPhoneFromRemark(remark);
      return {
        orderId: r.orderId,
        orderType: r.orderType,
        status: r.status,
        fareEstimate: r.fareEstimate,
        fareFinal: r.fareFinal,
        passengerPointsRedeemed:
          r.passengerPointsRedeemed != null && r.passengerPointsRedeemed !== ''
            ? Math.round(Number(r.passengerPointsRedeemed))
            : null,
        passengerPointsDiscountHkd:
          r.passengerPointsDiscountHkd != null && r.passengerPointsDiscountHkd !== ''
            ? Number(r.passengerPointsDiscountHkd)
            : null,
        passengerPointsHkdPerPointAtOrder:
          r.passengerPointsHkdPerPointAtOrder != null && r.passengerPointsHkdPerPointAtOrder !== ''
            ? Number(r.passengerPointsHkdPerPointAtOrder)
            : null,
        driverPointsCostAtOrder:
          r.driverPointsCostAtOrder != null && r.driverPointsCostAtOrder !== ''
            ? Math.round(Number(r.driverPointsCostAtOrder))
            : null,
        driverPointsBusySurcharge:
          r.driverPointsBusySurcharge != null && r.driverPointsBusySurcharge !== ''
            ? Math.round(Number(r.driverPointsBusySurcharge))
            : null,
        driverPostBountyPoints:
          r.driverPostBountyPoints != null && r.driverPostBountyPoints !== ''
            ? Math.round(Number(r.driverPostBountyPoints))
            : null,
        driverBusyRegionRewardPoints:
          r.driverBusyRegionRewardPoints != null && r.driverBusyRegionRewardPoints !== ''
            ? Math.round(Number(r.driverBusyRegionRewardPoints))
            : null,
        driverBusyRegionFromArea: r.driverBusyRegionFromArea?.trim() || null,
        driverBusyRegionToArea: r.driverBusyRegionToArea?.trim() || null,
        bountyFromVehiclePlate: r.bountyFromVehiclePlate?.trim() || null,
        bountyFromDriverPhone: r.bountyFromDriverPhone ?? null,
        bountyFromDriverName: r.bountyFromDriverName ?? null,
        postedByDriverId: r.postedByDriverId,
        driverId: r.driverId,
        driverPhone: r.driverPhone,
        driverName: r.driverName,
        vehiclePlate: r.vehiclePlate,
        pointsDeductedFromVehiclePlate: r.vehiclePlate?.trim() || null,
        passengerId: r.passengerId,
        passengerName: r.passengerName,
        passengerPhone: passengerPhone || null,
        acceptedAt: r.acceptedAt,
        acceptedAtHk: formatHkDateTime(r.acceptedAt),
        orderCreatedAtHk: formatHkDateTime(r.orderCreatedAt),
        pickupAddress: pickup,
        dropoffAddress: dropoff,
        stopCount,
      };
    });

    return paginated(items, total, page, pageSize);
  }

  async getAdminOrderDetail(orderId: string) {
    const order = await this.orders.findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('Order not found');

    const stops = await this.stops.find({ where: { orderId }, order: { seq: 'ASC' } });
    const { pickup, dropoff, stopCount } = this.mapStopSummary(stops);

    const driver = order.driverId ? await this.drivers.findOneBy({ id: order.driverId }) : null;
    const postedByDriver = order.postedByDriverId
      ? await this.drivers.findOneBy({ id: order.postedByDriverId })
      : null;
    const passenger = order.passengerId ? await this.passengers.findOneBy({ id: order.passengerId }) : null;
    const driverPostBountyPoints =
      order.driverPostBountyPoints != null && order.driverPostBountyPoints !== ''
        ? Math.round(Number(order.driverPostBountyPoints))
        : null;

    const bookingMap = await this.buildPassengerBookingDisplay([orderId]);
    const booking = bookingMap.get(orderId) ?? {
      tipHkd: 0,
      remark: null,
      bookingOptionLines: [] as string[],
    };

    const events = await this.statusEvents.find({
      where: { orderId },
      order: { id: 'ASC' },
    });

    const acceptedEvent = events.find((e) => e.toStatus === 'accepted');

    return {
      orderId: order.id,
      orderType: order.orderType,
      status: order.status,
      fareEstimate: order.fareEstimate,
      fareFinal: order.fareFinal,
      ...this.passengerPointsRedemptionFromOrder(order),
      driverPointsCostAtOrder:
        order.driverPointsCostAtOrder != null && order.driverPointsCostAtOrder !== ''
          ? Math.round(Number(order.driverPointsCostAtOrder))
          : null,
      driverPointsBusySurcharge:
        order.driverPointsBusySurcharge != null && order.driverPointsBusySurcharge !== ''
          ? Math.round(Number(order.driverPointsBusySurcharge))
          : null,
      driverPostBountyPoints,
      driverBusyRegionRewardPoints:
        order.driverBusyRegionRewardPoints != null && order.driverBusyRegionRewardPoints !== ''
          ? Math.round(Number(order.driverBusyRegionRewardPoints))
          : null,
      driverBusyRegionFromArea: order.driverBusyRegionFromArea?.trim() || null,
      driverBusyRegionToArea: order.driverBusyRegionToArea?.trim() || null,
      pointsDeductedFromVehiclePlate: driver?.vehiclePlate?.trim() || null,
      bountyFromVehiclePlate: postedByDriver?.vehiclePlate?.trim() || null,
      postedByDriver: postedByDriver
        ? {
            id: postedByDriver.id,
            phone: postedByDriver.phone,
            displayName: postedByDriver.displayName,
            vehiclePlate: postedByDriver.vehiclePlate,
          }
        : null,
      placedAtHk: formatHkDateTime(order.createdAt),
      updatedAtHk: formatHkDateTime(order.updatedAt),
      acceptedAtHk: acceptedEvent ? formatHkDateTime(acceptedEvent.createdAt) : null,
      pickupAddress: pickup,
      dropoffAddress: dropoff,
      stopCount,
      stops: stops.map((s) => ({
        seq: s.seq,
        addressText: addressForCrmDisplay(s.addressText, Number(s.lat), Number(s.lng)),
        lat: Number(s.lat),
        lng: Number(s.lng),
      })),
      driver: driver
        ? {
            id: driver.id,
            phone: driver.phone,
            displayName: driver.displayName,
            vehiclePlate: driver.vehiclePlate,
            licenseNumber: driver.licenseNumber,
            driverTier: driver.driverTier,
          }
        : null,
      passengerPhone: resolveCrmPassengerPhone(passenger, booking.remark),
      passenger: passenger
        ? {
            id: passenger.id,
            displayName: passenger.displayName,
            phone: resolveCrmPassengerPhone(passenger, booking.remark),
          }
        : null,
      tipHkd: booking.tipHkd,
      remark: booking.remark,
      bookingOptionLines: booking.bookingOptionLines,
      statusEvents: events.map((e) => ({
        id: e.id,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        actorType: e.actorType,
        actorId: e.actorId,
        note: e.note,
        atHk: formatHkDateTime(e.createdAt),
      })),
    };
  }

  async listPassengerOrderRecords(filters: {
    passengerId?: string;
    date?: string;
    time?: string;
    page?: string;
    pageSize?: string;
  }) {
    const { page, pageSize, skip } = parsePageQuery(
      filters.page,
      filters.pageSize,
      ORDER_RECORDS_PAGE_SIZE,
    );

    const countQb = this.orders
      .createQueryBuilder('o')
      .innerJoin(PassengerEntity, 'p', 'p.id = o.passenger_id')
      .where('o.passenger_id IS NOT NULL');
    if (filters.passengerId?.trim()) {
      countQb.andWhere('p.id = :passengerId', { passengerId: filters.passengerId.trim() });
    }
    applyHkDateTimeFilter(countQb, 'o.created_at', filters.date, filters.time, 'ord');
    const total = await countQb.getCount();

    const qb = this.orders
      .createQueryBuilder('o')
      .innerJoin(PassengerEntity, 'p', 'p.id = o.passenger_id')
      .leftJoin(DriverEntity, 'd', 'd.id = o.driver_id')
      .select('o.id', 'orderId')
      .addSelect('o.order_type', 'orderType')
      .addSelect('o.status', 'status')
      .addSelect('o.fare_estimate', 'fareEstimate')
      .addSelect('o.fare_final', 'fareFinal')
      .addSelect('o.estimate_distance_km', 'estimateDistanceKm')
      .addSelect('o.trip_distance_km', 'tripDistanceKm')
      .addSelect('o.passenger_points_awarded', 'passengerPointsAwarded')
      .addSelect('o.passenger_points_redeemed', 'passengerPointsRedeemed')
      .addSelect('o.passenger_points_discount_hkd', 'passengerPointsDiscountHkd')
      .addSelect('o.passenger_points_hkd_per_point_at_order', 'passengerPointsHkdPerPointAtOrder')
      .addSelect('o.driver_points_cost_at_order', 'driverPointsCostAtOrder')
      .addSelect('o.driver_points_busy_surcharge', 'driverPointsBusySurcharge')
      .addSelect('p.points_balance', 'passengerPointsBalance')
      .addSelect('o.created_at', 'placedAt')
      .addSelect('o.scheduled_at', 'scheduledAt')
      .addSelect('o.passenger_id', 'passengerId')
      .addSelect('p.display_name', 'passengerName')
      .addSelect('o.driver_id', 'driverId')
      .addSelect('d.phone', 'driverPhone')
      .addSelect('d.display_name', 'driverName')
      .addSelect('d.vehicle_plate', 'driverVehiclePlate')
      .addSelect('o.driver_post_bounty_points', 'driverPostBountyPoints')
      .addSelect('o.posted_by_driver_id', 'postedByDriverId')
      .leftJoin(DriverEntity, 'pd', 'pd.id = o.posted_by_driver_id')
      .addSelect('pd.vehicle_plate', 'bountyFromVehiclePlate')
      .where('o.passenger_id IS NOT NULL');

    if (filters.passengerId?.trim()) {
      qb.andWhere('p.id = :passengerId', { passengerId: filters.passengerId.trim() });
    }
    applyHkDateTimeFilter(qb, 'o.created_at', filters.date, filters.time, 'ord');

    const raw = await qb.orderBy('o.created_at', 'DESC').offset(skip).limit(pageSize).getRawMany<{
      orderId: string;
      orderType: string;
      status: string;
      fareEstimate: string | null;
      fareFinal: string | null;
      estimateDistanceKm: string | null;
      tripDistanceKm: string | null;
      passengerPointsAwarded: string | null;
      passengerPointsRedeemed: string | null;
      passengerPointsDiscountHkd: string | null;
      passengerPointsHkdPerPointAtOrder: string | null;
      driverPointsCostAtOrder: string | null;
      driverPointsBusySurcharge: string | null;
      passengerPointsBalance: string | null;
      placedAt: Date;
      scheduledAt: Date | null;
      passengerId: string;
      passengerName: string | null;
      driverId: string | null;
      driverPhone: string | null;
      driverName: string | null;
      driverVehiclePlate: string | null;
      driverPostBountyPoints: string | null;
      postedByDriverId: string | null;
      bountyFromVehiclePlate: string | null;
    }>();

    const stopMap = await this.attachStops(raw.map((r) => r.orderId));
    const items = raw.map((r) => {
      const { pickup, dropoff, stopCount } = this.mapStopSummary(stopMap.get(r.orderId));
      return {
        orderId: r.orderId,
        orderType: r.orderType,
        status: r.status,
        fareEstimate: r.fareEstimate,
        fareFinal: r.fareFinal,
        estimateDistanceKm:
          r.estimateDistanceKm != null && r.estimateDistanceKm !== ''
            ? Math.round(Number(r.estimateDistanceKm))
            : null,
        tripDistanceKm:
          r.tripDistanceKm != null && r.tripDistanceKm !== ''
            ? Math.round(Number(r.tripDistanceKm))
            : null,
        passengerPointsAwarded:
          r.passengerPointsAwarded != null && r.passengerPointsAwarded !== ''
            ? Math.round(Number(r.passengerPointsAwarded))
            : null,
        passengerPointsRedeemed:
          r.passengerPointsRedeemed != null && r.passengerPointsRedeemed !== ''
            ? Math.round(Number(r.passengerPointsRedeemed))
            : null,
        passengerPointsDiscountHkd:
          r.passengerPointsDiscountHkd != null && r.passengerPointsDiscountHkd !== ''
            ? Number(r.passengerPointsDiscountHkd)
            : null,
        passengerPointsHkdPerPointAtOrder:
          r.passengerPointsHkdPerPointAtOrder != null && r.passengerPointsHkdPerPointAtOrder !== ''
            ? Number(r.passengerPointsHkdPerPointAtOrder)
            : null,
        driverPointsCostAtOrder:
          r.driverPointsCostAtOrder != null && r.driverPointsCostAtOrder !== ''
            ? Math.round(Number(r.driverPointsCostAtOrder))
            : null,
        driverPointsBusySurcharge:
          r.driverPointsBusySurcharge != null && r.driverPointsBusySurcharge !== ''
            ? Math.round(Number(r.driverPointsBusySurcharge))
            : null,
        driverPostBountyPoints:
          r.driverPostBountyPoints != null && r.driverPostBountyPoints !== ''
            ? Math.round(Number(r.driverPostBountyPoints))
            : null,
        bountyFromVehiclePlate: r.bountyFromVehiclePlate?.trim() || null,
        postedByDriverId: r.postedByDriverId,
        pointsDeductedFromVehiclePlate: r.driverVehiclePlate?.trim() || null,
        driverVehiclePlate: r.driverVehiclePlate?.trim() || null,
        passengerPointsBalance: Math.round(Number(r.passengerPointsBalance ?? 0)),
        passengerId: r.passengerId,
        passengerName: r.passengerName,
        driverId: r.driverId,
        driverPhone: r.driverPhone,
        driverName: r.driverName,
        placedAt: r.placedAt,
        placedAtHk: formatHkDateTime(r.placedAt),
        scheduledAtHk: formatHkDateTime(r.scheduledAt),
        pickupAddress: pickup,
        dropoffAddress: dropoff,
        stopCount,
      };
    });

    return paginated(items, total, page, pageSize);
  }

  async createAdmin(_adminId: number, _input: Partial<OrderEntity>) {
    throw new BadRequestException(
      'CRM 已不再建立 Demo 柯打；請使用乘客 App 落單（POST /passenger/orders）。',
    );
  }

  /** 乘客 App 柯打：落單時應已寫入接單積分快照；缺欄位時依落單時間補算（CRM 代接／舊資料） */
  private async ensurePassengerAppDriverPointsSnapshot(order: OrderEntity): Promise<void> {
    if (!this.usesPassengerAppDriverPointsRules(order)) return;
    const costRaw = order.driverPointsCostAtOrder;
    if (costRaw != null && costRaw !== '') return;

    const snap = await this.driverOrderPoints.snapshotForOrderPlacement(order.createdAt);
    order.driverPointsCostAtOrder = snap.total > 0 ? String(snap.total) : null;
    order.driverPointsBusySurcharge =
      snap.busySurcharge > 0 ? String(snap.busySurcharge) : null;
  }

  /** 平台獎賞：繁忙時段 + 地區配對（接單當刻入帳） */
  private async applyAcceptDriverRewards(order: OrderEntity, accepterDriverId: string) {
    await this.applyAcceptDriverRewardsWithManager(undefined, order, accepterDriverId);
  }

  private async applyAcceptDriverRewardsWithManager(
    manager: EntityManager | undefined,
    order: OrderEntity,
    accepterDriverId: string,
  ) {
    if (!this.usesPassengerAppDriverPointsRules(order)) return;

    await this.driverOrderPoints.tryGrantBusyHourReward(
      order.id,
      accepterDriverId,
      order.driverPointsBusySurcharge,
      manager,
    );
    const stops = manager
      ? await manager.find(OrderStopEntity, { where: { orderId: order.id }, order: { seq: 'ASC' } })
      : (await this.attachStops([order.id])).get(order.id) ?? [];
    const { pickup, dropoff } = this.mapStopSummary(stops);
    const regionRule = await this.driverOrderPoints.tryGrantBusyRegionReward(
      order.id,
      accepterDriverId,
      order.createdAt,
      pickup,
      dropoff,
      manager,
    );
    if (regionRule) {
      order.driverBusyRegionRewardPoints = String(regionRule.rewardPoints);
      order.driverBusyRegionFromArea = regionRule.fromArea;
      order.driverBusyRegionToArea = regionRule.toArea;
    }
  }

  /** 在 order 行鎖內檢查是否仍可接單 */
  private async assertOrderOpenForDriverAccept(
    order: OrderEntity,
    driverId: string,
    orderId: string,
  ): Promise<void> {
    if (order.status === 'cancelled') {
      const actor = await this.cancelActorForOrder(orderId);
      if (actor === 'passenger') {
        throw new BadRequestException('乘客已取消此柯打');
      }
      if (actor === 'admin') {
        throw new BadRequestException('後台已取消此柯打');
      }
      throw new BadRequestException('此柯打已取消');
    }
    if (
      order.status === 'accepted' ||
      order.status === 'en_route' ||
      order.status === 'in_trip' ||
      order.status === 'completed'
    ) {
      if (order.driverId && order.driverId !== driverId) {
        throw new BadRequestException(ORDER_TAKEN_BY_OTHER_DRIVER);
      }
      throw new BadRequestException('此柯打已被接或已結束');
    }
    if (order.status !== 'pending' && order.status !== 'matching') {
      throw new BadRequestException('此柯打已結束');
    }
  }

  /** 柯打取消：乘客抵扣積分退回；已接單則司機接單積分亦退回 */
  private async applyOrderCancellation(
    order: OrderEntity,
    from: OrderEntity['status'],
    actorType: OrderStatusEventEntity['actorType'],
    actorId: string | null,
    cancelNote?: string,
  ): Promise<OrderEntity> {
    const driverIdForRefund =
      order.driverId &&
      (from === 'accepted' || from === 'en_route' || from === 'in_trip')
        ? order.driverId
        : null;

    order.status = 'cancelled';
    if (from === 'pending' || from === 'matching') {
      order.driverId = null;
    }
    await this.orders.save(order);
    await this.passengerPoints.refundOrderRedemption(order);
    if (driverIdForRefund) {
      await this.driverOrderPoints.refundDriverAcceptCharge(order.id, driverIdForRefund);
      await this.driverOrderPoints.clawbackBusyHourReward(order.id, driverIdForRefund);
      await this.driverOrderPoints.clawbackBusyRegionReward(order.id, driverIdForRefund);
    }

    const bounty = this.bountyPointsFrom(order);
    const posterId = order.postedByDriverId;
    if (posterId && bounty > 0 && driverIdForRefund) {
      await this.driverOrderPoints.clawbackDriverPostBountyFromPoster(
        order.id,
        posterId,
        bounty,
      );
    }
    if (posterId && bounty > 0) {
      if (from === 'pending' || from === 'matching') {
        await this.driverOrderPoints.refundDriverPostBountyToPoster(order.id, posterId, bounty);
        this.orderNotifications.emitDriverPostedOrderNotice(posterId, {
          orderId: order.id,
          kind: 'bounty_refunded',
          message: `柯打 #${order.id} 已取消，懸賞 ${bounty} 積分已退回你的帳戶。`,
        });
      } else if (driverIdForRefund && posterId && bounty > 0) {
        await this.driverOrderPoints.clawbackDriverPostBountyFromAccepter(
          order.id,
          driverIdForRefund,
          posterId,
          bounty,
        );
        const msgByActor =
          actorType === 'passenger'
            ? `乘客已取消柯打 #${order.id}，懸賞 ${bounty} 積分已退回你的帳戶。`
            : actorType === 'admin'
              ? `後台已取消柯打 #${order.id}，懸賞 ${bounty} 積分已退回你的帳戶。`
              : `柯打 #${order.id} 已取消，懸賞 ${bounty} 積分已退回你的帳戶。`;
        this.orderNotifications.emitDriverPostedOrderNotice(posterId, {
          orderId: order.id,
          kind: 'bounty_refunded',
          message: msgByActor,
        });
      }
    }

    await this.recordStatusEvent(
      order.id,
      from,
      'cancelled',
      actorType,
      actorId,
      cancelNote,
    );
    await this.notifyAdminOrder('updated', order.id);
    await this.orderChat.purgeForOrder(order.id);
    return order;
  }

  private async recordStatusEvent(
    orderId: string,
    fromStatus: string | null,
    toStatus: string,
    actorType: OrderStatusEventEntity['actorType'],
    actorId: string | null,
    note?: string,
  ) {
    await this.statusEvents.save(
      this.statusEvents.create({
        orderId,
        fromStatus,
        toStatus,
        actorType,
        actorId,
        note: note ?? null,
      }),
    );
  }

  async updateStatus(
    actor: { type: 'admin' | 'driver'; id: number | string },
    orderId: string,
    status: OrderEntity['status'],
  ) {
    const order = await this.orders.findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('Order not found');
    const from = order.status;

    if (status === 'cancelled') {
      if (actor.type === 'driver') {
        throw new BadRequestException('司機不可取消已接柯打，請由乘客或後台取消');
      }
      return this.applyOrderCancellation(
        order,
        from,
        actor.type === 'admin' ? 'admin' : 'passenger',
        String(actor.id),
      );
    }

    if (status === 'accepted') {
      if (actor.type === 'driver') {
        const acceptingDriver = await this.drivers.findOneBy({ id: String(actor.id), isActive: true });
        if (!acceptingDriver) throw new BadRequestException('司機不存在');
        this.driversService.assertDriverEligibleForDispatch(acceptingDriver);
        if (order.postedByDriverId === String(actor.id)) {
          throw new BadRequestException('不可接自己發出的射柯打');
        }
        order.driverId = String(actor.id);
      }
      const chargeDriverId = order.driverId;
      if (chargeDriverId) {
        await this.ensurePassengerAppDriverPointsSnapshot(order);
        await this.orders.save(order);
        await this.driverOrderPoints.chargeDriverForAccept(
          orderId,
          this.acceptPointsChargeForOrder(order),
          chargeDriverId,
        );
        await this.applyAcceptDriverRewards(order, chargeDriverId);
        await this.applyDriverPostBountyOnAccept(order, chargeDriverId);
        await this.orders.save(order);
      }
      if (order.postedByDriverId && actor.type === 'driver') {
        this.orderNotifications.emitDriverPostedOrderNotice(order.postedByDriverId, {
          orderId,
          kind: 'accepted',
          message: `已有司機接你的柯打 #${orderId}。`,
        });
      }
    }

    order.status = status;
    if (status === 'completed' && !order.fareFinal?.trim() && order.fareEstimate?.trim()) {
      order.fareFinal = order.fareEstimate;
    }
    await this.orders.save(order);

    if (status === 'completed') {
      await this.payoutDriverPostBountyOnTripComplete(order, orderId);
    }

    if (status === 'completed' && order.passengerId) {
      const stopMap = await this.attachStops([orderId]);
      const stops = stopMap.get(orderId) ?? [];
      await this.passengerPoints.awardTripCompletionPoints(order, stops);
      await this.orders.save(order);
      await this.orderChat.purgeForOrder(orderId);
    }

    await this.recordStatusEvent(
      orderId,
      from,
      status,
      actor.type === 'admin' ? 'admin' : 'driver',
      String(actor.id),
    );
    if (actor.type === 'driver') {
      await this.audit.log({
        actorType: 'driver',
        actorId: Number(actor.id),
        action: 'order.status',
        resourceType: 'orders',
        resourceId: orderId,
        payload: { status },
      });
    }
    await this.notifyAdminOrder('updated', orderId);
    return order;
  }

  private async passengerHistoryMeta(orderIds: string[]) {
    const cancelByMap = new Map<string, 'passenger' | 'driver' | 'admin' | 'system'>();
    const misacceptSet = new Set<string>();
    if (!orderIds.length) return { cancelByMap, misacceptSet };

    const events = await this.statusEvents.find({
      where: { orderId: In(orderIds) },
      order: { id: 'ASC' },
    });
    for (const e of events) {
      if (e.note === 'misaccept_cancel') misacceptSet.add(e.orderId);
      if (e.toStatus === 'cancelled') {
        cancelByMap.set(e.orderId, e.actorType);
      }
    }
    return { cancelByMap, misacceptSet };
  }

  /** 乘客 App：叫車紀錄（含取消、司機誤接取消） */
  async listPassengerOrderHistory(appClientIdRaw: string, pageRaw?: string, pageSizeRaw?: string) {
    const appClientId = appClientIdRaw?.trim();
    if (!appClientId) throw new BadRequestException('appClientId is required');

    const passenger = await this.passengerMembers.findByAppClientId(appClientId);
    const { page, pageSize, skip } = parsePageQuery(pageRaw, pageSizeRaw, 20);

    if (!passenger) {
      return paginated([], 0, page, pageSize);
    }

    const qb = this.orders
      .createQueryBuilder('o')
      .where('o.passenger_id = :pid', { pid: passenger.id })
      .andWhere('o.passenger_history_hidden_at IS NULL')
      .orderBy('o.created_at', 'DESC');
    const total = await qb.getCount();
    const rows = await qb.skip(skip).take(pageSize).getMany();

    const orderIds = rows.map((o) => o.id);
    const stopMap = await this.attachStops(orderIds);
    const { cancelByMap, misacceptSet } = await this.passengerHistoryMeta(orderIds);

    const items = rows.map((o) => {
      const { pickup, dropoff } = this.mapStopSummary(stopMap.get(o.id));
      return {
        orderId: o.id,
        orderType: o.orderType,
        status: o.status,
        cancelBy: o.status === 'cancelled' ? (cancelByMap.get(o.id) ?? null) : null,
        driverMisaccept: misacceptSet.has(o.id),
        fareEstimate: o.fareEstimate,
        fareFinal: o.fareFinal,
        ...this.passengerPointsRedemptionFromOrder(o),
        placedAtHk: formatHkDateTime(o.createdAt),
        scheduledAtHk: formatHkDateTime(o.scheduledAt),
        pickupAddress: pickup,
        dropoffAddress: dropoff,
      };
    });

    return paginated(items, total, page, pageSize);
  }

  /** 司機 App：今日（香港日曆）已完成行程列表與收入匯總 */
  async listDriverTodayCompleted(driverId: string) {
    const hkToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
    const qb = this.orders
      .createQueryBuilder('o')
      .where('o.driver_id = :did', { did: String(driverId) })
      .andWhere('o.status = :st', { st: 'completed' });
    applyHkDateTimeFilter(qb, 'o.updated_at', hkToday, undefined, 'drvToday');
    qb.orderBy('o.updated_at', 'DESC').take(200);
    const rows = await qb.getMany();

    const orderIds = rows.map((o) => o.id);
    const stopMap = await this.attachStops(orderIds);

    let totalHkd = 0;
    const items = rows.map((o) => {
      const fareRaw = o.fareFinal?.trim() ? o.fareFinal : o.fareEstimate;
      const fareHkd = Math.round(Number(fareRaw ?? 0));
      if (Number.isFinite(fareHkd)) totalHkd += fareHkd;
      const { pickup, dropoff } = this.mapStopSummary(stopMap.get(o.id));
      return {
        orderId: o.id,
        completedAtHk: formatHkDateTime(o.updatedAt),
        pickupAddress: pickup,
        dropoffAddress: dropoff,
        fareHkd,
      };
    });

    return {
      dateHk: hkToday,
      totalHkd,
      tripCount: items.length,
      items,
    };
  }

  /** 乘客 App：從叫車紀錄移除（CRM 仍保留訂單） */
  async hidePassengerOrderFromHistory(passengerId: string, orderId: string) {
    const order = await this.orders.findOneBy({ id: orderId });
    if (!order || order.passengerId !== passengerId) {
      throw new NotFoundException('Order not found');
    }
    const active = ['accepted', 'en_route', 'in_trip'] as const;
    if (active.includes(order.status as (typeof active)[number])) {
      throw new BadRequestException('進行中的行程無法從紀錄移除');
    }
    if (order.passengerHistoryHiddenAt) {
      return { ok: true, orderId: order.id, alreadyHidden: true };
    }
    order.passengerHistoryHiddenAt = new Date();
    await this.orders.save(order);
    return { ok: true, orderId: order.id, alreadyHidden: false };
  }

  private async cancelActorForOrder(orderId: string): Promise<OrderStatusEventEntity['actorType'] | null> {
    const row = await this.statusEvents.findOne({
      where: { orderId, toStatus: 'cancelled' },
      order: { id: 'DESC' },
    });
    return row?.actorType ?? null;
  }

  private async passengerPlacementNoteForOrder(
    orderId: string,
  ): Promise<PassengerOrderPlacementNote | null> {
    const event = await this.statusEvents.findOne({
      where: { orderId, toStatus: 'matching', actorType: 'passenger' },
      order: { id: 'ASC' },
    });
    return parsePassengerPlacementNote(event?.note);
  }

  private rebookSnapshotForPassengerOrder(
    order: OrderEntity,
    note: PassengerOrderPlacementNote | null,
  ): PassengerOrderRebookSnapshot {
    const tipHkd = note?.tipHkd ?? 0;
    const discountHkd =
      note?.pointsDiscountHkd != null && Number.isFinite(Number(note.pointsDiscountHkd))
        ? Number(note.pointsDiscountHkd)
        : order.passengerPointsDiscountHkd != null && order.passengerPointsDiscountHkd !== ''
          ? Number(order.passengerPointsDiscountHkd)
          : 0;
    const netFare = Number(order.fareEstimate ?? 0);
    let grossFare = note?.grossFareHkd;
    if (grossFare == null || !Number.isFinite(Number(grossFare))) {
      grossFare = netFare + discountHkd;
    } else {
      grossFare = Number(grossFare);
    }
    const fareEstimate = Math.max(0, grossFare - (tipHkd > 0 ? tipHkd : 0));

    const pointsToRedeem =
      note?.pointsRedeemed != null && Number.isFinite(Number(note.pointsRedeemed))
        ? Math.round(Number(note.pointsRedeemed))
        : order.passengerPointsRedeemed != null && order.passengerPointsRedeemed !== ''
          ? Math.round(Number(order.passengerPointsRedeemed))
          : 0;

    let estimateDistanceMeters = 0;
    if (order.estimateDistanceKm != null && order.estimateDistanceKm !== '') {
      estimateDistanceMeters = Math.max(0, Math.round(Number(order.estimateDistanceKm) * 1000));
    }

    const scheduledRaw = note?.scheduledAt;
    const scheduledAt =
      typeof scheduledRaw === 'string' && scheduledRaw.trim() ? scheduledRaw.trim() : null;

    return {
      fareEstimate,
      tipHkd,
      estimateDistanceMeters,
      pointsToRedeem,
      sixSeat: !!note?.sixSeat,
      paymentMethods: (note?.paymentMethods ?? []).filter((m): m is PassengerPaymentMethod =>
        (PASSENGER_PAYMENT_METHODS as readonly string[]).includes(m),
      ),
      selectedOptionIds: (note?.selectedOptionIds ?? []).filter((id) => Number.isFinite(id)),
      remark: note?.remark?.trim() ?? '',
      scheduledAt,
      passengerContactCall: !!note?.passengerContactCall,
      passengerContactSms: !!note?.passengerContactSms,
      orderContactPhone: (() => {
        const raw = note?.orderContactPhone?.trim();
        if (!raw) return null;
        const v = validateHongKongLocalPhone(raw);
        return v.ok ? v.local8 : null;
      })(),
      companyPrice: !!note?.companyPrice,
      safeDriving: !!note?.safeDriving,
    };
  }

  private async bookingOptionIdsRequireRegularPrice(selectedOptionIds: number[]): Promise<boolean> {
    const ids = selectedOptionIds.filter((id) => Number.isFinite(id));
    if (!ids.length) return false;
    const opts = await this.bookingOptions.find({ where: { id: In(ids) } });
    return opts.some(
      (o) =>
        o.code === 'seats_5' ||
        o.code === 'seats_6' ||
        /五座|六座/.test(o.labelZh ?? ''),
    );
  }

  async getPassengerOrderTrack(orderId: string) {
    let order = await this.orders.findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === 'matching' || order.status === 'pending') {
      const wasStale =
        this.requiresPassengerMatchingWatch(order) &&
        !this.isPassengerPresentInMatchingHall(order);
      await this.orders.update({ id: orderId }, { passengerMatchingWatchAt: new Date() });
      if (wasStale) void this.notifyDriverSockets(orderId, 'updated');
    }
    const stopMap = await this.attachStops([orderId]);
    const stops = stopMap.get(orderId) ?? [];

    if (
      order.status === 'completed' &&
      order.passengerId &&
      (order.passengerPointsAwarded == null || order.passengerPointsAwarded === '')
    ) {
      await this.passengerPoints.awardTripCompletionPoints(order, stops);
      order = (await this.orders.findOneBy({ id: orderId })) ?? order;
    }
    const { pickup, dropoff } = this.mapStopSummary(stops);
    const pickupStop = stops[0];
    const dropStop = stops.length > 1 ? stops[stops.length - 1] : undefined;

    let driver: {
      id: string;
      displayName: string;
      vehiclePlate: string | null;
      vehicleModel: string | null;
      ratingAvg: number | null;
      phone: string | null;
      lat: number | null;
      lng: number | null;
    } | null = null;

    if (order.driverId) {
      const d = await this.drivers.findOneBy({ id: order.driverId });
      const locRows = (await this.dataSource.query(
        `SELECT lat, lng FROM live_locations WHERE driver_id = ? LIMIT 1`,
        [order.driverId],
      )) as { lat: string; lng: string }[];
      const loc = locRows[0];
      const ratingAvg = await this.driverAverageRating(order.driverId);
      driver = {
        id: order.driverId,
        displayName: d?.displayName?.trim() || '司機',
        vehiclePlate: d?.vehiclePlate ?? null,
        vehicleModel: null,
        ratingAvg,
        phone: d?.phone ?? null,
        lat: loc ? Number(loc.lat) : null,
        lng: loc ? Number(loc.lng) : null,
      };
    }

    const completedAtHk =
      order.status === 'completed' ? formatHkDateTime(order.updatedAt) : null;

    const passengerRatingRows = (await this.dataSource.query(
      `SELECT score, comment FROM ratings WHERE order_id = ? AND direction = 'passenger_to_driver' LIMIT 1`,
      [orderId],
    )) as { score: string; comment: string | null }[];
    const passengerRatingRow = passengerRatingRows[0];
    const passengerRating = passengerRatingRow
      ? { score: Number(passengerRatingRow.score), comment: passengerRatingRow.comment }
      : null;

    let passengerPointsBalance: number | null = null;
    if (order.passengerId) {
      const p = await this.passengers.findOneBy({ id: order.passengerId });
      if (p) passengerPointsBalance = Number(p.pointsBalance ?? 0);
    }

    const tripDistanceKm =
      order.tripDistanceKm != null && order.tripDistanceKm !== ''
        ? Number(order.tripDistanceKm)
        : null;
    const pointsEarnedThisTrip =
      order.passengerPointsAwarded != null && order.passengerPointsAwarded !== ''
        ? Number(order.passengerPointsAwarded)
        : null;

    const cancelBy =
      order.status === 'cancelled' ? await this.cancelActorForOrder(orderId) : null;

    const placementNote = await this.passengerPlacementNoteForOrder(orderId);
    const rebookSnapshot = this.rebookSnapshotForPassengerOrder(order, placementNote);

    return {
      orderId: order.id,
      status: order.status,
      cancelBy,
      rebookSnapshot,
      fareEstimate: order.fareEstimate,
      fareFinal: order.fareFinal,
      completedAtHk,
      tripDistanceKm,
      pointsEarnedThisTrip,
      passengerPointsBalance,
      ...this.passengerPointsRedemptionFromOrder(order),
      passengerRating,
      pickup: {
        label: pickup,
        lat: pickupStop ? Number(pickupStop.lat) : null,
        lng: pickupStop ? Number(pickupStop.lng) : null,
      },
      dropoff: {
        label: dropoff,
        lat: dropStop ? Number(dropStop.lat) : null,
        lng: dropStop ? Number(dropStop.lng) : null,
      },
      driver,
    };
  }

  async passengerCancelOrder(orderId: string) {
    const order = await this.orders.findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('Order not found');
    const cancellable: OrderEntity['status'][] = ['pending', 'matching', 'accepted', 'en_route'];
    if (!cancellable.includes(order.status)) {
      throw new BadRequestException('此柯打已無法取消');
    }
    const updated = await this.applyOrderCancellation(
      order,
      order.status,
      'passenger',
      order.passengerId,
    );
    return { ok: true, status: updated.status };
  }

  /** 司機取消已接柯打（例如乘客已有車），寫入 CRM 稽核與狀態事件 */
  async driverCancelOrder(driverId: string, orderId: string, cancelReportCode?: string) {
    const order = await this.orders.findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('Order not found');
    if (
      order.orderType === 'driver_posted' &&
      order.postedByDriverId === driverId &&
      !order.driverId
    ) {
      const openPoster: OrderEntity['status'][] = ['pending', 'matching'];
      if (!openPoster.includes(order.status)) {
        throw new BadRequestException('此柯打已無法取消');
      }
      const updated = await this.applyOrderCancellation(
        order,
        order.status,
        'driver',
        driverId,
        'driver_withdraw_posted_order',
      );
      await this.audit.log({
        actorType: 'driver',
        actorId: Number(driverId),
        action: 'order.driver_withdraw_post',
        resourceType: 'orders',
        resourceId: orderId,
        payload: { fromStatus: order.status },
      });
      return { ok: true, status: updated.status };
    }
    if (order.driverId !== driverId) {
      throw new BadRequestException('此柯打不屬於你');
    }
    const cancellable: OrderEntity['status'][] = ['accepted', 'en_route', 'in_trip'];
    if (!cancellable.includes(order.status)) {
      throw new BadRequestException('此柯打已無法取消');
    }
    const from = order.status;
    let statusNote = 'driver_remove_order';
    let reportCode: string | null = null;
    let reportLabel: string | null = null;
    if (cancelReportCode?.trim()) {
      const code = cancelReportCode.trim();
      if (!isDriverCancelReportCode(code)) {
        throw new BadRequestException('Invalid cancelReportCode');
      }
      reportCode = code;
      reportLabel = DRIVER_CANCEL_REPORT_LABELS[code];
      statusNote = driverCancelReportStatusNote(code);
    }
    const updated = await this.applyOrderCancellation(
      order,
      from,
      'driver',
      driverId,
      statusNote,
    );
    await this.audit.log({
      actorType: 'driver',
      actorId: Number(driverId),
      action: 'order.driver_remove',
      resourceType: 'orders',
      resourceId: orderId,
      payload: {
        fromStatus: from,
        note: statusNote,
        cancelReportCode: reportCode,
        cancelReportLabel: reportLabel,
      },
    });
    return { ok: true, status: updated.status };
  }

  private async driverAverageRating(driverId: string): Promise<number | null> {
    const rows = (await this.dataSource.query(
      `SELECT AVG(score) AS avgScore FROM ratings WHERE driver_id = ? AND direction = 'passenger_to_driver'`,
      [driverId],
    )) as { avgScore: string | null }[];
    const raw = rows[0]?.avgScore;
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
  }

  async driverUpdateOrderStatus(driverId: string, orderId: string, status: OrderEntity['status']) {
    const order = await this.orders.findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('Order not found');
    if (order.driverId !== driverId) {
      throw new BadRequestException('此柯打不屬於你');
    }
    const from = order.status;
    const allowed: Record<string, OrderEntity['status'][]> = {
      accepted: ['en_route', 'in_trip'],
      en_route: ['in_trip'],
      in_trip: ['completed'],
    };
    const next = allowed[from];
    if (!next?.includes(status)) {
      throw new BadRequestException(`無法由 ${from} 更新為 ${status}`);
    }
    return this.updateStatus({ type: 'driver', id: driverId }, orderId, status);
  }

  private isScheduledOrderForFarPickupSkip(order: Pick<OrderEntity, 'orderType' | 'scheduledAt'>): boolean {
    if (order.orderType === 'scheduled') return true;
    if (order.scheduledAt) return true;
    return false;
  }

  private async maybeAlertDriverFarFromPickupOnAccept(
    driverId: string,
    order: OrderEntity,
    acceptPosition: { lat: number; lng: number } | null,
    freshAccept: boolean,
  ): Promise<void> {
    if (!freshAccept) return;
    if (this.isScheduledOrderForFarPickupSkip(order)) return;

    let pos = acceptPosition;
    if (!pos) {
      pos = await this.locations.getDriverLive(driverId);
    }
    if (!pos) return;

    const stops = await this.stops.find({ where: { orderId: order.id }, order: { seq: 'ASC' } });
    const pickupStop = stops[0];
    if (!pickupStop) return;
    const pickupLat = Number(pickupStop.lat);
    const pickupLng = Number(pickupStop.lng);
    if (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLng)) return;

    const distanceKm = haversineKm(pos.lat, pos.lng, pickupLat, pickupLng);
    if (distanceKm <= DRIVER_FAR_PICKUP_ALERT_KM) return;

    const driver = await this.drivers.findOneBy({ id: driverId });
    const passenger = order.passengerId
      ? await this.passengers.findOneBy({ id: order.passengerId })
      : null;
    const { pickup, dropoff, stopCount } = this.mapStopSummary(stops);
    const bookingMap = await this.buildPassengerBookingDisplay([order.id]);
    const booking = bookingMap.get(order.id) ?? {
      tipHkd: 0,
      remark: null,
      bookingOptionLines: [] as string[],
    };

    const snapshot: Record<string, unknown> = {
      outcome: 'success',
      orderId: order.id,
      orderType: order.orderType,
      orderStatus: order.status,
      fareEstimate: order.fareEstimate,
      placedAtHk: formatHkDateTime(order.createdAt),
      acceptedAtHk: formatHkDateTime(new Date()),
      pickupAddress: pickup,
      dropoffAddress: dropoff,
      stopCount,
      pickupLat,
      pickupLng,
      driverGpsAtAccept: { lat: pos.lat, lng: pos.lng },
      distanceKmFromPickup: Math.round(distanceKm * 100) / 100,
      alertThresholdKm: DRIVER_FAR_PICKUP_ALERT_KM,
      driver: driver
        ? {
            id: driver.id,
            displayName: driver.displayName,
            phone: driver.phone,
            vehiclePlate: driver.vehiclePlate,
            driverTier: driver.driverTier,
          }
        : null,
      passenger: passenger
        ? {
            id: passenger.id,
            displayName: passenger.displayName,
            phone: passenger.phone,
          }
        : null,
      bookingOptionLines: booking.bookingOptionLines,
      remark: booking.remark,
      tipHkd: booking.tipHkd,
    };

    await this.audit.log({
      actorType: 'driver',
      actorId: Number(driverId),
      action: 'order.driver_accept_far_from_pickup',
      resourceType: 'orders',
      resourceId: order.id,
      payload: snapshot,
    });

    void this.adminMail.sendDriverFarPickupAcceptAlert(snapshot).then((sent) => {
      if (!sent) {
        this.audit.log({
          actorType: 'system',
          actorId: null,
          action: 'order.driver_accept_far_from_pickup.email_skipped',
          resourceType: 'orders',
          resourceId: order.id,
          payload: { orderId: order.id, reason: 'smtp_not_configured_or_send_failed' },
        });
      }
    });
  }

  async driverAcceptOrder(
    driverId: string,
    orderId: string,
    acceptPosition?: { lat: number; lng: number } | null,
  ) {
    const acceptSideEffects = {
      notifyPosterAccepted: false,
      freshAccept: false,
    };

    const order = await this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(OrderEntity, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Order not found');

      if (
        locked.driverId === driverId &&
        (locked.status === 'accepted' ||
          locked.status === 'en_route' ||
          locked.status === 'in_trip')
      ) {
        return locked;
      }

      await this.assertOrderOpenForDriverAccept(locked, driverId, orderId);

      const acceptingDriver = await manager.findOne(DriverEntity, {
        where: { id: driverId, isActive: true },
      });
      if (!acceptingDriver) throw new BadRequestException('司機不存在');
      this.driversService.assertDriverEligibleForDispatch(acceptingDriver);
      if (locked.postedByDriverId === driverId) {
        throw new BadRequestException('不可接自己發出的射柯打');
      }

      const from = locked.status;
      locked.driverId = driverId;
      locked.status = 'accepted';

      await this.ensurePassengerAppDriverPointsSnapshot(locked);

      await this.driverOrderPoints.chargeDriverForAccept(
        orderId,
        this.acceptPointsChargeForOrder(locked),
        driverId,
        manager,
      );
      await this.applyAcceptDriverRewardsWithManager(manager, locked, driverId);
      await this.applyDriverPostBountyOnAccept(locked, driverId, manager);

      if (locked.postedByDriverId) {
        acceptSideEffects.notifyPosterAccepted = true;
      }

      await manager.save(locked);
      await manager.save(
        manager.create(OrderStatusEventEntity, {
          orderId,
          fromStatus: from,
          toStatus: 'accepted',
          actorType: 'driver',
          actorId: driverId,
          note: null,
        }),
      );

      acceptSideEffects.freshAccept = true;
      return locked;
    });

    if (acceptSideEffects.notifyPosterAccepted && acceptSideEffects.freshAccept) {
      const posterId = order.postedByDriverId;
      if (posterId) {
        this.orderNotifications.emitDriverPostedOrderNotice(posterId, {
          orderId,
          kind: 'accepted',
          message: `已有司機接你的柯打 #${orderId}。`,
        });
      }
    }

    if (acceptSideEffects.freshAccept) {
      await this.audit.log({
        actorType: 'driver',
        actorId: Number(driverId),
        action: 'order.status',
        resourceType: 'orders',
        resourceId: orderId,
        payload: { status: 'accepted' },
      });
      await this.notifyAdminOrder('updated', orderId);
      await this.maybeAlertDriverFarFromPickupOnAccept(
        driverId,
        order,
        acceptPosition ?? null,
        true,
      );
    }
    return order;
  }

  /** CRM：管理員代司機接單（積分扣減／繁忙獎賞同 App 接單），並寫入 Demo GPS（上車點附近） */
  async adminAcceptOrder(adminId: number, orderId: string, driverId?: string) {
    const driver = await this.resolveDriverForAdminAccept(driverId);
    this.driversService.assertDriverEligibleForDispatch(driver);

    const order = await this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(OrderEntity, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Order not found');

      await this.assertOrderOpenForDriverAccept(locked, driver.id, orderId);
      if (locked.postedByDriverId === driver.id) {
        throw new BadRequestException('不可接自己發出的射柯打');
      }

      const from = locked.status;
      locked.driverId = driver.id;
      locked.status = 'accepted';

      await this.ensurePassengerAppDriverPointsSnapshot(locked);

      await this.driverOrderPoints.chargeDriverForAccept(
        orderId,
        this.acceptPointsChargeForOrder(locked),
        driver.id,
        manager,
      );
      await this.applyAcceptDriverRewardsWithManager(manager, locked, driver.id);
      await this.applyDriverPostBountyOnAccept(locked, driver.id, manager);

      await manager.save(locked);
      await manager.save(
        manager.create(OrderStatusEventEntity, {
          orderId,
          fromStatus: from,
          toStatus: 'accepted',
          actorType: 'admin',
          actorId: String(adminId),
          note: JSON.stringify({ demoGps: true, driverId: driver.id }),
        }),
      );
      return locked;
    });

    if (order.postedByDriverId) {
      this.orderNotifications.emitDriverPostedOrderNotice(order.postedByDriverId, {
        orderId,
        kind: 'accepted',
        message: `已有司機接你的柯打 #${orderId}。`,
      });
    }

    await this.seedDemoDriverLocationNearPickup(driver.id, orderId);
    await this.audit.log({
      actorType: 'admin',
      actorId: adminId,
      action: 'order.admin_accept',
      resourceType: 'orders',
      resourceId: orderId,
      payload: { driverId: driver.id, demoGps: true },
    });
    await this.notifyAdminOrder('updated', orderId);
    return {
      orderId: order.id,
      status: order.status,
      driver: {
        id: driver.id,
        displayName: driver.displayName,
        vehiclePlate: driver.vehiclePlate,
        phone: driver.phone,
      },
    };
  }

  private async resolveDriverForAdminAccept(driverId?: string) {
    if (driverId?.trim()) {
      const d = await this.drivers.findOneBy({ id: driverId.trim(), isActive: true });
      if (!d) throw new NotFoundException('司機不存在');
      if (d.driverTier === 'admin') {
        throw new BadRequestException('請選擇司機帳號（不可選 CRM admin tier）');
      }
      return d;
    }
    const fallback = await this.drivers.findOne({
      where: { isActive: true, verificationStatus: 'approved', driverTier: 'public' },
      order: { id: 'ASC' },
    });
    if (!fallback) throw new BadRequestException('沒有可派嘅司機，請先新增或審批司機');
    return fallback;
  }

  /** Demo：司機位置設喺上車點附近（約 1–2 km），方便 UAT 乘客 App 睇地圖 */
  private async seedDemoDriverLocationNearPickup(driverId: string, orderId: string) {
    const stops = await this.stops.find({ where: { orderId }, order: { seq: 'ASC' }, take: 1 });
    const pickup = stops[0];
    const baseLat = pickup ? Number(pickup.lat) : 22.3193;
    const baseLng = pickup ? Number(pickup.lng) : 114.1694;
    const lat = baseLat + 0.012;
    const lng = baseLng - 0.008;
    await this.dataSource.query(
      `INSERT INTO live_locations (driver_id, passenger_id, lat, lng, location)
       VALUES (?, NULL, ?, ?, ST_SRID(POINT(?, ?), 4326))
       ON DUPLICATE KEY UPDATE lat = VALUES(lat), lng = VALUES(lng), location = VALUES(location)`,
      [driverId, lat, lng, lng, lat],
    );
  }

  /** 司機行程地圖：上車／落車點 + 乘客即時 GPS（live_locations） */
  async getDriverOrderTrack(driverId: string, orderId: string) {
    const order = await this.orders.findOneBy({ id: orderId, driverId });
    if (!order) throw new NotFoundException('Order not assigned to driver');
    const stopMap = await this.attachStops([orderId]);
    const stops = stopMap.get(orderId) ?? [];
    const { pickup, dropoff } = this.mapStopSummary(stops);
    const pickupStop = stops[0];
    const dropStop = stops.length > 1 ? stops[stops.length - 1] : undefined;

    let passengerLive: { lat: number; lng: number } | null = null;
    if (order.passengerId) {
      const locRows = (await this.dataSource.query(
        `SELECT lat, lng FROM live_locations WHERE passenger_id = ? LIMIT 1`,
        [order.passengerId],
      )) as { lat: string; lng: string }[];
      const loc = locRows[0];
      if (loc && Number.isFinite(Number(loc.lat)) && Number.isFinite(Number(loc.lng))) {
        passengerLive = { lat: Number(loc.lat), lng: Number(loc.lng) };
      }
    }

    return {
      orderId: order.id,
      status: order.status,
      pickup: {
        label: pickup,
        lat: pickupStop ? Number(pickupStop.lat) : null,
        lng: pickupStop ? Number(pickupStop.lng) : null,
      },
      dropoff: {
        label: dropoff,
        lat: dropStop ? Number(dropStop.lat) : null,
        lng: dropStop ? Number(dropStop.lng) : null,
      },
      passenger: passengerLive,
    };
  }

  /** 已接受但未到的預約柯打（仍顯示於「預約」Tab，不算進行中行程） */
  private isFutureScheduledReservation(order: Pick<OrderEntity, 'scheduledAt' | 'status' | 'driverId'>) {
    if (!order.scheduledAt || !order.driverId) return false;
    if (order.status !== 'accepted') return false;
    return order.scheduledAt.getTime() > Date.now();
  }

  /** 司機進行中柯打（accepted / en_route / in_trip） */
  async getDriverActiveOrder(driverId: string) {
    const driver = await this.drivers.findOneBy({ id: driverId, isActive: true });
    if (!driver) throw new NotFoundException('Driver not found');
    const order = await this.orders.findOne({
      where: {
        driverId,
        status: In(['accepted', 'en_route', 'in_trip']),
      },
      order: { updatedAt: 'DESC' },
    });
    if (!order) return null;
    if (this.isFutureScheduledReservation(order)) return null;
    const stopMap = await this.attachStops([order.id]);
    const [dto] = await this.buildDriverAvailableDtosForOrders([order], stopMap);
    if (!dto) return null;
    let postedByDriverPhone: string | null = null;
    if (order.orderType === 'driver_posted' && order.postedByDriverId) {
      const poster = await this.drivers.findOneBy({ id: order.postedByDriverId });
      postedByDriverPhone = poster?.phone?.trim() || null;
    }
    let passengerPhone = await this.passengerPhoneForAssignedOrder(order);
    if (!passengerPhone && order.orderType === 'driver_posted') {
      const bookingMap = await this.buildPassengerBookingDisplay([order.id]);
      const entry = bookingMap.get(order.id);
      passengerPhone =
        entry?.driverPostGuestPhone?.trim() ||
        guestPassengerPhoneFromRemark(entry?.remark);
    }
    return {
      ...dto,
      passengerPhone,
      postedByDriverPhone,
    };
  }

  /** 大廳待接 matching／pending（未做公里數過濾） */
  private async listOpenMatchingDtosForDriver(driverId: string): Promise<DriverAvailableOrderDto[]> {
    const driver = await this.drivers.findOneBy({ id: driverId, isActive: true });
    if (!driver) throw new NotFoundException('Driver not found');
    const open = await this.orders.find({
      where: [{ status: 'matching' }, { status: 'pending' }],
      order: { createdAt: 'DESC' },
      take: 100,
    });
    const eligible = await this.filterOpenOrdersForDrivers(open);
    const visible = eligible.filter((o) => {
      if (o.postedByDriverId === driverId && o.orderType === 'driver_posted') {
        return o.status === 'matching' || o.status === 'pending';
      }
      if (o.postedByDriverId === driverId) return false;
      return this.visibility.canDriverSeeOrder(o.createdAt, {
        driverTier: driver.driverTier,
        isInternalMember: driver.isInternalMember,
      });
    });
    const stopMap = await this.attachStops(visible.map((o) => o.id));
    return this.buildDriverAvailableDtosForOrders(visible, stopMap);
  }

  /** 大廳：待接 instant + 未接預約（matching/pending）；上車點在司機設定公里數內（≤） */
  async listForDriver(
    driverId: string,
    maxPickupRadiusKm?: number | null,
    driverPosition?: { lat: number; lng: number } | null,
  ) {
    const dtos = await this.listOpenMatchingDtosForDriver(driverId);
    const filtered = await this.filterDtosByDriverPickupRadius(
      driverId,
      dtos,
      maxPickupRadiusKm,
      driverPosition,
    );
    if (driverPosition && filtered.length) {
      return this.attachPickupDrivingDistanceKm(filtered, driverPosition);
    }
    return filtered;
  }

  /** 司機曾「放出」回大廳的柯打 ID（預約列表不再顯示） */
  private async orderIdsDriverReleasedToHall(
    driverId: string,
    orderIds: string[],
  ): Promise<Set<string>> {
    if (!orderIds.length) return new Set();
    const events = await this.statusEvents.find({
      where: {
        orderId: In(orderIds),
        actorType: 'driver',
        actorId: driverId,
        toStatus: 'matching',
        note: 'driver_release_to_hall',
      },
      select: ['orderId'],
    });
    return new Set(events.map((e) => e.orderId));
  }

  /** 此司機已「接受預約」、尚未開始行程的柯打 */
  private async listDriverReservedScheduledOrders(
    driverId: string,
    maxPickupRadiusKm?: number | null,
    driverPosition?: { lat: number; lng: number } | null,
  ): Promise<DriverAvailableOrderDto[]> {
    const orders = await this.orders.find({
      where: { driverId, status: 'accepted' },
      order: { scheduledAt: 'ASC' },
      take: 50,
    });
    const future = orders.filter((o) => this.isFutureScheduledReservation(o));
    if (!future.length) return [];
    const stopMap = await this.attachStops(future.map((o) => o.id));
    const dtos = await this.buildDriverAvailableDtosForOrders(future, stopMap);
    const withPhone = await Promise.all(
      dtos.map(async (dto) => {
        const row = future.find((o) => o.id === dto.orderId);
        return {
          ...dto,
          passengerPhone: row ? await this.passengerPhoneForAssignedOrder(row) : null,
        };
      }),
    );
    /** 已接受預約：不受接單公里數／即時 GPS 限制（司機可能離上車點仍須見單） */
    return withPhone;
  }

  /** 預約 Tab：此司機已接受、尚未開始的 future scheduled（未接單見大廳 listForDriver） */
  async listScheduledForDriver(
    driverId: string,
    _maxPickupRadiusKm?: number | null,
    _driverPosition?: { lat: number; lng: number } | null,
  ): Promise<DriverAvailableOrderDto[]> {
    const reservedRows = await this.listDriverReservedScheduledOrders(driverId, null, null);
    return [...reservedRows].sort(
      (a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!),
    );
  }

  /** 預約提醒 job：組裝大廳 DTO */
  async buildAvailableDtoForOpenOrder(order: OrderEntity): Promise<DriverAvailableOrderDto | null> {
    const live = await this.filterOpenOrdersForDrivers([order]);
    if (!live.length) return null;
    const stopMap = await this.attachStops(live.map((o) => o.id));
    const dtos = await this.buildDriverAvailableDtosForOrders(live, stopMap);
    return dtos[0] ?? null;
  }

  private assertOrderReleasableToHall(locked: OrderEntity, inTripMessage: string) {
    const releasable: OrderEntity['status'][] = ['accepted', 'en_route'];
    if (!releasable.includes(locked.status)) {
      if (locked.status === 'in_trip') {
        throw new BadRequestException(inTripMessage);
      }
      throw new BadRequestException('此柯打狀態無法放回大廳');
    }
  }

  private async releaseAssignedOrderToHallInTx(
    manager: EntityManager,
    locked: OrderEntity,
    driverId: string,
    event: {
      actorType: OrderStatusEventEntity['actorType'];
      actorId: string;
      note: string;
    },
  ): Promise<OrderEntity> {
    this.assertOrderReleasableToHall(locked, '行程已開始，無法放回大廳');

    const from = locked.status;
    const posterId = locked.postedByDriverId;
    const bounty = this.bountyPointsFrom(locked);
    const orderId = locked.id;

    await this.driverOrderPoints.refundDriverAcceptCharge(orderId, driverId, manager);
    await this.driverOrderPoints.clawbackBusyHourReward(orderId, driverId, manager);
    await this.driverOrderPoints.clawbackBusyRegionReward(orderId, driverId, manager);
    if (posterId && bounty > 0) {
      await this.driverOrderPoints.clawbackDriverPostBountyFromPoster(
        orderId,
        posterId,
        bounty,
        manager,
      );
      await this.driverOrderPoints.revertDriverPostBountyOnHallRelease(
        orderId,
        driverId,
        bounty,
        manager,
      );
    }

    locked.driverId = null;
    locked.status = 'matching';
    locked.driverBusyRegionRewardPoints = null;
    locked.driverBusyRegionFromArea = null;
    locked.driverBusyRegionToArea = null;
    await manager.save(locked);

    await manager.save(
      manager.create(OrderStatusEventEntity, {
        orderId,
        fromStatus: from,
        toStatus: 'matching',
        actorType: event.actorType,
        actorId: event.actorId,
        note: event.note,
      }),
    );

    return locked;
  }

  private async afterOrderReleasedToHall(
    released: OrderEntity,
    orderId: string,
    options: {
      audit: { actorType: OrderStatusEventEntity['actorType']; actorId: string; action: string };
      notifyPassengerReleased: boolean;
      notifyDriverWontWait?: string | null;
    },
  ) {
    if (options.notifyPassengerReleased && released.passengerId) {
      void this.oneSignalPassenger.sendOrderReleasedToHall(released.passengerId, orderId);
    }
    if (options.notifyDriverWontWait) {
      void this.oneSignalDriver.sendPassengerWontWaitReleasedToHall(
        options.notifyDriverWontWait,
        orderId,
      );
    }

    await this.audit.log({
      actorType: options.audit.actorType,
      actorId: Number(options.audit.actorId),
      action: options.audit.action,
      resourceType: 'orders',
      resourceId: orderId,
      payload: { toStatus: 'matching' },
    });

    await this.notifyAdminOrder('updated', orderId);
    await this.notifyDriverSockets(orderId, 'updated');

    if (released.postedByDriverId) {
      this.orderNotifications.emitDriverPostedOrderNotice(released.postedByDriverId, {
        orderId,
        message: `柯打 #${orderId} 已放回大廳，等候司機接單。`,
      });
    }

    await this.orderChat.purgeForOrder(orderId);
  }

  /** 司機放出：已接柯打回到 matching，重新出現喺大廳 */
  async driverReleaseOrderToHall(driverId: string, orderId: string) {
    const released = await this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(OrderEntity, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Order not found');
      if (locked.driverId !== driverId) {
        throw new BadRequestException('此柯打不屬於你');
      }
      return this.releaseAssignedOrderToHallInTx(manager, locked, driverId, {
        actorType: 'driver',
        actorId: driverId,
        note: 'driver_release_to_hall',
      });
    });

    await this.afterOrderReleasedToHall(released, orderId, {
      audit: { actorType: 'driver', actorId: driverId, action: 'order.release_to_hall' },
      notifyPassengerReleased: true,
    });

    return { ok: true, status: released.status };
  }

  /** 乘客不等：解除司機配對，柯打回到 matching（等候下一位師傅） */
  async passengerReleaseOrderToHall(passengerId: string, orderId: string) {
    let previousDriverId: string | null = null;

    const released = await this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(OrderEntity, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Order not found');
      if (locked.passengerId !== passengerId) throw new ForbiddenException();
      if (!locked.driverId) {
        throw new BadRequestException('尚未有司機接單');
      }
      previousDriverId = locked.driverId;
      return this.releaseAssignedOrderToHallInTx(manager, locked, locked.driverId, {
        actorType: 'passenger',
        actorId: passengerId,
        note: 'passenger_release_to_hall',
      });
    });

    await this.afterOrderReleasedToHall(released, orderId, {
      audit: {
        actorType: 'passenger',
        actorId: passengerId,
        action: 'order.passenger_release_to_hall',
      },
      notifyPassengerReleased: false,
      notifyDriverWontWait: previousDriverId,
    });

    return { ok: true, status: released.status };
  }

  async driverMisacceptCancel(driverId: string, orderId: string) {
    return this.driverReleaseOrderToHall(driverId, orderId);
  }

  /**
   * 預約柯打仍在大廳（pending/matching）：用車時間 + 120 秒仍無司機接單 → 系統取消並通知乘客。
   * @returns 是否本次成功取消
   */
  async trySystemCancelExpiredOpenScheduledOrder(orderId: string): Promise<boolean> {
    const order = await this.orders.findOneBy({ id: orderId });
    if (!order?.scheduledAt) return false;
    if (order.status !== 'pending' && order.status !== 'matching') return false;
    if (order.driverId) return false;
    const deadlineMs = order.scheduledAt.getTime() + 120_000;
    if (Date.now() < deadlineMs) return false;

    const passengerId = order.passengerId?.trim() || null;
    await this.applyOrderCancellation(
      order,
      order.status,
      'system',
      null,
      'scheduled_unaccepted_auto_cancel',
    );

    if (passengerId) {
      void this.oneSignalPassenger.sendScheduledOrderAutoCancelled(passengerId, orderId);
    }

    return true;
  }
}
