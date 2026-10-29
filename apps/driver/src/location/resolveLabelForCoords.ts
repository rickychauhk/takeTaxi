import { addressForCrmDisplay } from '@taxima/shared';
import * as Location from 'expo-location';
import { t } from '../i18n';
import { formatGeocodedAddress } from './formatAddress';
import { reverseGeocodeChinese, reverseGeocodeGoogle } from './reverseGeocodeChinese';
import { withTimeout } from './withTimeout';

function hasCjk(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text);
}

const REVERSE_GEOCODE_MS = 5_000;

/** 司機 App 介面一律顯示繁中地址（唔用系統英文 reverse geocode） */
export async function resolveLabelForCoords(latitude: number, longitude: number): Promise<string> {
  const coordFallback = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  let label = coordFallback;

  const fromGoogle =
    (await reverseGeocodeGoogle(latitude, longitude, 'zh-HK')) ??
    (await reverseGeocodeChinese(latitude, longitude));
  if (fromGoogle?.trim() && hasCjk(fromGoogle)) {
    return fromGoogle.trim();
  }

  try {
    const places = await withTimeout(
      Location.reverseGeocodeAsync({ latitude, longitude }),
      REVERSE_GEOCODE_MS,
    );
    const formatted = places[0] ? formatGeocodedAddress(places[0]) : '';
    if (formatted && hasCjk(formatted)) {
      label = formatted;
    }
  } catch {
    /* keep coords */
  }

  if (!hasCjk(label)) {
    const zhDemo = addressForCrmDisplay(label, latitude, longitude);
    if (zhDemo?.trim() && hasCjk(zhDemo)) {
      label = zhDemo.trim();
    }
  }

  if (!hasCjk(label)) {
    for (const language of ['zh-TW', 'zh-CN'] as const) {
      const alt = await reverseGeocodeGoogle(latitude, longitude, language);
      if (alt?.trim() && hasCjk(alt)) {
        label = alt.trim();
        break;
      }
    }
  }

  if (!hasCjk(label) && fromGoogle?.trim() && hasCjk(fromGoogle)) {
    label = fromGoogle.trim();
  }

  if (!label.trim() || label === coordFallback) {
    if (!label.trim()) label = t('address.unknown');
  }
  return label;
}
