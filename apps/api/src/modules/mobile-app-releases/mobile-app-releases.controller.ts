import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { diskStorage } from 'multer';
import type { Response } from 'express';
import { join } from 'path';
import { AdminAuthGuard } from '../../common/admin-auth.guard';
import { MobileAppReleasesService } from './mobile-app-releases.service';

const uploadDir = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
const apkUploadDir = join(uploadDir, 'apk');
const MAX_APK_BYTES = 250 * 1024 * 1024;

class CreateMobileAppReleaseDto {
  @IsEnum(['passenger', 'driver'])
  app!: 'passenger' | 'driver';

  @IsString()
  @MaxLength(64)
  version!: string;

  @IsOptional()
  @IsString()
  releaseNotes?: string;
}

class DeployMobileAppReleaseDto {
  @IsEnum(['uat', 'prod'])
  environment!: 'uat' | 'prod';
}

@UseGuards(AdminAuthGuard)
@Controller('admin/mobile-app-releases')
export class MobileAppReleasesController {
  constructor(private readonly releases: MobileAppReleasesService) {}

  @Get()
  list() {
    return this.releases.list();
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('apk', {
      storage: diskStorage({
        destination: apkUploadDir,
        filename: (_req, file, cb) => {
          const safe = file.originalname.replace(/[^\w.\-]+/g, '_') || 'release.apk';
          cb(null, `${Date.now()}-${safe}`);
        },
      }),
      limits: { fileSize: MAX_APK_BYTES },
      fileFilter: (_req, file, cb) => {
        const name = file.originalname?.toLowerCase() ?? '';
        if (!name.endsWith('.apk') && file.mimetype !== 'application/vnd.android.package-archive') {
          cb(new BadRequestException('只接受 .apk 檔案') as unknown as Error, false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  create(
    @Body() dto: CreateMobileAppReleaseDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { admin: { sub: number } },
  ) {
    if (!file?.path) throw new BadRequestException('請上傳 APK');
    const version = dto.version?.trim();
    if (!version) throw new BadRequestException('請填寫版本號');

    return this.releases.create({
      app: dto.app,
      version,
      releaseNotes: dto.releaseNotes,
      filePath: file.path,
      fileSizeBytes: file.size,
      uploadedByAdminId: req.admin.sub,
    });
  }

  @Patch(':id/deploy')
  deploy(@Param('id') id: string, @Body() dto: DeployMobileAppReleaseDto) {
    return this.releases.deploy(id, dto.environment);
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const { stream, fileName, size } = await this.releases.openDownloadStream(id);
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    if (size) res.setHeader('Content-Length', String(size));
    stream.pipe(res);
  }
}
