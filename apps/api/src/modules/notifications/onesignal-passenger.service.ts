import { Injectable, Logger } from '@nestjs/common';
import {
  LOST_PROPERTY_EXPIRED_PUSH_BODY,
  LOST_PROPERTY_EXPIRED_PUSH_TITLE,
} from '../lost-property/lost-property.constants';
import { PassengerPushInboxService } from './passenger-push-inbox.service';

export type PassengerCrmPushMeta = {
  crmMessageId?: string | null;
  /** 預設 true：成功送出後寫入 passenger_push_inbox */
  recordInbox?: boolean;
  data?: Record<string, string>;
};

@Injectable()
export class OneSignalPassengerService {
  private readonly log = new Logger(OneSignalPassengerService.name);

  constructor(private readonly passengerInbox: PassengerPushInboxService) {}

  private config(): { appId: string; apiKey: string } | null {
    const appId = process.env.ONESIGNAL_APP_ID?.trim();
    const apiKey = process.env.ONESIGNAL_REST_API_KEY?.trim();
    if (!appId || !apiKey) return null;
    return { appId, apiKey };
  }

  async sendCrmPush(
    passengerIds: string[],
    title: string,
    body: string,
    meta?: PassengerCrmPushMeta,
  ): Promise<{ sent: number; errors: string[] }> {
    return this.sendToExternalIds(passengerIds, title, body, meta);
  }

  /** 司機行程訊息 → 乘客 push */
  async sendOrderChatFromDriver(passengerId: string, orderId: string, messageBody: string) {
    const preview = messageBody.trim().slice(0, 120) || '新訊息';
    return this.sendToExternalIds([passengerId], '司機訊息', preview, {
      recordInbox: false,
      data: { type: 'order_chat', orderId: String(orderId) },
    });
  }

  /** 失物協助 20 分鐘展示期結束 */
  async sendLostPropertyListingEnded(passengerId: string) {
    return this.sendToExternalIds(
      [passengerId],
      LOST_PROPERTY_EXPIRED_PUSH_TITLE,
      LOST_PROPERTY_EXPIRED_PUSH_BODY,
      { recordInbox: true, crmMessageId: null, data: { type: 'lost_property_expired' } },
    );
  }

  /** 預約用大廳逾時無人接單 → 系統自動取消 */
  async sendScheduledOrderAutoCancelled(passengerId: string, orderId: string) {
    return this.sendToExternalIds(
      [passengerId],
      '預約未能接單',
      '用車時間已過 2 分鐘仍無司機接單，系統已自動取消你的預約柯打。如需用車請重新落單。',
      {
        recordInbox: true,
        crmMessageId: null,
        data: { type: 'order_cancelled', orderId: String(orderId) },
      },
    );
  }

  /** 司機放出已接柯打 → 乘客重新等候接單 */
  async sendOrderReleasedToHall(passengerId: string, orderId: string) {
    return this.sendToExternalIds(
      [passengerId],
      '等候司機接單',
      '接單司機已將你的柯打放回大廳，請繼續等候其他司機接單。',
      { recordInbox: true, crmMessageId: null },
    );
  }

  private async sendToExternalIds(
    externalIds: string[],
    title: string,
    body: string,
    meta?: PassengerCrmPushMeta,
  ): Promise<{ sent: number; errors: string[] }> {
    const ids = [...new Set(externalIds.map((id) => String(id).trim()).filter(Boolean))];
    if (!ids.length) return { sent: 0, errors: [] };

    const recordInbox = meta?.recordInbox !== false;
    const crmMessageId = meta?.crmMessageId?.trim() || null;
    const persistInbox = async () => {
      if (!recordInbox) return;
      await this.passengerInbox.recordDeliveries(ids, title, body, crmMessageId);
    };

    const cfg = this.config();
    if (!cfg) {
      this.log.debug('OneSignal 乘客 App 未設定，略過 push');
      await persistInbox();
      return { sent: 0, errors: ['OneSignal 乘客 App 未設定'] };
    }

    const errors: string[] = [];
    let sent = 0;
    const deliveredIds: string[] = [];
    const chunkSize = 2000;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      try {
        const res = await fetch('https://api.onesignal.com/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Key ${cfg.apiKey}`,
          },
          body: JSON.stringify({
            app_id: cfg.appId,
            target_channel: 'push',
            include_aliases: { external_id: chunk },
            headings: { en: title, 'zh-Hant': title },
            contents: { en: body, 'zh-Hant': body },
            data: meta?.data ?? { type: 'crm_message' },
          }),
        });
        const text = await res.text().catch(() => '');
        if (!res.ok) {
          errors.push(`HTTP ${res.status}: ${text.slice(0, 200)}`);
          continue;
        }
        try {
          const parsed = JSON.parse(text) as { errors?: string[] };
          if (parsed.errors?.length) {
            errors.push(...parsed.errors.slice(0, 5));
          } else {
            sent += chunk.length;
            deliveredIds.push(...chunk);
          }
        } catch {
          sent += chunk.length;
          deliveredIds.push(...chunk);
        }
      } catch (e) {
        errors.push(String(e));
      }
    }
    /** App「訊息」列表以 DB 為準：即使未訂閱 push 或 OneSignal 失敗仍保留紀錄 */
    await persistInbox();
    return { sent, errors };
  }
}
