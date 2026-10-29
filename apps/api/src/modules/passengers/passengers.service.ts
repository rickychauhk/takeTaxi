import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { normalizePhoneE164, phoneLookupVariants } from '../admin-auth/phone.util';
import { paginated, parsePageQuery } from '../../common/pagination';
import { formatHkDateTime } from '../orders/order-datetime-filter';
import { PassengerEntity } from './passenger.entity';

const APP_CLIENT_ID_MAX = 64;

@Injectable()
export class PassengersService {
  constructor(@InjectRepository(PassengerEntity) private readonly repo: Repository<PassengerEntity>) {}

  private normalizeAppClientId(input: string): string {
    const id = input.trim();
    if (!id || id.length > APP_CLIENT_ID_MAX) {
      throw new BadRequestException('Invalid appClientId');
    }
    return id;
  }

  async findByAppClientId(input: string): Promise<PassengerEntity | null> {
    const appClientId = this.normalizeAppClientId(input);
    return this.repo.findOne({ where: { appClientId, isActive: true } });
  }

  async getOrCreateByAppClientId(input: string): Promise<PassengerEntity> {
    const appClientId = this.normalizeAppClientId(input);
    const existing = await this.repo.findOne({ where: { appClientId, isActive: true } });
    if (existing) return existing;

    return this.repo.save(
      this.repo.create({
        appClientId,
        displayName: 'App 乘客',
        isActive: true,
        phone: null,
      }),
    );
  }

  async findActiveById(id: string) {
    return this.repo.findOne({ where: { id, isActive: true } });
  }

  async findActiveByPhone(rawPhone: string): Promise<PassengerEntity | null> {
    const variants = phoneLookupVariants(rawPhone);
    return this.repo.findOne({ where: { phone: In(variants), isActive: true } });
  }

  /**
   * 已 OTP 登入的乘客：將本機 appClientId 綁到帳戶（重裝 App、清快取後 JWT 仍有效時）。
   * 若 clientId 只綁在無電話的幽靈帳，會釋出再綁定。
   */
  async bindAppClientIdToVerifiedPassenger(
    passengerId: string,
    appClientIdInput: string,
  ): Promise<PassengerEntity> {
    const appClientId = this.normalizeAppClientId(appClientIdInput);
    const row = await this.findActiveById(passengerId);
    if (!row) throw new NotFoundException('Passenger not found');
    if (!row.phone?.trim()) {
      throw new BadRequestException('請先完成電話驗證');
    }
    if (row.appClientId === appClientId) return row;

    const other = await this.repo.findOne({ where: { appClientId, isActive: true } });
    if (other && other.id !== passengerId) {
      if (!other.phone?.trim()) {
        other.appClientId = null;
        await this.repo.save(other);
      } else {
        throw new BadRequestException('appClientId 與登入帳戶不符');
      }
    }
    row.appClientId = appClientId;
    return this.repo.save(row);
  }

  /** Firebase OTP 登入：以電話為會員主鍵，綁定 appClientId。 */
  async registerLoginWithPhoneAndAppClientId(rawPhone: string, appClientIdInput: string) {
    const phone = normalizePhoneE164(rawPhone);
    const appClientId = this.normalizeAppClientId(appClientIdInput);
    const variants = phoneLookupVariants(phone);

    let row = await this.repo.findOne({ where: { phone: In(variants), isActive: true } });
    if (!row) {
      const byClient = await this.repo.findOne({ where: { appClientId, isActive: true } });
      if (byClient && !byClient.phone?.trim()) {
        row = byClient;
        row.phone = phone;
      } else {
        row = this.repo.create({
          phone,
          appClientId,
          displayName: `乘客 ·${phone.slice(-4)}`,
          isActive: true,
        });
      }
    } else {
      row.phone = phone;
      row.appClientId = appClientId;
      if (!row.displayName?.trim()) row.displayName = `乘客 ·${phone.slice(-4)}`;
    }
    return this.repo.save(row);
  }

  async getAppMemberProfile(appClientIdInput: string) {
    const row = await this.getOrCreateByAppClientId(appClientIdInput);
    return {
      id: row.id,
      displayName: row.displayName,
      phone: row.phone,
      pointsBalance: Number(row.pointsBalance ?? 0),
    };
  }

