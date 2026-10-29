/**
 * 乘客 App／司機射柯打：隧道附加費（平台規則，非運輸署錶旗）。
 * 過海隧道預設收來回（$25×2）；勾選「收單程隧道費」則過海只收 $25。
 * 其餘隧道只收單程，不收來回。純大埔道等無隧道路段不另加隧道附加。
 */
export type HkTaxiTunnelCode =
  | 'cht'
  | 'wht'
  | 'eht'
  | 'lion_rock'
  | 'tate_cairn'
  | 'aberdeen'
  | 'tseung_kwan_o'
  | 'shing_mun'
  | 'tai_lam'
  | 'eagles_nest';

const HARBOUR_TUNNEL_CODES = new Set<HkTaxiTunnelCode>(['cht', 'wht', 'eht']);

/** 單程基準價（港元） */
export const ORDER_TUNNEL_ONE_WAY_HKD: Record<HkTaxiTunnelCode, number> = {
  cht: 25,
  wht: 25,
  eht: 25,
  lion_rock: 8,
  eagles_nest: 8,
  shing_mun: 8,
  tate_cairn: 20,
  tai_lam: 28,
  aberdeen: 8,
  tseung_kwan_o: 8,
};

/** @deprecated 請用 {@link ORDER_TUNNEL_ONE_WAY_HKD} */
export const HK_TAXI_URBAN_TUNNEL_ONE_WAY_HKD = ORDER_TUNNEL_ONE_WAY_HKD;

export function isHkTaxiTunnelCode(id: string): id is HkTaxiTunnelCode {
  return id in ORDER_TUNNEL_ONE_WAY_HKD;
}

export function isHarbourTunnelCode(id: HkTaxiTunnelCode): boolean {
  return HARBOUR_TUNNEL_CODES.has(id);
}

export function passengerTunnelSurchargeForCode(
  id: HkTaxiTunnelCode,
  singleTripTunnelFare: boolean,
): number {
  const oneWay = ORDER_TUNNEL_ONE_WAY_HKD[id];
  if (HARBOUR_TUNNEL_CODES.has(id)) {
    return singleTripTunnelFare ? oneWay : oneWay * 2;
  }
  return oneWay;
}

/** 乘客 App：此類隧道不計入估算附加費 */
export const PASSENGER_APP_FREE_TUNNEL_CODES: ReadonlySet<HkTaxiTunnelCode> = new Set([
  'tseung_kwan_o',
]);

/** 依路線偵測到的隧道 id 加總附加費（司機射柯打／預設） */
export function passengerTunnelTollFromDetectedIds(
  tunnelIds: readonly string[],
  singleTripTunnelFare: boolean,
): number {
  let total = 0;
  for (const id of tunnelIds) {
    if (!isHkTaxiTunnelCode(id)) continue;
    total += passengerTunnelSurchargeForCode(id, singleTripTunnelFare);
  }
  return total;
}

/** 乘客 App 叫車估算（將軍澳隧等免費） */
export function passengerAppTunnelTollFromDetectedIds(
  tunnelIds: readonly string[],
  singleTripTunnelFare: boolean,
): number {
  let total = 0;
  for (const id of tunnelIds) {
    if (!isHkTaxiTunnelCode(id)) continue;
    if (PASSENGER_APP_FREE_TUNNEL_CODES.has(id)) continue;
    total += passengerTunnelSurchargeForCode(id, singleTripTunnelFare);
  }
  return total;
}
