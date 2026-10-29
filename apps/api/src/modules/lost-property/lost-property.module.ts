import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { PassengerAuthModule } from '../passenger-auth/passenger-auth.module';
import { PassengerEntity } from '../passengers/passenger.entity';
import { LostPropertyController } from './lost-property.controller';
import { LostPropertyExpiryService } from './lost-property-expiry.service';
import { LostPropertyRequestEntity } from './lost-property-request.entity';
import { LostPropertyService } from './lost-property.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LostPropertyRequestEntity, PassengerEntity]),
    PassengerAuthModule,
    NotificationsModule,
  ],
  controllers: [LostPropertyController],
  providers: [LostPropertyService, LostPropertyExpiryService],
  exports: [LostPropertyService],
})
export class LostPropertyModule {}
