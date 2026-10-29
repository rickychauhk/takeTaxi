import { BadRequestException } from '@nestjs/common';

const MAX_HTML_BYTES = 512 * 1024;

export function assertAdHtmlContent(html: string | undefined): string {
  const trimmed = html?.trim();
  if (!trimmed) throw new BadRequestException('請填寫 WebView HTML 內容');
  const bytes = Buffer.byteLength(trimmed, 'utf8');
  if (bytes > MAX_HTML_BYTES) {
    throw new BadRequestException('HTML 內容不可超過 512KB');
  }
  return trimmed;
}
