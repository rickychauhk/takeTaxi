import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  HK_LICENSED_BANK_NAMES,
  normalizeHongKongBankAccountNumber,
} from '@taxima/shared';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

function toOptionalBoolean({ value }: { value: unknown }) {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return value;
}
import { AdminAuthGuard } from '../../common/admin-auth.guard';
import { DriverEntity } from './driver.entity';
import { DriversService } from './drivers.service';

class RegisterDriverDto {
  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  offDutyPhone?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(32)
  vehiclePlate!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  licenseNumber!: string;

  @IsOptional()
  @IsString()
  vehiclePlateExpiry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  vehicleModel?: string;

  @IsOptional()
  @IsString()
  firstRegistrationDate?: string;

  @IsOptional()
  @IsString()
  promoCode?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([...HK_LICENSED_BANK_NAMES])
  bankName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(34)
  @Matches(/^[\d\s-]+$/, { message: '銀行戶口須為數字' })
  bankAccountNumber!: string;
}

class CreateDriverDto {
  @IsString()
  phone!: string;

  @IsString()
  offDutyPhone!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(32)
  displayName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  licenseNumber!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(32)
  vehiclePlate!: string;

  @IsString()
  @IsNotEmpty()
  vehiclePlateExpiry!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  vehicleModel!: string;

  @IsString()
  @IsNotEmpty()
  firstRegistrationDate!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([...HK_LICENSED_BANK_NAMES])
  bankName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(34)
  @Matches(/^[\d\s-]+$/, { message: '銀行戶口須為數字' })
  bankAccountNumber!: string;

  @IsOptional()
  @IsEnum(['admin', 'partner', 'public'])
  driverTier?: DriverEntity['driverTier'];
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isInternalMember?: boolean;
  @IsOptional()
  @IsEnum(['pending', 'approved', 'rejected'])
  verificationStatus?: DriverEntity['verificationStatus'];
}

class UpdateDriverDto {
  @IsOptional()
  @IsString()
  phone?: string;
  @IsOptional()
  @IsString()
  offDutyPhone?: string;
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  displayName?: string;
  @IsOptional()
  @IsString()
  @MaxLength(64)
  licenseNumber?: string;
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  vehiclePlate?: string;
  @IsOptional()
  @IsString()
  vehiclePlateExpiry?: string;
  @IsOptional()
  @IsString()
  @MaxLength(64)
  vehicleModel?: string;
  @IsOptional()
  @IsString()
  firstRegistrationDate?: string;
  @IsOptional()
  @IsString()
  @IsIn([...HK_LICENSED_BANK_NAMES])
  bankName?: string;
  @IsOptional()
  @IsString()
  @MaxLength(34)
  @Matches(/^[\d\s-]+$/, { message: '銀行戶口須為數字' })
  bankAccountNumber?: string;
  @IsOptional()
  @IsEnum(['admin', 'partner', 'public'])
  driverTier?: DriverEntity['driverTier'];
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isInternalMember?: boolean;
  @IsOptional()
  @IsEnum(['pending', 'approved', 'rejected'])
  verificationStatus?: DriverEntity['verificationStatus'];
}

class TierDto {
  @IsEnum(['admin', 'partner', 'public'])
  driverTier!: DriverEntity['driverTier'];
}

class SetDriverPointsDto {
  @Type(() => Number)
  @IsNumber()
  pointsBalance!: number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  reason?: string;
}

class SuspendDriverDto {
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  permanent?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  days?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

@Controller()
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  @Post('driver/register')
  register(@Body() dto: RegisterDriverDto) {
    return this.drivers.register(dto);
  }

  @Post('driver/register/check-phones')
  checkRegisterPhones(@Body() body: { phone: string; offDutyPhone?: string }) {
    return this.drivers.checkRegisterPhones(body.phone, body.offDutyPhone);
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/drivers')
  list(@Query('phone') phone?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.drivers.list(phone, page, pageSize);
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/drivers/:id')
  detail(@Param('id') id: string) {
    return this.drivers.getDetail(id);
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/drivers/:id/point-ledger')
  pointLedger(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.drivers.listPointLedger(id, page, pageSize);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('admin/drivers/:id/points')
  setPoints(@Param('id') id: string, @Body() dto: SetDriverPointsDto, @Req() req: { admin: { sub: number } }) {
    return this.drivers.setPointsBalance(req.admin.sub, id, dto.pointsBalance, dto.reason);
  }

  @UseGuards(AdminAuthGuard)
  @Post('admin/drivers')
  create(@Body() dto: CreateDriverDto, @Req() req: { admin: { sub: number } }) {
    return this.drivers.create(req.admin.sub, dto);
  }

  @UseGuards(AdminAuthGuard)
  @Put('admin/drivers/:id')
  update(@Param('id') id: string, @Body() dto: UpdateDriverDto, @Req() req: { admin: { sub: number } }) {
    return this.drivers.update(req.admin.sub, id, dto);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('admin/drivers/:id/tier')
  tier(@Param('id') id: string, @Body() dto: TierDto, @Req() req: { admin: { sub: number } }) {
    return this.drivers.setTier(req.admin.sub, id, dto.driverTier);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('admin/drivers/:id/approve')
  approve(@Param('id') id: string, @Req() req: { admin: { sub: number } }) {
    return this.drivers.quickApprove(req.admin.sub, id);
  }

  @UseGuards(AdminAuthGuard)
  @Delete('admin/drivers/:id')
  remove(@Param('id') id: string, @Req() req: { admin: { sub: number } }) {
    return this.drivers.remove(req.admin.sub, id);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('admin/drivers/:id/suspend')
  suspend(@Param('id') id: string, @Body() dto: SuspendDriverDto, @Req() req: { admin: { sub: number } }) {
    return this.drivers.suspend(req.admin.sub, id, dto);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('admin/drivers/:id/unsuspend')
  unsuspend(@Param('id') id: string, @Req() req: { admin: { sub: number } }) {
    return this.drivers.unsuspend(req.admin.sub, id);
  }
}
