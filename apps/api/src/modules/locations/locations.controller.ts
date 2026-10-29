import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsEnum, IsNumber, IsString } from 'class-validator';
import { SettingsService } from '../settings/settings.service';
import { LocationsService } from './locations.service';

class UpsertLocationDto {
  @IsString()
  userId!: string;

  @IsEnum(['passenger', 'driver'])
  role!: 'passenger' | 'driver';

  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;
}

@Controller()
export class LocationsController {
  constructor(
    private readonly locations: LocationsService,
    private readonly settings: SettingsService,
  ) {}

  @Post('realtime/location')
  upsert(@Body() dto: UpsertLocationDto) {
    return this.locations.upsertLive(dto.userId, dto.role, dto.lat, dto.lng);
  }

  @Get('realtime/nearby-drivers')
  async nearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
    @Query('limit') limit?: string,
  ) {
    let radiusM = radius ? Number(radius) : undefined;
    if (radiusM == null || !Number.isFinite(radiusM) || radiusM <= 0) {
      radiusM = await this.settings.getPassengerNearbyDriversRadiusMeters();
    }
    const limitN = limit ? Number(limit) : undefined;
    return this.locations.nearbyDrivers(Number(lat), Number(lng), radiusM, limitN);
  }
}
