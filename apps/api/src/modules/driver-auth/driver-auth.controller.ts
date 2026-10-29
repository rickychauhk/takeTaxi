import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Request } from 'express';
import { DriverAuthGuard } from '../../common/driver-auth.guard';
import { DriverAuthService } from './driver-auth.service';

class FirebaseLoginDto {
  @IsString()
  idToken!: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}

class CheckPhoneDto {
  @IsString()
  phone!: string;
}

class PhoneLoginDto {
  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}

class DriverPresenceDto {
  @IsBoolean()
  online!: boolean;

  @IsOptional()
  maxPickupRadiusKm?: number | null | 'unlimited';
}

class DriverDispatchPreferencesDto {
  @IsOptional()
  maxPickupRadiusKm?: number | null | 'unlimited';
}

class UpdateVehiclePlateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  vehiclePlate!: string;
}

@Controller('driver/auth')
export class DriverAuthController {
  constructor(private readonly auth: DriverAuthService) {}

  @Post('check-phone')
  checkPhone(@Body() dto: CheckPhoneDto) {
    return this.auth.checkDriverPhone(dto.phone);
  }

  @Post('firebase-login')
  firebaseLogin(@Body() dto: FirebaseLoginDto, @Req() req: Request) {
    return this.auth.loginWithFirebase(dto.idToken, req.ip, dto.deviceId);
  }

  /** 暫停 OTP：check-phone 通過後可直接登入 */
  @Post('phone-login')
  phoneLogin(@Body() dto: PhoneLoginDto, @Req() req: Request) {
    return this.auth.loginWithPhoneOnly(dto.phone, req.ip, dto.deviceId);
  }

  @UseGuards(DriverAuthGuard)
  @Get('me')
  me(@Req() req: Request & { driver: { id: string } }) {
    return this.auth.getProfile(req.driver.id);
  }

  @UseGuards(DriverAuthGuard)
  @Post('logout')
  logout(@Req() req: Request & { driver: { id: string } }) {
    return this.auth.logout(req.driver.id);
  }

  /** 上線／下線：下線會清除 live_locations，乘客地圖 pin 即消失。 */
  @UseGuards(DriverAuthGuard)
  @Post('presence')
  presence(@Req() req: Request & { driver: { id: string } }, @Body() dto: DriverPresenceDto) {
    return this.auth.setPresence(req.driver.id, dto.online, dto.maxPickupRadiusKm);
  }

  @UseGuards(DriverAuthGuard)
  @Post('dispatch-preferences')
  dispatchPreferences(
    @Req() req: Request & { driver: { id: string } },
    @Body() dto: DriverDispatchPreferencesDto,
  ) {
    return this.auth.updateDispatchPreferences(req.driver.id, dto.maxPickupRadiusKm);
  }

  @UseGuards(DriverAuthGuard)
  @Patch('vehicle-plate')
  updateVehiclePlate(
    @Req() req: Request & { driver: { id: string } },
    @Body() dto: UpdateVehiclePlateDto,
  ) {
    return this.auth.updateVehiclePlate(req.driver.id, dto.vehiclePlate);
  }
}
