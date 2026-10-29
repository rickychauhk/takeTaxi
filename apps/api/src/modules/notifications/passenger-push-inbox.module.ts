import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassengerPushInboxEntity } from './passenger-push-inbox.entity';
import { PassengerPushInboxService } from './passenger-push-inbox.service';

@Module({
  imports: [TypeOrmModule.forFeature([PassengerPushInboxEntity])],
  providers: [PassengerPushInboxService],
  exports: [PassengerPushInboxService],
})
export class PassengerPushInboxModule {}
