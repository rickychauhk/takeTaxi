import { Injectable, Logger } from '@nestjs/common';

type NewOrderPushPayload = {
  orderId: string;
  pickupLabel: string;
  dropoffLabel: string;
};

@Injectable()
export class OneSignalDriverService {
  private readonly log = new Logger(OneSignalDriverService.name);

  private config(): { appId: string; apiKey: string } | null {
    const appId = process.env.ONESIGNAL_DRIVER_APP_ID?.trim();
    const apiKey = process.env.ONESIGNAL_DRIVER_REST_API_KEY?.trim();
    if (!appId || !apiKey) return null;
    return { appId, apiKey };
  }

  async sendTopupRejectedPush(driverId: string, reason: string): Promise<void> {
    const trimmed = reason.trim();
    const body = trimmed || '你的積分購買申請未獲批核，請重新提交或聯絡客服。';
    await this.sendDriverPush(driverId, {
      headings: { en: '積分購買未批核', 'zh-Hant': '積分購買未批核' },
      contents: { en: body, 'zh-Hant': body },
      data: { type: 'point_topup_rejected' },
    });
  }

  async sendTopupApprovedPush(driverId: string, amountPoints: string): Promise<void> {
    const pts = Math.round(Number(amountPoints));
    const body =
      Number.isFinite(pts) && pts > 0
        ? `已成功充值 ${pts.toLocaleString('zh-Hant')} 積分，可繼續接單。`
        : '積分充值已批核，可繼續接單。';
    await this.sendDriverPush(driverId, {
      headings: { en: '積分充值成功', 'zh-Hant': '積分充值成功' },
      contents: { en: body, 'zh-Hant': body },
      data: { type: 'point_topup_approved' },
    });
  }

  async sendCrmPush(
    driverIds: string[],
    title: string,
    body: string,
  ): Promise<{ sent: number; errors: string[] }> {
    const ids = [...new Set(driverIds.map((id) => String(id).trim()).filter(Boolean))];
    if (!ids.length) return { sent: 0, errors: [] };

    const errors: string[] = [];
    let sent = 0;
    const chunkSize = 2000;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const ok = await this.sendDriverPushBatch(chunk, {
        headings: { en: title, 'zh-Hant': title },
        contents: { en: body, 'zh-Hant': body },
        data: { type: 'crm_message' },
      });
      if (ok.ok) sent += chunk.length;
      else if (ok.error) errors.push(ok.error);
    }
    return { sent, errors };
  }

  /** 乘客快捷「不等」→ 柯打返回大廳，司機離開行程頁 */
  async sendPassengerWontWaitReleasedToHall(driverId: string, orderId: string): Promise<void> {
    const body = '乘客已選擇等候其他師傅，柯打已返回大廳。';
    await this.sendDriverPush(driverId, {
      headings: { en: '乘客不等', 'zh-Hant': '乘客不等' },
      contents: { en: body, 'zh-Hant': body },
      data: { type: 'order_passenger_wont_wait', orderId: String(orderId) },
      collapseId: `order-hall-${orderId}`,
      priority: 10,
    });
  }

  /** 乘客行程訊息 → 司機 push */
  async sendOrderChatFromPassenger(
    driverId: string,
    orderId: string,
    messageBody: string,
  ): Promise<void> {
    const preview = messageBody.trim().slice(0, 120) || '新訊息';
    await this.sendDriverPush(driverId, {
      headings: { en: '乘客訊息', 'zh-Hant': '乘客訊息' },
      contents: { en: preview, 'zh-Hant': preview },
      data: { type: 'order_chat', orderId: String(orderId) },
      collapseId: `order-chat-${orderId}`,
    });
  }

  async sendScheduledOrderReminderPush(
    driverId: string,
    payload: {
      orderId: string;
      pickupLabel: string;
      dropoffLabel: string;
      scheduledAtIso: string;
      minutesBefore: number;
    },
  ): Promise<void> {
    const pickup = payload.pickupLabel?.trim() || '上車點';
    const dropoff = payload.dropoffLabel?.trim() || '目的地';
    const mins = Math.round(payload.minutesBefore);
    const timeHint = payload.scheduledAtIso.trim().slice(0, 16).replace('T', ' ') || '預約時間';
    const body = `${timeHint} · ${pickup} → ${dropoff}（約 ${mins} 分鐘後）`;
    await this.sendDriverPush(driverId, {
      headings: { en: '預約柯打提醒', 'zh-Hant': '預約柯打提醒' },
      contents: { en: body, 'zh-Hant': body },
      data: {
        type: 'scheduled_order_reminder',
        orderId: payload.orderId,
        minutesBefore: String(mins),
      },
      collapseId: `order-sched-${payload.orderId}-${mins}`,
      priority: 10,
    });
  }

  async sendNewOrderPush(driverId: string, payload: NewOrderPushPayload): Promise<void> {
    const pickup = payload.pickupLabel?.trim() || '上車點';
    const dropoff = payload.dropoffLabel?.trim() || '目的地';
    const body = `${pickup} → ${dropoff}`;
    await this.sendDriverPush(driverId, {
      headings: { en: '新柯打', 'zh-Hant': '新柯打' },
      contents: { en: body, 'zh-Hant': body },
      data: { type: 'new_order', orderId: payload.orderId },
      collapseId: `order-${payload.orderId}`,
      priority: 10,
    });
  }

  private async sendDriverPushBatch(
    driverIds: string[],
    payload: {
      headings: Record<string, string>;
      contents: Record<string, string>;
      data?: Record<string, string>;
      collapseId?: string;
      priority?: number;
    },
  ): Promise<{ ok: boolean; error?: string }> {
    const cfg = this.config();
    if (!cfg) {
      this.log.debug('OneSignal 未設定，略過 push');
      return { ok: false, error: 'OneSignal 司機 App 未設定' };
    }
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
          include_aliases: { external_id: driverIds },
          headings: payload.headings,
          contents: payload.contents,
          data: payload.data,
          ...(process.env.ONESIGNAL_DRIVER_ANDROID_CHANNEL_ID?.trim()
            ? { android_channel_id: process.env.ONESIGNAL_DRIVER_ANDROID_CHANNEL_ID.trim() }
            : {}),
          ...(payload.priority != null ? { priority: payload.priority } : {}),
          ...(payload.collapseId ? { collapse_id: payload.collapseId } : {}),
        }),
      });
      const text = await res.text().catch(() => '');
      if (!res.ok) {
        const err = `HTTP ${res.status}: ${text.slice(0, 200)}`;
        this.log.warn(`OneSignal batch push 失敗 ${err}`);
        return { ok: false, error: err };
      }
      try {
        const body = JSON.parse(text) as { errors?: string[] };
        if (body.errors?.length) {
          return { ok: false, error: body.errors.join('; ') };
        }
      } catch {
        /* ok */
      }
      return { ok: true };
    } catch (e) {
      this.log.warn('OneSignal batch push 異常', e);
      return { ok: false, error: String(e) };
    }
  }

  private async sendDriverPush(
    driverId: string,
    payload: {
      headings: Record<string, string>;
      contents: Record<string, string>;
      data?: Record<string, string>;
      collapseId?: string;
      priority?: number;
    },
  ): Promise<void> {
    const result = await this.sendDriverPushBatch([String(driverId)], payload);
    if (!result.ok && result.error) {
      this.log.warn(`OneSignal push 失敗 driver=${driverId} ${result.error}`);
    }
  }
}
