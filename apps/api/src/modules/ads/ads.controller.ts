import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { diskStorage } from 'multer';
import { join } from 'path';
import { AD_MAX_UPLOAD_BYTES } from '@taxima/shared';
import { AdminAuthGuard } from '../../common/admin-auth.guard';
import { assertAdHtmlContent } from './ad-html.util';
import { assertAdImageFile, relativeAdPath } from './ad-image.util';
import { AdEntity } from './ad.entity';
import { AdsService } from './ads.service';

const uploadDir = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
const adsUploadDir = join(uploadDir, 'ads');

class CreateAdDto {
  @IsEnum(['passenger', 'driver', 'both'])
  targetApp!: AdEntity['targetApp'];

  @IsString()
  htmlContent!: string;

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortOrder?: number;
}

class UpdateAdDto {
  @IsOptional()
  @IsEnum(['passenger', 'driver', 'both'])
  targetApp?: AdEntity['targetApp'];

  @IsOptional()
  @IsString()
  htmlContent?: string;

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortOrder?: number;
}

const adFileInterceptor = FileInterceptor('file', {
  storage: diskStorage({
    destination: (_req, _file, cb) => cb(null, adsUploadDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^\w.\-]+/g, '_')}`),
  }),
  limits: { fileSize: AD_MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.mimetype)) {
      cb(new Error('只接受 JPG 或 PNG'), false);
      return;
    }
    cb(null, true);
  },
});

@Controller()
export class AdsController {
  constructor(private readonly ads: AdsService) {}

  @Get('public/ads')
  publicList(@Query('app') app: 'passenger' | 'driver') {
    return this.ads.fetchForApp(app ?? 'passenger');
  }

  @Get('public/ads/:id/webview')
  webview(@Param('id') id: string) {
    return this.ads.getWebviewContent(Number(id));
  }

  @Post('public/ads/:id/track')
  track(@Param('id') id: string, @Query('type') type: 'impression' | 'click') {
    return this.ads.track(Number(id), type ?? 'impression');
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/ads')
  adminList(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.ads.listAdmin(page, pageSize);
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/ads/:id')
  adminGet(@Param('id') id: string) {
    return this.ads.getAdmin(Number(id));
  }

  @UseGuards(AdminAuthGuard)
  @Post('admin/ads')
  @UseInterceptors(adFileInterceptor)
  create(
    @Body() dto: CreateAdDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { admin: { sub: number } },
  ) {
    const htmlContent = assertAdHtmlContent(dto.htmlContent);
    assertAdImageFile(file);
    return this.ads.create(req.admin.sub, {
      targetApp: dto.targetApp,
      imagePath: relativeAdPath(file),
      htmlContent,
      linkUrl: dto.linkUrl,
      sortOrder: dto.sortOrder ?? 0,
    });
  }

  @UseGuards(AdminAuthGuard)
  @Put('admin/ads/:id')
  @UseInterceptors(adFileInterceptor)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAdDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: { admin: { sub: number } },
  ) {
    if (file) assertAdImageFile(file);
    if (dto.htmlContent !== undefined && !dto.htmlContent.trim()) {
      throw new BadRequestException('WebView HTML 不可為空');
    }
    return this.ads.update(req.admin.sub, Number(id), {
      targetApp: dto.targetApp,
      linkUrl: dto.linkUrl,
      sortOrder: dto.sortOrder,
      ...(dto.htmlContent !== undefined ? { htmlContent: assertAdHtmlContent(dto.htmlContent) } : {}),
      ...(file ? { imagePath: relativeAdPath(file) } : {}),
    });
  }

  @UseGuards(AdminAuthGuard)
  @Patch('admin/ads/:id/status/:status')
  status(
    @Param('id') id: string,
    @Param('status') status: AdEntity['status'],
    @Req() req: { admin: { sub: number } },
  ) {
    return this.ads.setStatus(req.admin.sub, Number(id), status);
  }
}
