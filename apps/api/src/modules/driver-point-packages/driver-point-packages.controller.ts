import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { AdminAuthGuard } from '../../common/admin-auth.guard';
import { DriverAuthGuard } from '../../common/driver-auth.guard';
import { DriverPointPackagesService } from './driver-point-packages.service';

class UpsertPackageDto {
  @IsNumber()
  points!: number;

  @IsNumber()
  priceHkd!: number;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller()
export class DriverPointPackagesController {
  constructor(private readonly packages: DriverPointPackagesService) {}

  @UseGuards(DriverAuthGuard)
  @Get('driver/point-packages')
  listForDriver() {
    return this.packages.listActive();
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/driver-point-packages')
  listForAdmin() {
    return this.packages.listAll();
  }

  @UseGuards(AdminAuthGuard)
  @Post('admin/driver-point-packages')
  create(@Body() dto: UpsertPackageDto) {
    return this.packages.create(dto);
  }

  @UseGuards(AdminAuthGuard)
  @Put('admin/driver-point-packages/:id')
  update(@Param('id') id: string, @Body() dto: UpsertPackageDto) {
    return this.packages.update(id, dto);
  }
}
