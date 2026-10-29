import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LostPropertyService } from './lost-property.service';

const TICK_MS = 30_000;

@Injectable()
export class LostPropertyExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(LostPropertyExpiryService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;

  constructor(private readonly lostProperty: LostPropertyService) {}

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
      const n = await this.lostProperty.expireDueRows();
      if (n > 0) this.log.log(`失物協助已下架 ${n} 則並推播乘客`);
    } catch (e) {
      this.log.warn(`失物協助到期檢查失敗: ${String(e)}`);
    } finally {
      this.ticking = false;
    }
  }
}
