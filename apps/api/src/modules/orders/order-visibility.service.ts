import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  driverHasHallPriorityPreview,
  parseDriverHallPriorityPreviewSeconds,
  DRIVER_HALL_PRIORITY_PREVIEW_SECONDS_SETTING_KEY,
  type DriverHallVisibilityContext,
} from '@taxima/shared';
import { SettingsService } from '../settings/settings.service';

const REFRESH_MS = 15_000;

@Injectable()
export class OrderVisibilityService implements OnModuleInit, OnModuleDestroy {
  private previewSeconds = parseDriverHallPriorityPreviewSeconds(
    process.env.ORDER_ADMIN_PREVIEW_SECONDS,
  );
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly settings: SettingsService) {}

  onModuleInit() {
    void this.refreshPreviewSeconds();
    this.timer = setInterval(() => void this.refreshPreviewSeconds(), REFRESH_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async refreshPreviewSeconds() {
    try {
      const raw = await this.settings.getRawSettingValue(DRIVER_HALL_PRIORITY_PREVIEW_SECONDS_SETTING_KEY);
      this.previewSeconds = parseDriverHallPriorityPreviewSeconds(
        raw || process.env.ORDER_ADMIN_PREVIEW_SECONDS,
      );
    } catch {
      this.previewSeconds = parseDriverHallPriorityPreviewSeconds(process.env.ORDER_ADMIN_PREVIEW_SECONDS);
    }
  }

  getPreviewSecondsForAdmin(): number {
    return this.previewSeconds;
  }

  canDriverSeeOrder(
    orderCreatedAt: Date,
    driver: DriverHallVisibilityContext,
    now = new Date(),
  ): boolean {
    const preview = this.previewSeconds;
    if (preview <= 0) return true;
    const elapsedSec = (now.getTime() - orderCreatedAt.getTime()) / 1000;
    if (elapsedSec >= preview) return true;
    return driverHasHallPriorityPreview(driver);
  }
}
