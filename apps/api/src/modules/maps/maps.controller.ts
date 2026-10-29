import { Body, Controller, Post } from '@nestjs/common';
import { IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MapsService } from './maps.service';

class LatLngDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;
}

class RouteDto {
  @ValidateNested()
  @Type(() => LatLngDto)
  origin!: LatLngDto;

  @ValidateNested()
  @Type(() => LatLngDto)
  destination!: LatLngDto;
}

@Controller('maps')
export class MapsController {
  constructor(private readonly maps: MapsService) {}

  @Post('route')
  route(@Body() dto: RouteDto) {
    return this.maps.routePreview(dto);
  }
}
