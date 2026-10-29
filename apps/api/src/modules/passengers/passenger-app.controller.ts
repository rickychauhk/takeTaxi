import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { PassengersService } from './passengers.service';

@Controller()
export class PassengerAppController {
  constructor(private readonly passengers: PassengersService) {}

  /** 乘客 App：User ID = CRM passengers.id（以 appClientId 綁定） */
  @Get('passenger/me')
  me(@Query('appClientId') appClientId?: string) {
    if (!appClientId?.trim()) {
      throw new BadRequestException('appClientId is required');
    }
    return this.passengers.getAppMemberProfile(appClientId);
  }
}
