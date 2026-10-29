import { BadRequestException, Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { AdminAuthGuard } from '../../common/admin-auth.guard';
import { SettingsService } from './settings.service';

class UpdateSettingDto {
  @IsString()
  value!: string;
}

@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('public/contact-us')
  contactUs() {
    return this.settings.getPublicContactHtml();
  }

  @Get('public/news-url')
  newsUrl() {
    return this.settings.getPublicNewsUrl();
  }

  @Get('public/passenger-map-config')
  passengerMapConfig() {
    return this.settings.getPublicPassengerMapConfig();
  }

  @Get('public/driver-points-topup')
  driverPointsTopup() {
    return this.settings.getPublicDriverPointsTopupInstructions();
  }

  @Get('public/terms/:app')
  terms(@Param('app') app: string) {
    if (app !== 'passenger' && app !== 'driver') {
      throw new BadRequestException('app must be passenger or driver');
    }
    return this.settings.getPublicTermsHtml(app);
  }

  @Get('public/passenger-company-price-notice')
  passengerCompanyPriceNotice() {
    return this.settings.getPublicPassengerCompanyPriceNoticeHtml();
  }

  @Get('public/passenger-ride-tips')
  passengerRideTips() {
    return this.settings.getPublicPassengerRideTipsHtml();
  }

  @Get('public/passenger-auto-tip')
  passengerAutoTip() {
    return this.settings.getPublicPassengerAutoTipHkd();
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/settings/:key')
  get(@Param('key') key: string) {
    return this.settings.getForAdmin(key);
  }

  @UseGuards(AdminAuthGuard)
  @Put('admin/settings/:key')
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @Req() req: { admin: { sub: number } },
  ) {
    return this.settings.upsert(req.admin.sub, key, dto.value);
  }
}
