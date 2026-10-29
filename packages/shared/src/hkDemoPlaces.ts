/** 與乘客 App demo 目的地一致，供 CRM 英文地址對應繁中 */
export type HkDemoPlace = {
  latitude: number;
  longitude: number;
  labelZh: string;
  labelEn: string;
};

export const HK_DEMO_PLACES: HkDemoPlace[] = [
  {
    latitude: 22.3193,
    longitude: 114.1694,
    labelZh: '何文田孝民街愛民邨康民樓',
    labelEn: 'Hong Ning House, Oi Man Estate, Ho Man Tin',
  },
  {
    latitude: 22.2938,
    longitude: 114.1689,
    labelZh: '尖沙咀海港城',
    labelEn: 'Harbour City, Tsim Sha Tsui',
  },
  {
    latitude: 22.2855,
    longitude: 114.1577,
    labelZh: '中環國際金融中心',
    labelEn: 'International Finance Centre, Central',
  },
  {
    latitude: 22.3704,
    longitude: 114.1185,
    labelZh: '葵涌石排街',
    labelEn: 'Shek Pai Street, Kwai Chung',
  },
  {
    latitude: 22.3688,
    longitude: 114.1272,
    labelZh: '葵涌圍乪街石籬（一）邨商場',
    labelEn: 'Shek Lei (I) Estate Shopping Centre, Kwai Chung',
  },
  {
    latitude: 22.3695,
    longitude: 114.1265,
    labelZh: '葵涌圍乪街石籬邨石安樓',
    labelEn: 'Shek On House, Shek Lei Estate, Kwai Chung',
  },
  {
    latitude: 22.3672,
    longitude: 114.1318,
    labelZh: '葵涌大隴街友明大廈',
    labelEn: 'Yau Ming Building, Tai Loong Street, Kwai Chung',
  },
  {
    latitude: 22.3668,
    longitude: 114.1325,
    labelZh: '葵涌大隴街昌榮樓',
    labelEn: 'Cheong Wing House, Tai Loong Street, Kwai Chung',
  },
  {
    latitude: 22.3659,
    longitude: 114.1331,
    labelZh: '葵涌大隴街石籬（二）邨',
    labelEn: 'Shek Lei (II) Estate, Tai Loong Street, Kwai Chung',
  },
  {
    latitude: 22.3364,
    longitude: 114.1936,
    labelZh: '旺角朗豪坊',
    labelEn: 'Langham Place, Mong Kok',
  },
  {
    latitude: 22.2477,
    longitude: 114.2035,
    labelZh: '香港海洋公園',
    labelEn: 'Ocean Park Hong Kong',
  },
];

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

export function hasCjk(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text);
}

/** CRM／後台：盡量顯示繁中地址（demo 英↔中、座標就近） */
export function addressForCrmDisplay(
  addressText: string | null | undefined,
  lat?: number | null,
  lng?: number | null,
): string | null {
  if (addressText == null) return null;
  const text = addressText.trim();
  if (!text) return null;
  if (hasCjk(text)) return text;

  const lower = text.toLowerCase();
  for (const p of HK_DEMO_PLACES) {
    if (p.labelEn.toLowerCase() === lower) return p.labelZh;
  }
  for (const p of HK_DEMO_PLACES) {
    const en = p.labelEn.toLowerCase();
    if (lower.includes(en) || en.includes(lower)) return p.labelZh;
  }

  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    let best: HkDemoPlace | null = null;
    let bestD = 250;
    for (const p of HK_DEMO_PLACES) {
      const d = haversineMeters(lat, lng, p.latitude, p.longitude);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (best) return best.labelZh;
  }

  return text;
}
