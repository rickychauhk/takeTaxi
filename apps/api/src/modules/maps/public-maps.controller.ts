import { Controller, Get, Query } from '@nestjs/common';
import { MapsPlaceSearchService } from './maps-place-search.service';

@Controller('public')
export class PublicMapsController {
  constructor(private readonly placeSearch: MapsPlaceSearchService) {}

  /** 乘客／司機 App 地點搜尋（伺服器代叫 Google，支援大廈座數等細緻關鍵字） */
  @Get('places/search')
  searchPlaces(
    @Query('q') q?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    const latN = lat != null ? Number(lat) : NaN;
    const lngN = lng != null ? Number(lng) : NaN;
    const near =
      Number.isFinite(latN) && Number.isFinite(lngN)
        ? { lat: latN, lng: lngN }
        : undefined;
    return this.placeSearch.search(q ?? '', near);
  }
}
