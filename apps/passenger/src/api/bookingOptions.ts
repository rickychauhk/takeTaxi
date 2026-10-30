import Constants from 'expo-constants';

const baseUrl =
  Constants.expoConfig?.extra?.apiBaseUrl ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  'https://app.hktaketaxi.online/api/v1';

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
  scheduledOrdersEnabled?: boolean;
  categories: BookingOptionCategoryDto[];
};

export async function fetchBookingOptions(): Promise<BookingOptionsPayload> {
  const res = await fetch(`${baseUrl}/passenger/booking-options`);
  if (!res.ok) return { categories: [], scheduledOrdersEnabled: true };
  const data = (await res.json()) as BookingOptionsPayload;
  return {
    scheduledOrdersEnabled: data.scheduledOrdersEnabled !== false,
    categories: Array.isArray(data.categories) ? data.categories : [],
  };
}
