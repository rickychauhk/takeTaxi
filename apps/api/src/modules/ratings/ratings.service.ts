import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginated } from '../../common/pagination';
import { DriverEntity } from '../drivers/driver.entity';
import { OrderEntity } from '../orders/order.entity';
import { PassengerEntity } from '../passengers/passenger.entity';
import { RatingDirection, RatingEntity } from './rating.entity';

function normalizeScore(raw: number): number {
  const n = Math.round(raw * 10) / 10;
  if (n < 1 || n > 5) {
    throw new BadRequestException('評分須介乎 1.0 至 5.0');
  }
  const halfSteps = Math.round(n * 2);
  if (Math.abs(n * 2 - halfSteps) > 1e-6) {
    throw new BadRequestException('評分須以 0.5 為單位');
  }
  return n;
}

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(RatingEntity) private readonly ratings: Repository<RatingEntity>,
    @InjectRepository(OrderEntity) private readonly orders: Repository<OrderEntity>,
    @InjectRepository(DriverEntity) private readonly drivers: Repository<DriverEntity>,
    @InjectRepository(PassengerEntity) private readonly passengers: Repository<PassengerEntity>,
  ) {}

  private directionLabel(d: RatingDirection) {
    return d === 'passenger_to_driver' ? '乘客 → 司機' : '司機 → 乘客';
  }

  private async mapRow(row: RatingEntity) {
    const [order, passenger, driver] = await Promise.all([
      this.orders.findOne({ where: { id: row.orderId } }),
      this.passengers.findOne({ where: { id: row.passengerId } }),
      this.drivers.findOne({ where: { id: row.driverId } }),
    ]);
    return {
      id: row.id,
      orderId: row.orderId,
      direction: row.direction,
      directionLabel: this.directionLabel(row.direction),
      passengerId: row.passengerId,
      driverId: row.driverId,
      passengerName: passenger?.displayName ?? null,
      driverPhone: driver?.phone ?? null,
      score: Number(row.score),
      comment: row.comment,
      createdAt: row.createdAt,
      orderStatus: order?.status ?? null,
    };
  }

  async getForOrder(orderId: string, direction: RatingDirection) {
    const row = await this.ratings.findOne({ where: { orderId, direction } });
    if (!row) return { score: null as number | null, comment: null as string | null };
    return { score: Number(row.score), comment: row.comment };
  }

  async listAdmin(query: { page?: number; pageSize?: number; orderId?: string; direction?: RatingDirection }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 20));
    const qb = this.ratings.createQueryBuilder('r').orderBy('r.created_at', 'DESC');
    if (query.orderId) qb.andWhere('r.order_id = :orderId', { orderId: query.orderId });
    if (query.direction) qb.andWhere('r.direction = :direction', { direction: query.direction });
    const [rows, total] = await qb.skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
    const items = await Promise.all(rows.map((r) => this.mapRow(r)));
    return paginated(items, total, page, pageSize);
  }

  async upsertForOrder(input: {
    orderId: string;
    direction: RatingDirection;
    score: number;
    comment?: string | null;
  }) {
    const order = await this.orders.findOne({ where: { id: input.orderId } });
    if (!order) throw new NotFoundException('找不到行程');
    if (!order.driverId || !order.passengerId) {
      throw new BadRequestException('行程須有乘客及司機才可評分');
    }
    if (order.status !== 'completed') {
      throw new BadRequestException('僅已完成行程可評分');
    }

    const score = normalizeScore(input.score);
    const existing = await this.ratings.findOne({
      where: { orderId: input.orderId, direction: input.direction },
    });
    if (existing) {
      existing.score = score.toFixed(1);
      existing.comment = input.comment?.trim() || null;
      await this.ratings.save(existing);
      return this.mapRow(existing);
    }

    try {
      const row = this.ratings.create({
        orderId: input.orderId,
        direction: input.direction,
        passengerId: order.passengerId,
        driverId: order.driverId,
        score: score.toFixed(1),
        comment: input.comment?.trim() || null,
      });
      await this.ratings.save(row);
      return this.mapRow(row);
    } catch {
      throw new ConflictException('此行程該方向已有評分');
    }
  }

  async updateAdmin(id: string, input: { score: number; comment?: string | null }) {
    const row = await this.ratings.findOne({ where: { id } });
    if (!row) throw new NotFoundException('找不到評分');
    return this.upsertForOrder({
      orderId: row.orderId,
      direction: row.direction,
      score: input.score,
      comment: input.comment,
    });
  }
}
