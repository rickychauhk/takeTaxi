import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { basename } from 'path';
import { DataSource, In, Repository } from 'typeorm';
import { DriverEntity } from '../drivers/driver.entity';
import { formatHkDateTime } from '../orders/order-datetime-filter';
import { OneSignalDriverService } from '../notifications/onesignal-driver.service';
import { PointTopupEntity } from './point-topup.entity';

export type DriverPendingPointTopupRow = {
  id: string;
  amountPoints: number;
  priceHkd: string | null;
  bankName: string | null;
  createdAt: string;
  createdAtHk: string;
};

export type PointTopupAdminRow = PointTopupEntity & {
  driverPhone: string | null;
  driverDisplayName: string | null;
  receiptUrl: string | null;
};

@Injectable()
export class PointTopupsService {
  constructor(
    @InjectRepository(PointTopupEntity) private readonly repo: Repository<PointTopupEntity>,
    @InjectRepository(DriverEntity) private readonly drivers: Repository<DriverEntity>,
    private readonly dataSource: DataSource,
    private readonly oneSignalDriver: OneSignalDriverService,
  ) {}

  receiptPublicUrl(receiptImagePath: string | null | undefined): string | null {
    const raw = receiptImagePath?.trim();
    if (!raw) return null;
    const name = basename(raw);
    return name ? `/api/v1/uploads/${name}` : null;
  }

  async listForAdmin(statusFilter?: string): Promise<PointTopupAdminRow[]> {
    const qb = this.repo.createQueryBuilder('t').orderBy('t.created_at', 'DESC').take(200);
    const raw = statusFilter?.trim();
    const allowed = new Set(['pending', 'approved', 'rejected']);
    if (raw === 'queue' || raw === 'pending,rejected') {
      qb.andWhere('t.status IN (:...statuses)', { statuses: ['pending', 'rejected'] });
    } else if (raw && raw.includes(',')) {
      const statuses = [
        ...new Set(raw.split(',').map((s) => s.trim()).filter((s) => allowed.has(s))),
      ];
      if (statuses.length > 0) {
        qb.andWhere('t.status IN (:...statuses)', { statuses });
      }
    } else if (raw && allowed.has(raw)) {
      qb.andWhere('t.status = :status', { status: raw });
    }
    const rows = await qb.getMany();
    const driverIds = [...new Set(rows.map((r) => r.driverId))];
    const driverRows =
      driverIds.length > 0
        ? await this.drivers.find({ where: { id: In(driverIds) }, select: ['id', 'phone', 'displayName'] })
        : [];
    const driverById = new Map(driverRows.map((d) => [String(d.id), d]));
    return rows.map((row) => {
      const d = driverById.get(String(row.driverId));
      return {
        ...row,
        driverPhone: d?.phone ?? null,
        driverDisplayName: d?.displayName ?? null,
        receiptUrl: this.receiptPublicUrl(row.receiptImagePath),
      };
    });
  }

  async listPendingForDriver(driverId: string): Promise<{
    items: DriverPendingPointTopupRow[];
    pendingCount: number;
    pendingPointsTotal: number;
  }> {
    const rows = await this.repo.find({
      where: { driverId: String(driverId), status: 'pending' },
      order: { createdAt: 'DESC' },
      take: 30,
    });
    let pendingPointsTotal = 0;
    const items = rows.map((r) => {
      const amountPoints = Math.round(Number(r.amountPoints));
      if (Number.isFinite(amountPoints)) pendingPointsTotal += amountPoints;
      return {
        id: String(r.id),
        amountPoints,
        priceHkd: r.priceHkd != null ? String(r.priceHkd) : null,
        bankName: r.bankName?.trim() || null,
        createdAt: r.createdAt.toISOString(),
        createdAtHk: formatHkDateTime(r.createdAt) ?? r.createdAt.toISOString(),
      };
    });
    return { items, pendingCount: items.length, pendingPointsTotal };
  }

  async saveReceiptTransferAt(id: string, transferAt: Date | null) {
    if (!transferAt) return;
    await this.repo.update({ id }, { transferAt });
  }

  createPending(input: {
    driverId: string;
    amountPoints: number;
    packageId?: string | null;
    priceHkd?: number | null;
    receiptImagePath: string;
    bankName?: string;
    paymentMethodId?: string | null;
    transferAt?: Date;
  }) {
    return this.repo.save(
      this.repo.create({
        ...input,
        amountPoints: String(input.amountPoints),
        packageId: input.packageId ?? null,
        priceHkd: input.priceHkd != null ? String(input.priceHkd) : null,
        paymentMethodId: input.paymentMethodId ?? null,
        status: 'pending',
      }),
    );
  }

  /** @param adminId null = Gemini／系統自動審批 */
  async review(adminId: number | null, id: string, approve: boolean, note?: string) {
    const topup = await this.repo.findOneBy({ id });
    if (!topup || topup.status !== 'pending') throw new NotFoundException('Top-up not found or already reviewed');

    const reviewNote = note?.trim() || null;
    if (!approve && !reviewNote) {
      throw new BadRequestException('請填寫拒絕原因');
    }

    await this.dataSource.transaction(async (manager) => {
      topup.status = approve ? 'approved' : 'rejected';
      topup.reviewedByAdminId = adminId ?? null;
      topup.reviewNote = reviewNote;
      await manager.save(topup);

      if (approve) {
        await manager.query(
          `UPDATE drivers SET points_balance = points_balance + ? WHERE id = ?`,
          [topup.amountPoints, topup.driverId],
        );
        const [{ balance }] = await manager.query(
          `SELECT points_balance AS balance FROM drivers WHERE id = ?`,
          [topup.driverId],
        );
        await manager.query(
          `INSERT INTO driver_point_ledger (driver_id, delta_points, balance_after, reason, ref_type, ref_id)
           VALUES (?, ?, ?, 'topup_approved', 'point_topups', ?)`,
          [topup.driverId, topup.amountPoints, balance, topup.id],
        );
      }
    });

    const updated = await this.repo.findOneByOrFail({ id });
    if (approve) {
      void this.oneSignalDriver.sendTopupApprovedPush(topup.driverId, topup.amountPoints);
    } else if (reviewNote) {
      void this.oneSignalDriver.sendTopupRejectedPush(topup.driverId, reviewNote);
    }
    return updated;
  }
}
