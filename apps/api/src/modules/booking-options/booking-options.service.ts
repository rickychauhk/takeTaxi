import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingOptionCategoryEntity } from './booking-option-category.entity';
import { BookingOptionEntity } from './booking-option.entity';

@Injectable()
export class BookingOptionsService {
  constructor(
    @InjectRepository(BookingOptionCategoryEntity)
    private readonly categories: Repository<BookingOptionCategoryEntity>,
    @InjectRepository(BookingOptionEntity)
    private readonly options: Repository<BookingOptionEntity>,
  ) {}

  async listForPassenger() {
    const rows = await this.categories.find({
      where: { isActive: true },
      relations: { options: true },
      order: { sortOrder: 'ASC', options: { sortOrder: 'ASC' } },
    });
    return {
      categories: rows.map((c) => ({
        id: c.id,
        code: c.code,
        labelZh: c.labelZh,
        labelEn: c.labelEn,
        selectionMode: c.selectionMode,
        displayStyle: c.displayStyle,
        screenGroup: c.screenGroup,
        sortOrder: c.sortOrder,
        options: (c.options ?? [])
          .filter((o) => o.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((o) => ({
            id: o.id,
            code: o.code,
            labelZh: o.labelZh,
            labelEn: o.labelEn,
            iconKey: o.iconKey,
            sortOrder: o.sortOrder,
          })),
      })),
    };
  }

  listCategoriesAdmin() {
    return this.categories.find({ order: { sortOrder: 'ASC' } });
  }

  async createCategory(data: Partial<BookingOptionCategoryEntity>) {
    const row = this.categories.create(data);
    return this.categories.save(row);
  }

  async updateCategory(id: number, data: Partial<BookingOptionCategoryEntity>) {
    const row = await this.categories.findOne({ where: { id } });
    if (!row) throw new NotFoundException('分類不存在');
    Object.assign(row, data);
    return this.categories.save(row);
  }

  async deleteCategory(id: number) {
    const row = await this.categories.findOne({ where: { id } });
    if (!row) throw new NotFoundException('分類不存在');
    await this.categories.remove(row);
    return { ok: true };
  }

  listOptionsAdmin(categoryId?: number) {
    return this.options.find({
      where: categoryId ? { categoryId } : {},
      relations: { category: true },
      order: { categoryId: 'ASC', sortOrder: 'ASC' },
    });
  }

  async createOption(data: {
    categoryId: number;
    code: string;
    labelZh: string;
    labelEn: string;
    iconKey?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    const cat = await this.categories.findOne({ where: { id: data.categoryId } });
    if (!cat) throw new NotFoundException('分類不存在');
    const row = this.options.create(data);
    return this.options.save(row);
  }

  async updateOption(
    id: number,
    data: Partial<{
      categoryId: number;
      code: string;
      labelZh: string;
      labelEn: string;
      iconKey: string | null;
      sortOrder: number;
      isActive: boolean;
    }>,
  ) {
    const row = await this.options.findOne({ where: { id } });
    if (!row) throw new NotFoundException('選項不存在');
    if (data.categoryId != null) {
      const cat = await this.categories.findOne({ where: { id: data.categoryId } });
      if (!cat) throw new NotFoundException('分類不存在');
    }
    Object.assign(row, data);
    return this.options.save(row);
  }

  async deleteOption(id: number) {
    const row = await this.options.findOne({ where: { id } });
    if (!row) throw new NotFoundException('選項不存在');
    await this.options.remove(row);
    return { ok: true };
  }
}
