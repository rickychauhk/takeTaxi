import { Injectable } from '@nestjs/common';
import type { DriverTier } from '@taxima/shared';
import { DataSource } from 'typeorm';
import { normalizeStoredPickupRadiusKm } from '../orders/driver-pickup-radius.util';

export type OnlineDriverDispatchRow = {
  driverId: string;
  driverTier: DriverTier;
  isInternalMember: boolean;
  maxPickupRadiusKm: number | null;
  lat: number;
  lng: number;
};

/** 背景 push / 派單：司機 GPS 有效期（分鐘）；App 背景時上報較疏 */
const DRIVER_DISPATCH_GPS_MAX_AGE_MINUTES = Math.min(
  60,
  Math.max(3, Number(process.env.DRIVER_DISPATCH_GPS_MAX_AGE_MINUTES) || 15),
);

@Injectable()
export class LocationsService {
  constructor(private readonly dataSource: DataSource) {}

  async setDriverPresence(driverId: string, online: boolean) {
    await this.dataSource.query(`UPDATE drivers SET is_online = ? WHERE id = ?`, [
      online ? 1 : 0,
      driverId,
    ]);
    if (!online) {
      await this.clearDriverLive(driverId);
    }
    return { ok: true, online };
  }

  async clearDriverLive(driverId: string) {
    await this.dataSource.query(`DELETE FROM live_locations WHERE driver_id = ?`, [driverId]);
  }

  async upsertLive(userId: string, role: 'passenger' | 'driver', lat: number, lng: number) {
    const driverId = role === 'driver' ? userId : null;
    const passengerId = role === 'passenger' ? userId : null;
    if (driverId) {
      await this.dataSource.query(`UPDATE drivers SET is_online = 1 WHERE id = ? AND is_active = 1`, [
        driverId,
      ]);
      await this.dataSource.query(
        `INSERT INTO live_locations (driver_id, passenger_id, lat, lng, location)
         VALUES (?, NULL, ?, ?, ST_SRID(POINT(?, ?), 4326))
         ON DUPLICATE KEY UPDATE lat = VALUES(lat), lng = VALUES(lng), location = VALUES(location)`,
        [driverId, lat, lng, lng, lat],
      );
    } else if (passengerId) {
      await this.dataSource.query(
        `INSERT INTO live_locations (driver_id, passenger_id, lat, lng, location)
         VALUES (NULL, ?, ?, ?, ST_SRID(POINT(?, ?), 4326))
         ON DUPLICATE KEY UPDATE lat = VALUES(lat), lng = VALUES(lng), location = VALUES(location)`,
        [passengerId, lat, lng, lng, lat],
      );
    }
    return { ok: true };
  }

  async getDriverLive(driverId: string): Promise<{ lat: number; lng: number } | null> {
    const rows = (await this.dataSource.query(
      `SELECT lat, lng FROM live_locations WHERE driver_id = ? LIMIT 1`,
      [driverId],
    )) as { lat: number; lng: number }[];
    const row = rows[0];
    if (!row) return null;
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  /** 只回傳 is_online 且近期有上報 GPS 的司機（離線會清 live_locations）。 */
  /** 上線且有近期 GPS 的司機（背景 push / 派單） */
  async listOnlineDriversForDispatch(): Promise<OnlineDriverDispatchRow[]> {
    const rows = (await this.dataSource.query(
      `SELECT d.id AS driver_id, d.driver_tier, d.is_internal_member, d.max_pickup_radius_km, ll.lat, ll.lng
       FROM drivers d
       INNER JOIN live_locations ll ON ll.driver_id = d.id
       WHERE d.is_online = 1 AND d.is_active = 1
         AND d.suspended_permanent = 0
         AND (d.suspended_until IS NULL OR d.suspended_until <= UTC_TIMESTAMP())
         AND ll.updated_at >= DATE_SUB(NOW(), INTERVAL ${DRIVER_DISPATCH_GPS_MAX_AGE_MINUTES} MINUTE)`,
    )) as {
      driver_id: string;
      driver_tier: DriverTier;
      is_internal_member: number | boolean;
      max_pickup_radius_km: string | null;
      lat: number;
      lng: number;
    }[];
    return rows
      .map((r) => {
        const lat = Number(r.lat);
        const lng = Number(r.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const maxPickupRadiusKm =
          r.max_pickup_radius_km == null || r.max_pickup_radius_km === ''
            ? null
            : normalizeStoredPickupRadiusKm(Number(r.max_pickup_radius_km));
        return {
          driverId: String(r.driver_id),
          driverTier: r.driver_tier,
          isInternalMember: Boolean(r.is_internal_member),
          maxPickupRadiusKm,
          lat,
          lng,
        } satisfies OnlineDriverDispatchRow;
      })
      .filter((r): r is OnlineDriverDispatchRow => r != null);
  }

  async nearbyDrivers(lat: number, lng: number, radiusMeters = 2000, limit = 48) {
    const rows = await this.dataSource.query(
      `SELECT ll.driver_id, ll.lat, ll.lng,
              ST_Distance_Sphere(ll.location, ST_SRID(POINT(?, ?), 4326)) AS distance_m
       FROM live_locations ll
       INNER JOIN drivers d ON d.id = ll.driver_id AND d.is_online = 1 AND d.is_active = 1
         AND d.suspended_permanent = 0
         AND (d.suspended_until IS NULL OR d.suspended_until <= UTC_TIMESTAMP())
       WHERE ll.driver_id IS NOT NULL
         AND ll.updated_at >= DATE_SUB(NOW(), INTERVAL 3 MINUTE)
       HAVING distance_m <= ?
       ORDER BY distance_m ASC
       LIMIT ?`,
      [lng, lat, radiusMeters, limit],
    );
    return rows;
  }
}
