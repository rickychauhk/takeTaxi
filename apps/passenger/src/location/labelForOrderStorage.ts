import { snapLatLngToKnownHkPlace } from '@taxima/shared';
import type { LatLng } from '../constants/demoDestinations';
import { getAppLocale } from '../i18n';
import { addressForOrderStorage } from './addressForCrmDisplay';
import { localizedAddressForPassenger } from './addressForPassengerDisplay';
import { hasChineseAddressChars, isChinesePrimaryAddress } from './addressLocale';
import { reverseGeocodeGoogle, reverseGeocodeNominatimZh } from './reverseGeocodeChinese';
import { resolveLabelForCoords } from './resolveLabelForCoords';
import { simplifyPassengerDisplayAddress } from './simplifyDisplayAddress';

export { hasChineseAddressChars } from './addressLocale';

/** 落單寫入 API／CRM 用繁中地址（唔跟手機語言） */
export async function ensureChineseOrderLabel(place: LatLng): Promise<LatLng> {
  const base = snapLatLngToKnownHkPlace(place);
  if (hasChineseAddressChars(base.label) && isChinesePrimaryAddress(base.label)) {
    const fromDemo = addressForOrderStorage(base.label, base.latitude, base.longitude);
    if (hasChineseAddressChars(fromDemo)) {
      return snapLatLngToKnownHkPlace({ ...base, label: fromDemo.trim() });
    }
    return base;
  }

  const fromDemo = addressForOrderStorage(base.label, base.latitude, base.longitude);
  if (hasChineseAddressChars(fromDemo)) {
    return snapLatLngToKnownHkPlace({ ...base, label: fromDemo.trim() });
  }

  for (const language of ['zh-HK', 'zh-TW', 'zh-CN'] as const) {
    const zh = await reverseGeocodeGoogle(base.latitude, base.longitude, language);
    if (zh?.trim() && hasChineseAddressChars(zh)) {
      return snapLatLngToKnownHkPlace({ ...base, label: zh.trim() });
    }
  }

  const nominatim = await reverseGeocodeNominatimZh(base.latitude, base.longitude);
  if (nominatim?.trim() && hasChineseAddressChars(nominatim)) {
    return snapLatLngToKnownHkPlace({ ...base, label: nominatim.trim() });
  }

  if (hasChineseAddressChars(fromDemo)) {
    return snapLatLngToKnownHkPlace({ ...base, label: fromDemo.trim() });
  }
  return snapLatLngToKnownHkPlace({ ...base, label: fromDemo.trim() || base.label.trim() });
}

/** 乘客畫面用：跟 App 語言顯示地址 */
function withShortDisplayLabel(p: LatLng): LatLng {
  const label = simplifyPassengerDisplayAddress(p.label.trim());
  return label === p.label ? p : { ...p, label };
}

export async function ensureDisplayPlaceLabel(place: LatLng): Promise<LatLng> {
  const snapped = snapLatLngToKnownHkPlace(place);
  if (getAppLocale() === 'en') {
    const localized = localizedAddressForPassenger(
      snapped.label,
      snapped.latitude,
      snapped.longitude,
    );
    if (localized !== snapped.label) {
      return { ...snapped, label: localized };
    }
    if (hasChineseAddressChars(snapped.label)) {
      const en =
        (await reverseGeocodeGoogle(snapped.latitude, snapped.longitude, 'en')) ??
        (await resolveLabelForCoords(snapped.latitude, snapped.longitude, 'en'));
      if (en?.trim() && !hasChineseAddressChars(en)) {
        return { ...snapped, label: en.trim() };
      }
    }
    return snapped;
  }
  if (isChinesePrimaryAddress(snapped.label)) return withShortDisplayLabel(snapped);
  const zh = await ensureChineseOrderLabel(snapped);
  return withShortDisplayLabel(zh);
}
