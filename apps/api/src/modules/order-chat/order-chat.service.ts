import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { OrderEntity } from '../orders/order.entity';
import { OneSignalDriverService } from '../notifications/onesignal-driver.service';
import { OneSignalPassengerService } from '../notifications/onesignal-passenger.service';
import { OrderNotificationsService } from '../realtime/order-notifications.service';
import { OrderChatMessageEntity, type OrderChatSenderRole } from './order-chat-message.entity';
import {
  PassengerOrderChatQuickReplyEntity,
  type PassengerChatQuickReplyAction,
} from './passenger-order-chat-quick-reply.entity';

const CHAT_ACTIVE_STATUSES: OrderEntity['status'][] = ['accepted', 'en_route', 'in_trip'];

export type OrderChatMessageDto = {
  id: string;
  orderId: string;
  senderRole: OrderChatSenderRole;
  body: string;
  createdAt: string;
};

@Injectable()
export class OrderChatService {
  private readonly log = new Logger(OrderChatService.name);

  constructor(
    @InjectRepository(OrderChatMessageEntity)
    private readonly messages: Repository<OrderChatMessageEntity>,
    @InjectRepository(PassengerOrderChatQuickReplyEntity)
    private readonly quickReplies: Repository<PassengerOrderChatQuickReplyEntity>,
    @InjectRepository(OrderEntity) private readonly orders: Repository<OrderEntity>,
    private readonly orderNotifications: OrderNotificationsService,
    private readonly oneSignalPassenger: OneSignalPassengerService,
    private readonly oneSignalDriver: OneSignalDriverService,
  ) {}

