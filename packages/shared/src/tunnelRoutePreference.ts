import type { HkTaxiTunnelCode } from './hkTaxiTunnelTolls';
import {
  isHkTaxiTunnelCode,
  passengerAppTunnelTollFromDetectedIds,
  passengerTunnelTollFromDetectedIds,
} from './hkTaxiTunnelTolls';
import { isLandTunnelBookingCode, LAND_TUNNEL_BOOKING_CODES } from './tunnelWaypoints';

/** 過海隧道（與 booking_options.code 一致） */
export type HarbourTunnelCode = 'cht' | 'wht' | 'eht';

export type TunnelRoutePreference = {
  /** 過海隧道（可多選；路線須途經其中一條） */
  harbourTunnels: HarbourTunnelCode[];
  /** 陸路隧道（可多選；路線須全部途經） */
  landTunnels: HkTaxiTunnelCode[];
  /** 收單程隧道費（只減過海隧道回程；陸路隧道本身只收單程） */
  singleTripTunnelFare: boolean;
};

/** booking_options 隧道選項排序（與 CRM seed 一致） */
export const TUNNEL_BOOKING_OPTION_ORDER: Record<string, number> = {
  cht: 10,
  wht: 20,
  eht: 30,
  lion_rock: 45,
  tate_cairn: 50,
  eagles_nest: 55,
  shing_mun: 60,
  aberdeen: 70,
  tseung_kwan_o: 75,
  tai_lam: 80,
  tunnel_single_fare: 1000,
};

export const HARBOUR_TUNNEL_CODES: HarbourTunnelCode[] = ['cht', 'wht', 'eht'];

/** 強制途經隧道附近（Google Directions waypoint） */
export const HARBOUR_TUNNEL_WAYPOINTS: Record<
  HarbourTunnelCode,
  { latitude: number; longitude: number }
> = {
  cht: { latitude: 22.2917, longitude: 114.1778 },
  wht: { latitude: 22.2958, longitude: 114.1563 },
  eht: { latitude: 22.2983, longitude: 114.2135 },
};

const HARBOUR_TUNNEL_SURCHARGE_FULL = 50;
const HARBOUR_TUNNEL_SURCHARGE_SINGLE = 25;

export function emptyTunnelRoutePreference(): TunnelRoutePreference {
  return { harbourTunnels: [], landTunnels: [], singleTripTunnelFare: false };
}

function sortTunnelCodes(codes: string[]): string[] {
  return [...codes].sort(
    (a, b) => (TUNNEL_BOOKING_OPTION_ORDER[a] ?? 999) - (TUNNEL_BOOKING_OPTION_ORDER[b] ?? 999),
  );
}

export function tunnelRoutePreferenceFromOptionCodes(codes: string[]): TunnelRoutePreference {
  const harbourTunnels: HarbourTunnelCode[] = [];
  const landTunnels: HkTaxiTunnelCode[] = [];
  let singleTripTunnelFare = false;
  for (const code of sortTunnelCodes(codes)) {
    if (code === 'cht' || code === 'wht' || code === 'eht') {
      // 一般行程只會行一條過海隧道；多選時以排序後第一個為準
      if (harbourTunnels.length === 0) harbourTunnels.push(code);
    } else if (isLandTunnelBookingCode(code)) {
      if (!landTunnels.includes(code)) landTunnels.push(code);
    } else if (isHkTaxiTunnelCode(code) && !isHarbourTunnelId(code)) {
      if (!landTunnels.includes(code)) landTunnels.push(code);
    }
    if (code === 'tunnel_single_fare') singleTripTunnelFare = true;
  }
  return { harbourTunnels, landTunnels, singleTripTunnelFare };
}

export function hasTunnelRoutePreference(pref: TunnelRoutePreference): boolean {
  return pref.harbourTunnels.length > 0 || pref.landTunnels.length > 0;
}

