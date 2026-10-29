import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUserEntity } from '../admin-auth/admin-user.entity';
import { AuditLogEntity } from './audit-log.entity';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity, AdminUserEntity]), AdminAuthModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
