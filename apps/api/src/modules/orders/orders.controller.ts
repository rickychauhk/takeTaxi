import {
  isDriverPostBountyPoints,
} from '@taxima/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { DriverAuthGuard } from '../../common/driver-auth.guard';
import { PassengerAuthGuard } from '../../common/passenger-auth.guard';
import { DriverEntity } from '../drivers/driver.entity';
import { PassengerEntity } from '../passengers/passenger.entity';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AdminAuthGuard } from '../../common/admin-auth.guard';
import { OrderEntity } from './order.entity';
import { parseDriverPosition, parseMaxPickupRadiusKm } from './driver-pickup-radius.util';
import { PassengersService } from '../passengers/passengers.service';
import { OrdersService } from './orders.service';
import { PassengerMatchingWatchService } from './passenger-matching-watch.service';

class StopPointDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;

  @IsString()
  label!: string;
}

class CreatePassengerOrderDto {
  @ValidateNested()
  @Type(() => StopPointDto)
  pickup!: StopPointDto;

  @ValidateNested()
  @Type(() => StopPointDto)
  dropoff!: StopPointDto;

  @Type(() => Number)
  @IsNumber()
  fareEstimate!: number;

  /** 預估駕駛路程（米），App 路線規劃結果 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  estimateDistanceMeters?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tipHkd?: number;

  @IsString()
  appClientId!: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsArray()
  selectedOptionIds?: number[];

  @IsOptional()
  sixSeat?: boolean;

  @IsOptional()
  @IsArray()
  @IsIn(['octopus', 'alipay', 'wechat', 'fps'], { each: true })
  paymentMethods?: ('octopus' | 'alipay' | 'wechat' | 'fps')[];

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pointsToRedeem?: number;

  @IsOptional()
  @IsBoolean()
  passengerContactCall?: boolean;

  @IsOptional()
  @IsBoolean()
  passengerContactSms?: boolean;

  /** 幫人 call 車：8 位本地聯絡電話 */
  @IsOptional()
  @IsString()
  orderContactPhone?: string;

  @IsOptional()
  @IsBoolean()
  companyPrice?: boolean;

  @IsOptional()
  @IsBoolean()
  safeDriving?: boolean;
}

class CreateOrderDto {
  @IsOptional()
  @IsEnum(['instant', 'scheduled', 'multi_stop', 'blind_box', 'driver_posted'])
  orderType?: OrderEntity['orderType'];

  @IsOptional()
  @IsString()
  passengerId?: string;
}

class DriverCancelOrderDto {
  @IsOptional()
  @IsString()
  cancelReportCode?: string;
}

class StatusDto {
  @IsEnum(['pending', 'matching', 'accepted', 'en_route', 'in_trip', 'completed', 'cancelled'])
  status!: OrderEntity['status'];
}

class CreateDriverPostedOrderDto {
  @IsString()
  driverId!: string;

  @ValidateNested()
  @Type(() => StopPointDto)
  pickup!: StopPointDto;

  @ValidateNested()
  @Type(() => StopPointDto)
  dropoff!: StopPointDto;

  @Type(() => Number)
  @IsNumber()
  fareEstimate!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  estimateDistanceMeters?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  bountyPoints?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tipHkd?: number;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsArray()
  selectedOptionIds?: number[];

  @IsOptional()
  sixSeat?: boolean;

