import {
  HARBOUR_TUNNEL_WAYPOINTS,
  hasTunnelRoutePreference,
  isHarbourTunnelId,
  tripLikelyCrossesHarbour,
  tunnelTollHkdForRoute,
  waypointsForTunnelPreference,
  type HarbourTunnelCode,
  type TunnelRoutePreference,
} from '@taxima/shared';
import { detectTunnelTolls, type HkTunnelId } from '../pricing/hkTunnelTolls';
export type Coord = { latitude: number; longitude: number };

export type DrivingRouteShape = {
  coordinates: Coord[];
  distanceMeters: number;
  durationSeconds: number;
  tunnelTollHkd: number;
};

type GoogleRoute = {
  overview_polyline?: { points?: string };
  legs?: { steps?: { html_instructions?: string }[] }[];
};

export function harbourTunnelOnRoute(coordinates: Coord[], stepTexts?: string[]): HarbourTunnelCode | null {
  const { tunnelIds } = detectTunnelTolls({ coordinates, stepTexts });
  for (const id of tunnelIds) {
    if (isHarbourTunnelId(id)) return id;
  }
  return null;
}

export function withTunnelFarePolicy(
  result: Omit<DrivingRouteShape, 'tunnelTollHkd'> & { tunnelTollHkd?: number },
  stepTexts: string[] | undefined,
  pref: TunnelRoutePreference,
): DrivingRouteShape {
  const { tunnelIds } = detectTunnelTolls({
    coordinates: result.coordinates,
    stepTexts,
  });
  const tunnelTollHkd = tunnelTollHkdForRoute(tunnelIds, pref);
  return { ...result, tunnelTollHkd };
}

export function routeMatchesTunnelPreference(
  coordinates: Coord[],
  stepTexts: string[] | undefined,
  pref: TunnelRoutePreference,
): boolean {
  const { tunnelIds } = detectTunnelTolls({ coordinates, stepTexts });
  if (pref.harbourTunnels.length > 0) {
    const harbour = tunnelIds.find(isHarbourTunnelId);
    if (!harbour || !pref.harbourTunnels.includes(harbour)) return false;
  }
  for (const id of pref.landTunnels) {
    if (!tunnelIds.includes(id)) return false;
  }
  return true;
}

/** @deprecated 用 {@link routeMatchesTunnelPreference} */
export function routeMatchesHarbourPreference(
  coordinates: Coord[],
  stepTexts: string[] | undefined,
  pref: TunnelRoutePreference,
): boolean {
  return routeMatchesTunnelPreference(coordinates, stepTexts, pref);
}

/** 起終點同側（例如九龍↔九龍）時，避開誤選的過海隧道路線 */
export function pickGoogleRouteAvoidingHarbourWhenSameSide(
  routes: GoogleRoute[],
  build: (route: GoogleRoute) => { result: DrivingRouteShape; stepTexts: string[] },
  from: Coord,
  to: Coord,
  pref: TunnelRoutePreference,
): GoogleRoute | null {
  if (hasTunnelRoutePreference(pref)) return null;
  if (tripLikelyCrossesHarbour(from, to)) return null;

  let bestRoute: GoogleRoute | null = null;
  let bestDur = Infinity;
  let bestDist = Infinity;
  for (const route of routes) {
    const { result, stepTexts } = build(route);
    if (harbourTunnelOnRoute(result.coordinates, stepTexts)) continue;
    const dur = result.durationSeconds > 0 ? result.durationSeconds : Infinity;
    const dist = result.distanceMeters > 0 ? result.distanceMeters : Infinity;
    if (dur < bestDur || (dur === bestDur && dist < bestDist)) {
      bestRoute = route;
      bestDur = dur;
      bestDist = dist;
    }
  }
  return bestRoute;
}

export function pickGoogleRouteForTunnelPreference(
  routes: GoogleRoute[],
  pref: TunnelRoutePreference,
  build: (route: GoogleRoute) => { result: DrivingRouteShape; stepTexts: string[] },
  from: Coord,
  to: Coord,
): DrivingRouteShape | null {
  if (!hasTunnelRoutePreference(pref)) return null;

  let best: DrivingRouteShape | null = null;
  let bestDur = Infinity;
  for (const route of routes) {
    const { result, stepTexts } = build(route);
    if (!routeMatchesTunnelPreference(result.coordinates, stepTexts, pref)) continue;
    const dur = result.durationSeconds > 0 ? result.durationSeconds : Infinity;
    if (dur < bestDur) {
      best = result;
      bestDur = dur;
    }
  }
  if (best) return best;

  if (pref.harbourTunnels.length > 0 && !tripLikelyCrossesHarbour(from, to)) return null;

  return null;
}

export function preferredHarbourWaypoint(pref: TunnelRoutePreference): HarbourTunnelCode | null {
  return pref.harbourTunnels[0] ?? null;
}

export function waypointForHarbour(code: HarbourTunnelCode): Coord {
  return HARBOUR_TUNNEL_WAYPOINTS[code];
}

export function tunnelWaypointsForPreference(
  from: Coord,
  to: Coord,
  pref: TunnelRoutePreference,
): Coord[] {
  return waypointsForTunnelPreference(from, to, pref.harbourTunnels, pref.landTunnels);
}

export function needsTunnelReroute(
  base: DrivingRouteShape,
  stepTexts: string[] | undefined,
  pref: TunnelRoutePreference,
  from: Coord,
  to: Coord,
): boolean {
  if (!hasTunnelRoutePreference(pref)) return false;
  if (routeMatchesTunnelPreference(base.coordinates, stepTexts, pref)) return false;
  if (pref.landTunnels.length === 0 && pref.harbourTunnels.length > 0) {
    const onRoute = harbourTunnelOnRoute(base.coordinates, stepTexts);
    if (!onRoute && !tripLikelyCrossesHarbour(from, to)) return false;
  }
  return true;
}

/** @deprecated 用 {@link needsTunnelReroute} */
export function needsHarbourReroute(
  base: DrivingRouteShape,
  stepTexts: string[] | undefined,
  pref: TunnelRoutePreference,
  from: Coord,
  to: Coord,
): boolean {
  return needsTunnelReroute(base, stepTexts, pref, from, to);
}

export function primaryHarbourOnRoute(tunnelIds: HkTunnelId[]): HarbourTunnelCode | null {
  for (const id of tunnelIds) {
    if (isHarbourTunnelId(id)) return id;
  }
  return null;
}
