import type { TunnelRoutePreference } from '@taxima/shared';
import { emptyTunnelRoutePreference, hasTunnelRoutePreference } from '@taxima/shared';
import {
  needsTunnelReroute,
  pickGoogleRouteAvoidingHarbourWhenSameSide,
  pickGoogleRouteForTunnelPreference,
  routeMatchesTunnelPreference,
  tunnelWaypointsForPreference,
  waypointForHarbour,
  withTunnelFarePolicy,
} from './applyTunnelRoutePreference';
import { decodeGooglePolyline } from './decodePolyline';
import { polylineLengthMeters } from './polylineDistance';
import {
  extractStreetName,
  stripHtmlInstructions,
  type RouteStep,
} from './routeSteps';

export type { RouteStep } from './routeSteps';

export type Coord = { latitude: number; longitude: number };

export type DrivingRouteResult = {
  coordinates: Coord[];
  distanceMeters: number;
  durationSeconds: number;
  tunnelTollHkd: number;
  steps: RouteStep[];
};

export type FetchDrivingRouteOptions = {
  tunnelPreference?: TunnelRoutePreference;
};

type GoogleRouteStep = {
  distance?: { value?: number };
  duration?: { value?: number };
  html_instructions?: string;
  maneuver?: string;
  end_location?: { lat: number; lng: number };
};

type GoogleRouteLeg = {
  distance?: { value?: number };
  duration?: { value?: number };
  duration_in_traffic?: { value?: number };
  steps?: GoogleRouteStep[];
};

type GoogleRoute = {
  overview_polyline?: { points?: string };
  legs?: GoogleRouteLeg[];
};

export function straightLineCoords(from: Coord, to: Coord): Coord[] {
  return [
    { latitude: from.latitude, longitude: from.longitude },
    { latitude: to.latitude, longitude: to.longitude },
  ];
}

function straightLine(from: Coord, to: Coord, pref: TunnelRoutePreference): DrivingRouteResult {
  const coordinates = straightLineCoords(from, to);
  const distanceMeters = polylineLengthMeters(coordinates);
  const durationSeconds = Math.max(60, Math.round((distanceMeters / 1000 / 25) * 3600));
  const instruction = '沿指示方向行駛';
  const base = withTunnelFarePolicy({ coordinates, distanceMeters, durationSeconds }, undefined, pref);
  return {
    ...base,
    steps: [
      {
        distanceMeters,
        instruction,
        streetName: instruction,
        maneuver: 'straight',
        endLocation: to,
      },
    ],
  };
}

function stepsFromGoogleRoute(route: GoogleRoute): RouteStep[] {
  const out: RouteStep[] = [];
  for (const leg of route.legs ?? []) {
    for (const step of leg.steps ?? []) {
      const lat = step.end_location?.lat;
      const lng = step.end_location?.lng;
      if (lat == null || lng == null) continue;
      const instruction = stripHtmlInstructions(step.html_instructions ?? '繼續前行');
      out.push({
        distanceMeters: step.distance?.value ?? 0,
        instruction,
        streetName: extractStreetName(instruction),
        maneuver: step.maneuver ?? null,
        endLocation: { latitude: lat, longitude: lng },
      });
    }
  }
  return out;
}

function routeDurationAndDistance(route: GoogleRoute): { durationSeconds: number; distanceMeters: number } {
  let distanceMeters = 0;
  let durationSeconds = 0;
  for (const leg of route.legs ?? []) {
    distanceMeters += leg.distance?.value ?? 0;
    durationSeconds += leg.duration_in_traffic?.value ?? leg.duration?.value ?? 0;
  }
  return { durationSeconds, distanceMeters };
}

