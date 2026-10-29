import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AdminAuthGuard } from '../../common/admin-auth.guard';
import { RatingDirection } from './rating.entity';
import { RatingsService } from './ratings.service';

class ListRatingsQuery {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsEnum(['passenger_to_driver', 'driver_to_passenger'])
  direction?: RatingDirection;
}

class UpsertRatingDto {
  @IsString()
  orderId!: string;

  @IsEnum(['passenger_to_driver', 'driver_to_passenger'])
  direction!: RatingDirection;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  score!: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

class UpdateRatingDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  score!: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

@Controller()
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  @UseGuards(AdminAuthGuard)
  @Get('admin/ratings')
  listAdmin(@Query() query: ListRatingsQuery) {
    return this.ratings.listAdmin(query);
  }

  @UseGuards(AdminAuthGuard)
  @Post('admin/ratings')
  createAdmin(@Body() dto: UpsertRatingDto) {
    return this.ratings.upsertForOrder(dto);
  }

  @UseGuards(AdminAuthGuard)
  @Put('admin/ratings/:id')
  updateAdmin(@Param('id') id: string, @Body() dto: UpdateRatingDto) {
    return this.ratings.updateAdmin(id, dto);
  }

  @Get('passenger/orders/:orderId/rating')
  passengerGetRating(@Param('orderId') orderId: string) {
    return this.ratings.getForOrder(orderId, 'passenger_to_driver');
  }

  @Get('driver/orders/:orderId/rating')
  driverGetRating(@Param('orderId') orderId: string) {
    return this.ratings.getForOrder(orderId, 'driver_to_passenger');
  }

  /** App：乘客評司機 */
  @Post('passenger/orders/:orderId/rating')
  passengerRatesDriver(@Param('orderId') orderId: string, @Body() dto: UpdateRatingDto) {
    return this.ratings.upsertForOrder({
      orderId,
      direction: 'passenger_to_driver',
      score: dto.score,
      comment: dto.comment,
    });
  }

  /** App：司機評乘客 */
  @Post('driver/orders/:orderId/rating')
  driverRatesPassenger(@Param('orderId') orderId: string, @Body() dto: UpdateRatingDto) {
    return this.ratings.upsertForOrder({
      orderId,
      direction: 'driver_to_passenger',
      score: dto.score,
      comment: dto.comment,
    });
  }
}
