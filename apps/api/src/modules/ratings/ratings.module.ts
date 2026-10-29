import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { DriverEntity } from '../drivers/driver.entity';
import { OrderEntity } from '../orders/order.entity';
import { PassengerEntity } from '../passengers/passenger.entity';
import { RatingEntity } from './rating.entity';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([RatingEntity, OrderEntity, DriverEntity, PassengerEntity]),
    AdminAuthModule,
  ],
  controllers: [RatingsController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}