function buildResultFromGoogleRoute(
  route: GoogleRoute,
  from: Coord,
  to: Coord,
  pref: TunnelRoutePreference,
): { result: DrivingRouteResult; stepTexts: string[] } {
  if (!route.overview_polyline?.points) {
    throw new Error('Google Directions missing polyline');
  }
  const decoded = decodeGooglePolyline(route.overview_polyline.points);
  const coordinates = decoded.length >= 2 ? decoded : straightLine(from, to, pref).coordinates;
  let { distanceMeters, durationSeconds } = routeDurationAndDistance(route);
  if (distanceMeters <= 0) distanceMeters = polylineLengthMeters(coordinates);
  if (durationSeconds <= 0) durationSeconds = Math.max(60, Math.round((distanceMeters / 1000 / 25) * 3600));
  const steps = stepsFromGoogleRoute(route);
  const stepTexts = steps.map((s) => s.instruction);
  const base = withTunnelFarePolicy({ coordinates, distanceMeters, durationSeconds }, stepTexts, pref);
  return {
    result: {
      ...base,
      steps: steps.length ? steps : straightLine(from, to, pref).steps,
    },
    stepTexts,
  };
}

function pickFastestGoogleRoute(routes: GoogleRoute[]): GoogleRoute {
  let best = routes[0]!;
  let bestDuration = Infinity;
  let bestDistance = Infinity;
  for (const route of routes) {
    const { durationSeconds, distanceMeters } = routeDurationAndDistance(route);
    const dur = durationSeconds > 0 ? durationSeconds : Infinity;
    const dist = distanceMeters > 0 ? distanceMeters : Infinity;
    if (dur < bestDuration || (dur === bestDuration && dist < bestDistance)) {
      best = route;
      bestDuration = dur;
      bestDistance = dist;
    }
  }
  return best;
}

