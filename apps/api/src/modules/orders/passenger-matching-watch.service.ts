import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OrderNotificationsService } from '../realtime/order-notifications.service';
import { PASSENGER_MATCHING_WATCH_SWEEP_MS } from './passenger-matching-watch.constants';
import { OrdersService } from './orders.service';

@Injectable()
export class PassengerMatchingWatchService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(PassengerMatchingWatchService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;
  /** 已通知大廳移除，避免每 tick 重複 emit */
  private readonly hallRemovedNotified = new Set<string>();

  constructor(
    private readonly orders: OrdersService,
    private readonly orderNotifications: OrderNotificationsService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), PASSENGER_MATCHING_WATCH_SWEEP_MS);
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  clearHallRemovedNotice(orderId: string) {
    this.hallRemovedNotified.delete(orderId);
  }

  private async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const staleIds = await this.orders.listInstantMatchingOrdersMissingPassengerWatch();
      for (const orderId of staleIds) {
        if (this.hallRemovedNotified.has(orderId)) continue;
        this.hallRemovedNotified.add(orderId);
        this.orderNotifications.broadcastDriverOrderRemoved(orderId);
        this.orderNotifications.publishAdminOrderEvent({ type: 'removed', orderId });
      }
    } catch (e) {
      this.log.warn('matching watch sweep failed', e);
    } finally {
      this.ticking = false;
    }
  }
}
