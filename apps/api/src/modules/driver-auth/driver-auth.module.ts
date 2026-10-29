import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverAuthGuard } from '../../common/driver-auth.guard';
import { FirebaseTokenService } from '../admin-auth/firebase-token.service';
import { DriverEntity } from '../drivers/driver.entity';
import { DriverVehiclePlateHistoryEntity } from './driver-vehicle-plate-history.entity';
import { DriversModule } from '../drivers/drivers.module';
import { LocationsModule } from '../locations/locations.module';
import { DriverAuthController } from './driver-auth.controller';
import { DriverAuthService } from './driver-auth.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DriverEntity, DriverVehiclePlateHistoryEntity]),
    JwtModule.register({}),
    LocationsModule,
    DriversModule,
  ],
  controllers: [DriverAuthController],
  providers: [DriverAuthService, FirebaseTokenService, DriverAuthGuard],
  exports: [DriverAuthService, DriverAuthGuard, JwtModule],
})
export class DriverAuthModule {}
