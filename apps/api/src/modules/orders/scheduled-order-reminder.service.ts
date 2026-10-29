import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderNotificationsService } from '../realtime/order-notifications.service';
import { OrderEntity } from './order.entity';
import { OrderScheduledReminderSentEntity } from './order-scheduled-reminder-sent.entity';
import { OrderVisibilityService } from './order-visibility.service';
import { OrdersService } from './orders.service';

const REMINDER_MINUTES = [30, 15, 5] as const;
const TICK_MS = 60_000;
const TRIGGER_WINDOW_MS = 120_000;
const LOOKAHEAD_MS = 35 * 60_000;

@Injectable()
export class ScheduledOrderReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ScheduledOrderReminderService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;

  constructor(
    @InjectRepository(OrderEntity) private readonly orders: Repository<OrderEntity>,
    @InjectRepository(OrderScheduledReminderSentEntity)
    private readonly sent: Repository<OrderScheduledReminderSentEntity>,
    private readonly ordersService: OrdersService,
    private readonly orderNotifications: OrderNotificationsService,
    private readonly visibility: OrderVisibilityService,
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
      const horizon = new Date(now + LOOKAHEAD_MS);
      const open = await this.orders
        .createQueryBuilder('o')
        .where('o.status IN (:...st)', { st: ['matching', 'pending'] })
        .andWhere('o.scheduled_at IS NOT NULL')
        .andWhere('o.scheduled_at > :now', { now: new Date(now) })
        .andWhere('o.scheduled_at <= :horizon', { horizon })
        .getMany();

      for (const order of open) {
        if (!order.scheduledAt) continue;
        const scheduledMs = order.scheduledAt.getTime();
        for (const minutesBefore of REMINDER_MINUTES) {
          const triggerAt = scheduledMs - minutesBefore * 60_000;
          if (now < triggerAt || now >= triggerAt + TRIGGER_WINDOW_MS) continue;

          const exists = await this.sent.findOneBy({
            orderId: order.id,
            minutesBefore,
          });
          if (exists) continue;

          const dto = await this.ordersService.buildAvailableDtoForOpenOrder(order);
          if (!dto) continue;

          await this.orderNotifications.pushScheduledOrderReminderToEligibleOnlineDrivers(
            order,
            dto,
            this.visibility,
            minutesBefore,
          );

          await this.sent.save(
            this.sent.create({
              orderId: order.id,
              minutesBefore,
              sentAt: new Date(),
            }),
          );
          this.log.log(`已發預約提醒 order=${order.id} T-${minutesBefore}`);
        }
      }
    } catch (e) {
      this.log.warn('scheduled reminder tick 失敗', e);
    } finally {
      this.ticking = false;
    }
  }
}
