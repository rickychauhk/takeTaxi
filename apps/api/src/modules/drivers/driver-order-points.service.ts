import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  computeDriverPointsAtOrderPlacement,
  parseDriverBusyHoursConfig,
  parseDriverBusyRegionRewardsConfig,
  resolveBusyRegionRewardAtAccept,
  type DriverBusyHoursConfig,
  type DriverBusyRegionRewardRule,
} from '@taxima/shared';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { SystemSettingEntity } from '../settings/system-setting.entity';

const BASE_KEY = 'driver_points_per_order';
const EXTRA_KEY = 'driver_busy_extra_points_per_order';
const HOURS_KEY = 'driver_busy_hours_json';
const REGION_REWARDS_KEY = 'driver_busy_region_rewards_json';

const LEDGER_REF_TYPE = 'order_accept';
const BOUNTY_REF_TYPE = 'driver_post_bounty';
const BOUNTY_REFUND_REF_TYPE = 'driver_post_bounty_refund';
const BOUNTY_REWARD_REF_TYPE = 'driver_post_bounty_reward';
const BOUNTY_POSTER_PAYOUT_REF_TYPE = 'driver_post_bounty_poster_payout';
const BOUNTY_POSTER_PAYOUT_CLAWBACK_REF_TYPE = 'driver_post_bounty_poster_payout_clawback';
const BOUNTY_CLAWBACK_REF_TYPE = 'driver_post_bounty_clawback';
const REGION_REWARD_REF_TYPE = 'busy_region_reward';
const REGION_REWARD_CLAWBACK_REF_TYPE = 'busy_region_reward_clawback';
const BUSY_HOUR_REWARD_REF_TYPE = 'busy_hour_reward';
const BUSY_HOUR_REWARD_CLAWBACK_REF_TYPE = 'busy_hour_reward_clawback';

@Injectable()
export class DriverOrderPointsService {
  constructor(
    @InjectRepository(SystemSettingEntity)
    private readonly settings: Repository<SystemSettingEntity>,
    private readonly dataSource: DataSource,
  ) {}

  private async readSetting(key: string): Promise<string> {
    const row = await this.settings.findOne({ where: { settingKey: key } });
    return row?.settingValue ?? '';
  }

  async getBasePointsPerOrder(): Promise<number> {
    const n = Number(await this.readSetting(BASE_KEY));
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  }

  async getBusyExtraPointsPerOrder(): Promise<number> {
    const n = Number(await this.readSetting(EXTRA_KEY));
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  }

  async getBusyHoursConfig(): Promise<DriverBusyHoursConfig> {
    return parseDriverBusyHoursConfig(await this.readSetting(HOURS_KEY));
  }

  async getBusyRegionRewardsConfig() {
    return parseDriverBusyRegionRewardsConfig(await this.readSetting(REGION_REWARDS_KEY));
  }

  /** 落單當刻（伺服器時間 → 香港時區）計算接單所需積分快照 */
  async snapshotForOrderPlacement(placedAt: Date = new Date()) {
    const [base, extra, busyHours] = await Promise.all([
      this.getBasePointsPerOrder(),
      this.getBusyExtraPointsPerOrder(),
      this.getBusyHoursConfig(),
    ]);
    return computeDriverPointsAtOrderPlacement({
      placedAt,
      basePointsPerOrder: base,
      busyExtraPointsPerOrder: extra,
      busyHours,
    });
  }

