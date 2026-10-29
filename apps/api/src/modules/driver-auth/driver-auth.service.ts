import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { FirebaseTokenService } from '../admin-auth/firebase-token.service';
import { normalizePhoneE164, phoneLookupVariants } from '../admin-auth/phone.util';
import { DriverEntity } from '../drivers/driver.entity';
import { DriversService } from '../drivers/drivers.service';
import { isDriverSuspended } from '../drivers/driver-suspension.util';
import { formatHkDateTime } from '../orders/order-datetime-filter';
import { LocationsService } from '../locations/locations.service';
import { parseMaxPickupRadiusKm } from '../orders/driver-pickup-radius.util';
import { OrderNotificationsService } from '../realtime/order-notifications.service';
import { DriverVehiclePlateHistoryEntity } from './driver-vehicle-plate-history.entity';

const DRIVER_JWT_EXPIRES_IN = process.env.DRIVER_JWT_EXPIRES_IN ?? process.env.JWT_EXPIRES_IN ?? '180d';

function normalizeVehiclePlate(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toUpperCase();
}

@Injectable()
export class DriverAuthService {
  constructor(
    @InjectRepository(DriverEntity) private readonly drivers: Repository<DriverEntity>,
    @InjectRepository(DriverVehiclePlateHistoryEntity)
    private readonly plateHistory: Repository<DriverVehiclePlateHistoryEntity>,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly firebase: FirebaseTokenService,
    private readonly orderNotifications: OrderNotificationsService,
    private readonly locations: LocationsService,
    private readonly driversService: DriversService,
  ) {}

  private async findDriverByPhoneInput(rawPhone: string): Promise<DriverEntity> {
    const variants = phoneLookupVariants(rawPhone);
    const driver = await this.drivers.findOne({
      where: { phone: In(variants), isActive: true },
    });
    if (!driver) {
      throw new BadRequestException('此電話並非 CRM 登記司機');
    }
    return driver;
  }

  async checkDriverPhone(rawPhone: string) {
    const phone = normalizePhoneE164(rawPhone);
    const variants = phoneLookupVariants(rawPhone);
    const driver = await this.drivers.findOne({
      where: { phone: In(variants), isActive: true },
    });
    if (!driver) {
      const offDutyOnly = await this.drivers.findOne({
        where: { offDutyPhone: In(variants), isActive: true },
      });
      if (offDutyOnly) {
        return {
          ok: true as const,
          exists: false as const,
          phone,
          useWorkPhone: true as const,
        };
      }
      return { ok: true as const, exists: false as const, phone };
    }
    return {
      ok: true as const,
      exists: true as const,
      phone,
      driverId: driver.id,
      displayName: driver.displayName,
      driverTier: driver.driverTier,
      vehiclePlate: driver.vehiclePlate,
      verificationStatus: driver.verificationStatus,
    };
  }

  /** 暫停 Firebase OTP：CRM 登記司機電話即可直接簽發 JWT */
  async loginWithPhoneOnly(rawPhone: string, ip?: string, deviceId?: string) {
    const driver = await this.findDriverByPhoneInput(rawPhone);
    const phone = normalizePhoneE164(rawPhone);
    const { token, expiresAt } = await this.issueDriverToken(driver, deviceId);
    await this.audit.log({
      actorType: 'driver',
      actorId: Number(driver.id),
      action: 'driver.login.phone',
      ip,
      resourceType: 'drivers',
      resourceId: String(driver.id),
    });
    return {
      token,
      expiresAt,
      driver: await this.driverProfilePayload(driver, phone),
    };
  }

