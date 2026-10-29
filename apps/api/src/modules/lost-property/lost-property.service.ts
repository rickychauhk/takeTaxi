import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import {
  formatHongKongPhoneDisplay,
  normalizePhoneE164,
  validateHongKongLocalPhone,
} from '@taxima/shared';
import { formatHkDateTime } from '../orders/order-datetime-filter';
import { LOST_PROPERTY_LISTING_MS } from './lost-property.constants';
import { LostPropertyRequestEntity } from './lost-property-request.entity';
import { OneSignalPassengerService } from '../notifications/onesignal-passenger.service';

export type CreateLostPropertyInput = {
  passengerId: string;
  itemName: string;
  description: string;
  lostAt: Date;
  contactPhone: string;
  contactName: string;
  imagePaths: string[];
};

export type LostPropertyActiveTickerItem = {
  id: string;
  itemName: string;
  lostAtHk: string;
  contactPhone: string;
  marqueeText: string;
};

export type LostPropertyBoardItem = {
  id: string;
  itemName: string;
  description: string;
  lostAtHk: string;
  contactPhone: string;
  contactPhoneDisplay: string;
  contactName: string;
  imageUrls: string[];
  expiresAtHk: string;
};

@Injectable()
export class LostPropertyService {
  constructor(
    @InjectRepository(LostPropertyRequestEntity)
    private readonly repo: Repository<LostPropertyRequestEntity>,
    private readonly passengerPush: OneSignalPassengerService,
  ) {}

  async create(input: CreateLostPropertyInput): Promise<LostPropertyRequestEntity> {
    const itemName = input.itemName.trim();
    const description = input.description.trim();
    const contactName = input.contactName.trim();
    if (!itemName) throw new BadRequestException('請填寫失物名稱');
    if (!description) throw new BadRequestException('請填寫描述');
    if (!contactName) throw new BadRequestException('請填寫姓名');
    const phoneV = validateHongKongLocalPhone(input.contactPhone);
    if (!phoneV.ok) throw new BadRequestException('請輸入有效的香港電話號碼');
    const contactPhone = normalizePhoneE164(input.contactPhone);

    const now = new Date();
    const row = this.repo.create({
      passengerId: String(input.passengerId),
      itemName: itemName.slice(0, 120),
      description,
      lostAt: input.lostAt,
      imagePaths: input.imagePaths.length ? input.imagePaths : null,
      contactPhone,
      contactName: contactName.slice(0, 80),
      status: 'active',
      expiresAt: new Date(now.getTime() + LOST_PROPERTY_LISTING_MS),
      expiredNotifiedAt: null,
    });
    return this.repo.save(row);
  }

  async listActiveTicker(): Promise<LostPropertyActiveTickerItem[]> {
    await this.expireDueRows();
    const rows = await this.repo.find({
      where: { status: 'active' },
      order: { createdAt: 'DESC' },
      take: 40,
    });
    return rows.map((r) => this.toTickerItem(r));
  }

  async listActiveBoard(publicBaseUrl: string): Promise<LostPropertyBoardItem[]> {
    await this.expireDueRows();
    const rows = await this.repo.find({
      where: { status: 'active' },
      order: { createdAt: 'DESC' },
      take: 40,
    });
    return rows.map((r) => this.toBoardItem(r, publicBaseUrl));
  }

  renderBoardHtml(publicBaseUrl: string, items: LostPropertyBoardItem[]): string {
    const cards =
      items.length === 0
        ? '<p class="empty">目前沒有進行中的失物協助。</p>'
        : items
            .map((item) => {
              const imgs = item.imageUrls
                .map(
                  (url) =>
                    `<a href="${escapeHtml(url)}" target="_blank" rel="noopener"><img src="${escapeHtml(url)}" alt="" /></a>`,
                )
                .join('');
              return `<article class="card">
  <h2>${escapeHtml(item.itemName)}</h2>
  <p class="meta">遺失時間：${escapeHtml(item.lostAtHk ?? '—')}</p>
  <p class="meta">聯絡：${escapeHtml(item.contactName)} · ${escapeHtml(item.contactPhoneDisplay)}</p>
  <p class="meta">展示至：${escapeHtml(item.expiresAtHk ?? '—')}</p>
  <p class="desc">${escapeHtml(item.description).replace(/\n/g, '<br/>')}</p>
  ${imgs ? `<div class="imgs">${imgs}</div>` : ''}
</article>`;
            })
            .join('\n');

    return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>失物協助</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 16px; background: #111; color: #eee; }
    h1 { font-size: 20px; margin: 0 0 16px; color: #facc15; }
    .card { background: #1a1a1a; border-radius: 12px; padding: 14px; margin-bottom: 14px; border: 1px solid #333; }
    .card h2 { margin: 0 0 8px; font-size: 18px; }
    .meta { margin: 4px 0; color: #aaa; font-size: 14px; }
    .desc { margin: 10px 0 0; line-height: 1.5; white-space: pre-wrap; }
    .imgs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .imgs img { width: 96px; height: 96px; object-fit: cover; border-radius: 8px; border: 1px solid #444; }
    .empty { color: #888; text-align: center; padding: 32px 0; }
  </style>
</head>
<body>
  <h1>失物協助</h1>
  ${cards}
</body>
</html>`;
  }

  /** 定時檢查到期項目並推播乘客 */
  async expireDueRows(): Promise<number> {
    const now = new Date();
    const due = await this.repo.find({
      where: {
        status: 'active',
        expiresAt: LessThanOrEqual(now),
      },
      take: 50,
    });
    let n = 0;
    for (const row of due) {
      row.status = 'expired';
      if (!row.expiredNotifiedAt) {
        row.expiredNotifiedAt = now;
        await this.passengerPush.sendLostPropertyListingEnded(row.passengerId);
      }
      await this.repo.save(row);
      n += 1;
    }
    return n;
  }

  private toTickerItem(row: LostPropertyRequestEntity): LostPropertyActiveTickerItem {
    const lostAtHk = formatHkDateTime(row.lostAt) ?? '';
    const phoneDisplay = formatHongKongPhoneDisplay(row.contactPhone);
    return {
      id: String(row.id),
      itemName: row.itemName,
      lostAtHk,
      contactPhone: phoneDisplay,
      marqueeText: `失物：${row.itemName}｜${lostAtHk}｜電話：${phoneDisplay}`,
    };
  }

  private toBoardItem(row: LostPropertyRequestEntity, publicBaseUrl: string): LostPropertyBoardItem {
    const base = publicBaseUrl.replace(/\/$/, '');
    const imageUrls = (row.imagePaths ?? []).map((p) => this.publicUploadUrl(base, p));
    return {
      id: String(row.id),
      itemName: row.itemName,
      description: row.description,
      lostAtHk: formatHkDateTime(row.lostAt) ?? '',
      contactPhone: row.contactPhone,
      contactPhoneDisplay: formatHongKongPhoneDisplay(row.contactPhone),
      contactName: row.contactName,
      imageUrls,
      expiresAtHk: formatHkDateTime(row.expiresAt) ?? '',
    };
  }

  private publicUploadUrl(apiOrigin: string, storedPath: string): string {
    const name = storedPath.replace(/^\/+/, '').replace(/^uploads\//, '');
    return `${apiOrigin}/api/v1/uploads/${name}`;
  }
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
