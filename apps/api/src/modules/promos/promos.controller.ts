import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { AdminAuthGuard } from '../../common/admin-auth.guard';
import { PromosService } from './promos.service';

class CreatePromoDto {
  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  marksInternalMember?: boolean;
}

class UpdatePromoDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  marksInternalMember?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class ApplyPromoDto {
  @IsString()
  code!: string;

  @IsString()
  driverId!: string;
}

@Controller()
export class PromosController {
  constructor(private readonly promos: PromosService) {}

  @Post('driver/promo/apply')
  apply(@Body() dto: ApplyPromoDto) {
    return this.promos.applyPromoToDriver(dto.code, dto.driverId);
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/promos')
  list() {
    return this.promos.list();
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/promos/internal-drivers')
  internalDrivers() {
    return this.promos.internalDriversWithPromo();
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/promos/:id/drivers')
  driversForPromo(@Param('id') id: string) {
    return this.promos.driversForPromo(Number(id));
  }

  @UseGuards(AdminAuthGuard)
  @Post('admin/promos')
  create(@Body() dto: CreatePromoDto, @Req() req: { admin: { sub: number } }) {
    return this.promos.create(req.admin.sub, dto);
  }

  @UseGuards(AdminAuthGuard)
  @Put('admin/promos/:id')
  update(@Param('id') id: string, @Body() dto: UpdatePromoDto, @Req() req: { admin: { sub: number } }) {
    return this.promos.update(req.admin.sub, Number(id), dto);
  }

  @UseGuards(AdminAuthGuard)
  @Delete('admin/promos/:id')
  remove(@Param('id') id: string, @Req() req: { admin: { sub: number } }) {
    return this.promos.remove(req.admin.sub, Number(id));
  }

  @UseGuards(AdminAuthGuard)
  @Patch('admin/promos/:id/deactivate')
  deactivate(@Param('id') id: string, @Req() req: { admin: { sub: number } }) {
    return this.promos.remove(req.admin.sub, Number(id));
  }
}
