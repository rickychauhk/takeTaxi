import type { BookingOptionCategoryDto } from '../api/bookingOptions';

const REGULAR_PRICE_OPTION_CODES = new Set(['seats_5', 'seats_6']);

export function optionRequiresRegularPrice(option: { code: string; labelZh: string }): boolean {
  if (REGULAR_PRICE_OPTION_CODES.has(option.code)) return true;
  return /五座|六座/.test(option.labelZh);
}

export function bookingExtrasRequireRegularPrice(
  categories: BookingOptionCategoryDto[],
  selectedOptionIds: number[],
): boolean {
  const idSet = new Set(selectedOptionIds);
  for (const cat of categories) {
    for (const opt of cat.options) {
      if (!idSet.has(opt.id)) continue;
      if (optionRequiresRegularPrice(opt)) return true;
    }
  }
  return false;
}

export function optionIsWheelchair(option: {
  code: string;
  iconKey?: string | null;
  labelZh: string;
}): boolean {
  if (option.code === 'wheelchair' || option.code === 'wheelchair_other') return true;
  if (option.iconKey?.includes('wheelchair')) return true;
  return /輪椅/.test(option.labelZh);
}

export function bookingSelectionIncludesWheelchair(
  categories: BookingOptionCategoryDto[],
  selectedOptionIds: number[],
): boolean {
  const idSet = new Set(selectedOptionIds);
  for (const cat of categories) {
    for (const opt of cat.options) {
      if (!idSet.has(opt.id)) continue;
      if (optionIsWheelchair(opt)) return true;
    }
  }
  return false;
}
