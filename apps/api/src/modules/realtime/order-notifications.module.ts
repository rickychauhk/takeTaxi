import { Global, Module } from '@nestjs/common';
import { LocationsModule } from '../locations/locations.module';
import { MapsModule } from '../maps/maps.module';
import { OrderNotificationsService } from './order-notifications.service';

@Global()
@Module({
  imports: [LocationsModule, MapsModule],
  providers: [OrderNotificationsService],
  exports: [OrderNotificationsService],
})
export class OrderNotificationsModule {}
