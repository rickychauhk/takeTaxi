import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { parsePageQuery, paginated } from '../../common/pagination';
import { AdEntity } from './ad.entity';

@Injectable()
export class AdsService {
  constructor(@InjectRepository(AdEntity) private readonly repo: Repository<AdEntity>) {}

  mapRow(row: AdEntity) {
    return {
      ...row,
      imageUrl: row.imagePath ? `/api/v1/uploads/${row.imagePath.replace(/^\/+/, '')}` : null,
    };
  }

  /** Splash list for app — no full HTML payload */
  mapPublicCard(row: AdEntity) {
    const mapped = this.mapRow(row);
    const { htmlContent: _html, ...card } = mapped;
    return card;
  }

  async listAdmin(pageRaw?: string, pageSizeRaw?: string) {
    const { page, pageSize, skip } = parsePageQuery(pageRaw, pageSizeRaw);
    const [rows, total] = await this.repo.findAndCount({
      where: { status: Not('removed') },
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
      skip,
      take: pageSize,
    });
    return paginated(
      rows.map((r) => this.mapRow(r)),
      total,
      page,
      pageSize,
    );
  }

  async getAdmin(id: number) {
    const row = await this.repo.findOneBy({ id });
    if (!row || row.status === 'removed') throw new NotFoundException('廣告不存在');
    return this.mapRow(row);
  }

  async fetchForApp(target: 'passenger' | 'driver') {
    const rows = await this.repo.find({
      where: { targetApp: In([target, 'both']), status: 'active', placement: 'splash' },
      order: { sortOrder: 'ASC', id: 'DESC' },
    });
    const limit = target === 'passenger' ? 1 : 3;
    return rows.slice(0, limit).map((r) => this.mapPublicCard(r));
  }

  async getWebviewContent(id: number) {
    const row = await this.repo.findOneBy({ id });
    if (!row || row.status !== 'active') throw new NotFoundException('廣告不存在或已下架');
    if (!row.htmlContent?.trim()) throw new NotFoundException('此廣告沒有 WebView 內容');
    return { id: row.id, html: row.htmlContent };
  }

  async create(adminId: number, input: Partial<AdEntity>) {
    const row = await this.repo.save(
      this.repo.create({
        ...input,
        status: input.status ?? 'active',
        placement: 'splash',
        linkUrl: input.linkUrl ?? null,
      }),
    );
    return this.mapRow(row);
  }

  async update(adminId: number, id: number, input: Partial<AdEntity>) {
    const row = await this.repo.findOneBy({ id });
    if (!row || row.status === 'removed') throw new NotFoundException('廣告不存在');
    if (input.targetApp) row.targetApp = input.targetApp;
    if (input.linkUrl !== undefined) row.linkUrl = input.linkUrl || null;
    if (input.sortOrder !== undefined) row.sortOrder = input.sortOrder;
    if (input.imagePath !== undefined) row.imagePath = input.imagePath;
    if (input.htmlContent !== undefined) row.htmlContent = input.htmlContent;
    const saved = await this.repo.save(row);
    return this.mapRow(saved);
  }

  async setStatus(adminId: number, id: number, status: AdEntity['status']) {
    const row = await this.repo.findOneBy({ id });
    if (!row || row.status === 'removed') throw new NotFoundException('廣告不存在');
    await this.repo.update({ id }, { status });
    return this.mapRow(await this.repo.findOneByOrFail({ id }));
  }

  async track(id: number, type: 'impression' | 'click') {
    if (type === 'impression') {
      await this.repo.increment({ id }, 'impressionCount', 1);
    } else {
      await this.repo.increment({ id }, 'clickCount', 1);
    }
    return { ok: true };
  }
}