  async list(search?: string, pageRaw?: string, pageSizeRaw?: string) {
    const { page, pageSize, skip } = parsePageQuery(pageRaw, pageSizeRaw);
    const qb = this.repo.createQueryBuilder('p').where('p.is_active = 1').orderBy('p.created_at', 'DESC');
    const q = search?.trim();
    if (q) {
      const digits = q.replace(/\D/g, '');
      if (/^\d+$/.test(q)) {
        qb.andWhere('(p.id = :id OR p.display_name LIKE :name OR p.phone LIKE :phone)', {
          id: q,
          name: `%${q}%`,
          phone: `%${digits || q}%`,
        });
      } else {
        qb.andWhere('(p.display_name LIKE :name OR p.phone LIKE :phone)', {
          name: `%${q}%`,
          phone: `%${digits}%`,
        });
      }
    }
    const total = await qb.getCount();
    const rows = await qb.skip(skip).take(pageSize).getMany();
    const items = rows.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      phone: p.phone,
      email: p.email,
      pointsBalance: Math.round(Number(p.pointsBalance ?? 0)),
    }));
    return paginated(items, total, page, pageSize);
  }

  async listPointLedger(passengerId: string, pageRaw?: string, pageSizeRaw?: string) {
    const passenger = await this.repo.findOneBy({ id: passengerId });
    if (!passenger || !passenger.isActive) throw new NotFoundException('乘客不存在');

    const { page, pageSize, skip } = parsePageQuery(pageRaw, pageSizeRaw, 20);
    const [{ c }] = (await this.repo.manager.query(
      `SELECT COUNT(*) AS c FROM passenger_point_ledger WHERE passenger_id = ?`,
      [passengerId],
    )) as { c: string }[];

    const total = Number(c ?? 0);
    const rows = (await this.repo.manager.query(
      `SELECT id, delta_points AS deltaPoints, balance_after AS balanceAfter, reason,
              ref_type AS refType, ref_id AS refId, created_at AS createdAt
       FROM passenger_point_ledger
       WHERE passenger_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [passengerId, pageSize, skip],
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
      passenger: {
        id: passenger.id,
        displayName: passenger.displayName,
        pointsBalance: Math.round(Number(passenger.pointsBalance ?? 0)),
      },
      ...paginated(items, total, page, pageSize),
    };
  }

  private async assertPhoneAvailable(excludePassengerId: string, rawPhone: string) {
    const phone = normalizePhoneE164(rawPhone);
    const variants = phoneLookupVariants(phone);
    const taken = await this.repo.findOne({ where: { phone: In(variants), isActive: true } });
    if (taken && taken.id !== excludePassengerId) {
      throw new BadRequestException('此電話已被其他乘客使用');
    }
    return phone;
  }

  async create(_adminId: number, input: { displayName?: string; phone?: string; email?: string }) {
    let phone: string | null = null;
    if (input.phone?.trim()) {
      phone = await this.assertPhoneAvailable('__new__', input.phone);
    }
    const row = await this.repo.save(
      this.repo.create({
        displayName: input.displayName ?? null,
        email: input.email ?? null,
        isActive: true,
        phone,
        appClientId: null,
      }),
    );
    return row;
  }

  async update(
    _adminId: number,
    id: string,
    input: { displayName?: string; phone?: string; email?: string },
  ) {
    const row = await this.repo.findOneBy({ id });
    if (!row || !row.isActive) throw new NotFoundException('乘客不存在');
    if (input.displayName !== undefined) row.displayName = input.displayName || null;
    if (input.email !== undefined) row.email = input.email || null;
    if (input.phone !== undefined) {
      const trimmed = input.phone?.trim() ?? '';
      if (!trimmed) {
        row.phone = null;
      } else {
        row.phone = await this.assertPhoneAvailable(id, trimmed);
      }
    }
    return this.repo.save(row);
  }

  async remove(_adminId: number, id: string) {
    const row = await this.repo.findOneBy({ id });
    if (!row) throw new NotFoundException('乘客不存在');
    row.isActive = false;
    await this.repo.save(row);
    return { ok: true };
  }
}
