import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { diskStorage } from 'multer';
import { join } from 'path';
import { AdminAuthGuard } from '../../common/admin-auth.guard';
import { DriverAuthGuard } from '../../common/driver-auth.guard';
import { DriverEntity } from '../drivers/driver.entity';
import { DriverPointPackagesService } from '../driver-point-packages/driver-point-packages.service';
import { SettingsService } from '../settings/settings.service';
import { PointTopupEntity } from './point-topup.entity';
import { PointTopupsService } from './point-topups.service';

class ReviewTopupDto {
  @IsOptional()
  @IsString()
  note?: string;
}

class DriverTopupDto {
  @IsOptional()
  @IsString()
  driverId?: string;

  @IsOptional()
  @IsNumber()
  amountPoints?: number;

  @IsOptional()
  @IsString()
  packageId?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  /** CRM 設定的付款方式 id（FPS、銀行入數等） */
  @IsOptional()
  @IsString()
  paymentMethodId?: string;
}

const uploadDir = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');

@Controller()
export class PointTopupsController {
  constructor(
    private readonly topups: PointTopupsService,
    private readonly packages: DriverPointPackagesService,
    private readonly settings: SettingsService,
  ) {}

  @UseGuards(DriverAuthGuard)
  @Get('driver/point-topups/pending')
  driverPending(@Req() req: { driver: DriverEntity }) {
    return this.topups.listPendingForDriver(req.driver.id);
  }

  @UseGuards(DriverAuthGuard)
  @Post('driver/point-topups')
  @UseInterceptors(
    FileInterceptor('receipt', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) => cb(null, `topup-${Date.now()}-${file.originalname}`),
      }),
    }),
  )
  async driverSubmit(
    @Body() dto: DriverTopupDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { driver: DriverEntity },
  ) {
    const receiptImagePath = file?.path ?? file?.filename ?? '';
    if (!receiptImagePath) {
      throw new BadRequestException('請上傳轉帳憑證');
    }

    let amountPoints: number;
    let packageId: string | null = null;
    let priceHkd: number | null = null;

    if (dto.packageId?.trim()) {
      const pkg = await this.packages.getActiveById(dto.packageId.trim());
      amountPoints = pkg.points;
      packageId = pkg.id;
      priceHkd = Number(pkg.priceHkd);
    } else if (dto.amountPoints != null) {
      amountPoints = Math.round(dto.amountPoints);
    } else {
      throw new BadRequestException('請選擇積分套餐');
    }

    if (amountPoints <= 0) throw new BadRequestException('積分無效');

    let bankName = dto.bankName?.trim() || null;
    const paymentMethodId = dto.paymentMethodId?.trim();
    if (paymentMethodId) {
      const methods = await this.settings.getDriverPointsTopupPaymentMethods();
      const method = methods.find((m) => m.id === paymentMethodId);
      if (!method) throw new BadRequestException('付款方式無效，請重新選擇');
      bankName = method.title;
    } else if (!bankName) {
      throw new BadRequestException('請選擇付款方式');
    }

    return this.topups.createPending({
      driverId: req.driver.id,
      amountPoints,
      packageId,
      priceHkd,
      receiptImagePath,
      bankName,
    });
  }

  /** @deprecated 舊版無 token 上傳；保留相容 */
  @Post('driver/point-topups/legacy')
  @UseInterceptors(
    FileInterceptor('receipt', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) => cb(null, `topup-${Date.now()}-${file.originalname}`),
      }),
    }),
  )
  driverSubmitLegacy(@Body() dto: DriverTopupDto & { driverId: string }, @UploadedFile() file: Express.Multer.File) {
    if (!dto.driverId) throw new BadRequestException('driverId required');
    return this.topups.createPending({
      driverId: dto.driverId,
      amountPoints: Math.round(dto.amountPoints ?? 0),
      receiptImagePath: file?.path ?? file?.filename ?? '',
      bankName: dto.bankName,
    });
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/point-topups')
  list(@Query('status') status?: string) {
    return this.topups.listForAdmin(status ?? 'queue');
  }

  @UseGuards(AdminAuthGuard)
  @Patch('admin/point-topups/:id/approve')
  approve(@Param('id') id: string, @Body() dto: ReviewTopupDto, @Req() req: { admin: { sub: number } }) {
    return this.topups.review(req.admin.sub, id, true, dto.note);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('admin/point-topups/:id/reject')
  reject(@Param('id') id: string, @Body() dto: ReviewTopupDto, @Req() req: { admin: { sub: number } }) {
    const note = dto.note?.trim();
    if (!note) throw new BadRequestException('請填寫拒絕原因');
    return this.topups.review(req.admin.sub, id, false, note);
  }
}
