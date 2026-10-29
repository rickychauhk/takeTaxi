import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { AdminAuthGuard } from '../../common/admin-auth.guard';
import { PassengersService } from './passengers.service';

class UpsertPassengerDto {
  @IsOptional()
  @IsString()
  displayName?: string;
  @IsOptional()
  @IsString()
  phone?: string;
  @IsOptional()
  @IsString()
  email?: string;
}

@Controller('admin/passengers')
@UseGuards(AdminAuthGuard)
export class PassengersController {
  constructor(private readonly passengers: PassengersService) {}

  @Get()
  list(@Query('q') q?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.passengers.list(q, page, pageSize);
  }

  @Get(':id/point-ledger')
  pointLedger(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.passengers.listPointLedger(id, page, pageSize);
  }

  @Post()
  create(@Body() dto: UpsertPassengerDto, @Req() req: { admin: { sub: number } }) {
    return this.passengers.create(req.admin.sub, dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertPassengerDto, @Req() req: { admin: { sub: number } }) {
    return this.passengers.update(req.admin.sub, id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: { admin: { sub: number } }) {
    return this.passengers.remove(req.admin.sub, id);
  }
}
