import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from './order.entity';
import { OrdersService } from './orders.service';

/** 用車時間過後仍無人接單，自動取消 */
export const SCHEDULED_OPEN_ORDER_AUTO_CANCEL_AFTER_MS = 120_000;

const TICK_MS = 30_000;
const BATCH = 50;
/** 避免掃描過舊殘留 open 預約 */
const MAX_AGE_MS = 7 * 24 * 60 * 60_000;

@Injectable()
export class ScheduledOrderAutoCancelService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ScheduledOrderAutoCancelService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;

  constructor(
    @InjectRepository(OrderEntity) private readonly orders: Repository<OrderEntity>,
    private readonly ordersService: OrdersService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const now = Date.now();
      const cancelNotAfter = new Date(now - SCHEDULED_OPEN_ORDER_AUTO_CANCEL_AFTER_MS);
      const cancelNotBefore = new Date(now - SCHEDULED_OPEN_ORDER_AUTO_CANCEL_AFTER_MS - MAX_AGE_MS);

      const candidates = await this.orders
        .createQueryBuilder('o')
        .where('o.status IN (:...st)', { st: ['matching', 'pending'] })
        .andWhere('o.scheduled_at IS NOT NULL')
        .andWhere('o.driver_id IS NULL')
        .andWhere('o.scheduled_at <= :cancelNotAfter', { cancelNotAfter })
        .andWhere('o.scheduled_at >= :cancelNotBefore', { cancelNotBefore })
        .orderBy('o.scheduled_at', 'ASC')
        .take(BATCH)
        .getMany();

      for (const order of candidates) {
        const cancelled = await this.ordersService.trySystemCancelExpiredOpenScheduledOrder(order.id);
        if (cancelled) {
          this.log.log(`已自動取消逾時未接預約 order=${order.id}`);
        }
      }
    } catch (e) {
      this.log.warn('scheduled auto-cancel tick 失敗', e);
    } finally {
      this.ticking = false;
    }
  }
}
