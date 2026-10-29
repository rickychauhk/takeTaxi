import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { DriverAuthModule } from '../driver-auth/driver-auth.module';
import { DriverEntity } from '../drivers/driver.entity';
import { OrderEntity } from '../orders/order.entity';
import { PassengerEntity } from '../passengers/passenger.entity';
import { OrdersModule } from '../orders/orders.module';
import { PassengerAuthModule } from '../passenger-auth/passenger-auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrderNotificationsModule } from '../realtime/order-notifications.module';
import { DriverOrderChatController } from './driver-order-chat.controller';
import { OrderChatMessageEntity } from './order-chat-message.entity';
import { OrderChatAdminController } from './order-chat.controller';
import { OrderChatService } from './order-chat.service';
import { PassengerOrderChatController } from './passenger-order-chat.controller';
import { PassengerOrderChatQuickReplyEntity } from './passenger-order-chat-quick-reply.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderChatMessageEntity,
      PassengerOrderChatQuickReplyEntity,
      OrderEntity,
      PassengerEntity,
      DriverEntity,
    ]),
    AdminAuthModule,
    PassengerAuthModule,
    DriverAuthModule,
    OrderNotificationsModule,
    NotificationsModule,
    forwardRef(() => OrdersModule),
  ],
  controllers: [OrderChatAdminController, PassengerOrderChatController, DriverOrderChatController],
  providers: [OrderChatService],
  exports: [OrderChatService],
})
export class OrderChatModule {}
