import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { DriverPointPackagesModule } from '../driver-point-packages/driver-point-packages.module';
import { DriverAuthModule } from '../driver-auth/driver-auth.module';
import { DriverEntity } from '../drivers/driver.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';
import { PointTopupEntity } from './point-topup.entity';
import { PointTopupsController } from './point-topups.controller';
import { PointTopupsService } from './point-topups.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PointTopupEntity, DriverEntity]),
    AdminAuthModule,
    DriverAuthModule,
    DriverPointPackagesModule,
    SettingsModule,
    NotificationsModule,
  ],
  controllers: [PointTopupsController],
  providers: [PointTopupsService],
})
export class PointTopupsModule {}
