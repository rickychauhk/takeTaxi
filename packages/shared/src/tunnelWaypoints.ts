import type { HkTaxiTunnelCode } from './hkTaxiTunnelTolls';

export type TunnelWaypoint = { latitude: number; longitude: number };

/** Google Directions 途經點（隧道入口附近） */
export const TUNNEL_WAYPOINTS: Record<HkTaxiTunnelCode, TunnelWaypoint> = {
  cht: { latitude: 22.2917, longitude: 114.1778 },
  wht: { latitude: 22.2958, longitude: 114.1563 },
  eht: { latitude: 22.2983, longitude: 114.2135 },
  lion_rock: { latitude: 22.3472, longitude: 114.1785 },
  tate_cairn: { latitude: 22.3525, longitude: 114.2085 },
  eagles_nest: { latitude: 22.3415, longitude: 114.1545 },
  aberdeen: { latitude: 22.2515, longitude: 114.1695 },
  tseung_kwan_o: { latitude: 22.3155, longitude: 114.2585 },
  shing_mun: { latitude: 22.3875, longitude: 114.1395 },
  tai_lam: { latitude: 22.3725, longitude: 114.0685 },
};

/** 與 booking_options.code 一致（不含 tunnel_single_fare） */
export const LAND_TUNNEL_BOOKING_CODES: HkTaxiTunnelCode[] = [
  'lion_rock',
  'tate_cairn',
  'eagles_nest',
  'shing_mun',
  'aberdeen',
  'tseung_kwan_o',
  'tai_lam',
];

export function isLandTunnelBookingCode(code: string): code is HkTaxiTunnelCode {
  return (LAND_TUNNEL_BOOKING_CODES as string[]).includes(code);
}

export function waypointForTunnel(code: HkTaxiTunnelCode): TunnelWaypoint {
  return TUNNEL_WAYPOINTS[code];
}

/** 沿起點→終點方向排序途經隧道 */
export function orderTunnelCodesAlongTrip(
  from: TunnelWaypoint,
  to: TunnelWaypoint,
  codes: readonly HkTaxiTunnelCode[],
): HkTaxiTunnelCode[] {
  const dx = to.longitude - from.longitude;
  const dy = to.latitude - from.latitude;
  const len2 = dx * dx + dy * dy || 1e-12;
  const score = (wp: TunnelWaypoint) =>
    ((wp.longitude - from.longitude) * dx + (wp.latitude - from.latitude) * dy) / len2;
  return [...codes].sort(
    (a, b) => score(TUNNEL_WAYPOINTS[a]) - score(TUNNEL_WAYPOINTS[b]),
  );
}

export function waypointsForTunnelPreference(
  from: TunnelWaypoint,
  to: TunnelWaypoint,
  harbourTunnels: readonly HkTaxiTunnelCode[],
  landTunnels: readonly HkTaxiTunnelCode[],
): TunnelWaypoint[] {
  const codes: HkTaxiTunnelCode[] = [];
  const harbour = harbourTunnels.filter(
    (id): id is 'cht' | 'wht' | 'eht' => id === 'cht' || id === 'wht' || id === 'eht',
  );
  if (harbour.length > 0) codes.push(harbour[0]!);
  for (const id of landTunnels) {
    if (!codes.includes(id)) codes.push(id);
  }
  return orderTunnelCodesAlongTrip(from, to, codes).map((c) => TUNNEL_WAYPOINTS[c]);
}
