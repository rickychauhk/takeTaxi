import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { DocumentsModule } from '../documents/documents.module';
import { LocationsModule } from '../locations/locations.module';
import { PromosModule } from '../promos/promos.module';
import { SystemSettingEntity } from '../settings/system-setting.entity';
import { DriverEntity } from './driver.entity';
import { DriverOrderPointsService } from './driver-order-points.service';
import { DriverSuspensionService } from './driver-suspension.service';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DriverEntity, SystemSettingEntity]),
    AdminAuthModule,
    forwardRef(() => PromosModule),
    DocumentsModule,
    LocationsModule,
  ],
  controllers: [DriversController],
  providers: [DriversService, DriverOrderPointsService, DriverSuspensionService],
  exports: [DriversService, DriverOrderPointsService, TypeOrmModule],
})
export class DriversModule {}
