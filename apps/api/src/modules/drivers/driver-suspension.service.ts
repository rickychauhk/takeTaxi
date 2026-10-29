import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DriverEntity } from './driver.entity';

const TICK_MS = 60_000;

@Injectable()
export class DriverSuspensionService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(DriverSuspensionService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;

  constructor(@InjectRepository(DriverEntity) private readonly drivers: Repository<DriverEntity>) {}

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
      const n = await this.clearExpiredSuspensions();
      if (n > 0) this.log.log(`已自動解除 ${n} 位司機限期停用`);
    } finally {
      this.ticking = false;
    }
  }

  /** 清除已過期的限期停用（永久停用不受影響） */
  async clearExpiredSuspensions(): Promise<number> {
    const result = await this.drivers
      .createQueryBuilder()
      .update(DriverEntity)
      .set({
        suspendedUntil: null,
        suspendedReason: null,
      })
      .where('suspended_permanent = 0')
      .andWhere('suspended_until IS NOT NULL')
      .andWhere('suspended_until <= :now', { now: new Date() })
      .execute();
    return result.affected ?? 0;
  }
}
