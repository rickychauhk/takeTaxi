import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeminiService, parsePointTopupReceiptTransferAt } from '../ai/gemini.service';
import { DriverPointPackageEntity } from '../driver-point-packages/driver-point-package.entity';
import { DriverEntity } from '../drivers/driver.entity';
import { SettingsService } from '../settings/settings.service';
import { PointTopupEntity } from './point-topup.entity';
import { PointTopupsService } from './point-topups.service';

const AUTO_REVIEW_NOTE_PREFIX = '[Gemini 3.8 Flash 自動審批]';

@Injectable()
export class PointTopupGeminiReviewService {
  private readonly log = new Logger(PointTopupGeminiReviewService.name);

  constructor(
    @InjectRepository(PointTopupEntity) private readonly topups: Repository<PointTopupEntity>,
    @InjectRepository(DriverEntity) private readonly drivers: Repository<DriverEntity>,
    @InjectRepository(DriverPointPackageEntity)
    private readonly packages: Repository<DriverPointPackageEntity>,
    private readonly settings: SettingsService,
    private readonly gemini: GeminiService,
    private readonly pointTopups: PointTopupsService,
  ) {}

  /** 司機提交或 CRM 觸發：待審積分充值 AI 審批 */
  scheduleReview(topupId: string) {
    void this.reviewPendingTopup(topupId).catch((e) => {
      this.log.warn(`topup ${topupId} Gemini 審批失敗，留待人工：${String(e)}`);
    });
  }

  async reviewPendingTopup(topupId: string): Promise<{ outcome: 'approved' | 'rejected' | 'skipped' | 'manual' }> {
    const topup = await this.topups.findOneBy({ id: topupId });
    if (!topup || topup.status !== 'pending') {
      return { outcome: 'skipped' };
    }

    const ctx = await this.buildReviewContext(topup);
    const receiptPath = topup.receiptImagePath?.trim() ?? '';
    let verdict: Awaited<ReturnType<GeminiService['analyzePointTopupReceipt']>> | null = null;

    if (receiptPath && ctx) {
      try {
        verdict = await this.gemini.analyzePointTopupReceipt({
          receiptImagePath: topup.receiptImagePath,
          expectedPoints: ctx.expectedPoints,
          expectedPriceHkd: ctx.expectedPriceHkd,
          packageLabel: ctx.packageLabel,
          paymentMethodTitle: ctx.paymentMethodTitle,
          paymentMethodDetail: ctx.paymentMethodDetail,
          driverDisplayName: ctx.driverDisplayName,
          driverPhone: ctx.driverPhone,
        });
        await this.persistTransferAtFromVerdict(topupId, verdict);
      } catch (e) {
        this.log.warn(`topup ${topupId} Gemini 審批呼叫失敗：${String(e)}`);
        await this.tryExtractTransferAtOnly(topupId, receiptPath);
      }
    } else if (receiptPath) {
      await this.tryExtractTransferAtOnly(topupId, receiptPath);
    }

    const hardReject = await this.runHardValidation(topup);
    if (hardReject) {
      await this.pointTopups.review(null, topupId, false, hardReject);
      return { outcome: 'rejected' };
    }

    if (!ctx || !verdict) {
      return { outcome: 'manual' };
    }

    try {
      if (
        verdict.approve &&
        verdict.receiptShowsTransferProof &&
        verdict.receiptAmountMatches &&
        verdict.receiptPayeeMatches
      ) {
        const note = `${AUTO_REVIEW_NOTE_PREFIX} ${verdict.summaryZh || '憑證與套餐、付款方式及金額核對一致。'}`;
        await this.pointTopups.review(null, topupId, true, note);
        return { outcome: 'approved' };
      }

      const reason =
        verdict.rejectReasonZh ||
        [
          !verdict.receiptShowsTransferProof ? '憑證不是有效轉帳紀錄' : null,
          !verdict.receiptAmountMatches ? '憑證金額與套餐不符' : null,
          !verdict.receiptPayeeMatches ? '收款資料與平台指定户口／FPS 不符' : null,
        ]
          .filter(Boolean)
          .join('；') ||
        '憑證未能通過自動核對';
      await this.pointTopups.review(null, topupId, false, reason);
      return { outcome: 'rejected' };
    } catch (e) {
      this.log.warn(`topup ${topupId} 審批寫入失敗：${String(e)}`);
      return { outcome: 'manual' };
    }
  }