  /** 繁忙時段平台獎賞（以落單快照 driver_points_busy_surcharge 為準） */
  async tryGrantBusyHourReward(
    orderId: string,
    driverId: string,
    busyHourRewardSnapshot: string | null | undefined,
    manager?: EntityManager,
  ): Promise<number | null> {
    const reward = Math.round(Number(busyHourRewardSnapshot ?? 0));
    if (!Number.isFinite(reward) || reward <= 0) return null;

    const run = async (m: EntityManager) => {
      const existing = await m.query(
        `SELECT id FROM driver_point_ledger WHERE ref_type = ? AND ref_id = ? AND driver_id = ? LIMIT 1`,
        [BUSY_HOUR_REWARD_REF_TYPE, orderId, driverId],
      );
      if (existing?.length) return;

      await m.query(`UPDATE drivers SET points_balance = points_balance + ? WHERE id = ?`, [
        reward,
        driverId,
      ]);
      const afterRows = await m.query(`SELECT points_balance AS balance FROM drivers WHERE id = ?`, [
        driverId,
      ]);
      const after = Number(afterRows?.[0]?.balance ?? 0);
      await m.query(
        `INSERT INTO driver_point_ledger (driver_id, delta_points, balance_after, reason, ref_type, ref_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [driverId, reward, after, '繁忙時段平台獎賞', BUSY_HOUR_REWARD_REF_TYPE, orderId],
      );
    };

    if (manager) await run(manager);
    else await this.dataSource.transaction(run);
    return reward;
  }

  async clawbackBusyHourReward(orderId: string, driverId: string, manager?: EntityManager): Promise<void> {
    const run = async (m: EntityManager) => {
      const rewardRows = await m.query(
        `SELECT id, delta_points FROM driver_point_ledger
         WHERE ref_type = ? AND ref_id = ? AND driver_id = ? AND delta_points > 0 LIMIT 1`,
        [BUSY_HOUR_REWARD_REF_TYPE, orderId, driverId],
      );
      if (!rewardRows?.length) return;

      const clawRows = await m.query(
        `SELECT id FROM driver_point_ledger WHERE ref_type = ? AND ref_id = ? AND driver_id = ? LIMIT 1`,
        [BUSY_HOUR_REWARD_CLAWBACK_REF_TYPE, orderId, driverId],
      );
      if (clawRows?.length) return;

      const reward = Math.round(Number(rewardRows[0].delta_points ?? 0));
      if (reward <= 0) return;

      const locked = await m.query(`SELECT points_balance AS balance FROM drivers WHERE id = ? FOR UPDATE`, [
        driverId,
      ]);
      const balance = Number(locked?.[0]?.balance ?? 0);
      const claw = Math.min(reward, Math.max(0, balance));
      if (claw <= 0) return;

      await m.query(`UPDATE drivers SET points_balance = points_balance - ? WHERE id = ?`, [claw, driverId]);
      const afterRows = await m.query(`SELECT points_balance AS balance FROM drivers WHERE id = ?`, [driverId]);
      const after = Number(afterRows?.[0]?.balance ?? 0);
      await m.query(
        `INSERT INTO driver_point_ledger (driver_id, delta_points, balance_after, reason, ref_type, ref_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [driverId, -claw, after, '繁忙時段獎賞收回', BUSY_HOUR_REWARD_CLAWBACK_REF_TYPE, orderId],
      );
    };

    if (manager) await run(manager);
    else await this.dataSource.transaction(run);
  }

  /** 繁忙時段 + 地區配對：接單司機獲獎賞積分 */
  async tryGrantBusyRegionReward(
    orderId: string,
    driverId: string,
    placedAt: Date,
    pickupAddress: string | null,
    dropoffAddress: string | null,
    manager?: EntityManager,
  ): Promise<DriverBusyRegionRewardRule | null> {
    const [busyHours, regionRewards] = await Promise.all([
      this.getBusyHoursConfig(),
      this.getBusyRegionRewardsConfig(),
    ]);
    const rule = resolveBusyRegionRewardAtAccept({
      placedAt,
      pickupAddress,
      dropoffAddress,
      busyHours,
      regionRewards,
    });
    if (!rule) return null;

    const run = async (m: EntityManager) => {
      const existing = await m.query(
        `SELECT id FROM driver_point_ledger WHERE ref_type = ? AND ref_id = ? AND driver_id = ? LIMIT 1`,
        [REGION_REWARD_REF_TYPE, orderId, driverId],
      );
      if (existing?.length) return;

      const reward = Math.round(rule.rewardPoints);
      await m.query(`UPDATE drivers SET points_balance = points_balance + ? WHERE id = ?`, [
        reward,
        driverId,
      ]);
      const afterRows = await m.query(`SELECT points_balance AS balance FROM drivers WHERE id = ?`, [
        driverId,
      ]);
      const after = Number(afterRows?.[0]?.balance ?? 0);
      const reason = `繁忙時段 ${rule.fromArea}→${rule.toArea} 獎賞`.slice(0, 128);
      await m.query(
        `INSERT INTO driver_point_ledger (driver_id, delta_points, balance_after, reason, ref_type, ref_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [driverId, reward, after, reason, REGION_REWARD_REF_TYPE, orderId],
      );
    };

    if (manager) await run(manager);
    else await this.dataSource.transaction(run);
    return rule;
  }

  async clawbackBusyRegionReward(orderId: string, driverId: string, manager?: EntityManager): Promise<void> {
    const run = async (m: EntityManager) => {
      const rewardRows = await m.query(
        `SELECT id, delta_points FROM driver_point_ledger
         WHERE ref_type = ? AND ref_id = ? AND driver_id = ? AND delta_points > 0 LIMIT 1`,
        [REGION_REWARD_REF_TYPE, orderId, driverId],
      );
      if (!rewardRows?.length) return;

      const clawRows = await m.query(
        `SELECT id FROM driver_point_ledger WHERE ref_type = ? AND ref_id = ? AND driver_id = ? LIMIT 1`,
        [REGION_REWARD_CLAWBACK_REF_TYPE, orderId, driverId],
      );
      if (clawRows?.length) return;

      const reward = Math.round(Number(rewardRows[0].delta_points ?? 0));
      if (reward <= 0) return;

      const locked = await m.query(`SELECT points_balance AS balance FROM drivers WHERE id = ? FOR UPDATE`, [
        driverId,
      ]);
      const balance = Number(locked?.[0]?.balance ?? 0);
      const claw = Math.min(reward, Math.max(0, balance));
      if (claw <= 0) return;

      await m.query(`UPDATE drivers SET points_balance = points_balance - ? WHERE id = ?`, [claw, driverId]);
      const afterRows = await m.query(`SELECT points_balance AS balance FROM drivers WHERE id = ?`, [driverId]);
      const after = Number(afterRows?.[0]?.balance ?? 0);
      await m.query(
        `INSERT INTO driver_point_ledger (driver_id, delta_points, balance_after, reason, ref_type, ref_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [driverId, -claw, after, '繁忙地區獎賞收回', REGION_REWARD_CLAWBACK_REF_TYPE, orderId],
      );
    };

    if (manager) await run(manager);
    else await this.dataSource.transaction(run);
  }

  async hasLedgerEntry(
    driverId: string,
    refType: string,
    refId: string,
  ): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT id FROM driver_point_ledger WHERE ref_type = ? AND ref_id = ? AND driver_id = ? LIMIT 1`,
      [refType, refId, driverId],
    );
    return Boolean(rows?.length);
  }

  async chargeDriverForAccept(
    orderId: string,
    driverPointsCostAtOrder: string | null | undefined,
    driverId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const cost = Number(driverPointsCostAtOrder ?? 0);
    if (!Number.isFinite(cost) || cost <= 0) return;

    const run = async (m: EntityManager) => {
      const existing = await m.query(
        `SELECT id FROM driver_point_ledger WHERE ref_type = ? AND ref_id = ? AND delta_points < 0 LIMIT 1`,
        [LEDGER_REF_TYPE, orderId],
      );
      if (existing?.length) return;

      const locked = await m.query(`SELECT points_balance AS balance FROM drivers WHERE id = ? FOR UPDATE`, [
        driverId,
      ]);
      const balance = Number(locked?.[0]?.balance ?? 0);
      if (balance < cost) {
        throw new BadRequestException(`司機積分不足（需要 ${Math.round(cost)} 積分）`);
      }
      await m.query(`UPDATE drivers SET points_balance = points_balance - ? WHERE id = ?`, [cost, driverId]);
      const afterRows = await m.query(`SELECT points_balance AS balance FROM drivers WHERE id = ?`, [driverId]);
      const after = Number(afterRows?.[0]?.balance ?? 0);
      await m.query(
        `INSERT INTO driver_point_ledger (driver_id, delta_points, balance_after, reason, ref_type, ref_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [driverId, -cost, after, '接單扣減', LEDGER_REF_TYPE, orderId],
      );
    };

    if (manager) await run(manager);
    else await this.dataSource.transaction(run);
  }

