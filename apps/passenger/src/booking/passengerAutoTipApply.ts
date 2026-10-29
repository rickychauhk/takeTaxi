import type { PassengerAutoTipHkdPublic } from '@taxima/shared';
import type { BookingOptionCategoryDto } from '../api/bookingOptions';
import { bookingSelectionIncludesWheelchair, optionIsWheelchair } from './regularPriceRules';

function optionIsLargeLuggage(option: { code: string; labelZh: string }): boolean {
  if (option.code === 'large_trunk') return true;
  return /大尾箱|多行李/.test(option.labelZh);
}

/** 輪椅、5座、6座、大尾箱：勾選時須彈出貼士 picker */
export function optionTriggersAutoTipPicker(option: {
  code: string;
  iconKey?: string | null;
  labelZh: string;
}): boolean {
  if (option.code === 'seats_5' || option.code === 'seats_6') return true;
  if (optionIsLargeLuggage(option)) return true;
  return optionIsWheelchair(option);
}

export function autoTipHkdForBookingOption(
  config: PassengerAutoTipHkdPublic,
  option: { code: string; iconKey?: string | null; labelZh: string },
): number {
  if (optionIsWheelchair(option)) return config.wheelchairTipHkd;
  if (option.code === 'seats_5') return config.fiveSeatTipHkd;
  if (option.code === 'seats_6') return config.sixSeatTipHkd;
  if (optionIsLargeLuggage(option)) return config.largeLuggageTipHkd;
  return 0;
}

function selectedOptionCodes(
  categories: BookingOptionCategoryDto[],
  selectedOptionIds: number[],
): Set<string> {
  const idSet = new Set(selectedOptionIds);
  const codes = new Set<string>();
  for (const cat of categories) {
    for (const opt of cat.options) {
      if (idSet.has(opt.id)) codes.add(opt.code);
    }
  }
  return codes;
}

function includesLargeLuggage(codes: Set<string>, categories: BookingOptionCategoryDto[]): boolean {
  if (codes.has('large_trunk')) return true;
  for (const cat of categories) {
    for (const opt of cat.options) {
      if (!codes.has(opt.code)) continue;
      if (opt.code === 'large_trunk') return true;
      if (/大尾箱|多行李/.test(opt.labelZh)) return true;
    }
  }
  return false;
}

/** 依目前選項計算應套用的自動貼士（多項同時符合時取最高金額） */
export function computeRequiredPassengerAutoTipHkd(
  config: PassengerAutoTipHkdPublic,
  categories: BookingOptionCategoryDto[],
  selectedOptionIds: number[],
  safeDriving: boolean,
  reviewSixSeatSelected: boolean,
): number {
  const codes = selectedOptionCodes(categories, selectedOptionIds);
  const amounts: number[] = [];

  if (bookingSelectionIncludesWheelchair(categories, selectedOptionIds)) {
    amounts.push(config.wheelchairTipHkd);
  }
  if (safeDriving) {
    amounts.push(config.safeDrivingTipHkd);
  }
  if (codes.has('seats_5')) {
    amounts.push(config.fiveSeatTipHkd);
  }
  if (codes.has('seats_6') || reviewSixSeatSelected) {
    amounts.push(config.sixSeatTipHkd);
  }
  if (includesLargeLuggage(codes, categories)) {
    amounts.push(config.largeLuggageTipHkd);
  }

  if (amounts.length === 0) return 0;
  return Math.max(...amounts.map((n) => Math.max(0, Math.round(n))));
}
