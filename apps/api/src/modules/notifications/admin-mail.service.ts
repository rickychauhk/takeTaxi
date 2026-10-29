import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

const DEFAULT_ADMIN_ALERT_EMAIL = 'yranma26@gmail.com';

@Injectable()
export class AdminMailService {
  private readonly log = new Logger(AdminMailService.name);
  private transporter: nodemailer.Transporter | null = null;

  private getAlertRecipient(): string {
    return process.env.ADMIN_ALERT_EMAIL?.trim() || DEFAULT_ADMIN_ALERT_EMAIL;
  }

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;
    const host = process.env.SMTP_HOST?.trim();
    const portRaw = process.env.SMTP_PORT?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    if (!host || !user || !pass) {
      return null;
    }
    const port = portRaw ? Number(portRaw) : 587;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
    return this.transporter;
  }

  async sendPlainText(subject: string, body: string, to?: string): Promise<boolean> {
    const recipient = to?.trim() || this.getAlertRecipient();
    const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || 'noreply@taxima.hk';
    const tx = this.getTransporter();
    if (!tx) {
      this.log.warn(
        `略過寄信（未設定 SMTP_HOST/SMTP_USER/SMTP_PASS）：${subject} → ${recipient}`,
      );
      return false;
    }
    try {
      await tx.sendMail({ from, to: recipient, subject, text: body });
      return true;
    } catch (e) {
      this.log.warn(`寄信失敗 ${subject}: ${String(e)}`);
      return false;
    }
  }

  async sendDriverFarPickupAcceptAlert(payload: Record<string, unknown>): Promise<boolean> {
    const orderId = String(payload.orderId ?? '—');
    const distanceKm = payload.distanceKmFromPickup;
    const subject = `[搭的] 司機接單距離上車點過遠 · 柯打 #${orderId} · ${distanceKm} km`;
    const body = [
      '司機在大廳接單時，GPS 距離乘客上車點超過 5 公里。',
      '（預約單不會觸發此通知）',
      '',
      `環境：${process.env.TAXIMA_ENV?.trim() || process.env.NODE_ENV || 'unknown'}`,
      `距離：${distanceKm} km（門檻 5 km）`,
      '',
      '— 訂單／司機／乘客快照 —',
      JSON.stringify(payload, null, 2),
    ].join('\n');
    return this.sendPlainText(subject, body);
  }
}
