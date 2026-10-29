/** 香港地址搜尋：產生多個查詢變體（座數繁中／阿拉伯數字等） */
export function expandHkPlaceSearchQueries(raw: string): string[] {
  const base = raw.trim().replace(/\s+/g, '');
  if (!base) return [];

  const variants = new Set<string>();
  const add = (s: string) => {
    const t = s.trim().replace(/\s+/g, '');
    if (t.length >= 2) variants.add(t);
  };

  add(base);

  const block = base.match(/^(.*?)([一二三四五六七八九十百千\d]+)座$/);
  if (block) {
    const prefix = block[1] ?? '';
    const numPart = block[2] ?? '';
    const n = parseChineseOrArabicBlockNumber(numPart);
    if (n != null && n > 0) {
      add(`${prefix}${n}座`);
      add(`${prefix}第${n}座`);
      add(`${prefix}${numPart}座`);
    }
  }

  if (!base.includes('香港') && !/hong\s*kong/i.test(base)) {
    for (const v of [...variants]) {
      add(`${v}, 香港`);
      add(`${v} 香港`);
    }
  }

  return [...variants];
}

function parseChineseOrArabicBlockNumber(part: string): number | null {
  const p = part.trim();
  if (/^\d+$/.test(p)) return parseInt(p, 10);
  const digit: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  if (p === '十') return 10;
  if (p.startsWith('十')) return 10 + (digit[p[1]!] ?? 0);
  if (p.endsWith('十') && p.length === 2) return (digit[p[0]!] ?? 0) * 10;
  if (p.includes('十')) {
    const [a, b] = p.split('十');
    const tens = a ? (digit[a] ?? 0) : 1;
    const ones = b ? (digit[b] ?? 0) : 0;
    return tens * 10 + ones;
  }
  if (digit[p] != null) return digit[p]!;
  return null;
}

export function rankPlaceLabelSpecificity(query: string, label: string): number {
  const q = query.trim().replace(/\s+/g, '').toLowerCase();
  const l = label.trim().replace(/\s+/g, '').toLowerCase();
  if (!q || !l) return 0;
  if (l.includes(q)) return 1000 + q.length;
  const blockInQ = q.match(/([一二三四五六七八九十\d]+座|第\d+座)/);
  if (blockInQ && !l.includes(blockInQ[1]!) && !l.includes(blockInQ[1]!.replace(/^第/, ''))) {
    return -200;
  }
  let hit = 0;
  for (let i = 0; i < q.length - 1; i++) {
    const bigram = q.slice(i, i + 2);
    if (l.includes(bigram)) hit += 1;
  }
  return hit;
}
