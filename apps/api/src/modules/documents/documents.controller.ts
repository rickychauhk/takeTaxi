import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { diskStorage } from 'multer';
import { join } from 'path';
import { AdminAuthGuard } from '../../common/admin-auth.guard';
import { DocumentEntity } from './document.entity';
import { DocumentsService } from './documents.service';

class ReviewDto {
  @IsEnum(['approved', 'rejected'])
  status!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  note?: string;
}

class DriverUploadDto {
  @IsString()
  driverId!: string;

  @IsEnum(['driving_license', 'driver_id', 'vehicle_registration', 'other'])
  docType!: DocumentEntity['docType'];
}

const uploadDir = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');

@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post('driver/documents/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
      }),
      limits: { fileSize: (Number(process.env.MAX_UPLOAD_MB ?? 20) || 20) * 1024 * 1024 },
    }),
  )
  upload(@Body() dto: DriverUploadDto, @UploadedFile() file: Express.Multer.File) {
    if (!file?.path && !file?.filename) {
      throw new BadRequestException('請上傳圖片檔案');
    }
    const path = file.path ?? join(uploadDir, file.filename);
    return this.documents.registerUpload(dto.driverId, dto.docType, path);
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/documents/pending')
  pending() {
    return this.documents.listPending();
  }

  @UseGuards(AdminAuthGuard)
  @Patch('admin/documents/:id/review')
  review(
    @Param('id') id: string,
    @Body() dto: ReviewDto,
    @Req() req: { admin: { sub: number } },
  ) {
    return this.documents.review(req.admin.sub, id, dto.status, dto.note);
  }
}
