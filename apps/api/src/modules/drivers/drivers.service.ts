import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { paginated, parsePageQuery } from '../../common/pagination';
import { formatHkDateTime } from '../orders/order-datetime-filter';
import { AuditService } from '../audit/audit.service';
import { AdminAuthService } from '../admin-auth/admin-auth.service';
import { DocumentsService } from '../documents/documents.service';
import { LocationsService } from '../locations/locations.service';
import { PromosService } from '../promos/promos.service';
import { DriverSuspensionService } from './driver-suspension.service';
import { DriverEntity } from './driver.entity';
import {
  DRIVER_SUSPENSION_MESSAGE,
  isDriverSuspended,
  suspensionEndsAtFromDays,
} from './driver-suspension.util';
import {
  formatHongKongIdentityNumberError,
  normalizeHongKongBankAccountNumber,
  parseHongKongDriverLicenseNumber,
} from '@taxima/shared';
import { normalizePhoneE164, phoneLookupVariants } from '../admin-auth/phone.util';

export const DRIVER_DISPATCH_APPROVAL_MESSAGE =
  '管理員未審批，不能接柯打、射柯打或上線接單';

function normalizeVehiclePlate(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toUpperCase();
}

function normalizeDriverLicenseNumber(raw: string | undefined | null): string {
  if (!raw?.trim()) {
    throw new BadRequestException(formatHongKongIdentityNumberError('empty', '執照號碼'));
  }
  const parsed = parseHongKongDriverLicenseNumber(raw);
  if (!parsed.ok) {
    throw new BadRequestException(formatHongKongIdentityNumberError(parsed.reason, '執照號碼'));
  }
  return parsed.normalized;
}

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(DriverEntity) private readonly repo: Repository<DriverEntity>,
    @Inject(forwardRef(() => PromosService)) private readonly promos: PromosService,
    private readonly adminAuth: AdminAuthService,
    private readonly documents: DocumentsService,
    private readonly locations: LocationsService,
    private readonly audit: AuditService,
    private readonly driverSuspension: DriverSuspensionService,
  ) {}

  assertDriverApprovedForDispatch(driver: DriverEntity) {
    if (driver.verificationStatus !== 'approved') {
      throw new BadRequestException(DRIVER_DISPATCH_APPROVAL_MESSAGE);
    }
  }

  assertDriverNotSuspended(driver: DriverEntity) {
    if (isDriverSuspended(driver)) {
      throw new BadRequestException(DRIVER_SUSPENSION_MESSAGE);
    }
  }

  assertDriverEligibleForDispatch(driver: DriverEntity) {
    this.assertDriverApprovedForDispatch(driver);
    this.assertDriverNotSuspended(driver);
  }

  async ensureSuspensionFresh(driver: DriverEntity): Promise<DriverEntity> {
    if (driver.suspendedPermanent) return driver;
    if (!driver.suspendedUntil) return driver;
    if (new Date(driver.suspendedUntil).getTime() > Date.now()) return driver;
    driver.suspendedUntil = null;
    driver.suspendedReason = null;
    return this.repo.save(driver);
  }

  private suspensionFields(d: DriverEntity) {
    const active = isDriverSuspended(d);
    return {
      suspensionActive: active,
      suspendedPermanent: Boolean(d.suspendedPermanent),
      suspendedUntil: d.suspendedUntil ? new Date(d.suspendedUntil).toISOString() : null,
      suspendedUntilHk: d.suspendedUntil ? formatHkDateTime(d.suspendedUntil) : null,
      suspendedReason: d.suspendedReason?.trim() || null,
    };
  }

  private async syncCrmAccessForDriver(
    driver: DriverEntity,
    previousTier?: DriverEntity['driverTier'],
  ): Promise<void> {
    if (driver.driverTier === 'admin') {
      await this.adminAuth.ensureAdminUserForDriver(driver);
      return;
    }
    if (previousTier === 'admin') {
      await this.adminAuth.revokeCrmAccessForDriver(driver);
    }
  }

  mapRow(d: DriverEntity) {
    return {
      ...d,
      isActive: Boolean(d.isActive),
      isInternalMember: Boolean(d.isInternalMember),
      internalLabel: d.isInternalMember ? '自己人' : null,
      pointsBalance: Math.round(Number(d.pointsBalance ?? 0)),
      ...this.suspensionFields(d),
    };
  }

  async list(phone?: string, pageRaw?: string, pageSizeRaw?: string) {
    await this.driverSuspension.clearExpiredSuspensions();
    const { page, pageSize, skip } = parsePageQuery(pageRaw, pageSizeRaw);
    const qb = this.repo.createQueryBuilder('d').where('d.is_active = 1').orderBy('d.created_at', 'DESC');
    if (phone?.trim()) qb.andWhere('d.phone LIKE :phone', { phone: `%${phone.trim()}%` });
    const total = await qb.getCount();
    const rows = await qb.skip(skip).take(pageSize).getMany();
    return paginated(
      rows.map((d) => this.mapRow(d)),
      total,
      page,
      pageSize,
    );
  }

  private async findActiveDriverUsingPhoneVariants(variants: string[]) {
    const byWork = await this.repo.findOne({ where: { phone: In(variants), isActive: true } });
    if (byWork) return byWork;
    return this.repo.findOne({ where: { offDutyPhone: In(variants), isActive: true } });
  }

  async checkRegisterPhones(rawWorkPhone: string, rawOffDutyPhone?: string) {
    const workVariants = phoneLookupVariants(rawWorkPhone);
    const workTaken = await this.findActiveDriverUsingPhoneVariants(workVariants);
    if (workTaken) {
      return {
        ok: true as const,
        available: false as const,
        field: 'phone' as const,
        message: '此開工電話已被登記',
      };
    }
    const offRaw = rawOffDutyPhone?.trim();
    if (offRaw) {
      const workE164 = normalizePhoneE164(rawWorkPhone);
      const offE164 = normalizePhoneE164(offRaw);
      if (workE164 === offE164) {
        return {
          ok: true as const,
          available: false as const,
          field: 'offDutyPhone' as const,
          message: '收工電話不可與開工電話相同',
        };
      }
      const offTaken = await this.findActiveDriverUsingPhoneVariants(phoneLookupVariants(offRaw));
      if (offTaken) {
        return {
          ok: true as const,
          available: false as const,
          field: 'offDutyPhone' as const,
          message: '此收工電話已被登記',
        };
      }
    }
    return { ok: true as const, available: true as const };
  }

  async register(input: {
    phone: string;
    offDutyPhone?: string;
    vehiclePlate: string;
    displayName?: string;
    licenseNumber?: string;
    vehiclePlateExpiry?: string;
    vehicleModel?: string;
    firstRegistrationDate?: string;
    promoCode?: string;
    bankName?: string;
    bankAccountNumber?: string;
  }) {
    const availability = await this.checkRegisterPhones(input.phone, input.offDutyPhone);
    if (!availability.available) {
      throw new ConflictException(availability.message);
    }
    const phone = normalizePhoneE164(input.phone);
    let driver = await this.repo.save(
      this.repo.create({
        phone,
        offDutyPhone: input.offDutyPhone?.trim() ? normalizePhoneE164(input.offDutyPhone) : null,
        displayName: input.displayName?.trim() || null,
        licenseNumber: normalizeDriverLicenseNumber(input.licenseNumber),
        vehiclePlate: normalizeVehiclePlate(input.vehiclePlate),
        vehiclePlateExpiry: input.vehiclePlateExpiry?.trim() || null,
        vehicleModel: input.vehicleModel?.trim() || null,
        firstRegistrationDate: input.firstRegistrationDate?.trim() || null,
        bankName: input.bankName?.trim() || null,
        bankAccountNumber: input.bankAccountNumber?.trim()
          ? normalizeHongKongBankAccountNumber(input.bankAccountNumber)
          : null,
        isActive: true,
        driverTier: 'public',
        verificationStatus: 'pending',
      }),
    );
    let promoApplied = false;
    let promoRejectReason: string | null = null;
    if (input.promoCode?.trim()) {
      try {
        await this.promos.applyPromoToDriver(input.promoCode, driver.id);
        promoApplied = true;
        driver = (await this.repo.findOneBy({ id: driver.id }))!;
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        promoRejectReason = raw.includes('優惠碼') ? raw : '優惠碼無法套用，請聯絡客服';
      }
    }
    return { driver: this.mapRow(driver), promoApplied, promoRejectReason };
  }

  async getDetail(id: string) {
    let driver = await this.repo.findOneBy({ id, isActive: true });
    if (!driver) throw new NotFoundException('司機不存在');
    driver = await this.ensureSuspensionFresh(driver);
    const docs = await this.documents.listForDriver(id);
    return {
      driver: this.mapRow(driver),
      documents: docs.map((d) => ({
        id: d.id,
        docType: d.docType,
        reviewStatus: d.reviewStatus,
        fileUrl: this.documents.uploadPublicUrl(d.filePath),
        createdAt: d.createdAt,
      })),
    };
  }

  async create(adminId: number, input: {
    phone: string;
    offDutyPhone: string;
    displayName: string;
    licenseNumber: string;
    vehiclePlate: string;
    vehiclePlateExpiry: string;
    vehicleModel: string;
    firstRegistrationDate: string;
    bankName: string;
    bankAccountNumber: string;
    driverTier?: DriverEntity['driverTier'];
    isInternalMember?: boolean;
    verificationStatus?: DriverEntity['verificationStatus'];
  }) {
    const availability = await this.checkRegisterPhones(input.phone, input.offDutyPhone);
    if (!availability.available) {
      throw new ConflictException(availability.message);
    }
    const phone = normalizePhoneE164(input.phone);
    const driver = await this.repo.save(
      this.repo.create({
        phone,
        offDutyPhone: normalizePhoneE164(input.offDutyPhone),
        displayName: input.displayName.trim(),
        licenseNumber: normalizeDriverLicenseNumber(input.licenseNumber),
        vehiclePlate: normalizeVehiclePlate(input.vehiclePlate),
        vehiclePlateExpiry: input.vehiclePlateExpiry.trim(),
        vehicleModel: input.vehicleModel.trim(),
        firstRegistrationDate: input.firstRegistrationDate.trim(),
        bankName: input.bankName.trim(),
        bankAccountNumber: normalizeHongKongBankAccountNumber(input.bankAccountNumber),
        isActive: true,
        driverTier: input.driverTier ?? 'public',
        isInternalMember: Boolean(input.isInternalMember),
        verificationStatus: input.verificationStatus ?? 'pending',
      }),
    );
    await this.syncCrmAccessForDriver(driver);
    return this.mapRow(driver);
  }

  async update(adminId: number, id: string, input: {
    phone?: string;
    offDutyPhone?: string;
    displayName?: string;
    licenseNumber?: string;
    vehiclePlate?: string;
    vehiclePlateExpiry?: string;
    vehicleModel?: string;
    firstRegistrationDate?: string;
    bankName?: string;
    bankAccountNumber?: string;
    driverTier?: DriverEntity['driverTier'];
    isInternalMember?: boolean;
    verificationStatus?: DriverEntity['verificationStatus'];
  }) {
    const driver = await this.repo.findOneBy({ id });
    if (!driver || !driver.isActive) throw new NotFoundException('司機不存在');
    const previousTier = driver.driverTier;
    const nextWorkPhone =
      input.phone !== undefined ? normalizePhoneE164(input.phone) : driver.phone;
    const nextOffPhone =
      input.offDutyPhone !== undefined
        ? input.offDutyPhone.trim()
          ? normalizePhoneE164(input.offDutyPhone)
          : null
        : driver.offDutyPhone;
    if (input.phone !== undefined || input.offDutyPhone !== undefined) {
      if (nextOffPhone && nextWorkPhone === nextOffPhone) {
        throw new ConflictException('收工電話不可與開工電話相同');
      }
      const workTaken = await this.findActiveDriverUsingPhoneVariants(
        phoneLookupVariants(nextWorkPhone),
      );
      if (workTaken && workTaken.id !== id) {
        throw new ConflictException('此開工電話已被登記');
      }
      if (nextOffPhone) {
        const offTaken = await this.findActiveDriverUsingPhoneVariants(
          phoneLookupVariants(nextOffPhone),
        );
        if (offTaken && offTaken.id !== id) {
          throw new ConflictException('此收工電話已被登記');
        }
      }
    }
    if (input.phone !== undefined && nextWorkPhone !== driver.phone) {
      const dup = await this.repo.findOne({ where: { phone: nextWorkPhone } });
      if (dup && dup.id !== id) throw new ConflictException('電話已被使用');
      driver.phone = nextWorkPhone;
    }
    if (input.offDutyPhone !== undefined) driver.offDutyPhone = nextOffPhone;
    if (input.displayName !== undefined) driver.displayName = input.displayName?.trim() || null;
    if (input.licenseNumber !== undefined) {
      driver.licenseNumber = input.licenseNumber.trim()
        ? normalizeDriverLicenseNumber(input.licenseNumber)
        : null;
    }
    if (input.vehiclePlate !== undefined) {
      driver.vehiclePlate = input.vehiclePlate.trim()
        ? normalizeVehiclePlate(input.vehiclePlate)
        : null;
    }
    if (input.vehiclePlateExpiry !== undefined) {
      driver.vehiclePlateExpiry = input.vehiclePlateExpiry.trim() || null;
    }
    if (input.vehicleModel !== undefined) {
      driver.vehicleModel = input.vehicleModel.trim() || null;
    }
    if (input.firstRegistrationDate !== undefined) {
      driver.firstRegistrationDate = input.firstRegistrationDate.trim() || null;
    }
    if (input.bankName !== undefined) driver.bankName = input.bankName.trim() || null;
    if (input.bankAccountNumber !== undefined) {
      driver.bankAccountNumber = input.bankAccountNumber.trim()
        ? normalizeHongKongBankAccountNumber(input.bankAccountNumber)
        : null;
    }
    if (input.driverTier) driver.driverTier = input.driverTier;
    if (input.isInternalMember !== undefined) driver.isInternalMember = input.isInternalMember;
    if (input.verificationStatus !== undefined) driver.verificationStatus = input.verificationStatus;
    const saved = await this.repo.save(driver);
    await this.syncCrmAccessForDriver(saved, previousTier);
    return this.mapRow(saved);
  }

  async setTier(adminId: number, id: string, driverTier: DriverEntity['driverTier']) {
    const driver = await this.repo.findOneBy({ id });
    if (!driver) throw new NotFoundException('司機不存在');
    const previousTier = driver.driverTier;
    driver.driverTier = driverTier;
    const saved = await this.repo.save(driver);
    await this.syncCrmAccessForDriver(saved, previousTier);
    return this.mapRow(saved);
  }

  async quickApprove(adminId: number, id: string) {
    return this.setVerification(adminId, id, 'approved');
  }

  async setVerification(adminId: number, id: string, status: DriverEntity['verificationStatus']) {
    const driver = await this.repo.findOneBy({ id });
    if (!driver) throw new NotFoundException('司機不存在');
    driver.verificationStatus = status;
    await this.repo.save(driver);
    return this.mapRow(driver);
  }

  async remove(adminId: number, id: string) {
    const driver = await this.repo.findOneBy({ id });
    if (!driver) throw new NotFoundException('司機不存在');
    driver.isActive = false;
    await this.repo.save(driver);
    return { ok: true };
  }

  async suspend(
    adminId: number,
    id: string,
    input: { permanent?: boolean; days?: number; reason?: string },
  ) {
    const driver = await this.repo.findOneBy({ id, isActive: true });
    if (!driver) throw new NotFoundException('司機不存在');

    const permanent = Boolean(input.permanent);
    let days: number | undefined;
    if (!permanent) {
      days = Math.round(Number(input.days));
      if (!Number.isFinite(days) || days < 1 || days > 3650) {
        throw new BadRequestException('請輸入 1–3650 日停用天數，或選擇永久停用');
      }
    }

    driver.suspendedPermanent = permanent;
    driver.suspendedUntil = permanent ? null : suspensionEndsAtFromDays(days!);
    driver.suspendedReason = input.reason?.trim().slice(0, 255) || null;
    driver.isOnline = false;
    const saved = await this.repo.save(driver);
    await this.locations.clearDriverLive(id);

    await this.audit.log({
      actorType: 'admin',
      actorId: adminId,
      action: permanent ? 'driver.suspend.permanent' : 'driver.suspend.days',
      resourceType: 'drivers',
      resourceId: id,
      payload: {
        days: permanent ? null : days,
        reason: driver.suspendedReason,
        until: saved.suspendedUntil?.toISOString() ?? null,
      },
    });

    return this.mapRow(saved);
  }

  async unsuspend(adminId: number, id: string) {
    const driver = await this.repo.findOneBy({ id, isActive: true });
    if (!driver) throw new NotFoundException('司機不存在');
    if (!isDriverSuspended(driver)) {
      throw new BadRequestException('此司機目前並非停用狀態');
    }
    driver.suspendedPermanent = false;
    driver.suspendedUntil = null;
    driver.suspendedReason = null;
    const saved = await this.repo.save(driver);

    await this.audit.log({
      actorType: 'admin',
      actorId: adminId,
      action: 'driver.unsuspend',
      resourceType: 'drivers',
      resourceId: id,
    });

    return this.mapRow(saved);
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id, isActive: true } });
  }

  async listPointLedger(driverId: string, pageRaw?: string, pageSizeRaw?: string) {
    const driver = await this.repo.findOneBy({ id: driverId });
    if (!driver || !driver.isActive) throw new NotFoundException('司機不存在');

    const { page, pageSize, skip } = parsePageQuery(pageRaw, pageSizeRaw, 20);
    const [{ c }] = (await this.repo.manager.query(
      `SELECT COUNT(*) AS c FROM driver_point_ledger WHERE driver_id = ?`,
      [driverId],
    )) as { c: string }[];

    const total = Number(c ?? 0);
    const rows = (await this.repo.manager.query(
      `SELECT id, delta_points AS deltaPoints, balance_after AS balanceAfter, reason,
              ref_type AS refType, ref_id AS refId, created_at AS createdAt
       FROM driver_point_ledger
       WHERE driver_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [driverId, pageSize, skip],
    )) as {
      id: string;
      deltaPoints: string;
      balanceAfter: string;
      reason: string;
      refType: string | null;
      refId: string | null;
      createdAt: Date;
    }[];

    const items = rows.map((r) => ({
      id: r.id,
      deltaPoints: Math.round(Number(r.deltaPoints)),
      balanceAfter: Math.round(Number(r.balanceAfter)),
      reason: r.reason,
      refType: r.refType,
      refId: r.refId,
      createdAtHk: formatHkDateTime(r.createdAt),
    }));

    return {
      driver: {
        id: driver.id,
        displayName: driver.displayName,
        phone: driver.phone,
        pointsBalance: Math.round(Number(driver.pointsBalance ?? 0)),
      },
      ...paginated(items, total, page, pageSize),
    };
  }

  async setPointsBalance(adminId: number, driverId: string, pointsBalance: number, reason?: string) {
    const target = Math.max(0, Math.round(pointsBalance));
    if (!Number.isFinite(target)) throw new BadRequestException('積分格式不正確');

    return this.repo.manager.transaction(async (m) => {
      const locked = (await m.query(`SELECT points_balance AS balance FROM drivers WHERE id = ? FOR UPDATE`, [
        driverId,
      ])) as { balance: string }[];
      if (!locked.length) throw new NotFoundException('司機不存在');
      const before = Math.round(Number(locked[0]!.balance ?? 0));
      const delta = target - before;
      if (delta === 0) {
        const driver = await this.repo.findOneBy({ id: driverId });
        if (!driver || !driver.isActive) throw new NotFoundException('司機不存在');
        return this.mapRow(driver);
      }

      await m.query(`UPDATE drivers SET points_balance = ? WHERE id = ?`, [target, driverId]);
      const note =
        reason?.trim() ||
        (delta > 0 ? `CRM 管理員 #${adminId} 增加積分` : `CRM 管理員 #${adminId} 扣減積分`);
      await m.query(
        `INSERT INTO driver_point_ledger (driver_id, delta_points, balance_after, reason, ref_type, ref_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [driverId, delta, target, note.slice(0, 128), 'admin_adjust', adminId],
      );

      const driver = await this.repo.findOneBy({ id: driverId });
      if (!driver) throw new NotFoundException('司機不存在');
      return this.mapRow(driver);
    });
  }
}
