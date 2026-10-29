import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { AdEntity } from './ad.entity';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';

@Module({
  imports: [TypeOrmModule.forFeature([AdEntity]), AdminAuthModule],
  controllers: [AdsController],
  providers: [AdsService],
})
export class AdsModule {}
