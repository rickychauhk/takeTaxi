import type { TunnelRoutePreference } from '@taxima/shared';
import { emptyTunnelRoutePreference, hasTunnelRoutePreference } from '@taxima/shared';
import { mapsLanguageTag } from '../i18n';
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

export type Coord = { latitude: number; longitude: number };

export type DrivingRouteResult = {
  coordinates: Coord[];
  distanceMeters: number;
  durationSeconds: number;
  tunnelTollHkd: number;
};

export type FetchDrivingRouteOptions = {
  tunnelPreference?: TunnelRoutePreference;
};

type GoogleRouteLeg = {
  distance?: { value?: number };
  duration?: { value?: number };
  duration_in_traffic?: { value?: number };
  steps?: { html_instructions?: string }[];
};

type GoogleRoute = {
  overview_polyline?: { points?: string };
  legs?: GoogleRouteLeg[];
};

function straightLine(from: Coord, to: Coord, pref: TunnelRoutePreference): DrivingRouteResult {
  const coordinates = [
    { latitude: from.latitude, longitude: from.longitude },
    { latitude: to.latitude, longitude: to.longitude },
  ];
  const distanceMeters = polylineLengthMeters(coordinates);
  const durationSeconds = Math.max(60, Math.round((distanceMeters / 1000 / 25) * 3600));
  return withTunnelFarePolicy(
    { coordinates, distanceMeters, durationSeconds, tunnelTollHkd: 0 },
    undefined,
    pref,
  );
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

function collectStepTexts(route: GoogleRoute): string[] {
  const texts: string[] = [];
  for (const leg of route.legs ?? []) {
    for (const step of leg.steps ?? []) {
      if (step.html_instructions) texts.push(step.html_instructions);
    }
  }
  return texts;
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
  const stepTexts = collectStepTexts(route);
  const result = withTunnelFarePolicy({ coordinates, distanceMeters, durationSeconds }, stepTexts, pref);
  return { result, stepTexts };
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
    language: mapsLanguageTag(),
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
    if (matched) return matched;
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
  if (matched) return matched;

  const multi = tunnelWaypointsForPreference(from, to, pref);
  if (multi.length > 0) {
    try {
      const viaRoute = await fetchGoogleDrivingRoute(from, to, apiKey, pref, multi);
      if (routeMatchesTunnelPreference(viaRoute.coordinates, undefined, pref)) {
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
      if (routeMatchesTunnelPreference(viaRoute.coordinates, undefined, pref)) {
        return viaRoute;
      }
    } catch {
      /* try next tunnel */
    }
  }

  return fastest;
}

async function fetchOsrmDrivingRoute(from: Coord, to: Coord, pref: TunnelRoutePreference): Promise<DrivingRouteResult> {
  const path = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  const data = (await res.json()) as {
    code: string;
    routes?: {
      distance?: number;
      duration?: number;
      geometry?: { coordinates?: [number, number][] };
      legs?: { steps?: { name?: string; maneuver?: { instruction?: string } }[] }[];
    }[];
  };
  const routes = data.routes ?? [];
  let best = routes[0];
  let bestDuration = Infinity;
  let bestDistance = Infinity;
  for (const route of routes) {
    const dur = route.duration ?? Infinity;
    const dist = route.distance ?? Infinity;
    if (dur < bestDuration || (dur === bestDuration && dist < bestDistance)) {
      best = route;
      bestDuration = dur;
      bestDistance = dist;
    }
  }
  const route = best;
  const coords = route?.geometry?.coordinates;
  if (data.code !== 'Ok' || !coords?.length) throw new Error('OSRM no route');
  const coordinates = coords.map(([longitude, latitude]) => ({ latitude, longitude }));
  const stepTexts: string[] = [];
  for (const leg of route.legs ?? []) {
    for (const step of leg.steps ?? []) {
      if (step.name) stepTexts.push(step.name);
      if (step.maneuver?.instruction) stepTexts.push(step.maneuver.instruction);
    }
  }
  const distanceMeters = route.distance ?? polylineLengthMeters(coordinates);
  const durationSeconds = route.duration ?? Math.max(60, Math.round((distanceMeters / 1000 / 25) * 3600));
  return withTunnelFarePolicy({ coordinates, distanceMeters, durationSeconds }, stepTexts, pref);
}

/**
 * Driving route for map + fare estimate. Prefers Google Directions when API key is set.
 * When tunnel preferences are set, re-plans if the fastest route does not use a selected harbour tunnel.
 */
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
