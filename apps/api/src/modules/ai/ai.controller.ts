import { Body, Controller, Post } from '@nestjs/common';
import { IsNumber, IsOptional, IsString } from 'class-validator';

class HabitAnalysisDto {
  @IsString()
  passengerId!: string;
}

class TrafficPredictDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;

  @IsOptional()
  @IsString()
  departAt?: string;
}

@Controller('ai')
export class AiController {
  @Post('passenger-habits')
  habits(@Body() dto: HabitAnalysisDto) {
    return {
      passengerId: dto.passengerId,
      summary: 'stub — connect ML pipeline for habit clusters & frequent POIs',
      topLocations: [],
    };
  }

  @Post('traffic-predict')
  traffic(@Body() dto: TrafficPredictDto) {
    return {
      lat: dto.lat,
      lng: dto.lng,
      congestionLevel: 'unknown',
      etaMultiplier: 1,
      note: 'stub — integrate traffic model / Google traffic layer',
    };
  }
}
