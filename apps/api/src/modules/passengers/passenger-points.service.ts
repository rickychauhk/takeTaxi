import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { SystemSettingEntity } from '../settings/system-setting.entity';
import { OrderStopEntity } from '../orders/order-stop.entity';
import { OrderEntity } from '../orders/order.entity';
import { PassengerEntity } from './passenger.entity';

const SETTING_KEY = 'passenger_points_per_km';
const HKD_PER_POINT_KEY = 'passenger_points_hkd_per_point';
const REDEEM_ENABLED_KEY = 'passenger_points_redeem_enabled';

function parseSettingFlag(raw: string | null | undefined, defaultOn: boolean): boolean {
  if (raw == null || raw === '') return defaultOn;
  const v = raw.trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  return defaultOn;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function tripDistanceKmFromStops(stops: OrderStopEntity[]): number | null {
  if (stops.length < 2) return null;
  const sorted = [...stops].sort((a, b) => a.seq - b.seq);
  const pickup = sorted[0]!;
  const drop = sorted[sorted.length - 1]!;
  const lat1 = Number(pickup.lat);
  const lng1 = Number(pickup.lng);
  const lat2 = Number(drop.lat);
  const lng2 = Number(drop.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
  const km = haversineKm(lat1, lng1, lat2, lng2);
  return Math.round(km);
}

/** 積分計費公里：優先叫車預估駕駛路程，否則 fallback 直線距離（舊單） */
export function passengerPointsBillingKm(
  order: OrderEntity,
  stops: OrderStopEntity[],
): number | null {
  if (order.estimateDistanceKm != null && order.estimateDistanceKm !== '') {
    const n = Number(order.estimateDistanceKm);
    if (Number.isFinite(n) && n >= 0) return Math.round(n);
  }
  return tripDistanceKmFromStops(stops);
}

@Injectable()
export class PassengerPointsService {
  constructor(
    @InjectRepository(SystemSettingEntity)
    private readonly settings: Repository<SystemSettingEntity>,
    @InjectRepository(PassengerEntity)
    private readonly passengers: Repository<PassengerEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async getPointsPerKm(): Promise<number> {
    const row = await this.settings.findOne({ where: { settingKey: SETTING_KEY } });
    const n = Number(row?.settingValue ?? 0);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n);
  }

  async getHkdPerPoint(): Promise<number> {
    const row = await this.settings.findOne({ where: { settingKey: HKD_PER_POINT_KEY } });
    const n = Number(row?.settingValue ?? 1);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  }

  async isPointsRedeemEnabled(): Promise<boolean> {
    const row = await this.settings.findOne({ where: { settingKey: REDEEM_ENABLED_KEY } });
    return parseSettingFlag(row?.settingValue, true);
  }

  /** 計算可兌換積分與折扣（不寫庫） */
  computeRedemption(input: {
    grossFareHkd: number;
    pointsBalance: number;
    pointsRequested: number;
    hkdPerPoint: number;
  }): { pointsRedeemed: number; discountHkd: number; netFareHkd: number } {
    const gross = Math.max(0, input.grossFareHkd);
    const hkdPerPoint = input.hkdPerPoint;
    if (hkdPerPoint <= 0 || gross <= 0) {
      return { pointsRedeemed: 0, discountHkd: 0, netFareHkd: gross };
    }
    const balance = Math.max(0, Math.floor(input.pointsBalance));
    const requested = Math.max(0, Math.floor(input.pointsRequested));
    const maxByFare = Math.floor(gross / hkdPerPoint);
    const pointsRedeemed = Math.min(requested, balance, maxByFare);
    const discountHkd = Math.round(pointsRedeemed * hkdPerPoint * 100) / 100;
    const netFareHkd = Math.max(0, Math.round((gross - discountHkd) * 100) / 100);
    return { pointsRedeemed, discountHkd, netFareHkd };
  }

  async redeemPointsForOrder(
    orderId: string,
    passengerId: string,
    pointsRedeemed: number,
    discountHkd: number,
    manager?: EntityManager,
  ): Promise<void> {
    if (pointsRedeemed <= 0) return;

    const run = async (m: EntityManager) => {
      const existing = (await m.query(
        `SELECT id FROM passenger_point_ledger WHERE ref_type = ? AND ref_id = ? LIMIT 1`,
        ['order_redeem', orderId],
      )) as { id: string }[];
      if (existing.length) return;

      const locked = await m.findOne(PassengerEntity, {
        where: { id: passengerId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new BadRequestException('Passenger not found');

      const balance = Number(locked.pointsBalance ?? 0);
      if (balance < pointsRedeemed) {
        throw new BadRequestException('積分不足');
      }

      await m.query(`UPDATE passengers SET points_balance = points_balance - ? WHERE id = ?`, [
        pointsRedeemed,
        passengerId,
      ]);
      const [{ balance: balanceAfter }] = (await m.query(
        `SELECT points_balance AS balance FROM passengers WHERE id = ?`,
        [passengerId],
      )) as { balance: string }[];

      await m.query(
        `INSERT INTO passenger_point_ledger (passenger_id, delta_points, balance_after, reason, ref_type, ref_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          passengerId,
          -pointsRedeemed,
          balanceAfter,
          `落柯打抵扣 HK$${discountHkd.toFixed(0)}`,
          'order_redeem',
          orderId,
        ],
      );
    };

    if (manager) {
      await run(manager);
      return;
    }
    await this.dataSource.transaction(run);
  }

  /** 取消柯打時退回已扣積分（原路退回帳戶；可重入） */
  async refundOrderRedemption(order: OrderEntity): Promise<void> {
    if (!order.passengerId) return;

    await this.dataSource.transaction(async (manager) => {
      const refunded = (await manager.query(
        `SELECT id FROM passenger_point_ledger WHERE ref_type = ? AND ref_id = ? LIMIT 1`,
        ['order_redeem_refund', order.id],
      )) as { id: string }[];
      if (refunded.length) return;

      const redeemRows = (await manager.query(
        `SELECT delta_points FROM passenger_point_ledger WHERE ref_type = ? AND ref_id = ? AND delta_points < 0 LIMIT 1`,
        ['order_redeem', order.id],
      )) as { delta_points: string }[];
      let redeemed = 0;
      if (redeemRows.length) {
        redeemed = Math.abs(Number(redeemRows[0].delta_points ?? 0));
      } else {
        redeemed = Number(order.passengerPointsRedeemed ?? 0);
      }
      if (!Number.isFinite(redeemed) || redeemed <= 0) return;

      await manager.query(
        `UPDATE passengers SET points_balance = points_balance + ? WHERE id = ?`,
        [redeemed, order.passengerId],
      );
      const [{ balance }] = (await manager.query(
        `SELECT points_balance AS balance FROM passengers WHERE id = ?`,
        [order.passengerId],
      )) as { balance: string }[];
      await manager.query(
        `INSERT INTO passenger_point_ledger (passenger_id, delta_points, balance_after, reason, ref_type, ref_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [order.passengerId, redeemed, balance, '取消柯打退回積分', 'order_redeem_refund', order.id],
      );
    });
  }

  /** 完成行程時發放積分（可重入：已發放則跳過） */
  async awardTripCompletionPoints(
    order: OrderEntity,
    stops: OrderStopEntity[],
  ): Promise<{ tripDistanceKm: number | null; pointsAwarded: number }> {
    if (!order.passengerId) {
      return { tripDistanceKm: null, pointsAwarded: 0 };
    }
    if (order.passengerPointsAwarded != null && order.passengerPointsAwarded !== '') {
      return {
        tripDistanceKm: order.tripDistanceKm != null ? Number(order.tripDistanceKm) : null,
        pointsAwarded: Number(order.passengerPointsAwarded),
      };
    }

    const tripDistanceKm = passengerPointsBillingKm(order, stops);
    const rate = await this.getPointsPerKm();
    const pointsAwarded =
      tripDistanceKm != null ? Math.round(tripDistanceKm * rate) : 0;

    await this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(OrderEntity, {
        where: { id: order.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || locked.passengerPointsAwarded != null) return;

      locked.tripDistanceKm =
        tripDistanceKm != null ? String(tripDistanceKm) : null;
      locked.passengerPointsAwarded = String(pointsAwarded);
      await manager.save(locked);

      if (pointsAwarded <= 0 || !locked.passengerId) return;

      await manager.query(
        `UPDATE passengers SET points_balance = points_balance + ? WHERE id = ?`,
        [pointsAwarded, locked.passengerId],
      );
      const [{ balance }] = (await manager.query(
        `SELECT points_balance AS balance FROM passengers WHERE id = ?`,
        [locked.passengerId],
      )) as { balance: string }[];
      await manager.query(
        `INSERT INTO passenger_point_ledger (passenger_id, delta_points, balance_after, reason, ref_type, ref_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          locked.passengerId,
          pointsAwarded,
          balance,
          '完成行程',
          'order_trip',
          locked.id,
        ],
      );
    });

    order.tripDistanceKm =
      tripDistanceKm != null ? String(tripDistanceKm) : null;
    order.passengerPointsAwarded = String(pointsAwarded);

    return { tripDistanceKm, pointsAwarded };
  }
}
