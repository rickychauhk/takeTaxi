import { Injectable, Logger } from '@nestjs/common';

function kmFromMeters(meters: number): number {
  return Math.round((meters / 1000) * 10) / 10;
}

@Injectable()
export class MapsService {
  private readonly log = new Logger(MapsService.name);

  async routePreview(input: { origin: { lat: number; lng: number }; destination: { lat: number; lng: number } }) {
    const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (!key) {
      return {
        provider: 'stub',
        distanceMeters: null,
        durationSeconds: null,
        note: 'Configure GOOGLE_MAPS_API_KEY for Google Directions',
        input,
      };
    }
    const routes = await this.computeRoutesDistanceMeters(key, input.origin, input.destination);
    if (routes != null) {
      return {
        provider: 'google-routes',
        distanceMeters: routes.distanceMeters,
        durationSeconds: routes.durationSeconds,
      };
    }
    const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
    url.searchParams.set('origin', `${input.origin.lat},${input.origin.lng}`);
    url.searchParams.set('destination', `${input.destination.lat},${input.destination.lng}`);
    url.searchParams.set('key', key);
    const res = await fetch(url);
    const data = (await res.json()) as {
      routes?: { legs?: { distance: { value: number }; duration: { value: number } }[] }[];
    };
    const leg = data.routes?.[0]?.legs?.[0];
    return {
      provider: 'google',
      distanceMeters: leg?.distance?.value ?? null,
      durationSeconds: leg?.duration?.value ?? null,
    };
  }

  /** 司機→多個上車點行車距離（Routes API；legacy Distance Matrix 為後備） */
  async drivingDistanceMatrixKm(
    origin: { lat: number; lng: number },
    destinations: { lat: number; lng: number }[],
  ): Promise<(number | null)[]> {
    const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (!key || !destinations.length) return destinations.map(() => null);

    const out: (number | null)[] = [];
    const chunkSize = 25;
    for (let i = 0; i < destinations.length; i += chunkSize) {
      const chunk = destinations.slice(i, i + chunkSize);
      const chunkKm = await this.routesRouteMatrixKm(key, origin, chunk);
      if (chunkKm.some((k) => k != null)) {
        out.push(...chunkKm);
        continue;
      }
      out.push(...(await this.legacyDistanceMatrixKm(key, origin, chunk)));
    }
    return out;
  }

  private async routesRouteMatrixKm(
    key: string,
    origin: { lat: number; lng: number },
    destinations: { lat: number; lng: number }[],
  ): Promise<(number | null)[]> {
    const out = destinations.map(() => null as number | null);
    try {
      const res = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'originIndex,destinationIndex,distanceMeters,condition',
        },
        body: JSON.stringify({
          origins: [
            {
              waypoint: {
                location: { latLng: { latitude: origin.lat, longitude: origin.lng } },
              },
            },
          ],
          destinations: destinations.map((d) => ({
            waypoint: {
              location: { latLng: { latitude: d.lat, longitude: d.lng } },
            },
          })),
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_UNAWARE',
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        this.log.warn(`Routes computeRouteMatrix HTTP ${res.status}: ${text.slice(0, 200)}`);
        return out;
      }
      const data = (await res.json()) as
        | { originIndex?: number; destinationIndex?: number; distanceMeters?: number }[]
        | { error?: { message?: string } };
      if (!Array.isArray(data)) {
        this.log.warn(`Routes computeRouteMatrix error: ${JSON.stringify(data).slice(0, 200)}`);
        return out;
      }
      for (const cell of data) {
        const idx = cell.destinationIndex;
        if (idx == null || idx < 0 || idx >= out.length) continue;
        if (cell.distanceMeters != null && Number.isFinite(cell.distanceMeters)) {
          out[idx] = kmFromMeters(cell.distanceMeters);
        }
      }
    } catch (e) {
      this.log.warn('Routes computeRouteMatrix failed', e);
    }
    return out;
  }

  private async computeRoutesDistanceMeters(
    key: string,
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<{ distanceMeters: number; durationSeconds: number | null } | null> {
    try {
      const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
          destination: {
            location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
          },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_UNAWARE',
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        routes?: { distanceMeters?: number; duration?: string }[];
      };
      const route = data.routes?.[0];
      if (route?.distanceMeters == null) return null;
      const durationSeconds = route.duration ? parseDurationSeconds(route.duration) : null;
      return { distanceMeters: route.distanceMeters, durationSeconds };
    } catch {
      return null;
    }
  }

  private async legacyDistanceMatrixKm(
    key: string,
    origin: { lat: number; lng: number },
    destinations: { lat: number; lng: number }[],
  ): Promise<(number | null)[]> {
    const params = new URLSearchParams({
      origins: `${origin.lat},${origin.lng}`,
      destinations: destinations.map((d) => `${d.lat},${d.lng}`).join('|'),
      mode: 'driving',
      region: 'hk',
      language: 'zh-HK',
      key,
    });
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`,
    );
    const data = (await res.json()) as {
      status?: string;
      rows?: { elements?: { status?: string; distance?: { value: number } }[] }[];
    };
    if (data.status && data.status !== 'OK') {
      this.log.warn(`Legacy Distance Matrix status=${data.status}`);
    }
    const elements = data.rows?.[0]?.elements ?? [];
    return destinations.map((_, j) => {
      const el = elements[j];
      if (el?.status === 'OK' && el.distance?.value != null) {
        return kmFromMeters(el.distance.value);
      }
      return null;
    });
  }
}

/** e.g. "1234s" */
function parseDurationSeconds(duration: string): number | null {
  const m = /^(\d+(?:\.\d+)?)s$/.exec(duration.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? Math.round(n) : null;
}
