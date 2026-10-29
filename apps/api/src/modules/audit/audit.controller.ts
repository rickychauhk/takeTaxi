import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { AdminAuthGuard } from '../../common/admin-auth.guard';
import { AuditService } from './audit.service';

class ListAuditQuery {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number;

  @IsOptional()
  @IsString()
  action?: string;
}

@Controller('admin/audit-logs')
@UseGuards(AdminAuthGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query() query: ListAuditQuery) {
    return this.audit.listAdmin(query);
  }
}
