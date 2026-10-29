import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DriverEntity } from '../drivers/driver.entity';
import { PromoCodeEntity } from './promo-code.entity';
import { PromoRedemptionEntity } from './promo-redemption.entity';

export type PromoWithStats = PromoCodeEntity & { redemptionCount: number };

@Injectable()
export class PromosService {
  constructor(
    @InjectRepository(PromoCodeEntity) private readonly promos: Repository<PromoCodeEntity>,
    @InjectRepository(PromoRedemptionEntity) private readonly redemptions: Repository<PromoRedemptionEntity>,
    @InjectRepository(DriverEntity) private readonly drivers: Repository<DriverEntity>,
  ) {}

  async list(): Promise<PromoWithStats[]> {
    const rows = await this.promos.find({ order: { createdAt: 'DESC' } });
    const counts = await this.redemptions
      .createQueryBuilder('r')
      .select('r.promo_code_id', 'promoCodeId')
      .addSelect('COUNT(*)', 'cnt')
      .groupBy('r.promo_code_id')
      .getRawMany<{ promoCodeId: number; cnt: string }>();
    const map = new Map(counts.map((c) => [Number(c.promoCodeId), Number(c.cnt)]));
    return rows.map((p) => ({ ...p, redemptionCount: map.get(p.id) ?? 0 }));
  }

  async create(adminId: number, input: { code: string; description?: string; marksInternalMember?: boolean }) {
    const normalized = input.code.trim().toUpperCase();
    const exists = await this.promos.findOne({ where: { code: normalized } });
    if (exists) throw new ConflictException('優惠碼已存在');
    const row = await this.promos.save(
      this.promos.create({
        code: normalized,
        description: input.description ?? null,
        marksInternalMember: input.marksInternalMember ?? true,
        isActive: true,
      }),
    );
    return row;
  }

  async update(
    adminId: number,
    id: number,
    input: { description?: string; marksInternalMember?: boolean; isActive?: boolean },
  ) {
    const promo = await this.promos.findOneBy({ id });
    if (!promo) throw new NotFoundException('優惠碼不存在');
    Object.assign(promo, input);
    await this.promos.save(promo);
    return promo;
  }

  /** 移除：停用優惠碼（已兌換紀錄保留） */
  async remove(adminId: number, id: number) {
    const promo = await this.promos.findOneBy({ id });
    if (!promo) throw new NotFoundException('優惠碼不存在');
    promo.isActive = false;
    await this.promos.save(promo);
    return { ok: true, id };
  }

  async applyPromoToDriver(code: string, driverId: string) {
    const normalized = code.trim().toUpperCase();
    const promo = await this.promos.findOne({ where: { code: normalized, isActive: true } });
    if (!promo) throw new NotFoundException('優惠碼無效或已停用');

    const driver = await this.drivers.findOne({ where: { id: driverId, isActive: true } });
    if (!driver) throw new NotFoundException('司機不存在');

    const existing = await this.redemptions.findOne({
      where: { promoCodeId: promo.id, driverId },
    });
    if (!existing) {
      await this.redemptions.save(
        this.redemptions.create({ promoCodeId: promo.id, driverId }),
      );
    }

    if (promo.marksInternalMember) {
      driver.isInternalMember = true;
      driver.driverTier = 'partner';
      await this.drivers.save(driver);
    }

    return {
      ok: true,
      promoCode: promo.code,
      promoCodeId: promo.id,
      isInternalMember: driver.isInternalMember,
      internalLabel: driver.isInternalMember ? '自己人' : null,
    };
  }

  async driversForPromo(promoId: number) {
    const promo = await this.promos.findOneBy({ id: promoId });
    if (!promo) throw new NotFoundException('優惠碼不存在');
    const rows = await this.redemptions.find({
      where: { promoCodeId: promoId },
      order: { redeemedAt: 'DESC' },
      take: 500,
    });
    if (rows.length === 0) return [];
    const driverIds = rows.map((r) => r.driverId);
    const drivers = await this.drivers.find({ where: { id: In(driverIds) } });
    const driverMap = new Map(drivers.map((d) => [d.id, d]));
    return rows.map((r) => {
      const d = driverMap.get(r.driverId);
      return {
        redemptionId: r.id,
        redeemedAt: r.redeemedAt,
        promoCode: promo.code,
        driver: d
          ? {
              id: d.id,
              phone: d.phone,
              displayName: d.displayName,
              isInternalMember: d.isInternalMember,
              internalLabel: d.isInternalMember ? '自己人' : null,
              driverTier: d.driverTier,
            }
          : null,
      };
    });
  }

  internalDrivers() {
    return this.drivers.find({
      where: { isInternalMember: true, isActive: true },
      order: { updatedAt: 'DESC' },
      take: 500,
    });
  }

  async internalDriversWithPromo() {
    const drivers = await this.internalDrivers();
    if (drivers.length === 0) return [];
    const redemptions = await this.redemptions
      .createQueryBuilder('r')
      .where('r.driver_id IN (:...ids)', { ids: drivers.map((d) => d.id) })
      .orderBy('r.redeemed_at', 'DESC')
      .getMany();
    const promoIds = [...new Set(redemptions.map((r) => r.promoCodeId))];
    const promos = promoIds.length ? await this.promos.find({ where: { id: In(promoIds) } }) : [];
    const promoMap = new Map(promos.map((p) => [p.id, p.code]));
    const latestPromoByDriver = new Map<string, string>();
    for (const r of redemptions) {
      if (!latestPromoByDriver.has(r.driverId)) {
        latestPromoByDriver.set(r.driverId, promoMap.get(r.promoCodeId) ?? '');
      }
    }
    return drivers.map((d) => ({
      ...d,
      internalLabel: '自己人',
      promoCodeUsed: latestPromoByDriver.get(d.id) ?? null,
    }));
  }
}
