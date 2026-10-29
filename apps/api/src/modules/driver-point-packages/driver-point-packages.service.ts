import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DriverPointPackageEntity } from './driver-point-package.entity';

@Injectable()
export class DriverPointPackagesService {
  constructor(
    @InjectRepository(DriverPointPackageEntity)
    private readonly repo: Repository<DriverPointPackageEntity>,
  ) {}

  listActive() {
    return this.repo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', points: 'ASC' },
    });
  }

  listAll() {
    return this.repo.find({ order: { sortOrder: 'ASC', points: 'ASC' } });
  }

  async getActiveById(id: string) {
    const row = await this.repo.findOne({ where: { id, isActive: true } });
    if (!row) throw new NotFoundException('積分套餐不存在或已下架');
    return row;
  }

  create(input: {
    points: number;
    priceHkd: number;
    label?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    const points = Math.round(input.points);
    const priceHkd = Math.max(0, Math.round(input.priceHkd * 100) / 100);
    if (points <= 0) throw new BadRequestException('積分須大於 0');
    return this.repo.save(
      this.repo.create({
        points,
        priceHkd: String(priceHkd),
        label: input.label?.trim() || null,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
      }),
    );
  }

  async update(
    id: string,
    input: Partial<{
      points: number;
      priceHkd: number;
      label: string | null;
      sortOrder: number;
      isActive: boolean;
    }>,
  ) {
    const row = await this.repo.findOneBy({ id });
    if (!row) throw new NotFoundException('套餐不存在');
    if (input.points !== undefined) {
      const points = Math.round(input.points);
      if (points <= 0) throw new BadRequestException('積分須大於 0');
      row.points = points;
    }
    if (input.priceHkd !== undefined) {
      row.priceHkd = String(Math.max(0, Math.round(input.priceHkd * 100) / 100));
    }
    if (input.label !== undefined) row.label = input.label?.trim() || null;
    if (input.sortOrder !== undefined) row.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) row.isActive = input.isActive;
    return this.repo.save(row);
  }
}
