import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthGuard } from '../../common/admin-auth.guard';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { DriverEntity } from '../drivers/driver.entity';
import { AdminUserEntity } from './admin-user.entity';
import { FirebaseTokenService } from './firebase-token.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AdminUserEntity, DriverEntity]),
    JwtModule.register({}),
  ],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, FirebaseTokenService, AdminAuthGuard],
  exports: [JwtModule, AdminAuthGuard, TypeOrmModule, AdminAuthService],
})
export class AdminAuthModule {}
