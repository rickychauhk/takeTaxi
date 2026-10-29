import { Module } from '@nestjs/common';
import { MapsController } from './maps.controller';
import { MapsPlaceSearchService } from './maps-place-search.service';
import { MapsService } from './maps.service';
import { PublicMapsController } from './public-maps.controller';

@Module({
  controllers: [MapsController, PublicMapsController],
  providers: [MapsService, MapsPlaceSearchService],
  exports: [MapsPlaceSearchService, MapsService],
})
export class MapsModule {}
