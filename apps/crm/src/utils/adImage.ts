import { AD_MAX_UPLOAD_BYTES } from '@taxima/shared';

export function validateAdImageFile(file: File): Promise<string | null> {
  if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
    return Promise.resolve('只接受 JPG 或 PNG');
  }
  if (file.size > AD_MAX_UPLOAD_BYTES) {
    return Promise.resolve('圖片不可超過 2MB');
  }
  return Promise.resolve(null);
}
