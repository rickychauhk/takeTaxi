import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Allow, IsNotEmpty, IsString } from 'class-validator';
import { mkdirSync } from 'node:fs';
import { diskStorage } from 'multer';
import { join, extname } from 'path';
import { PassengerAuthGuard } from '../../common/passenger-auth.guard';
import { PassengerEntity } from '../passengers/passenger.entity';
import { LostPropertyService } from './lost-property.service';

const uploadDir = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
const lostPropertyUploadDir = join(uploadDir, 'lost-property');

class CreateLostPropertyBody {
  @IsString()
  @IsNotEmpty()
  itemName!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsNotEmpty()
  lostAt!: string;

  @IsString()
  @IsNotEmpty()
  contactPhone!: string;

  @IsString()
  @IsNotEmpty()
  contactName!: string;

  /** multipart 檔案欄位（由 Multer 處理，勿進 whitelist 驗證） */
  @Allow()
  images?: unknown;
}

function publicApiOrigin(req: { protocol?: string; get?: (h: string) => string | undefined }): string {
  const env = process.env.PUBLIC_API_ORIGIN?.trim();
  if (env) return env.replace(/\/$/, '');
  const host = req.get?.('x-forwarded-host') ?? req.get?.('host');
  const proto = req.get?.('x-forwarded-proto') ?? req.protocol ?? 'https';
  if (host) return `${proto}://${host}`.replace(/\/$/, '');
  return 'https://app.hktaketaxi.online';
}

@Controller()
export class LostPropertyController {
  constructor(private readonly lostProperty: LostPropertyService) {}

  @UseGuards(PassengerAuthGuard)
  @Post('passenger/lost-property')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  )
  @UseInterceptors(
    FilesInterceptor('images', 6, {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          mkdirSync(lostPropertyUploadDir, { recursive: true });
          cb(null, lostPropertyUploadDir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '').slice(0, 8) || '.jpg';
          cb(null, `lost-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
        },
      }),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async createPassengerRequest(
    @Body() body: CreateLostPropertyBody,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: { passenger: PassengerEntity },
  ) {
    const lostAtRaw = body.lostAt?.trim();
    if (!lostAtRaw) throw new BadRequestException('請選擇日期時間');
    const lostAt = new Date(lostAtRaw);
    if (Number.isNaN(lostAt.getTime())) throw new BadRequestException('日期時間格式不正確');

    const imagePaths = (files ?? [])
      .map((f) => (f.filename ? `lost-property/${f.filename}` : ''))
      .filter(Boolean);

    const row = await this.lostProperty.create({
      passengerId: req.passenger.id,
      itemName: body.itemName ?? '',
      description: body.description ?? '',
      lostAt,
      contactPhone: body.contactPhone ?? '',
      contactName: body.contactName ?? '',
      imagePaths,
    });

    return {
      id: String(row.id),
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  @Get('public/lost-property/active')
  async listActiveTicker() {
    const items = await this.lostProperty.listActiveTicker();
    return { items };
  }

  @Get('public/lost-property/board')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async boardHtml(@Req() req: { protocol?: string; get?: (h: string) => string | undefined }) {
    const origin = publicApiOrigin(req);
    const items = await this.lostProperty.listActiveBoard(origin);
    return this.lostProperty.renderBoardHtml(origin, items);
  }
}
