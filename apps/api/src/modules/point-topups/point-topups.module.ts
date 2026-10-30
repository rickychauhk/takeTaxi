import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { AiModule } from '../ai/ai.module';
import { DriverPointPackageEntity } from '../driver-point-packages/driver-point-package.entity';
import { DriverPointPackagesModule } from '../driver-point-packages/driver-point-packages.module';
import { DriverAuthModule } from '../driver-auth/driver-auth.module';
import { DriverEntity } from '../drivers/driver.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';
import { PointTopupEntity } from './point-topup.entity';
import { PointTopupGeminiReviewService } from './point-topup-gemini-review.service';
import { PointTopupsController } from './point-topups.controller';
import { PointTopupsService } from './point-topups.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PointTopupEntity, DriverEntity, DriverPointPackageEntity]),
    AdminAuthModule,
    DriverAuthModule,
    DriverPointPackagesModule,
    SettingsModule,
    NotificationsModule,
    AiModule,
  ],
  controllers: [PointTopupsController],
  providers: [PointTopupsService, PointTopupGeminiReviewService],
})
export class PointTopupsModule {}
