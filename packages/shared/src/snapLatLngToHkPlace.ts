import { HK_DEMO_PLACES, type HkDemoPlace } from './hkDemoPlaces';
import { tripLikelyCrossesHarbour } from './tunnelRoutePreference';

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const KOWLOON_LABEL =
  /尖沙咀|旺角|油麻地|佐敦|九龍|油尖旺|荃灣|深水埗|長沙灣|紅磡|何文田|土瓜灣|黃大仙|觀塘|新界|大埔|沙田|屯門|元朗|葵涌|青衣|天水圍|上水|粉嶺|馬鞍山|西貢|將軍澳|藍田|tsim sha tsui|mong kok|yau tsim|kowloon|tsuen wan|sha tin|tai po/i;

export function findHkDemoPlaceForLabel(label: string): HkDemoPlace | null {
  const t = label.trim();
  if (!t) return null;
  for (const p of HK_DEMO_PLACES) {
    if (t.includes(p.labelZh) || p.labelZh.includes(t)) return p;
    const en = p.labelEn.toLowerCase();
    const lower = t.toLowerCase();
    if (lower.includes(en) || en.includes(lower)) return p;
  }
  if (/海港城|harbour city/i.test(t)) {
    return HK_DEMO_PLACES.find((p) => p.labelZh.includes('海港城')) ?? null;
  }
  return null;
}

/** 標籤與座標不一致時（例如繁中寫尖沙咀、pin 在港島），對齊已知地標座標 */
export function snapLatLngToKnownHkPlace<T extends { latitude: number; longitude: number; label: string }>(
  place: T,
): T {
  const demo = findHkDemoPlaceForLabel(place.label);
  if (!demo) return place;

  const dist = haversineMeters(place.latitude, place.longitude, demo.latitude, demo.longitude);
  const kowloonRef = { latitude: 22.3193, longitude: 114.1694 };
  const labelKowloon = KOWLOON_LABEL.test(demo.labelZh) || KOWLOON_LABEL.test(place.label);
  const coordsLookIslandSide =
    labelKowloon &&
    tripLikelyCrossesHarbour(kowloonRef, {
      latitude: place.latitude,
      longitude: place.longitude,
    });

  if (dist > 600 || coordsLookIslandSide) {
    return {
      ...place,
      latitude: demo.latitude,
      longitude: demo.longitude,
      label: demo.labelZh,
    };
  }
  return place;
}

/** 起終點標籤皆似九龍／同區，但座標觸發過海 → 修正終點（及起點） */
export function reconcileKowloonTripEndpoints<
  T extends { latitude: number; longitude: number; label: string },
>(pickup: T, dropoff: T): { pickup: T; dropoff: T } {
  let p = snapLatLngToKnownHkPlace(pickup);
  let d = snapLatLngToKnownHkPlace(dropoff);
  const pickupK = KOWLOON_LABEL.test(p.label);
  const dropK = KOWLOON_LABEL.test(d.label);
  if (pickupK && dropK && tripLikelyCrossesHarbour(p, d)) {
    d = snapLatLngToKnownHkPlace(d);
    p = snapLatLngToKnownHkPlace(p);
  }
  return { pickup: p, dropoff: d };
}