  async refundDriverAcceptCharge(orderId: string, driverId: string, manager?: EntityManager): Promise<void> {
    const run = async (m: EntityManager) => {
      const debits = await m.query(
        `SELECT id, delta_points FROM driver_point_ledger
         WHERE ref_type = ? AND ref_id = ? AND driver_id = ? AND delta_points < 0`,
        [LEDGER_REF_TYPE, orderId, driverId],
      );
      if (!debits?.length) return;

      const refundRows = await m.query(
        `SELECT id FROM driver_point_ledger
         WHERE ref_type = ? AND ref_id = ? AND driver_id = ? AND delta_points > 0 LIMIT 1`,
        [`${LEDGER_REF_TYPE}_refund`, orderId, driverId],
      );
      if (refundRows?.length) return;

      const cost = Math.abs(Number(debits[0].delta_points ?? 0));
      if (cost <= 0) return;

      await m.query(`UPDATE drivers SET points_balance = points_balance + ? WHERE id = ?`, [cost, driverId]);
      const afterRows = await m.query(`SELECT points_balance AS balance FROM drivers WHERE id = ?`, [driverId]);
      const after = Number(afterRows?.[0]?.balance ?? 0);
      await m.query(
        `INSERT INTO driver_point_ledger (driver_id, delta_points, balance_after, reason, ref_type, ref_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [driverId, cost, after, '接單扣減退回', `${LEDGER_REF_TYPE}_refund`, orderId],
      );
    };

    if (manager) await run(manager);
    else await this.dataSource.transaction(run);
  }

  async chargeDriverPostBounty(
    orderId: string,
    driverId: string,
    points: number,
    manager?: EntityManager,
  ): Promise<void> {
    const cost = Math.round(points);
    if (cost <= 0) return;

    const run = async (m: EntityManager) => {
      const existing = await m.query(
        `SELECT id FROM driver_point_ledger WHERE ref_type = ? AND ref_id = ? AND driver_id = ? AND delta_points < 0 LIMIT 1`,
        [BOUNTY_REF_TYPE, orderId, driverId],
      );
      if (existing?.length) return;

      const locked = await m.query(`SELECT points_balance AS balance FROM drivers WHERE id = ? FOR UPDATE`, [
        driverId,
      ]);
      const balance = Number(locked?.[0]?.balance ?? 0);
      if (balance < cost) {
        throw new BadRequestException(`積分不足（需要 ${cost} 分才可發出此懸賞）`);
      }
      await m.query(`UPDATE drivers SET points_balance = points_balance - ? WHERE id = ?`, [cost, driverId]);
      const afterRows = await m.query(`SELECT points_balance AS balance FROM drivers WHERE id = ?`, [driverId]);
      const after = Number(afterRows?.[0]?.balance ?? 0);
      await m.query(
        `INSERT INTO driver_point_ledger (driver_id, delta_points, balance_after, reason, ref_type, ref_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [driverId, -cost, after, '射柯打懸賞扣減', BOUNTY_REF_TYPE, orderId],
      );
    };

    if (manager) await run(manager);
    else await this.dataSource.transaction(run);
  }

  async refundDriverPostBountyToPoster(
    orderId: string,
    posterDriverId: string,
    points: number,
    manager?: EntityManager,
  ): Promise<void> {
    const cost = Math.round(points);
    if (cost <= 0) return;

    const run = async (m: EntityManager) => {
      const refundRows = await m.query(
        `SELECT id FROM driver_point_ledger WHERE ref_type = ? AND ref_id = ? AND driver_id = ? LIMIT 1`,
        [BOUNTY_REFUND_REF_TYPE, orderId, posterDriverId],
      );
      if (refundRows?.length) return;

      await m.query(`UPDATE drivers SET points_balance = points_balance + ? WHERE id = ?`, [
        cost,
        posterDriverId,
      ]);
      const afterRows = await m.query(`SELECT points_balance AS balance FROM drivers WHERE id = ?`, [
        posterDriverId,
      ]);
      const after = Number(afterRows?.[0]?.balance ?? 0);
      await m.query(
        `INSERT INTO driver_point_ledger (driver_id, delta_points, balance_after, reason, ref_type, ref_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [posterDriverId, cost, after, '射柯打懸賞退回', BOUNTY_REFUND_REF_TYPE, orderId],
      );
    };

    if (manager) await run(manager);
    else await this.dataSource.transaction(run);
  }

  /** 出貨：接單司機已扣減後，懸賞分入帳出貨司機 */
  async rewardDriverPostBountyToPoster(
    orderId: string,
    posterDriverId: string,
    points: number,
    manager?: EntityManager,
  ): Promise<void> {
    const cost = Math.round(points);
    if (cost <= 0) return;

    const run = async (m: EntityManager) => {
      const existing = await m.query(
        `SELECT id FROM driver_point_ledger WHERE ref_type = ? AND ref_id = ? AND driver_id = ? LIMIT 1`,
        [BOUNTY_POSTER_PAYOUT_REF_TYPE, orderId, posterDriverId],
      );
      if (existing?.length) return;

      await m.query(`UPDATE drivers SET points_balance = points_balance + ? WHERE id = ?`, [
        cost,
        posterDriverId,
      ]);
      const afterRows = await m.query(`SELECT points_balance AS balance FROM drivers WHERE id = ?`, [
        posterDriverId,
      ]);
      const after = Number(afterRows?.[0]?.balance ?? 0);
      await m.query(
        `INSERT INTO driver_point_ledger (driver_id, delta_points, balance_after, reason, ref_type, ref_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [posterDriverId, cost, after, '出貨柯打接單分', BOUNTY_POSTER_PAYOUT_REF_TYPE, orderId],
      );
    };

    if (manager) await run(manager);
    else await this.dataSource.transaction(run);
  }

  async clawbackDriverPostBountyFromPoster(
    orderId: string,
    posterDriverId: string,
    points: number,
    manager?: EntityManager,
  ): Promise<void> {
    const cost = Math.round(points);
    if (cost <= 0) return;

    const run = async (m: EntityManager) => {
      const payoutRows = await m.query(
        `SELECT id, delta_points FROM driver_point_ledger
         WHERE ref_type = ? AND ref_id = ? AND driver_id = ? AND delta_points > 0 LIMIT 1`,
        [BOUNTY_POSTER_PAYOUT_REF_TYPE, orderId, posterDriverId],
      );
      if (!payoutRows?.length) return;

      const clawRows = await m.query(
        `SELECT id FROM driver_point_ledger WHERE ref_type = ? AND ref_id = ? AND driver_id = ? LIMIT 1`,
        [BOUNTY_POSTER_PAYOUT_CLAWBACK_REF_TYPE, orderId, posterDriverId],
      );
      if (clawRows?.length) return;

      const payout = Math.round(Number(payoutRows[0].delta_points ?? 0));
      if (payout <= 0) return;

      const locked = await m.query(`SELECT points_balance AS balance FROM drivers WHERE id = ? FOR UPDATE`, [
        posterDriverId,
      ]);
      const balance = Number(locked?.[0]?.balance ?? 0);
      const claw = Math.min(payout, Math.max(0, balance));
      if (claw <= 0) return;

      await m.query(`UPDATE drivers SET points_balance = points_balance - ? WHERE id = ?`, [
        claw,
        posterDriverId,
      ]);
      const afterRows = await m.query(`SELECT points_balance AS balance FROM drivers WHERE id = ?`, [
        posterDriverId,
      ]);
      const after = Number(afterRows?.[0]?.balance ?? 0);
      await m.query(
        `INSERT INTO driver_point_ledger (driver_id, delta_points, balance_after, reason, ref_type, ref_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [posterDriverId, -claw, after, '出貨接單分收回', BOUNTY_POSTER_PAYOUT_CLAWBACK_REF_TYPE, orderId],
      );
    };

    if (manager) await run(manager);
    else await this.dataSource.transaction(run);
  }

  async rewardDriverPostBountyToAccepter(
    orderId: string,
    accepterDriverId: string,
    points: number,
    manager?: EntityManager,
  ): Promise<void> {
    const cost = Math.round(points);
    if (cost <= 0) return;

    const run = async (m: EntityManager) => {
      const existing = await m.query(
        `SELECT id FROM driver_point_ledger WHERE ref_type = ? AND ref_id = ? AND driver_id = ? LIMIT 1`,
        [BOUNTY_REWARD_REF_TYPE, orderId, accepterDriverId],
      );
      if (existing?.length) return;

      await m.query(`UPDATE drivers SET points_balance = points_balance + ? WHERE id = ?`, [
        cost,
        accepterDriverId,
      ]);
      const afterRows = await m.query(`SELECT points_balance AS balance FROM drivers WHERE id = ?`, [
        accepterDriverId,
      ]);
      const after = Number(afterRows?.[0]?.balance ?? 0);
      await m.query(
        `INSERT INTO driver_point_ledger (driver_id, delta_points, balance_after, reason, ref_type, ref_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [accepterDriverId, cost, after, '射柯打懸賞獎賞', BOUNTY_REWARD_REF_TYPE, orderId],
      );
    };

    if (manager) await run(manager);
    else await this.dataSource.transaction(run);
  }

  /** 司機放出柯打：收回接單司機懸賞，懸賞仍留喺發單司機（待下一位接單） */
  async revertDriverPostBountyOnHallRelease(
    orderId: string,
    accepterDriverId: string,
    points: number,
    manager?: EntityManager,
  ): Promise<void> {
    const cost = Math.round(points);
    if (cost <= 0) return;

    const run = async (m: EntityManager) => {
      const rewardRows = await m.query(
        `SELECT id, delta_points FROM driver_point_ledger
         WHERE ref_type = ? AND ref_id = ? AND driver_id = ? LIMIT 1`,
        [BOUNTY_REWARD_REF_TYPE, orderId, accepterDriverId],
      );
      if (!rewardRows?.length) return;

      const rewardPts = Math.round(Number(rewardRows[0].delta_points ?? 0));
      if (rewardPts <= 0) return;

      const locked = await m.query(`SELECT points_balance AS balance FROM drivers WHERE id = ? FOR UPDATE`, [
        accepterDriverId,
      ]);
      const balance = Number(locked?.[0]?.balance ?? 0);
      const claw = Math.min(rewardPts, Math.max(0, balance));
      if (claw > 0) {
        await m.query(`UPDATE drivers SET points_balance = points_balance - ? WHERE id = ?`, [
          claw,
          accepterDriverId,
        ]);
        const afterAcc = await m.query(`SELECT points_balance AS balance FROM drivers WHERE id = ?`, [
          accepterDriverId,
        ]);
        await m.query(
          `INSERT INTO driver_point_ledger (driver_id, delta_points, balance_after, reason, ref_type, ref_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            accepterDriverId,
            -claw,
            Number(afterAcc?.[0]?.balance ?? 0),
            '放出柯打收回懸賞',
            BOUNTY_CLAWBACK_REF_TYPE,
            orderId,
          ],
        );
      }

      await m.query(
        `DELETE FROM driver_point_ledger WHERE ref_type = ? AND ref_id = ? AND driver_id = ?`,
        [BOUNTY_REWARD_REF_TYPE, orderId, accepterDriverId],
      );
    };

    if (manager) await run(manager);
    else await this.dataSource.transaction(run);
  }

  async clawbackDriverPostBountyFromAccepter(
    orderId: string,
    accepterDriverId: string,
    posterDriverId: string,
    points: number,
    manager?: EntityManager,
  ): Promise<void> {
    const cost = Math.round(points);
    if (cost <= 0) return;

    const run = async (m: EntityManager) => {
      const clawRows = await m.query(
        `SELECT id FROM driver_point_ledger WHERE ref_type = ? AND ref_id = ? LIMIT 1`,
        [BOUNTY_CLAWBACK_REF_TYPE, orderId],
      );
      if (clawRows?.length) return;

      const rewardRows = await m.query(
        `SELECT id FROM driver_point_ledger WHERE ref_type = ? AND ref_id = ? AND driver_id = ? LIMIT 1`,
        [BOUNTY_REWARD_REF_TYPE, orderId, accepterDriverId],
      );
      if (!rewardRows?.length) {
        await this.refundDriverPostBountyToPoster(orderId, posterDriverId, cost, m);
        return;
      }

      const locked = await m.query(`SELECT points_balance AS balance FROM drivers WHERE id = ? FOR UPDATE`, [
        accepterDriverId,
      ]);
      const balance = Number(locked?.[0]?.balance ?? 0);
      const claw = Math.min(cost, Math.max(0, balance));
      if (claw > 0) {
        await m.query(`UPDATE drivers SET points_balance = points_balance - ? WHERE id = ?`, [
          claw,
          accepterDriverId,
        ]);
        const afterAcc = await m.query(`SELECT points_balance AS balance FROM drivers WHERE id = ?`, [
          accepterDriverId,
        ]);
        await m.query(
          `INSERT INTO driver_point_ledger (driver_id, delta_points, balance_after, reason, ref_type, ref_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            accepterDriverId,
            -claw,
            Number(afterAcc?.[0]?.balance ?? 0),
            '射柯打懸賞收回',
            BOUNTY_CLAWBACK_REF_TYPE,
            orderId,
          ],
        );
      }

      await this.refundDriverPostBountyToPoster(orderId, posterDriverId, cost, m);
    };

    if (manager) await run(manager);
    else await this.dataSource.transaction(run);
  }
}
