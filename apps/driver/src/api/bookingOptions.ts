import { getApiBaseUrl } from './config';

export type BookingOptionDto = {
  id: number;
  code: string;
  labelZh: string;
  labelEn: string;
  iconKey: string | null;
  sortOrder: number;
};

export type BookingOptionCategoryDto = {
  id: number;
  code: string;
  labelZh: string;
  labelEn: string;
  selectionMode: 'single' | 'multi';
  displayStyle: 'chip' | 'tunnel' | 'vehicle';
  screenGroup: 'preferences' | 'extras';
  sortOrder: number;
  options: BookingOptionDto[];
};

export type BookingOptionsPayload = {
  categories: BookingOptionCategoryDto[];
};

export async function fetchBookingOptions(): Promise<BookingOptionsPayload> {
  const res = await fetch(`${getApiBaseUrl()}/passenger/booking-options`);
  if (!res.ok) return { categories: [] };
  const data = (await res.json()) as BookingOptionsPayload;
  return { categories: Array.isArray(data.categories) ? data.categories : [] };
}
