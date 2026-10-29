import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverEntity } from '../drivers/driver.entity';
import { LocationsModule } from '../locations/locations.module';
import { OrdersModule } from '../orders/orders.module';
import { OrderNotificationsModule } from './order-notifications.module';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [
    OrderNotificationsModule,
    LocationsModule,
    OrdersModule,
    TypeOrmModule.forFeature([DriverEntity]),
    JwtModule.register({}),
  ],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
