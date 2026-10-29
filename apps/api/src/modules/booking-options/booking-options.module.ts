import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { BookingOptionCategoryEntity } from './booking-option-category.entity';
import { BookingOptionEntity } from './booking-option.entity';
import { BookingOptionsController } from './booking-options.controller';
import { BookingOptionsService } from './booking-options.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BookingOptionCategoryEntity, BookingOptionEntity]),
    AdminAuthModule,
  ],
  controllers: [BookingOptionsController],
  providers: [BookingOptionsService],
  exports: [BookingOptionsService],
})
export class BookingOptionsModule {}