  @IsOptional()
  @IsArray()
  @IsIn(['octopus', 'alipay', 'wechat', 'fps'], { each: true })
  paymentMethods?: ('octopus' | 'alipay' | 'wechat' | 'fps')[];

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

class OrderRecordQueryDto {
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  passengerId?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  time?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  pageSize?: string;
}

@Controller()
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly passengers: PassengersService,
    private readonly matchingWatch: PassengerMatchingWatchService,
  ) {}

  @UseGuards(PassengerAuthGuard)
  @Post('passenger/orders')
  async createPassenger(
    @Body() dto: CreatePassengerOrderDto,
    @Req() req: Request & { passenger: PassengerEntity },
  ) {
    const clientId = dto.appClientId?.trim();
    if (!clientId) throw new BadRequestException('appClientId is required');
    await this.passengers.bindAppClientIdToVerifiedPassenger(req.passenger.id, clientId);
    return this.orders.createPassengerInstantOrder({ ...dto, passengerId: req.passenger.id });
  }

  @UseGuards(PassengerAuthGuard)
  @Get('passenger/orders')
  async listPassengerOrders(
    @Req() req: Request & { passenger: PassengerEntity },
    @Query('appClientId') appClientId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const clientId = appClientId?.trim() || req.passenger.appClientId || '';
    if (!clientId) throw new BadRequestException('appClientId is required');
    const row = await this.passengers.bindAppClientIdToVerifiedPassenger(req.passenger.id, clientId);
    return this.orders.listPassengerOrderHistory(row.appClientId ?? clientId, page, pageSize);
  }

  @UseGuards(PassengerAuthGuard)
  @Delete('passenger/orders/:id/history')
  async hidePassengerOrderHistory(
    @Param('id') id: string,
    @Req() req: Request & { passenger: PassengerEntity },
  ) {
    return this.orders.hidePassengerOrderFromHistory(req.passenger.id, id);
  }

  @Get('passenger/orders/:id/track')
  passengerTrack(@Param('id') id: string) {
    return this.orders.getPassengerOrderTrack(id);
  }

  @UseGuards(PassengerAuthGuard)
  @Patch('passenger/orders/:id/matching-watch')
  async passengerMatchingWatch(
    @Param('id') id: string,
    @Req() req: Request & { passenger: PassengerEntity },
  ) {
    const result = await this.orders.touchPassengerMatchingWatch(id, req.passenger.id);
    if (result.watched) this.matchingWatch.clearHallRemovedNotice(id);
    return result;
  }

  @Patch('passenger/orders/:id/cancel')
  passengerCancel(@Param('id') id: string) {
    return this.orders.passengerCancelOrder(id);
  }

  @Post('driver/orders/post')
  driverPostOrder(@Body() dto: CreateDriverPostedOrderDto) {
    const bounty = dto.bountyPoints ?? 0;
    if (!isDriverPostBountyPoints(Math.round(bounty))) {
      throw new BadRequestException('懸賞積分只可選 0、3、5、8、12');
    }
    return this.orders.createDriverPostedOrder({
      driverId: dto.driverId.trim(),
      pickup: dto.pickup,
      dropoff: dto.dropoff,
      fareEstimate: dto.fareEstimate,
      estimateDistanceMeters: dto.estimateDistanceMeters,
      bountyPoints: Math.round(bounty),
      tipHkd: dto.tipHkd,
      remark: dto.remark,
      selectedOptionIds: dto.selectedOptionIds,
      sixSeat: dto.sixSeat,
      paymentMethods: dto.paymentMethods,
      scheduledAt: dto.scheduledAt,
    });
  }

  @Get('driver/orders/available')
  available(
    @Query('driverId') driverId: string,
    @Query('maxPickupRadiusKm') maxPickupRadiusKm?: string,
    @Query('driverLat') driverLat?: string,
    @Query('driverLng') driverLng?: string,
  ) {
    return this.orders.listForDriver(
      driverId,
      parseMaxPickupRadiusKm(maxPickupRadiusKm),
      parseDriverPosition({ driverLat, driverLng }),
    );
  }

  @Get('driver/orders/scheduled')
  scheduled(
    @Query('driverId') driverId: string,
    @Query('maxPickupRadiusKm') maxPickupRadiusKm?: string,
    @Query('driverLat') driverLat?: string,
    @Query('driverLng') driverLng?: string,
  ) {
    return this.orders.listScheduledForDriver(
      driverId,
      parseMaxPickupRadiusKm(maxPickupRadiusKm),
      parseDriverPosition({ driverLat, driverLng }),
    );
  }

  @Get('driver/orders/active')
  driverActive(@Query('driverId') driverId: string) {
    return this.orders.getDriverActiveOrder(driverId);
  }

  @UseGuards(DriverAuthGuard)
  @Get('driver/earnings/today')
  driverTodayEarnings(@Req() req: { driver: DriverEntity }) {
    return this.orders.listDriverTodayCompleted(req.driver.id);
  }

  @Get('driver/orders/:id/track')
  driverTrack(@Param('id') id: string, @Query('driverId') driverId: string) {
    return this.orders.getDriverOrderTrack(driverId, id);
  }

  @Patch('driver/orders/:id/accept')
  driverAccept(
    @Param('id') id: string,
    @Query('driverId') driverId: string,
    @Query('driverLat') driverLat?: string,
    @Query('driverLng') driverLng?: string,
  ) {
    const acceptPosition = parseDriverPosition({ driverLat, driverLng });
    return this.orders.driverAcceptOrder(driverId, id, acceptPosition);
  }

  @Patch('driver/orders/:id/release')
  driverRelease(@Param('id') id: string, @Query('driverId') driverId: string) {
    return this.orders.driverReleaseOrderToHall(driverId, id);
  }

  @Patch('driver/orders/:id/misaccept-cancel')
  misaccept(@Param('id') id: string, @Query('driverId') driverId: string) {
    return this.orders.driverMisacceptCancel(driverId, id);
  }

  @Patch('driver/orders/:id/cancel')
  driverCancel(
    @Param('id') id: string,
    @Query('driverId') driverId: string,
    @Body() dto: DriverCancelOrderDto,
  ) {
    return this.orders.driverCancelOrder(driverId, id, dto?.cancelReportCode);
  }

  @Patch('driver/orders/:id/status')
  driverStatus(
    @Param('id') id: string,
    @Query('driverId') driverId: string,
    @Body() dto: StatusDto,
  ) {
    return this.orders.driverUpdateOrderStatus(driverId, id, dto.status);
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/orders')
  adminList() {
    return this.orders.listAdmin();
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/order-records/driver-acceptances')
  driverAcceptances(@Query() query: OrderRecordQueryDto) {
    return this.orders.listDriverAcceptanceRecords(query);
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/orders/:id/detail')
  adminOrderDetail(@Param('id') id: string) {
    return this.orders.getAdminOrderDetail(id);
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/order-records/passenger-orders')
  passengerOrders(@Query() query: OrderRecordQueryDto) {
    return this.orders.listPassengerOrderRecords(query);
  }

  @UseGuards(AdminAuthGuard)
  @Post('admin/orders')
  create(@Body() dto: CreateOrderDto, @Req() req: { admin: { sub: number } }) {
    return this.orders.createAdmin(req.admin.sub, dto);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('admin/orders/:id/status')
  adminStatus(@Param('id') id: string, @Body() dto: StatusDto, @Req() req: { admin: { sub: number } }) {
    return this.orders.updateStatus({ type: 'admin', id: req.admin.sub }, id, dto.status);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('admin/orders/:id/accept')
  adminAccept(
    @Param('id') id: string,
    @Body() body: { driverId?: string },
    @Req() req: { admin: { sub: number } },
  ) {
    return this.orders.adminAcceptOrder(req.admin.sub, id, body?.driverId);
  }
}
