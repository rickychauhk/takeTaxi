import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { OrderEntity } from '../orders/order.entity';
import { SystemSettingEntity } from '../settings/system-setting.entity';
import { PassengerEntity } from './passenger.entity';
import { PassengerAppController } from './passenger-app.controller';
import { PassengerPointsService } from './passenger-points.service';
import { PassengersController } from './passengers.controller';
import { PassengersService } from './passengers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PassengerEntity, SystemSettingEntity, OrderEntity]),
    AdminAuthModule,
  ],
  controllers: [PassengersController, PassengerAppController],
  providers: [PassengersService, PassengerPointsService],
  exports: [PassengersService, PassengerPointsService],
})
export class PassengersModule {}
