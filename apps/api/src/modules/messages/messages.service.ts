import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  formatHongKongPhoneValidationMessage,
  validateHongKongLocalPhone,
} from '@taxima/shared';
import { formatHkDateTime } from '../orders/order-datetime-filter';
import { phoneLookupVariants } from '../admin-auth/phone.util';
import { DriverEntity } from '../drivers/driver.entity';
import { OneSignalDriverService } from '../notifications/onesignal-driver.service';
import { OneSignalPassengerService } from '../notifications/onesignal-passenger.service';
import { PassengerPushInboxService } from '../notifications/passenger-push-inbox.service';
import { PassengerEntity } from '../passengers/passenger.entity';
import { MessageEntity } from './message.entity';

export type MessageAudience = MessageEntity['audience'];
export type PhoneAppTarget = NonNullable<MessageEntity['phoneAppTarget']>;

export type SendAdminMessageInput = {
  audience: MessageAudience;
  title: string;
  body: string;
  phones?: string;
  phoneAppTarget?: PhoneAppTarget;
};

function parsePhoneLines(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean))];
}

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(MessageEntity) private readonly repo: Repository<MessageEntity>,
    @InjectRepository(DriverEntity) private readonly drivers: Repository<DriverEntity>,
    @InjectRepository(PassengerEntity) private readonly passengers: Repository<PassengerEntity>,
    private readonly oneSignalDriver: OneSignalDriverService,
    private readonly oneSignalPassenger: OneSignalPassengerService,
    private readonly passengerPushInbox: PassengerPushInboxService,
  ) {}

  list() {
    return this.repo.find({ order: { createdAt: 'DESC' }, take: 200 });
  }

  /** 乘客 App：經 OneSignal 發出的推播（以 passenger_push_inbox 為主，並補上遷移前 CRM 紀錄） */
  async listForPassenger(passengerId: string, passengerPhone: string | null) {
    const pid = String(passengerId);
    const inboxRows = await this.passengerPushInbox.listForPassenger(pid, 200);
    const inboxCrmIds = new Set(
      inboxRows.map((r) => r.crmMessageId).filter((id): id is string => !!id),
    );

    const items = inboxRows.map((r) => ({
      id: String(r.id),
      title: r.title,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
      createdAtHk: formatHkDateTime(r.createdAt),
      source: 'crm' as const,
    }));

    if (inboxRows.length < 200) {
      const legacyRows = await this.repo.find({
        where: { deliveryStatus: 'sent' },
        order: { createdAt: 'DESC' },
        take: 200,
      });
      for (const m of legacyRows) {
        if (inboxCrmIds.has(String(m.id))) continue;
        if (!this.messageAppliesToPassenger(m, pid, passengerPhone)) continue;
        items.push({
          id: String(m.id),
          title: m.title,
          body: m.body,
          createdAt: m.createdAt.toISOString(),
          createdAtHk: formatHkDateTime(m.createdAt),
          source: 'crm' as const,
        });
        if (items.length >= 200) break;
      }
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { items: items.slice(0, 200) };
  }

  private messageAppliesToPassenger(
    message: MessageEntity,
    _passengerId: string,
    passengerPhone: string | null,
  ): boolean {
    if (message.audience === 'all_drivers') return false;
    if (message.audience === 'all_passengers' || message.audience === 'all_members') {
      return true;
    }
    if (message.audience === 'phones') {
      return this.passengerMatchesPhoneTarget(message, passengerPhone);
    }
    return false;
  }

  private passengerMatchesPhoneTarget(
    message: MessageEntity,
    passengerPhone: string | null,
  ): boolean {
    if (!passengerPhone?.trim()) return false;
    const target = message.phoneAppTarget ?? 'both';
    if (target !== 'passenger' && target !== 'both') return false;
    let lines: string[] = [];
    try {
      const parsed = JSON.parse(message.targetPhones ?? '[]') as unknown;
      if (Array.isArray(parsed)) {
        lines = parsed.map((x) => String(x).trim()).filter(Boolean);
      }
    } catch {
      return false;
    }
    const passengerVariants = new Set(phoneLookupVariants(passengerPhone));
    for (const line of lines) {
      for (const v of phoneLookupVariants(line)) {
        if (passengerVariants.has(v)) return true;
      }
    }
    return false;
  }

  async send(adminId: number, input: SendAdminMessageInput) {
    const title = input.title?.trim();
    const body = input.body?.trim();
    if (!title) throw new BadRequestException('請填寫標題');
    if (!body) throw new BadRequestException('請填寫內容');

    const audience = input.audience;
    let phoneAppTarget = input.phoneAppTarget ?? 'both';
    const phoneLines =
      audience === 'phones' ? parsePhoneLines(input.phones) : [];

    if (audience === 'phones') {
      if (!phoneLines.length) throw new BadRequestException('請輸入至少一個電話號碼');
      for (const p of phoneLines) {
        const v = validateHongKongLocalPhone(p);
        if (!v.ok) {
          throw new BadRequestException(`${p}：${formatHongKongPhoneValidationMessage(v)}`);
        }
      }
    }

    const scope: MessageEntity['scope'] = audience === 'phones' ? 'direct' : 'broadcast';

    const saved = await this.repo.save(
      this.repo.create({
        scope,
        audience,
        targetPhones: phoneLines.length ? JSON.stringify(phoneLines) : null,
        phoneAppTarget: audience === 'phones' ? phoneAppTarget : null,
        title,
        body,
        sentByAdminId: adminId,
        deliveryStatus: 'queued',
        pushRecipientCount: null,
        pushDetail: null,
      }),
    );

    const { driverIds, passengerIds } = await this.resolveRecipientIds(
      audience,
      phoneLines,
      phoneAppTarget,
    );

    const totalTargets = driverIds.length + passengerIds.length;
    if (totalTargets === 0) {
      saved.deliveryStatus = 'failed';
      saved.pushRecipientCount = 0;
      saved.pushDetail = '找不到符合條件的司機或乘客';
      await this.repo.save(saved);
      return saved;
    }

    const errors: string[] = [];
    let pushSent = 0;

    if (driverIds.length) {
      const r = await this.oneSignalDriver.sendCrmPush(driverIds, title, body);
      pushSent += r.sent;
      errors.push(...r.errors.map((e) => `司機：${e}`));
    }
    if (passengerIds.length) {
      const r = await this.oneSignalPassenger.sendCrmPush(passengerIds, title, body, {
        crmMessageId: String(saved.id),
      });
      pushSent += r.sent;
      errors.push(...r.errors.map((e) => `乘客：${e}`));
    }

    saved.pushRecipientCount = totalTargets;
    saved.pushDetail = errors.length ? errors.slice(0, 8).join('\n') : null;
    saved.deliveryStatus =
      errors.length && pushSent === 0 ? 'failed' : errors.length ? 'sent' : 'sent';
    await this.repo.save(saved);
    return saved;
  }

  private async resolveRecipientIds(
    audience: MessageAudience,
    phoneLines: string[],
    phoneAppTarget: PhoneAppTarget,
  ): Promise<{ driverIds: string[]; passengerIds: string[] }> {
    if (audience === 'all_drivers') {
      const rows = await this.drivers.find({
        where: { isActive: true },
        select: ['id'],
      });
      return { driverIds: rows.map((d) => d.id), passengerIds: [] };
    }
    if (audience === 'all_passengers') {
      const rows = await this.passengers.find({
        where: { isActive: true },
        select: ['id'],
      });
      return { driverIds: [], passengerIds: rows.map((p) => p.id) };
    }
    if (audience === 'all_members') {
      const [drivers, passengers] = await Promise.all([
        this.drivers.find({ where: { isActive: true }, select: ['id'] }),
        this.passengers.find({ where: { isActive: true }, select: ['id'] }),
      ]);
      return {
        driverIds: drivers.map((d) => d.id),
        passengerIds: passengers.map((p) => p.id),
      };
    }

    const driverIds = new Set<string>();
    const passengerIds = new Set<string>();
    const wantDriver = phoneAppTarget === 'driver' || phoneAppTarget === 'both';
    const wantPassenger = phoneAppTarget === 'passenger' || phoneAppTarget === 'both';

    for (const line of phoneLines) {
      const variants = phoneLookupVariants(line);
      if (wantDriver) {
        const d = await this.drivers.findOne({
          where: { phone: In(variants), isActive: true },
          select: ['id'],
        });
        if (d) driverIds.add(d.id);
      }
      if (wantPassenger) {
        const p = await this.passengers.findOne({
          where: { phone: In(variants), isActive: true },
          select: ['id'],
        });
        if (p) passengerIds.add(p.id);
      }
    }

    return { driverIds: [...driverIds], passengerIds: [...passengerIds] };
  }
}