  private toDto(row: OrderChatMessageEntity): OrderChatMessageDto {
    return {
      id: String(row.id),
      orderId: String(row.orderId),
      senderRole: row.senderRole,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async requireOrder(orderId: string): Promise<OrderEntity> {
    const order = await this.orders.findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('柯打不存在');
    return order;
  }

  private assertChatAllowed(order: OrderEntity) {
    if (!CHAT_ACTIVE_STATUSES.includes(order.status)) {
      throw new BadRequestException('此柯打狀態不可使用訊息');
    }
    if (!order.driverId || !order.passengerId) {
      throw new BadRequestException('尚未配對司機或乘客');
    }
  }

  async purgeForOrder(orderId: string) {
    await this.messages.delete({ orderId });
  }

  async listQuickRepliesForPassengerApp() {
    const rows = await this.quickReplies.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    return rows.map((r) => ({
      id: r.id,
      labelZh: r.labelZh,
      labelEn: r.labelEn,
      actionType: r.actionType,
    }));
  }

  async listQuickRepliesAdmin() {
    return this.quickReplies.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  async createQuickReply(input: {
    labelZh: string;
    labelEn?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    actionType?: PassengerChatQuickReplyAction;
  }) {
    const row = this.quickReplies.create({
      labelZh: input.labelZh.trim(),
      labelEn: input.labelEn?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
      actionType: input.actionType ?? 'message',
    });
    return this.quickReplies.save(row);
  }

  async updateQuickReply(
    id: number,
    patch: Partial<{
      labelZh: string;
      labelEn: string | null;
      sortOrder: number;
      isActive: boolean;
      actionType: PassengerChatQuickReplyAction;
    }>,
  ) {
    const row = await this.quickReplies.findOneBy({ id });
    if (!row) throw new NotFoundException('快捷訊息不存在');
    if (patch.labelZh !== undefined) row.labelZh = patch.labelZh.trim();
    if (patch.labelEn !== undefined) row.labelEn = patch.labelEn?.trim() || null;
    if (patch.sortOrder !== undefined) row.sortOrder = patch.sortOrder;
    if (patch.isActive !== undefined) row.isActive = patch.isActive;
    if (patch.actionType !== undefined) row.actionType = patch.actionType;
    return this.quickReplies.save(row);
  }

  async deleteQuickReply(id: number) {
    const row = await this.quickReplies.findOneBy({ id });
    if (!row) throw new NotFoundException('快捷訊息不存在');
    await this.quickReplies.remove(row);
    return { ok: true };
  }

  async countUnreadForPassenger(orderId: string, passengerId: string) {
    const order = await this.requireOrder(orderId);
    if (order.passengerId !== passengerId) throw new ForbiddenException();
    if (!CHAT_ACTIVE_STATUSES.includes(order.status)) return 0;
    return this.messages.count({
      where: { orderId, senderRole: 'driver', passengerReadAt: IsNull() },
    });
  }

  async countUnreadForDriver(orderId: string, driverId: string) {
    const order = await this.requireOrder(orderId);
    if (order.driverId !== driverId) throw new ForbiddenException();
    if (!CHAT_ACTIVE_STATUSES.includes(order.status)) return 0;
    return this.messages.count({
      where: { orderId, senderRole: 'passenger', driverReadAt: IsNull() },
    });
  }

  async listForPassenger(orderId: string, passengerId: string) {
    const order = await this.requireOrder(orderId);
    if (order.passengerId !== passengerId) throw new ForbiddenException();
    this.assertChatAllowed(order);
    const rows = await this.messages.find({
      where: { orderId },
      order: { id: 'ASC' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async listForDriver(orderId: string, driverId: string) {
    const order = await this.requireOrder(orderId);
    if (order.driverId !== driverId) throw new ForbiddenException();
    this.assertChatAllowed(order);
    const rows = await this.messages.find({
      where: { orderId },
      order: { id: 'ASC' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async listForAdmin(orderId: string) {
    const order = await this.requireOrder(orderId);
    if (!CHAT_ACTIVE_STATUSES.includes(order.status)) {
      return [];
    }
    const rows = await this.messages.find({
      where: { orderId },
      order: { id: 'ASC' },
    });
    return rows.map((r) => this.toDto(r));
  }

  private async emitNewMessage(order: OrderEntity, dto: OrderChatMessageDto) {
    if (!order.driverId || !order.passengerId) return;
    this.orderNotifications.emitOrderChatMessage({
      orderId: order.id,
      passengerId: order.passengerId,
      driverId: order.driverId,
      message: dto,
    });
    if (dto.senderRole === 'driver') {
      void this.oneSignalPassenger
        .sendOrderChatFromDriver(order.passengerId, order.id, dto.body)
        .then((result) => {
          if (result.errors.length) {
            this.log.warn(
              `乘客 ${order.passengerId} 行程訊息 push 失敗：${result.errors.slice(0, 3).join('；')}`,
            );
          } else if (result.sent === 0) {
            this.log.debug(
              `乘客 ${order.passengerId} 行程訊息 push 未送出（可能未訂閱 OneSignal 或 API 未設定）`,
            );
          }
        });
    } else {
      void this.oneSignalDriver.sendOrderChatFromPassenger(order.driverId, order.id, dto.body);
    }
  }

  async sendFromPassenger(
    orderId: string,
    passengerId: string,
    body: string,
    options?: { quickReplyId?: number },
  ) {
    const order = await this.requireOrder(orderId);
    if (order.passengerId !== passengerId) throw new ForbiddenException();
    this.assertChatAllowed(order);

    let text = body.trim();
    let actionType: PassengerChatQuickReplyAction = 'message';
    if (options?.quickReplyId != null) {
      const qr = await this.quickReplies.findOneBy({ id: options.quickReplyId, isActive: true });
      if (!qr) throw new BadRequestException('快捷訊息不存在');
      text = qr.labelZh.trim();
      actionType = qr.actionType;
    }
    if (!text) throw new BadRequestException('訊息不可為空');
    if (text.length > 500) throw new BadRequestException('訊息過長');

    const row = await this.messages.save(
      this.messages.create({
        orderId,
        senderRole: 'passenger',
        body: text,
        passengerReadAt: new Date(),
        driverReadAt: null,
      }),
    );
    const dto = this.toDto(row);
    await this.emitNewMessage(order, dto);
    return {
      message: dto,
      cancelOrder: actionType === 'cancel_order',
      releaseToHall: actionType === 'release_to_hall',
    };
  }

  async sendFromDriver(orderId: string, driverId: string, body: string) {
    const order = await this.requireOrder(orderId);
    if (order.driverId !== driverId) throw new ForbiddenException();
    this.assertChatAllowed(order);
    const text = body.trim();
    if (!text) throw new BadRequestException('訊息不可為空');
    if (text.length > 500) throw new BadRequestException('訊息過長');

    const row = await this.messages.save(
      this.messages.create({
        orderId,
        senderRole: 'driver',
        body: text,
        driverReadAt: new Date(),
        passengerReadAt: null,
      }),
    );
    const dto = this.toDto(row);
    await this.emitNewMessage(order, dto);
    return { message: dto };
  }

  async markReadByPassenger(orderId: string, passengerId: string) {
    const order = await this.requireOrder(orderId);
    if (order.passengerId !== passengerId) throw new ForbiddenException();
    await this.messages
      .createQueryBuilder()
      .update()
      .set({ passengerReadAt: () => 'CURRENT_TIMESTAMP' })
      .where('order_id = :orderId', { orderId })
      .andWhere('sender_role = :role', { role: 'driver' })
      .andWhere('passenger_read_at IS NULL')
      .execute();
    return { ok: true };
  }

  async markReadByDriver(orderId: string, driverId: string) {
    const order = await this.requireOrder(orderId);
    if (order.driverId !== driverId) throw new ForbiddenException();
    await this.messages
      .createQueryBuilder()
      .update()
      .set({ driverReadAt: () => 'CURRENT_TIMESTAMP' })
      .where('order_id = :orderId', { orderId })
      .andWhere('sender_role = :role', { role: 'passenger' })
      .andWhere('driver_read_at IS NULL')
      .execute();
    return { ok: true };
  }
}
