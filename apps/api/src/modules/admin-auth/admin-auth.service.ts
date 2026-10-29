import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { In, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { DriverEntity } from '../drivers/driver.entity';
import { AdminUserEntity } from './admin-user.entity';
import { FirebaseTokenService } from './firebase-token.service';
import { normalizePhoneE164, phoneLookupVariants } from './phone.util';

const CRM_JWT_EXPIRES_IN = process.env.CRM_JWT_EXPIRES_IN ?? '24h';

/** Firebase OTP 登入用；email/密碼登入路徑已停用 */
const CRM_PLACEHOLDER_PASSWORD_HASH =
  '$2b$10$L1mKhuch6iAd7QTmDWqo.uhoi5SZRBCrOf5td.UeZba35jtLJCFIa';

function crmAdminEmailForDriver(driverId: string): string {
  return `driver-${driverId}@crm.taxima.hk`;
}

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectRepository(AdminUserEntity)
    private readonly admins: Repository<AdminUserEntity>,
    @InjectRepository(DriverEntity)
    private readonly drivers: Repository<DriverEntity>,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly firebase: FirebaseTokenService,
  ) {}

  async login(email: string, password: string, ip?: string) {
    const admin = await this.admins.findOne({ where: { email, isActive: true } });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const token = await this.issueAdminToken(admin);
    await this.audit.log({
      actorType: 'admin',
      actorId: admin.id,
      action: 'admin.login',
      ip,
    });
    return {
      token: token.token,
      expiresAt: token.expiresAt,
      admin: { id: admin.id, email: admin.email, displayName: admin.displayName, role: admin.role },
    };
  }

  /** 同一裝置 24h 內重新 OTP 不會 bump session（避免自己踢自己）；換裝置才 bump */
  private async issueAdminToken(admin: AdminUserEntity, deviceId?: string) {
    const sameDevice =
      Boolean(deviceId) &&
      Boolean(admin.lastLoginDeviceId) &&
      admin.lastLoginDeviceId === deviceId;
    if (!sameDevice) {
      admin.sessionVersion += 1;
      if (deviceId) admin.lastLoginDeviceId = deviceId;
      await this.admins.save(admin);
    }
    const token = this.jwt.sign(
      { sub: admin.id, typ: 'admin', role: admin.role, sv: admin.sessionVersion, did: deviceId ?? null },
      { secret: process.env.JWT_SECRET, expiresIn: CRM_JWT_EXPIRES_IN },
    );
    const decoded = this.jwt.decode(token) as { exp?: number } | null;
    const expiresAt =
      decoded?.exp != null ? new Date(decoded.exp * 1000).toISOString() : null;
    return { token, expiresAt };
  }

  /**
   * 司機「管理員級」= CRM 最高權限（super_admin），自動建立／更新 admin_users。
   */
  async ensureAdminUserForDriver(driver: DriverEntity): Promise<AdminUserEntity> {
    const phoneE164 = normalizePhoneE164(driver.phone);
    const variants = phoneLookupVariants(driver.phone);
    const email = crmAdminEmailForDriver(driver.id);
    const displayName = driver.displayName?.trim() || `司機 ${driver.phone}`;

    let admin =
      (await this.admins.findOne({ where: { email } })) ??
      (await this.admins.findOne({ where: { phone: In([phoneE164, ...variants]) } }));

    if (!admin) {
      admin = this.admins.create({
        email,
        phone: phoneE164,
        passwordHash: CRM_PLACEHOLDER_PASSWORD_HASH,
        displayName,
        role: 'super_admin',
        isActive: true,
      });
    } else {
      if (!admin.email?.trim()) admin.email = email;
      admin.phone = phoneE164;
      admin.displayName = displayName;
      admin.role = 'super_admin';
      admin.isActive = true;
    }
    return this.admins.save(admin);
  }

  /** 司機級別不再是管理員級時，停用對應 CRM 帳號（同一電話 OTP 不可再登入） */
  async revokeCrmAccessForDriver(driver: DriverEntity): Promise<void> {
    const variants = phoneLookupVariants(driver.phone);
    const email = crmAdminEmailForDriver(driver.id);
    const admin =
      (await this.admins.findOne({ where: { email } })) ??
      (await this.admins.findOne({ where: { phone: In(variants) } }));
    if (!admin) return;
    admin.isActive = false;
    await this.admins.save(admin);
  }

  /** 發 OTP 前：須為 DB 內司機且 driver_tier = admin */
  private async assertCrmLoginByPhone(rawPhone: string) {
    const phone = normalizePhoneE164(rawPhone);
    const variants = phoneLookupVariants(rawPhone);

    const driver = await this.drivers.findOne({
      where: { phone: In(variants), isActive: true },
    });
    if (!driver) {
      throw new BadRequestException('此電話並非系統內司機');
    }
    if (driver.driverTier !== 'admin') {
      throw new BadRequestException('此司機未有 CRM 權限（需「管理員級」）');
    }

    const admin = await this.ensureAdminUserForDriver(driver);

    return { phone, driver, admin };
  }

  async checkAdminPhone(rawPhone: string) {
    const { phone, driver, admin } = await this.assertCrmLoginByPhone(rawPhone);
    return {
      ok: true as const,
      phone,
      displayName: driver.displayName ?? admin.displayName,
      driverTier: driver.driverTier,
    };
  }

  /** 暫停 Firebase OTP：DB 已有管理員級司機電話即可直接簽發 JWT */
  async loginWithPhoneOnly(rawPhone: string, ip?: string, deviceId?: string) {
    const { phone, admin, driver } = await this.assertCrmLoginByPhone(rawPhone);
    const { token, expiresAt } = await this.issueAdminToken(admin, deviceId);
    await this.audit.log({
      actorType: 'admin',
      actorId: admin.id,
      action: 'admin.login.phone',
      ip,
      resourceType: 'driver',
      resourceId: String(driver.id),
    });
    return {
      token,
      expiresAt,
      admin: {
        id: admin.id,
        phone,
        displayName: driver.displayName ?? admin.displayName,
        role: admin.role,
      },
    };
  }

  async loginWithFirebase(idToken: string, ip?: string, deviceId?: string) {
    const { phone: firebasePhone } = await this.firebase.verifyIdToken(idToken);
    const { phone, admin, driver } = await this.assertCrmLoginByPhone(firebasePhone);

    const adminPhoneVariants = phoneLookupVariants(admin.phone ?? phone);
    const firebaseVariants = phoneLookupVariants(firebasePhone);
    if (!adminPhoneVariants.some((p) => firebaseVariants.includes(p))) {
      throw new UnauthorizedException('Firebase 電話與管理員綁定不一致');
    }

    const { token, expiresAt } = await this.issueAdminToken(admin, deviceId);
    await this.audit.log({
      actorType: 'admin',
      actorId: admin.id,
      action: 'admin.login.firebase',
      ip,
      resourceType: 'driver',
      resourceId: String(driver.id),
    });
    return {
      token,
      expiresAt,
      admin: {
        id: admin.id,
        phone: admin.phone,
        displayName: driver.displayName ?? admin.displayName,
        role: admin.role,
      },
    };
  }
}
