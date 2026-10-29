import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  PASSENGER_NEARBY_DRIVERS_RADIUS_KM_OPTIONS,
  PASSENGER_NEARBY_DRIVERS_RADIUS_KM_SETTING_KEY,
  PASSENGER_TIP_HKD_FIVE_SEAT_DEFAULT,
  PASSENGER_TIP_HKD_FIVE_SEAT_SETTING_KEY,
  PASSENGER_TIP_HKD_LARGE_LUGGAGE_DEFAULT,
  PASSENGER_TIP_HKD_LARGE_LUGGAGE_SETTING_KEY,
  PASSENGER_TIP_HKD_SAFE_DRIVING_DEFAULT,
  PASSENGER_TIP_HKD_SAFE_DRIVING_SETTING_KEY,
  PASSENGER_TIP_HKD_SIX_SEAT_DEFAULT,
  PASSENGER_TIP_HKD_SIX_SEAT_SETTING_KEY,
  PASSENGER_TIP_HKD_WHEELCHAIR_DEFAULT,
  PASSENGER_TIP_HKD_WHEELCHAIR_SETTING_KEY,
  isPassengerAutoTipSettingKey,
  parsePassengerAutoTipHkd,
  parsePassengerNearbyDriversRadiusKm,
  passengerNearbyDriversRadiusMeters,
} from '@taxima/shared';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DRIVER_HALL_PRIORITY_PREVIEW_SECONDS_MAX,
  DRIVER_HALL_PRIORITY_PREVIEW_SECONDS_SETTING_KEY,
  parseDriverHallPriorityPreviewSeconds,
} from '@taxima/shared';
import { GEMINI_API_KEY_SETTING } from '../ai/gemini-models';
import { maskGeminiApiKeyForDisplay } from '../ai/gemini-key.util';
import { SystemSettingEntity } from './system-setting.entity';

export const DRIVER_POINTS_TOPUP_INSTRUCTIONS_KEY = 'driver_points_topup_instructions';
export const DRIVER_POINTS_TOPUP_PAYMENT_METHODS_KEY = 'driver_points_topup_payment_methods';
export const PASSENGER_COMPANY_PRICE_NOTICE_HTML_KEY = 'passenger_company_price_notice_html';
export const PASSENGER_RIDE_TIPS_HTML_KEY = 'passenger_ride_tips_html';
export {
  PASSENGER_TIP_HKD_FIVE_SEAT_SETTING_KEY,
  PASSENGER_TIP_HKD_LARGE_LUGGAGE_SETTING_KEY,
  PASSENGER_TIP_HKD_SAFE_DRIVING_SETTING_KEY,
  PASSENGER_TIP_HKD_SIX_SEAT_SETTING_KEY,
  PASSENGER_TIP_HKD_WHEELCHAIR_SETTING_KEY,
};

export type DriverPointsTopupPaymentMethod = {
  id: string;
  title: string;
  detail: string;
};

const DEFAULT_TERMS_DRIVER_HTML = `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:16px;line-height:1.6;margin:0;color:#222;}img{max-width:100%;height:auto;}</style></head><body><h1>搭的 · 司機版使用條款</h1><p>使用本 App 即表示你同意以下條款。</p><ol><li>你須為 CRM 登記之有效司機，並保持帳戶及車輛資料正確。</li><li>接單後須依平台流程完成行程；已接柯打不可由司機自行取消。</li><li>接單、懸賞及繁忙時段等積分規則以後台設定為準。</li></ol></body></html>`;

const DEFAULT_TERMS_PASSENGER_HTML = `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:16px;line-height:1.6;margin:0;color:#222;}img{max-width:100%;height:auto;}</style></head><body><h1>搭的 · 乘客版使用條款</h1><p>使用本 App 即表示你同意以下條款。</p><ol><li>你須提供真實聯絡電話以完成叫車及帳戶驗證。</li><li>請準時於上車點等候；惡意取消或濫用平台可能導致帳戶受限。</li><li>行程費用、積分抵扣及優惠以 App 及後台設定為準。</li></ol></body></html>`;

const DEFAULT_RIDE_TIPS_HTML = `<p><strong>搭車秘笈</strong></p>
<ul>
  <li>落單前確認上車點同目的地，必要時喺備註寫清楚座數或特殊需要。</li>
  <li>等候司機接單時請保持 App 開啟，方便司機聯絡你。</li>
  <li>如需代他人叫車，可勾選「幫人 call 車」並填寫客人 8 位電話。</li>
  <li>行程中如有問題，可透過 App 訊息或致電司機；緊急情況請致電 999。</li>
</ul>`;

