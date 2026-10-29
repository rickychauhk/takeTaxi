import { Injectable, Logger } from '@nestjs/common';
import type { DriverTier } from '@taxima/shared';
import type { Server } from 'socket.io';
import { LocationsService } from '../locations/locations.service';
import { MapsService } from '../maps/maps.service';
import { OneSignalDriverService } from '../notifications/onesignal-driver.service';
import type { DriverAvailableOrderDto } from '../orders/driver-available-order.types';
import type { OrderEntity } from '../orders/order.entity';
import type { OrderVisibilityService } from '../orders/order-visibility.service';
import {
  isFutureScheduledAt,
  isWithinDriverPickupRadius,
} from '../orders/driver-pickup-radius.util';
export type AdminOrderSocketPayload =
  | { type: 'created' | 'updated'; order: Record<string, unknown> }
  | { type: 'removed'; orderId: string };

export type DriverOrderSocketPayload =
  | { type: 'created' | 'updated'; order: DriverAvailableOrderDto }
  | { type: 'removed'; orderId: string };

@Injectable()
export class OrderNotificationsService {
  private readonly log = new Logger(OrderNotificationsService.name);
  private server: Server | null = null;

  constructor(
    private readonly locations: LocationsService,
    private readonly oneSignalDriver: OneSignalDriverService,
    private readonly maps: MapsService,
  ) {}

