import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { paginated } from '../../common/pagination';
import { AdminUserEntity } from '../admin-auth/admin-user.entity';
import { AuditLogEntity } from './audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repo: Repository<AuditLogEntity>,
    @InjectRepository(AdminUserEntity)
    private readonly admins: Repository<AdminUserEntity>,
  ) {}

  async log(input: {
    actorType: AuditLogEntity['actorType'];
    actorId?: number | null;
    action: string;
    resourceType?: string;
    resourceId?: string;
    payload?: unknown;
    ip?: string;
  }) {
    const row = this.repo.create({
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      action: input.action,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      payload: input.payload ?? null,
      ipAddress: input.ip ?? null,
    });
    await this.repo.save(row);
  }

  async listAdmin(query: { page?: number; pageSize?: number; action?: string }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 30));
    const qb = this.repo.createQueryBuilder('a').orderBy('a.created_at', 'DESC');
    if (query.action?.trim()) {
      qb.andWhere('a.action LIKE :action', { action: `%${query.action.trim()}%` });
    }
    const [rows, total] = await qb.skip((page - 1) * pageSize).take(pageSize).getManyAndCount();

    const adminIds = [
      ...new Set(
        rows.filter((r) => r.actorType === 'admin' && r.actorId != null).map((r) => r.actorId as number),
      ),
    ];
    const adminRows =
      adminIds.length > 0
        ? await this.admins.find({
            where: { id: In(adminIds) },
            select: ['id', 'displayName', 'email', 'phone'],
          })
        : [];
    const adminById = new Map(adminRows.map((a) => [a.id, a]));

    const items = rows.map((r) => {
      const admin =
        r.actorType === 'admin' && r.actorId != null ? adminById.get(r.actorId) : undefined;
      const actorDisplayName =
        admin?.displayName?.trim() ||
        admin?.phone?.trim() ||
        admin?.email?.trim() ||
        (r.actorId != null ? `#${r.actorId}` : null);
      return {
        id: r.id,
        actorType: r.actorType,
        actorId: r.actorId,
        actorDisplayName,
        action: r.action,
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        payload: r.payload,
        ipAddress: r.ipAddress,
        createdAt: r.createdAt,
      };
    });
    return paginated(items, total, page, pageSize);
  }
}
