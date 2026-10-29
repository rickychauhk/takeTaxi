import { snapLatLngToKnownHkPlace } from '@taxima/shared';
import * as Location from 'expo-location';
import { getAppLocale, mapsLanguageTag, t, type AppLocale } from '../i18n';
import { hasChineseAddressChars, isChinesePrimaryAddress } from './addressLocale';
import { formatGeocodedAddress } from './formatAddress';
import { ensureMinimumHkAreaInAddress } from './hkDisplayArea';
import { simplifyPassengerDisplayAddress } from './simplifyDisplayAddress';
import {
  reverseGeocodeChinese,
  reverseGeocodeGoogle,
  reverseGeocodeNominatimZh,
} from './reverseGeocodeChinese';
import { withTimeout } from './withTimeout';

const REVERSE_GEOCODE_MS = 5_000;

function displayLabel(line: string): string {
  return ensureMinimumHkAreaInAddress(simplifyPassengerDisplayAddress(line.trim()));
}

async function googleLabelForUi(
  latitude: number,
  longitude: number,
  wantsChinese: boolean,
  locale: AppLocale,
): Promise<string | null> {
  const primary = mapsLanguageTag(locale);
  const candidates = wantsChinese
    ? ['zh-HK', 'zh-TW', primary, 'zh-CN']
    : ['en', primary];

  const accept = wantsChinese
    ? (line: string) => isChinesePrimaryAddress(line)
    : (line: string) => !isChinesePrimaryAddress(line) || !hasChineseAddressChars(line);

  for (const language of candidates) {
    const line = await reverseGeocodeGoogle(latitude, longitude, language, accept);
    if (line) return displayLabel(line);
  }

  if (wantsChinese) {
    const zh = await reverseGeocodeChinese(latitude, longitude);
    if (zh?.trim()) return displayLabel(zh.trim());
  }
  return null;
}

export async function resolveLabelForCoords(
  latitude: number,
  longitude: number,
  locale: AppLocale = getAppLocale(),
): Promise<string> {
  const coordFallback = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  const wantsChinese = locale !== 'en';

  const fromGoogle = await googleLabelForUi(latitude, longitude, wantsChinese, locale);
  if (fromGoogle) return fromGoogle;

  if (wantsChinese) {
    const nominatim = await reverseGeocodeNominatimZh(latitude, longitude);
    if (nominatim) return displayLabel(nominatim);
  }

  let label = coordFallback;
  try {
    const places = await withTimeout(
      Location.reverseGeocodeAsync({ latitude, longitude }),
      REVERSE_GEOCODE_MS,
    );
    const formatted = places[0] ? formatGeocodedAddress(places[0]) : '';
    if (formatted) {
      if (wantsChinese) {
        if (isChinesePrimaryAddress(formatted)) {
          label = displayLabel(formatted);
        } else {
          const zh = await reverseGeocodeChinese(latitude, longitude);
          if (zh?.trim()) return displayLabel(zh.trim());
          const nominatim = await reverseGeocodeNominatimZh(latitude, longitude);
          if (nominatim) return displayLabel(nominatim);
        }
      } else {
        label = displayLabel(formatted);
      }
    }
  } catch {
    /* keep coords */
  }

  if (wantsChinese && !isChinesePrimaryAddress(label)) {
    const snapped = snapLatLngToKnownHkPlace({
      latitude,
      longitude,
      label,
    });
    if (isChinesePrimaryAddress(snapped.label)) {
      return displayLabel(snapped.label.trim());
    }
    const zh = await reverseGeocodeChinese(latitude, longitude);
    if (zh?.trim()) return displayLabel(zh.trim());
    const nominatim = await reverseGeocodeNominatimZh(latitude, longitude);
    if (nominatim) return displayLabel(nominatim);
  }

  if (!label.trim() || label === coordFallback) {
    if (!label.trim()) label = t('address.unknown');
  }
  if (wantsChinese && !isChinesePrimaryAddress(label) && label !== t('address.unknown')) {
    return coordFallback;
  }
  return displayLabel(label);
}
