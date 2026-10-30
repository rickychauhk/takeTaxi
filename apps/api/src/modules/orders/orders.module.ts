import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { BookingOptionCategoryEntity } from '../booking-options/booking-option-category.entity';
import { BookingOptionEntity } from '../booking-options/booking-option.entity';
import { LocationsModule } from '../locations/locations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DriverAuthModule } from '../driver-auth/driver-auth.module';
import { DriversModule } from '../drivers/drivers.module';
import { DriverEntity } from '../drivers/driver.entity';
import { PassengerAuthModule } from '../passenger-auth/passenger-auth.module';
import { PassengersModule } from '../passengers/passengers.module';
import { PassengerEntity } from '../passengers/passenger.entity';
import { OrderStatusEventEntity } from './order-status-event.entity';
import { OrderStopEntity } from './order-stop.entity';
import { OrderEntity } from './order.entity';
import { OrderScheduledReminderSentEntity } from './order-scheduled-reminder-sent.entity';
import { OrderVisibilityService } from './order-visibility.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ScheduledOrderReminderService } from './scheduled-order-reminder.service';
import { ScheduledOrderAutoCancelService } from './scheduled-order-auto-cancel.service';
import { PassengerMatchingWatchService } from './passenger-matching-watch.service';
import { OrderChatModule } from '../order-chat/order-chat.module';
import { SettingsModule } from '../settings/settings.module';
import { MapsModule } from '../maps/maps.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      DriverEntity,
      PassengerEntity,
      OrderStopEntity,
      OrderStatusEventEntity,
      OrderScheduledReminderSentEntity,
      BookingOptionEntity,
      BookingOptionCategoryEntity,
    ]),
    AdminAuthModule,
    PassengersModule,
    PassengerAuthModule,
    DriversModule,
    DriverAuthModule,
    LocationsModule,
    NotificationsModule,
    SettingsModule,
    MapsModule,
    forwardRef(() => OrderChatModule),
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderVisibilityService,
    ScheduledOrderReminderService,
    ScheduledOrderAutoCancelService,
    PassengerMatchingWatchService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