  private async dtoWithDrivingPickupKm(
    dto: DriverAvailableOrderDto,
    driverPosition: { lat: number; lng: number } | null,
  ): Promise<DriverAvailableOrderDto> {
    if (!driverPosition) return dto;
    const lat = dto.pickupLat;
    const lng = dto.pickupLng;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return dto;
    }
    const [km] = await this.maps.drivingDistanceMatrixKm(driverPosition, [{ lat, lng }]);
    if (km == null || !Number.isFinite(km)) return dto;
    return { ...dto, pickupDistanceKm: km };
  }

  setServer(server: Server) {
    this.server = server;
  }

  publishAdminOrderEvent(payload: AdminOrderSocketPayload) {
    this.server?.to('admin:orders').emit('admin:order:event', payload);
  }

  broadcastDriverOrderRemoved(orderId: string) {
    this.server
      ?.to('drivers:online')
      .emit('driver:order:event', { type: 'removed', orderId } satisfies DriverOrderSocketPayload);
  }

  /** 按 tier 時間軸只推送當前可見嘅司機 */
  /** 射柯打發單司機：懸賞退回等通知 */
  notifyDriverSessionRevoked(driverId: string, message: string) {
    this.server?.to(`driver:${driverId}`).emit('driver:session:revoked', { message });
  }

  emitDriverPostedOrderNotice(
    posterDriverId: string,
    payload: { orderId: string; message: string; kind?: 'bounty_refunded' | 'accepted' },
  ) {
    this.server?.to(`driver:${posterDriverId}`).emit('driver:posted-order:notice', payload);
  }

  async emitDriverOrderToEligibleDrivers(
    order: OrderEntity,
    dto: DriverAvailableOrderDto,
    visibility: OrderVisibilityService,
    eventType: 'created' | 'updated' = 'updated',
  ) {
    if (!this.server) return;
    const sockets = await this.server.in('drivers:online').fetchSockets();
    for (const remote of sockets) {
      const tier = remote.data.driverTier as DriverTier | undefined;
      if (
        !tier ||
        !visibility.canDriverSeeOrder(order.createdAt, {
          driverTier: tier,
          isInternalMember: Boolean(remote.data.isInternalMember),
        })
      ) {
        continue;
      }
      const driverId = remote.data.driverId as string | undefined;
      const maxKm = remote.data.maxPickupRadiusKm as number | null | undefined;
      const skipRadiusForScheduled = isFutureScheduledAt(dto.scheduledAt);
      const socketLat = remote.data.driverLat as number | undefined;
      const socketLng = remote.data.driverLng as number | undefined;
      const fromSocket =
        socketLat != null &&
        socketLng != null &&
        Number.isFinite(socketLat) &&
        Number.isFinite(socketLng)
          ? { lat: socketLat, lng: socketLng }
          : null;
      if (driverId && maxKm != null && maxKm > 0 && !skipRadiusForScheduled) {
        if (!fromSocket) continue;
        if (
          !isWithinDriverPickupRadius(
            fromSocket.lat,
            fromSocket.lng,
            dto.pickupLat,
            dto.pickupLng,
            maxKm,
          )
        ) {
          continue;
        }
      }
      const orderPayload = await this.dtoWithDrivingPickupKm(dto, fromSocket);
      remote.emit('driver:order:event', {
        type: eventType,
        order: orderPayload,
      } satisfies DriverOrderSocketPayload);
    }
  }

  /** 新柯打：背景 OneSignal（含未連 WS 的在線司機） */
  async pushNewOrderToEligibleOnlineDrivers(
    order: OrderEntity,
    dto: DriverAvailableOrderDto,
    visibility: OrderVisibilityService,
  ) {
    let rows: Awaited<ReturnType<LocationsService['listOnlineDriversForDispatch']>>;
    try {
      rows = await this.locations.listOnlineDriversForDispatch();
    } catch (e) {
      this.log.warn('listOnlineDriversForDispatch 失敗', e);
      return;
    }

    if (!rows.length) {
      this.log.warn(
        `新柯打 push：0 位司機符合 GPS 條件（上線且 ${process.env.DRIVER_DISPATCH_GPS_MAX_AGE_MINUTES ?? '15'} 分鐘內有定位） order=${dto.orderId}`,
      );
    }

    const tasks: Promise<void>[] = [];
    for (const row of rows) {
      if (
        !visibility.canDriverSeeOrder(order.createdAt, {
          driverTier: row.driverTier,
          isInternalMember: row.isInternalMember,
        })
      ) {
        continue;
      }
      if (
        !isFutureScheduledAt(dto.scheduledAt) &&
        !isWithinDriverPickupRadius(
          row.lat,
          row.lng,
          dto.pickupLat,
          dto.pickupLng,
          row.maxPickupRadiusKm,
        )
      ) {
        continue;
      }
      tasks.push(
        this.oneSignalDriver.sendNewOrderPush(row.driverId, {
          orderId: dto.orderId,
          pickupLabel: dto.pickupAddress ?? '上車點',
          dropoffLabel: dto.dropoffAddress ?? '目的地',
        }),
      );
    }
    if (rows.length && !tasks.length) {
      this.log.warn(`新柯打 push：有 ${rows.length} 位司機有 GPS，但無人通過 tier/半徑 order=${dto.orderId}`);
    }
    await Promise.all(tasks);
  }

  /** 預約柯打：T-30 / T-15 / T-5 提醒在線司機 */
  async pushScheduledOrderReminderToEligibleOnlineDrivers(
    order: OrderEntity,
    dto: DriverAvailableOrderDto,
    visibility: OrderVisibilityService,
    minutesBefore: number,
  ) {
    let rows: Awaited<ReturnType<LocationsService['listOnlineDriversForDispatch']>>;
    try {
      rows = await this.locations.listOnlineDriversForDispatch();
    } catch (e) {
      this.log.warn('listOnlineDriversForDispatch 失敗（預約提醒）', e);
      return;
    }

    const scheduledLabel = dto.scheduledAt?.trim() || '';
    const tasks: Promise<void>[] = [];
    for (const row of rows) {
      if (
        !visibility.canDriverSeeOrder(order.createdAt, {
          driverTier: row.driverTier,
          isInternalMember: row.isInternalMember,
        })
      ) {
        continue;
      }
      tasks.push(
        this.oneSignalDriver.sendScheduledOrderReminderPush(row.driverId, {
          orderId: dto.orderId,
          pickupLabel: dto.pickupAddress ?? '上車點',
          dropoffLabel: dto.dropoffAddress ?? '目的地',
          scheduledAtIso: scheduledLabel,
          minutesBefore,
        }),
      );
    }
    await Promise.all(tasks);
  }

  emitOrderChatMessage(payload: {
    orderId: string;
    passengerId: string;
    driverId: string;
    message: Record<string, unknown>;
  }) {
    this.server?.to(`driver:${payload.driverId}`).emit('order:chat:message', payload);
    this.server?.to(`passenger:${payload.passengerId}`).emit('order:chat:message', payload);
  }
}