const DEFAULT_COMPANY_PRICE_NOTICE_HTML = `<p><strong>公司價收費</strong></p>
<ul>
  <li>預估 $94 或以上：85 折</li>
  <li>預估 $80－$93：固定 $80</li>
  <li>預估不足 $80：按 App 預估收費</li>
</ul>
<p>附加費（隧道費、行李等）及多站行程另計。請向司機索取收據。</p>
<p>落單後請致電司機確認價錢，多謝配合 🙏</p>`;

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SystemSettingEntity)
    private readonly repo: Repository<SystemSettingEntity>,
  ) {}

  async get(key: string) {
    const row = await this.repo.findOne({ where: { settingKey: key } });
    if (!row) throw new NotFoundException(`Setting ${key} not found`);
    return row;
  }

  /** Admin CRM: allow create flow when row does not exist yet */
  /** 伺服器內部用（含敏感設定），勿直接回傳給 CRM */
  async getRawSettingValue(key: string): Promise<string> {
    const row = await this.repo.findOne({ where: { settingKey: key } });
    return row?.settingValue?.trim() ?? '';
  }

  async getForAdmin(key: string) {
    const row = await this.repo.findOne({ where: { settingKey: key } });
    if (!row) {
      return { settingKey: key, settingValue: '' };
    }
    if (key === GEMINI_API_KEY_SETTING) {
      const raw = row.settingValue?.trim() ?? '';
      return {
        ...row,
        settingValue: raw ? maskGeminiApiKeyForDisplay(raw) : '',
      };
    }
    return row;
  }

  async getPublicContactHtml() {
    const row = await this.repo.findOne({ where: { settingKey: 'contact_us_html' } });
    return { html: row?.settingValue ?? '' };
  }

  async getPublicTermsHtml(app: 'passenger' | 'driver') {
    const key = app === 'passenger' ? 'terms_passenger_html' : 'terms_driver_html';
    const row = await this.repo.findOne({ where: { settingKey: key } });
    const stored = row?.settingValue?.trim() ?? '';
    if (stored) return { html: stored };
    return { html: app === 'driver' ? DEFAULT_TERMS_DRIVER_HTML : DEFAULT_TERMS_PASSENGER_HTML };
  }

  async getPublicPassengerCompanyPriceNoticeHtml() {
    const row = await this.repo.findOne({
      where: { settingKey: PASSENGER_COMPANY_PRICE_NOTICE_HTML_KEY },
    });
    const stored = row?.settingValue?.trim() ?? '';
    return { html: stored || DEFAULT_COMPANY_PRICE_NOTICE_HTML };
  }

  async getPublicPassengerRideTipsHtml() {
    const row = await this.repo.findOne({
      where: { settingKey: PASSENGER_RIDE_TIPS_HTML_KEY },
    });
    const stored = row?.settingValue?.trim() ?? '';
    return { html: stored || DEFAULT_RIDE_TIPS_HTML };
  }

  async getPublicPassengerAutoTipHkd() {
    const [
      wheelchairRow,
      safeDrivingRow,
      fiveSeatRow,
      sixSeatRow,
      largeLuggageRow,
    ] = await Promise.all([
      this.repo.findOne({ where: { settingKey: PASSENGER_TIP_HKD_WHEELCHAIR_SETTING_KEY } }),
      this.repo.findOne({ where: { settingKey: PASSENGER_TIP_HKD_SAFE_DRIVING_SETTING_KEY } }),
      this.repo.findOne({ where: { settingKey: PASSENGER_TIP_HKD_FIVE_SEAT_SETTING_KEY } }),
      this.repo.findOne({ where: { settingKey: PASSENGER_TIP_HKD_SIX_SEAT_SETTING_KEY } }),
      this.repo.findOne({ where: { settingKey: PASSENGER_TIP_HKD_LARGE_LUGGAGE_SETTING_KEY } }),
    ]);
    return {
      wheelchairTipHkd: parsePassengerAutoTipHkd(
        wheelchairRow?.settingValue,
        PASSENGER_TIP_HKD_WHEELCHAIR_DEFAULT,
      ),
      safeDrivingTipHkd: parsePassengerAutoTipHkd(
        safeDrivingRow?.settingValue,
        PASSENGER_TIP_HKD_SAFE_DRIVING_DEFAULT,
      ),
      fiveSeatTipHkd: parsePassengerAutoTipHkd(
        fiveSeatRow?.settingValue,
        PASSENGER_TIP_HKD_FIVE_SEAT_DEFAULT,
      ),
      sixSeatTipHkd: parsePassengerAutoTipHkd(
        sixSeatRow?.settingValue,
        PASSENGER_TIP_HKD_SIX_SEAT_DEFAULT,
      ),
      largeLuggageTipHkd: parsePassengerAutoTipHkd(
        largeLuggageRow?.settingValue,
        PASSENGER_TIP_HKD_LARGE_LUGGAGE_DEFAULT,
      ),
    };
  }

  async getPublicNewsUrl() {
    const row = await this.repo.findOne({ where: { settingKey: 'news_url' } });
    return { url: row?.settingValue ?? '' };
  }

  async getPassengerNearbyDriversRadiusKm() {
    const row = await this.repo.findOne({
      where: { settingKey: PASSENGER_NEARBY_DRIVERS_RADIUS_KM_SETTING_KEY },
    });
    return parsePassengerNearbyDriversRadiusKm(row?.settingValue);
  }

  async getPassengerNearbyDriversRadiusMeters() {
    return passengerNearbyDriversRadiusMeters(await this.getPassengerNearbyDriversRadiusKm());
  }

  async getPublicPassengerMapConfig() {
    const nearbyDriversRadiusKm = await this.getPassengerNearbyDriversRadiusKm();
    return {
      nearbyDriversRadiusKm,
      nearbyDriversRadiusM: passengerNearbyDriversRadiusMeters(nearbyDriversRadiusKm),
    };
  }

  parseDriverPointsTopupPaymentMethods(raw: string | null | undefined): DriverPointsTopupPaymentMethod[] {
    const text = raw?.trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed)) return [];
      const out: DriverPointsTopupPaymentMethod[] = [];
      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue;
        const id = String((item as { id?: unknown }).id ?? '').trim();
        const title = String((item as { title?: unknown }).title ?? '').trim();
        const detail = String((item as { detail?: unknown }).detail ?? '').trim();
        if (!id || !title) continue;
        out.push({ id, title, detail });
      }
      return out;
    } catch {
      return [];
    }
  }

  async getDriverPointsTopupPaymentMethods(): Promise<DriverPointsTopupPaymentMethod[]> {
    const row = await this.repo.findOne({ where: { settingKey: DRIVER_POINTS_TOPUP_PAYMENT_METHODS_KEY } });
    return this.parseDriverPointsTopupPaymentMethods(row?.settingValue);
  }

  async getPublicDriverPointsTopupInstructions() {
    const [instRow, paymentMethods] = await Promise.all([
      this.repo.findOne({ where: { settingKey: DRIVER_POINTS_TOPUP_INSTRUCTIONS_KEY } }),
      this.getDriverPointsTopupPaymentMethods(),
    ]);
    return {
      instructions: instRow?.settingValue?.trim() ?? '',
      paymentMethods,
    };
  }

  async upsert(adminId: number, key: string, value: string) {
    if (key === DRIVER_HALL_PRIORITY_PREVIEW_SECONDS_SETTING_KEY) {
      value = String(parseDriverHallPriorityPreviewSeconds(value));
      if (Number(value) > DRIVER_HALL_PRIORITY_PREVIEW_SECONDS_MAX) {
        throw new BadRequestException(`提前秒數不可超過 ${DRIVER_HALL_PRIORITY_PREVIEW_SECONDS_MAX}`);
      }
    }
    if (key === PASSENGER_NEARBY_DRIVERS_RADIUS_KM_SETTING_KEY) {
      const raw = Number(String(value).trim());
      if (
        !Number.isFinite(raw) ||
        !(PASSENGER_NEARBY_DRIVERS_RADIUS_KM_OPTIONS as readonly number[]).includes(raw)
      ) {
        throw new BadRequestException(
          `半徑須為 ${PASSENGER_NEARBY_DRIVERS_RADIUS_KM_OPTIONS.join('、')} 公里其中之一`,
        );
      }
      value = String(raw);
    }
    if (isPassengerAutoTipSettingKey(key)) {
      const n = parsePassengerAutoTipHkd(value, 0);
      if (n > 9999) {
        throw new BadRequestException('貼士金額不可超過 9999');
      }
      value = String(n);
    }
    let row = await this.repo.findOne({ where: { settingKey: key } });
    if (!row) {
      row = this.repo.create({ settingKey: key, settingValue: value, updatedByAdminId: adminId });
    } else {
      row.settingValue = value;
      row.updatedByAdminId = adminId;
    }
    await this.repo.save(row);
    return row;
  }
}
