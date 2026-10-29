import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { MobileAppReleaseEntity } from './mobile-app-release.entity';
import { MobileAppReleasesController } from './mobile-app-releases.controller';
import { MobileAppReleasesService } from './mobile-app-releases.service';

@Module({
  imports: [TypeOrmModule.forFeature([MobileAppReleaseEntity]), AdminAuthModule],
  controllers: [MobileAppReleasesController],
  providers: [MobileAppReleasesService],
})
export class MobileAppReleasesModule {}
