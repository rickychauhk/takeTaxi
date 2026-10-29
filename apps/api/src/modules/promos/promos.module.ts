import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { DriverEntity } from '../drivers/driver.entity';
import { PromoCodeEntity } from './promo-code.entity';
import { PromoRedemptionEntity } from './promo-redemption.entity';
import { PromosController } from './promos.controller';
import { PromosService } from './promos.service';

@Module({
  imports: [TypeOrmModule.forFeature([PromoCodeEntity, PromoRedemptionEntity, DriverEntity]), AdminAuthModule],
  controllers: [PromosController],
  providers: [PromosService],
  exports: [PromosService],
})
export class PromosModule {}
