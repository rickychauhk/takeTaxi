import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { SystemSettingEntity } from './system-setting.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SystemSettingEntity]), AdminAuthModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