  private async persistTransferAtFromVerdict(
    topupId: string,
    verdict: { receiptHasVisibleDatetime: boolean; receiptTransferAtIso: string },
  ) {
    if (!verdict.receiptHasVisibleDatetime) return;
    const transferAt = parsePointTopupReceiptTransferAt(verdict.receiptTransferAtIso);
    await this.pointTopups.saveReceiptTransferAt(topupId, transferAt);
  }

  private async tryExtractTransferAtOnly(topupId: string, receiptImagePath: string) {
    try {
      const extracted = await this.gemini.extractPointTopupReceiptTransferAt(receiptImagePath);
      await this.persistTransferAtFromVerdict(topupId, extracted);
    } catch (e) {
      this.log.warn(`topup ${topupId} 憑證日期提取失敗：${String(e)}`);
    }
  }

  private async runHardValidation(topup: PointTopupEntity): Promise<string | null> {
    const errors: string[] = [];
    if (!topup.receiptImagePath?.trim()) errors.push('未上傳轉帳憑證');
    const points = Math.round(Number(topup.amountPoints));
    if (!Number.isFinite(points) || points <= 0) errors.push('申請積分無效');
    const price = topup.priceHkd != null ? Number(topup.priceHkd) : NaN;
    if (!Number.isFinite(price) || price <= 0) errors.push('套餐金額缺失');

    if (topup.packageId) {
      const pkg = await this.packages.findOneBy({ id: topup.packageId });
      if (!pkg) {
        errors.push('所選積分套餐不存在');
      } else if (!pkg.isActive) {
        errors.push('所選積分套餐已下架');
      } else {
        if (points !== Math.round(Number(pkg.points))) {
          errors.push(`積分與套餐不符（套餐 ${pkg.points} 分，申請 ${points} 分）`);
        }
        const pkgPrice = Number(pkg.priceHkd);
        if (Number.isFinite(pkgPrice) && Math.abs(price - pkgPrice) > 0.009) {
          errors.push(`金額與套餐不符（套餐 HK$${pkgPrice}，申請 HK$${price}）`);
        }
      }
    }

    const method = await this.resolvePaymentMethod(topup);
    if (!method) {
      errors.push('付款方式無效或與平台設定不符');
    } else if (!method.detail.trim()) {
      errors.push('此付款方式未設定收款户口／FPS 資料，無法自動審批');
    }

    return errors.length ? errors.join('；') : null;
  }

  private async buildReviewContext(topup: PointTopupEntity) {
    const method = await this.resolvePaymentMethod(topup);
    if (!method?.detail.trim()) return null;

    const points = Math.round(Number(topup.amountPoints));
    const price = Number(topup.priceHkd);
    let packageLabel: string | null = null;
    if (topup.packageId) {
      const pkg = await this.packages.findOneBy({ id: topup.packageId });
      packageLabel = pkg?.label?.trim() || `${pkg?.points ?? points} 分`;
    }

    const driver = await this.drivers.findOneBy({ id: topup.driverId });

    return {
      expectedPoints: points,
      expectedPriceHkd: price,
      packageLabel,
      paymentMethodTitle: method.title,
      paymentMethodDetail: method.detail,
      driverDisplayName: driver?.displayName ?? null,
      driverPhone: driver?.phone ?? null,
    };
  }

  private async resolvePaymentMethod(topup: PointTopupEntity) {
    const methods = await this.settings.getDriverPointsTopupPaymentMethods();
    const id = topup.paymentMethodId?.trim();
    if (id) {
      const hit = methods.find((m) => m.id === id);
      if (hit) return hit;
    }
    const title = topup.bankName?.trim();
    if (title) {
      return methods.find((m) => m.title === title) ?? null;
    }
    return null;
  }
}