  private async listPastVehiclePlates(
    driverId: string,
    currentPlate: string | null,
  ): Promise<string[]> {
    const current = currentPlate?.trim() ? normalizeVehiclePlate(currentPlate) : null;
    const rows = await this.plateHistory
      .createQueryBuilder('h')
      .select('h.vehicle_plate', 'plate')
      .addSelect('MAX(h.recorded_at)', 'lastAt')
      .where('h.driver_id = :driverId', { driverId })
      .groupBy('h.vehicle_plate')
      .orderBy('lastAt', 'DESC')
      .limit(24)
      .getRawMany<{ plate: string }>();
    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of rows) {
      const plate = row.plate?.trim();
      if (!plate || plate === current || seen.has(plate)) continue;
      seen.add(plate);
      out.push(plate);
    }
    return out;
  }

  private async recordVehiclePlateChange(
    driverId: string,
    previousPlate: string | null,
    nextPlate: string,
  ): Promise<void> {
    const prev = previousPlate?.trim() ? normalizeVehiclePlate(previousPlate) : null;
    if (!prev || prev === nextPlate) return;
    await this.plateHistory.insert({ driverId, vehiclePlate: prev });
  }

  private async driverProfilePayload(driver: DriverEntity, phone?: string) {
    const refreshed = await this.driversService.ensureSuspensionFresh(driver);
    const vehiclePlateHistory = await this.listPastVehiclePlates(refreshed.id, refreshed.vehiclePlate);
    const suspended = isDriverSuspended(refreshed);
    return {
      id: refreshed.id,
      phone: phone ?? refreshed.phone,
      displayName: refreshed.displayName,
      driverTier: refreshed.driverTier,
      vehiclePlate: refreshed.vehiclePlate,
      vehiclePlateHistory,
      pointsBalance: Math.round(Number(refreshed.pointsBalance ?? 0)),
      verificationStatus: refreshed.verificationStatus,
      suspensionActive: suspended,
      suspendedPermanent: Boolean(refreshed.suspendedPermanent),
      suspendedUntilHk: refreshed.suspendedUntil ? formatHkDateTime(refreshed.suspendedUntil) : null,
      suspendedReason: refreshed.suspendedReason?.trim() || null,
    };
  }

  private async issueDriverToken(driver: DriverEntity, deviceId?: string) {
    const sameDevice =
      Boolean(deviceId) &&
      Boolean(driver.lastLoginDeviceId) &&
      driver.lastLoginDeviceId === deviceId;
    if (!sameDevice) {
      driver.sessionVersion += 1;
      if (deviceId) driver.lastLoginDeviceId = deviceId;
      await this.drivers.save(driver);
      this.orderNotifications.notifyDriverSessionRevoked(
        String(driver.id),
        '你的帳戶已在另一部裝置登入，此裝置已登出。',
      );
    }
    const token = this.jwt.sign(
      { sub: driver.id, typ: 'driver', sv: driver.sessionVersion, did: deviceId ?? null },
      { secret: process.env.JWT_SECRET, expiresIn: DRIVER_JWT_EXPIRES_IN },
    );
    const decoded = this.jwt.decode(token) as { exp?: number } | null;
    const expiresAt =
      decoded?.exp != null ? new Date(decoded.exp * 1000).toISOString() : null;
    return { token, expiresAt };
  }

  async loginWithFirebase(idToken: string, ip?: string, deviceId?: string) {
    const { phone: firebasePhone } = await this.firebase.verifyIdToken(idToken);
    const driver = await this.findDriverByPhoneInput(firebasePhone);

    const driverVariants = phoneLookupVariants(driver.phone);
    const firebaseVariants = phoneLookupVariants(firebasePhone);
    if (!driverVariants.some((p) => firebaseVariants.includes(p))) {
      throw new UnauthorizedException('Firebase 電話與司機紀錄不一致');
    }

    const { token, expiresAt } = await this.issueDriverToken(driver, deviceId);
    await this.audit.log({
      actorType: 'driver',
      actorId: Number(driver.id),
      action: 'driver.login.firebase',
      ip,
      resourceType: 'drivers',
      resourceId: String(driver.id),
    });

    return {
      token,
      expiresAt,
      driver: await this.driverProfilePayload(driver),
    };
  }

  async getProfile(driverId: string) {
    const driver = await this.drivers.findOne({ where: { id: driverId, isActive: true } });
    if (!driver) throw new UnauthorizedException('司機不存在或已停用');
    return this.driverProfilePayload(driver);
  }

  async logout(driverId: string) {
    const driver = await this.drivers.findOne({ where: { id: driverId, isActive: true } });
    if (!driver) return { ok: true };
    driver.sessionVersion += 1;
    driver.isOnline = false;
    await this.drivers.save(driver);
    await this.locations.clearDriverLive(driverId);
    return { ok: true };
  }

  private pickupRadiusColumnValue(raw: unknown): string | null {
    const km = parseMaxPickupRadiusKm(raw);
    return km == null ? null : String(km);
  }

  async updateVehiclePlate(driverId: string, vehiclePlate: string) {
    const driver = await this.drivers.findOne({ where: { id: driverId, isActive: true } });
    if (!driver) throw new UnauthorizedException('司機不存在或已停用');
    const next = normalizeVehiclePlate(vehiclePlate);
    const previous = driver.vehiclePlate;
    await this.recordVehiclePlateChange(driverId, previous, next);
    driver.vehiclePlate = next;
    await this.drivers.save(driver);
    return this.driverProfilePayload(driver);
  }

  async updateDispatchPreferences(driverId: string, maxPickupRadiusKm?: unknown) {
    const driver = await this.drivers.findOne({ where: { id: driverId, isActive: true } });
    if (!driver) throw new UnauthorizedException('司機不存在或已停用');
    if (maxPickupRadiusKm !== undefined) {
      driver.maxPickupRadiusKm = this.pickupRadiusColumnValue(maxPickupRadiusKm);
      await this.drivers.save(driver);
    }
    return {
      ok: true,
      maxPickupRadiusKm:
        driver.maxPickupRadiusKm == null ? null : Number(driver.maxPickupRadiusKm),
    };
  }

  async setPresence(driverId: string, online: boolean, maxPickupRadiusKm?: unknown) {
    let driver = await this.drivers.findOne({ where: { id: driverId, isActive: true } });
    if (!driver) throw new UnauthorizedException('司機不存在或已停用');
    driver = await this.driversService.ensureSuspensionFresh(driver);
    if (online) {
      this.driversService.assertDriverEligibleForDispatch(driver);
    }
    if (maxPickupRadiusKm !== undefined) {
      driver.maxPickupRadiusKm = this.pickupRadiusColumnValue(maxPickupRadiusKm);
      await this.drivers.save(driver);
    }
    await this.locations.setDriverPresence(driverId, online);
    return {
      ok: true,
      online,
      maxPickupRadiusKm:
        driver.maxPickupRadiusKm == null ? null : Number(driver.maxPickupRadiusKm),
    };
  }

  assertJwtSession(driver: DriverEntity, payload: { sv?: number }) {
    if (payload.sv === undefined || driver.sessionVersion !== payload.sv) {
      throw new UnauthorizedException('登入已失效，請重新驗證');
    }
  }
}
