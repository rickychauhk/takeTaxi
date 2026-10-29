import { Body, Controller, Post, Req } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { Request } from 'express';
import { AdminAuthService } from './admin-auth.service';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

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

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto.email, dto.password, req.ip);
  }

  @Post('firebase-login')
  firebaseLogin(@Body() dto: FirebaseLoginDto, @Req() req: Request) {
    return this.auth.loginWithFirebase(dto.idToken, req.ip, dto.deviceId);
  }

  /** 發送 Firebase OTP 前先確認電話已登記為 CRM 管理員 */
  @Post('check-phone')
  checkPhone(@Body() dto: CheckPhoneDto) {
    return this.auth.checkAdminPhone(dto.phone);
  }

  /** 暫停 OTP：check-phone 通過後可直接登入 */
  @Post('phone-login')
  phoneLogin(@Body() dto: PhoneLoginDto, @Req() req: Request) {
    return this.auth.loginWithPhoneOnly(dto.phone, req.ip, dto.deviceId);
  }
}
