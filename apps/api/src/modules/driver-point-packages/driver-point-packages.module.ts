import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { DriverAuthModule } from '../driver-auth/driver-auth.module';
import { DriverPointPackageEntity } from './driver-point-package.entity';
import { DriverPointPackagesController } from './driver-point-packages.controller';
import { DriverPointPackagesService } from './driver-point-packages.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DriverPointPackageEntity]),
    AdminAuthModule,
    DriverAuthModule,
  ],
  controllers: [DriverPointPackagesController],
  providers: [DriverPointPackagesService],
  exports: [DriverPointPackagesService],
})
export class DriverPointPackagesModule {}
