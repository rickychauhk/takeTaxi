import { BadRequestException } from '@nestjs/common';
import { AD_MAX_UPLOAD_BYTES } from '@taxima/shared';
import { unlinkSync } from 'fs';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/jpg']);

export function assertAdImageFile(file: Express.Multer.File | undefined) {
  if (!file?.path) throw new BadRequestException('請上傳圖片');
  if (!ALLOWED_MIME.has(file.mimetype)) {
    safeUnlink(file.path);
    throw new BadRequestException('只接受 JPG 或 PNG');
  }
  if (file.size > AD_MAX_UPLOAD_BYTES) {
    safeUnlink(file.path);
    throw new BadRequestException('圖片不可超過 2MB');
  }
}

function safeUnlink(path: string) {
  try {
    unlinkSync(path);
  } catch {
    /* ignore */
  }
}

export function relativeAdPath(file: Express.Multer.File) {
  const name = file.filename ?? file.path.split('/').pop() ?? 'ad.jpg';
  return `ads/${name}`;
}
