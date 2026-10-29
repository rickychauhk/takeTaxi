import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { PassengerAuthModule } from '../passenger-auth/passenger-auth.module';
import { DriverEntity } from '../drivers/driver.entity';
import { PassengerEntity } from '../passengers/passenger.entity';
import { PassengerPushInboxModule } from '../notifications/passenger-push-inbox.module';
import { MessageEntity } from './message.entity';
import { MessagesController } from './messages.controller';
import { PassengerMessagesController } from './passenger-messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MessageEntity, DriverEntity, PassengerEntity]),
    PassengerPushInboxModule,
    AdminAuthModule,
    PassengerAuthModule,
  ],
  controllers: [MessagesController, PassengerMessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
