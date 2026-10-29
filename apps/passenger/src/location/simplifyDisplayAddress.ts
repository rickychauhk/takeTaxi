/** 乘客 App 地圖／列表：縮短 reverse geocode 冗長行政層級 */

import {
  addressContainsRecognizableHkArea,
  normalizeHkAreaSegment,
} from './hkDisplayArea';

const DROP_EXACT = new Set([
  '中國',
  '香港',
  '香港特別行政區',
  '中国香港',
  '香港島',
  '香港岛',
  '九龍',
  '九龙',
  '新界',
  '離島',
  '离岛',
  'China',
  'Hong Kong',
  'Hong Kong SAR',
  'Hong Kong Island',
  'Kowloon',
  'New Territories',
]);

function shouldDropSegment(part: string): boolean {
  const p = part.trim();
  if (!p) return true;
  if (DROP_EXACT.has(p)) return true;
  const lower = p.toLowerCase();
  if (lower === 'hong kong' || lower === 'china') return true;
  return false;
}

function mergeStreetParts(parts: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const cur = parts[i]!;
    const next = parts[i + 1];
    if (/^\d+[A-Za-z]?$/.test(cur) && next && !shouldDropSegment(next)) {
      out.push(`${next} ${cur}號`.replace(/\s+/g, ' ').trim());
      i++;
      continue;
    }
    if (next && /^\d+[A-Za-z]?$/.test(next) && !shouldDropSegment(cur)) {
      out.push(`${cur} ${next}號`.replace(/\s+/g, ' ').trim());
      i++;
      continue;
    }
    out.push(cur);
  }
  return out;
}

/**
 * 將 Google/OSM 長地址縮為 2–3 段（例：寶園，高化利徑 9號，半山）
 */
export function simplifyPassengerDisplayAddress(raw: string): string {
  const text = raw.trim();
  if (!text) return text;

  let parts: string[];
  if (text.includes(',')) {
    parts = text.split(',').map((s) => s.trim()).filter(Boolean);
  } else if (text.includes('，')) {
    parts = text.split('，').map((s) => s.trim()).filter(Boolean);
  } else {
    return text;
  }

  parts = parts
    .filter((p) => !shouldDropSegment(p))
    .map((p) => normalizeHkAreaSegment(p))
    .filter(Boolean);

  parts = mergeStreetParts(parts);

  if (parts.length === 0) return text;

  const maxParts = 3;
  const areaPart =
    parts.find((p) => addressContainsRecognizableHkArea(p)) ??
    parts.find((p) => /(區|区)$/u.test(p));

  let kept = parts.slice(0, maxParts);
  if (areaPart && !kept.some((k) => k === areaPart || k.includes(areaPart) || areaPart.includes(k))) {
    if (kept.length >= maxParts) kept = [...kept.slice(0, maxParts - 1), normalizeHkAreaSegment(areaPart)];
    else kept.push(normalizeHkAreaSegment(areaPart));
  }

  if (kept.length === 1 && parts.length > 1) {
    return parts.slice(0, 2).join('，');
  }
  return kept.join('，');
}
