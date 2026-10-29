import { HK_AREA_VALUES } from '@taxima/shared';

type AddressComponent = {
  long_name: string;
  types: string[];
};

const TYPE_PRIORITY: Record<string, number> = {
  sublocality_level_1: 0,
  sublocality: 1,
  administrative_area_level_1: 2,
  neighborhood: 3,
  locality: 4,
  administrative_area_level_2: 5,
};

/** 18 區等：顯示時去掉「區」字（保留半山等非 *區 地名） */
export function stripHkDistrictSuffix(name: string): string {
  return name.trim().replace(/(區|区)$/u, '');
}

export function normalizeHkAreaSegment(part: string): string {
  const p = part.trim();
  if (!p) return p;
  if (/(區|区)$/u.test(p)) return stripHkDistrictSuffix(p);
  return p;
}

/** 地址是否已含 CRM／司機可辨識的地區名（旺角、尖沙咀等） */
export function addressContainsRecognizableHkArea(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  for (const area of HK_AREA_VALUES) {
    if (t.includes(area)) return true;
  }
  for (const area of HK_AREA_VALUES) {
    const bare = stripHkDistrictSuffix(area);
    if (bare !== area && bare.length >= 2 && t.includes(bare)) return true;
  }
  if (/tsim sha tsui|mong kok|yau ma tei|jordan|causeway bay|wan chai|central|kowloon|tsuen wan|sha tin|tuen mun|yuen long/i.test(t)) {
    return true;
  }
  return false;
}

function scoreHkAreaCandidate(raw: string, typePri: number): { score: number; label: string } {
  const normalized = stripHkDistrictSuffix(raw);
  let score = 0;
  let matchedLabel: string | null = null;

  for (const v of HK_AREA_VALUES) {
    if (normalized === v || raw === v) {
      score = 2000 - typePri * 10 + v.length;
      matchedLabel = v;
      break;
    }
    if (normalized.includes(v) || v.includes(normalized)) {
      const s = 1500 - typePri * 10;
      if (s > score) {
        score = s;
        matchedLabel = v;
      }
    }
  }

  if (!matchedLabel && /(區|区)$/u.test(raw) && normalized.length >= 2) {
    score = Math.max(score, 650 - typePri * 10);
    matchedLabel = normalized;
  }

  if (!matchedLabel && normalized.length >= 2) {
    score = Math.max(score, 180 - typePri * 15);
    matchedLabel = normalized;
  }

  return { score, label: matchedLabel ?? normalized };
}

/** 從 Google address_components 揀最適合顯示嘅地區名 */
export function bestHkAreaFromGoogleComponents(
  components: AddressComponent[] | undefined,
): string | null {
  if (!components?.length) return null;

  let bestScore = -1;
  let bestLabel: string | null = null;

  for (const c of components) {
    const raw = c.long_name?.trim();
    if (!raw) continue;

    let typePri = 99;
    for (const [type, pri] of Object.entries(TYPE_PRIORITY)) {
      if (c.types.includes(type)) typePri = Math.min(typePri, pri);
    }
    if (typePri === 99) continue;

    const { score, label } = scoreHkAreaCandidate(raw, typePri);
    if (score > bestScore && label) {
      bestScore = score;
      bestLabel = label;
    }
  }

  if (bestLabel && bestScore >= 500) return bestLabel;
  if (bestLabel && bestScore >= 180) return bestLabel;
  return null;
}

/** 地圖選點：若地址未含地區名，補上 reverse geocode 揀出嘅地區 */
export function ensureMinimumHkAreaInAddress(
  line: string,
  components?: AddressComponent[],
): string {
  const trimmed = line.trim();
  if (!trimmed) return trimmed;
  if (addressContainsRecognizableHkArea(trimmed)) return trimmed;

  const area = bestHkAreaFromGoogleComponents(components);
  if (!area || trimmed.includes(area)) return trimmed;
  return `${trimmed}，${area}`;
}
