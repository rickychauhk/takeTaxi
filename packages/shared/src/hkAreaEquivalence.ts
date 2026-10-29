/**
 * CRM 地區配對：同一行政分區內細分區視為同一地區（起點／終點皆可互配）。
 * 例：尖沙咀→尖沙咀 獎賞，上車旺角、落車尖沙咀亦算。
 */

/** 油尖旺區常見細分（含 CRM 下拉「油尖旺」） */
export const HK_YAU_TSIM_MONG_CLUSTER = [
  '油尖旺',
  '尖沙咀',
  '旺角',
  '油麻地',
  '佐敦',
] as const;

const EN_BY_ZH: Record<string, readonly string[]> = {
  油尖旺: ['yau tsim mong', 'yau tsim', 'tsim mong'],
  尖沙咀: ['tsim sha tsui', 'tsim sha tsui kowloon'],
  旺角: ['mong kok'],
  油麻地: ['yau ma tei'],
  佐敦: ['jordan', 'jordan road'],
};

/** 可擴充更多分區群組 */
export const HK_AREA_EQUIVALENCE_GROUPS: readonly (readonly string[])[] = [
  HK_YAU_TSIM_MONG_CLUSTER,
];

function normalizeAreaKey(area: string): string {
  return area.trim().replace(/區$/, '');
}

function groupForCrmArea(area: string): readonly string[] | null {
  const key = normalizeAreaKey(area);
  if (!key) return null;
  for (const group of HK_AREA_EQUIVALENCE_GROUPS) {
    for (const member of group) {
      const m = normalizeAreaKey(member);
      if (key === m || key.includes(m) || m.includes(key)) return group;
    }
  }
  return null;
}

/** 配對規則中的地區 → 地址字串需匹配的關鍵字（繁中 + 英文） */
export function hkAreaMatchersForRule(crmArea: string): string[] {
  const trimmed = crmArea.trim();
  if (!trimmed) return [];
  const group = groupForCrmArea(trimmed);
  const zhMembers = group ? [...group] : [normalizeAreaKey(trimmed)];
  const out = new Set<string>();
  for (const zh of zhMembers) {
    if (zh) out.add(zh);
    for (const en of EN_BY_ZH[zh] ?? []) out.add(en);
  }
  if (!group) {
    const lower = trimmed.toLowerCase();
    if (lower !== trimmed) out.add(lower);
  }
  return [...out];
}
