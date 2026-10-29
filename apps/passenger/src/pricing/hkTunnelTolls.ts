import { passengerAppTunnelTollFromDetectedIds } from '@taxima/shared';

type Coord = { latitude: number; longitude: number };

/** 與 {@link @taxima/shared HkTaxiTunnelCode} 一致 */
export type HkTunnelId =
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

type TunnelDef = {
  id: HkTunnelId;
  patterns: RegExp[];
  anchors: { latitude: number; longitude: number; radiusMeters: number }[];
};

const HARBOUR_TUNNELS: HkTunnelId[] = ['cht', 'wht', 'eht'];

/** 隧道偵測定義；附加費見 @taxima/shared ORDER_TUNNEL_ONE_WAY_HKD */
const TUNNELS: TunnelDef[] = [
  {
    id: 'cht',
    patterns: [/cross[\s-]?harbour/i, /海底隧道/, /紅磡海底/, /cross harbour tunnel/i],
    anchors: [
      { latitude: 22.2805, longitude: 114.1738, radiusMeters: 450 },
      { latitude: 22.3029, longitude: 114.1818, radiusMeters: 450 },
    ],
  },
  {
    id: 'wht',
    patterns: [/western harbour/i, /西區海底/, /西隧/],
    anchors: [
      { latitude: 22.3045, longitude: 114.1608, radiusMeters: 450 },
      { latitude: 22.2872, longitude: 114.1518, radiusMeters: 450 },
    ],
  },
  {
    id: 'eht',
    patterns: [/eastern harbour/i, /東區海底/, /東隧/],
    anchors: [
      { latitude: 22.2918, longitude: 114.2145, radiusMeters: 450 },
      { latitude: 22.3048, longitude: 114.2125, radiusMeters: 450 },
    ],
  },
  {
    id: 'lion_rock',
    patterns: [/lion rock/i, /獅子山隧道/],
    anchors: [{ latitude: 22.3472, longitude: 114.1785, radiusMeters: 400 }],
  },
  {
    id: 'tate_cairn',
    patterns: [/tate'?s cairn/i, /大老山隧道/],
    anchors: [{ latitude: 22.3525, longitude: 114.2085, radiusMeters: 400 }],
  },
  {
    id: 'aberdeen',
    patterns: [/aberdeen tunnel/i, /香港仔隧道/],
    anchors: [{ latitude: 22.2515, longitude: 114.1695, radiusMeters: 350 }],
  },
  {
    id: 'tseung_kwan_o',
    patterns: [/tseung kwan o tunnel/i, /將軍澳隧道/],
    anchors: [{ latitude: 22.3155, longitude: 114.2585, radiusMeters: 350 }],
  },
  {
    id: 'shing_mun',
    patterns: [/shing mun/i, /城門隧道/],
    anchors: [{ latitude: 22.3875, longitude: 114.1395, radiusMeters: 400 }],
  },
  {
    id: 'tai_lam',
    patterns: [/tai lam/i, /大欖隧道/],
    anchors: [{ latitude: 22.3725, longitude: 114.0685, radiusMeters: 450 }],
  },
  {
    id: 'eagles_nest',
    patterns: [/eagles nest/i, /尖山隧道/],
    anchors: [{ latitude: 22.3415, longitude: 114.1545, radiusMeters: 350 }],
  },
];

function haversineMeters(a: Coord, b: Coord): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function detectFromStepTexts(stepTexts: string[]): Map<HkTunnelId, number> {
  const hits = new Map<HkTunnelId, number>();
  const blob = stepTexts.map(stripHtml).join(' | ');
  for (const tunnel of TUNNELS) {
    if (tunnel.patterns.some((p) => p.test(blob))) {
      hits.set(tunnel.id, 0);
    }
  }
  return hits;
}

function detectFromPolyline(coordinates: Coord[]): Map<HkTunnelId, number> {
  const hits = new Map<HkTunnelId, number>();
  if (coordinates.length === 0) return hits;

  for (let i = 0; i < coordinates.length; i++) {
    const pt = coordinates[i]!;
    for (const tunnel of TUNNELS) {
      if (hits.has(tunnel.id)) continue;
      for (const anchor of tunnel.anchors) {
        const d = haversineMeters(pt, anchor);
        if (d <= anchor.radiusMeters) {
          hits.set(tunnel.id, i);
          break;
        }
      }
    }
  }
  return hits;
}

function mergeHarbourCrossing(hits: Map<HkTunnelId, number>): Map<HkTunnelId, number> {
  const harbour = [...hits.entries()].filter(([id]) => HARBOUR_TUNNELS.includes(id));
  if (harbour.length <= 1) return hits;
  harbour.sort((a, b) => a[1] - b[1]);
  const keep = harbour[0]![0];
  for (const id of HARBOUR_TUNNELS) {
    if (id !== keep) hits.delete(id);
  }
  return hits;
}

export function detectTunnelTolls(input: {
  coordinates: Coord[];
  stepTexts?: string[];
}): { tunnelTollHkd: number; tunnelIds: HkTunnelId[] } {
  const fromSteps = input.stepTexts?.length ? detectFromStepTexts(input.stepTexts) : new Map();
  const fromPolyline = detectFromPolyline(input.coordinates);

  const merged = new Map<HkTunnelId, number>();
  for (const [id, idx] of fromPolyline) merged.set(id, idx);
  for (const [id] of fromSteps) {
    if (!merged.has(id)) merged.set(id, 0);
  }

  mergeHarbourCrossing(merged);

  const ordered = [...merged.entries()].sort((a, b) => a[1] - b[1]);
  const tunnelIds = ordered.map(([id]) => id);
  const tunnelTollHkd = passengerAppTunnelTollFromDetectedIds(tunnelIds, false);
  return { tunnelTollHkd, tunnelIds };
}