export { LAND_TUNNEL_BOOKING_CODES };

/** 由 CRM booking option id 對照 code（需先載入 booking options） */
export function tunnelRoutePreferenceFromSelectedIds(
  selectedOptionIds: number[],
  optionCodeById: Map<number, string>,
): TunnelRoutePreference {
  const codes: string[] = [];
  for (const id of selectedOptionIds) {
    const code = optionCodeById.get(id);
    if (code) codes.push(code);
  }
  return tunnelRoutePreferenceFromOptionCodes(codes);
}

/** 已選「隧道」分類 option id（用於觸發路線重算；含收單程隧道費） */
export function tunnelBookingSelectionKey(
  selectedOptionIds: readonly number[],
  optionCodeById: ReadonlyMap<number, string>,
): string {
  const ids = selectedOptionIds
    .filter((id) => {
      const code = optionCodeById.get(id);
      return code != null && code in TUNNEL_BOOKING_OPTION_ORDER;
    })
    .sort((a, b) => a - b);
  return ids.join(',');
}

/** 粗略判斷是否可能需要過海（九龍 ↔ 港島） */
export function tripLikelyCrossesHarbour(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): boolean {
  const side = (c: { latitude: number; longitude: number }) => {
    const hkIsland =
      c.latitude < 22.3 &&
      c.latitude > 22.19 &&
      c.longitude > 114.1 &&
      c.longitude < 114.26;
    const kowloon =
      c.latitude >= 22.28 &&
      c.latitude < 22.45 &&
      c.longitude > 114.12 &&
      c.longitude < 114.23;
    if (hkIsland) return 'island' as const;
    if (kowloon) return 'kowloon' as const;
    return 'other' as const;
  };
  const a = side(from);
  const b = side(to);
  return (a === 'island' && b === 'kowloon') || (a === 'kowloon' && b === 'island');
}

/** 依偵測到的隧道及乘客選項計算隧道附加（的士收費表） */
export function tunnelTollHkdForRoute(
  tunnelIds: readonly string[],
  pref: Pick<TunnelRoutePreference, 'singleTripTunnelFare'>,
): number {
  return passengerTunnelTollFromDetectedIds(tunnelIds, pref.singleTripTunnelFare);
}

/** 乘客 App 叫車估算（含將軍澳隧免費等） */
export function passengerAppTunnelTollHkdForRoute(
  tunnelIds: readonly string[],
  pref: Pick<TunnelRoutePreference, 'singleTripTunnelFare'>,
): number {
  return passengerAppTunnelTollFromDetectedIds(tunnelIds, pref.singleTripTunnelFare);
}

/**
 * @deprecated 請改用 {@link tunnelTollHkdForRoute}（含所有隧道，不只過海）
 */
export function adjustHarbourTunnelTollHkd(
  detectedTunnelTollHkd: number,
  harbourTunnelIdsOnRoute: HarbourTunnelCode[],
  pref: TunnelRoutePreference,
): number {
  if (!pref.singleTripTunnelFare || harbourTunnelIdsOnRoute.length === 0) {
    return detectedTunnelTollHkd;
  }
  const harbourCount = harbourTunnelIdsOnRoute.length;
  const reduction = harbourCount * (HARBOUR_TUNNEL_SURCHARGE_FULL - HARBOUR_TUNNEL_SURCHARGE_SINGLE);
  return Math.max(0, detectedTunnelTollHkd - reduction);
}

export function isHarbourTunnelId(id: string): id is HarbourTunnelCode {
  return id === 'cht' || id === 'wht' || id === 'eht';
}

/** 過海隧道最多保留一條（與路線規劃一致） */
export function coalesceHarbourTunnelPreference(pref: TunnelRoutePreference): TunnelRoutePreference {
  if (pref.harbourTunnels.length <= 1) return pref;
  return { ...pref, harbourTunnels: [pref.harbourTunnels[0]!] };
}