async function requestGoogleRoutes(
  from: Coord,
  to: Coord,
  apiKey: string,
  withTraffic: boolean,
  waypoints?: Coord | Coord[],
): Promise<GoogleRoute[]> {
  const params = new URLSearchParams({
    origin: `${from.latitude},${from.longitude}`,
    destination: `${to.latitude},${to.longitude}`,
    mode: 'driving',
    language: 'zh-HK',
    region: 'hk',
    alternatives: 'true',
    key: apiKey,
  });
  const wpList = waypoints == null ? [] : Array.isArray(waypoints) ? waypoints : [waypoints];
  if (wpList.length > 0) {
    params.set('waypoints', wpList.map((w) => `${w.latitude},${w.longitude}`).join('|'));
  }
  if (withTraffic) {
    params.set('departure_time', String(Math.floor(Date.now() / 1000)));
    params.set('traffic_model', 'best_guess');
  }
  const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`);
  if (!res.ok) throw new Error(`Google Directions HTTP ${res.status}`);
  const data = (await res.json()) as { status: string; routes?: GoogleRoute[] };
  const routes = data.routes ?? [];
  if (data.status !== 'OK' || routes.length === 0) {
    throw new Error(`Google Directions ${data.status}`);
  }
  return routes;
}

async function fetchGoogleDrivingRoute(
  from: Coord,
  to: Coord,
  apiKey: string,
  pref: TunnelRoutePreference,
  waypoints?: Coord | Coord[],
): Promise<DrivingRouteResult> {
  let routes: GoogleRoute[];
  try {
    routes = await requestGoogleRoutes(from, to, apiKey, true, waypoints);
  } catch {
    routes = await requestGoogleRoutes(from, to, apiKey, false, waypoints);
  }

  const build = (route: GoogleRoute) => buildResultFromGoogleRoute(route, from, to, pref);

  if (hasTunnelRoutePreference(pref) && !waypoints) {
    const matched = pickGoogleRouteForTunnelPreference(routes, pref, build, from, to);
    if (matched) {
      return matched as DrivingRouteResult;
    }
  }

  const sameSide = pickGoogleRouteAvoidingHarbourWhenSameSide(routes, build, from, to, pref);
  const route = sameSide ?? (routes.length === 1 ? routes[0]! : pickFastestGoogleRoute(routes));
  return build(route).result;
}

async function resolveGoogleRouteWithTunnelPreference(
  from: Coord,
  to: Coord,
  apiKey: string,
  pref: TunnelRoutePreference,
): Promise<DrivingRouteResult> {
  if (!hasTunnelRoutePreference(pref)) {
    return fetchGoogleDrivingRoute(from, to, apiKey, pref);
  }

  let routes: GoogleRoute[];
  try {
    routes = await requestGoogleRoutes(from, to, apiKey, true);
  } catch {
    routes = await requestGoogleRoutes(from, to, apiKey, false);
  }

  const build = (route: GoogleRoute) => buildResultFromGoogleRoute(route, from, to, pref);
  const sameSide = pickGoogleRouteAvoidingHarbourWhenSameSide(routes, build, from, to, pref);
  const picked = sameSide ?? pickFastestGoogleRoute(routes);
  const { result: fastest, stepTexts } = build(picked);

  if (!needsTunnelReroute(fastest, stepTexts, pref, from, to)) {
    return fastest;
  }

  const matched = pickGoogleRouteForTunnelPreference(routes, pref, build, from, to);
  if (matched) {
    return matched as DrivingRouteResult;
  }

  const multi = tunnelWaypointsForPreference(from, to, pref);
  if (multi.length > 0) {
    try {
      const viaRoute = await fetchGoogleDrivingRoute(from, to, apiKey, pref, multi);
      if (routeMatchesTunnelPreference(viaRoute.coordinates, stepTexts, pref)) {
        return viaRoute;
      }
    } catch {
      /* fall through */
    }
  }

  for (const tunnelCode of pref.harbourTunnels) {
    try {
      const wp = waypointForHarbour(tunnelCode);
      const viaRoute = await fetchGoogleDrivingRoute(from, to, apiKey, pref, wp);
      if (routeMatchesTunnelPreference(viaRoute.coordinates, stepTexts, pref)) {
        return viaRoute;
      }
    } catch {
      /* try next */
    }
  }

  return fastest;
}

async function fetchOsrmDrivingRoute(from: Coord, to: Coord, pref: TunnelRoutePreference): Promise<DrivingRouteResult> {
  const path = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  const data = (await res.json()) as {
    code: string;
    routes?: { distance?: number; duration?: number; geometry?: { coordinates?: [number, number][] } }[];
  };
  const route = data.routes?.[0];
  const coords = route?.geometry?.coordinates;
  if (data.code !== 'Ok' || !route || !coords?.length) throw new Error('OSRM no route');
  const coordinates = coords.map(([longitude, latitude]) => ({ latitude, longitude }));
  const distanceMeters = route.distance ?? polylineLengthMeters(coordinates);
  const durationSeconds = route.duration ?? Math.max(60, Math.round((distanceMeters / 1000 / 25) * 3600));
  const base = withTunnelFarePolicy({ coordinates, distanceMeters, durationSeconds }, undefined, pref);
  return {
    ...base,
    steps: [
      {
        distanceMeters,
        instruction: '沿道路前往目的地',
        streetName: '目的地',
        maneuver: 'straight',
        endLocation: to,
      },
    ],
  };
}

/** 司機行程地圖用駕駛路線（可跟落柯打隧道偏好重新規劃） */
export async function fetchDrivingRoute(
  from: Coord,
  to: Coord,
  options?: FetchDrivingRouteOptions,
): Promise<DrivingRouteResult> {
  const pref = options?.tunnelPreference ?? emptyTunnelRoutePreference();
  const googleKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (googleKey) {
    try {
      return await resolveGoogleRouteWithTunnelPreference(from, to, googleKey, pref);
    } catch {
      /* fall through */
    }
  }
  try {
    return await fetchOsrmDrivingRoute(from, to, pref);
  } catch {
    return straightLine(from, to, pref);
  }
}
