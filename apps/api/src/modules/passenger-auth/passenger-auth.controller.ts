import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { Request } from 'express';
import { PassengerAuthGuard } from '../../common/passenger-auth.guard';
import { PassengerEntity } from '../passengers/passenger.entity';
import { PassengerAuthService } from './passenger-auth.service';

class FirebaseLoginDto {
  @IsString()
  idToken!: string;

  @IsString()
  appClientId!: string;
}

class CheckPhoneDto {
  @IsString()
  phone!: string;
}

class PhoneLoginDto {
  @IsString()
  phone!: string;

  @IsString()
  appClientId!: string;
}

@Controller('passenger/auth')
export class PassengerAuthController {
  constructor(private readonly auth: PassengerAuthService) {}

  @Post('check-phone')
  checkPhone(@Body() dto: CheckPhoneDto) {
    return this.auth.checkPhone(dto.phone);
  }

  @Post('firebase-login')
  firebaseLogin(@Body() dto: FirebaseLoginDto) {
    return this.auth.loginWithFirebase(dto.idToken, dto.appClientId);
  }

  /** 內測：無 OTP，電話對 DB 登入／自動註冊 */
  @Post('phone-login')
  phoneLogin(@Body() dto: PhoneLoginDto) {
    return this.auth.loginWithPhoneOnly(dto.phone, dto.appClientId);
  }

  @UseGuards(PassengerAuthGuard)
  @Get('me')
  me(
    @Req() req: Request & { passenger: PassengerEntity },
    @Query('appClientId') appClientId?: string,
  ) {
    return this.auth.getProfile(req.passenger.id, appClientId);
  }
}
