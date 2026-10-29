import { isBusyHourInHongKong, type DriverBusyHoursConfig } from './driverBusyHours';
import { hkAreaMatchersForRule } from './hkAreaEquivalence';

export type DriverBusyRegionRewardRule = {
  id: string;
  fromArea: string;
  toArea: string;
  rewardPoints: number;
};

export type DriverBusyRegionRewardsConfig = {
  enabled: boolean;
  rules: DriverBusyRegionRewardRule[];
};

export function emptyDriverBusyRegionRewardsConfig(): DriverBusyRegionRewardsConfig {
  return { enabled: true, rules: [] };
}

function normalizeRule(raw: unknown): DriverBusyRegionRewardRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as {
    id?: unknown;
    fromArea?: unknown;
    toArea?: unknown;
    rewardPoints?: unknown;
  };
  const fromArea = typeof o.fromArea === 'string' ? o.fromArea.trim() : '';
  const toArea = typeof o.toArea === 'string' ? o.toArea.trim() : '';
  const rewardPoints = Math.round(Number(o.rewardPoints ?? 0));
  if (!fromArea || !toArea || rewardPoints <= 0) return null;
  const id =
    typeof o.id === 'string' && o.id.trim()
      ? o.id.trim()
      : `rule-${fromArea}-${toArea}-${rewardPoints}`;
  return { id, fromArea, toArea, rewardPoints };
}

export function parseDriverBusyRegionRewardsConfig(
  raw: string | null | undefined,
): DriverBusyRegionRewardsConfig {
  const base = emptyDriverBusyRegionRewardsConfig();
  if (!raw?.trim()) return base;
  try {
    const parsed = JSON.parse(raw) as { enabled?: unknown; rules?: unknown[] };
    if (typeof parsed.enabled === 'boolean') base.enabled = parsed.enabled;
    if (Array.isArray(parsed.rules)) {
      const rules: DriverBusyRegionRewardRule[] = [];
      for (const item of parsed.rules) {
        const rule = normalizeRule(item);
        if (rule) rules.push(rule);
      }
      base.rules = rules;
    }
  } catch {
    /* defaults */
  }
  return base;
}

export function serializeDriverBusyRegionRewardsConfig(
  config: DriverBusyRegionRewardsConfig,
): string {
  const normalized = emptyDriverBusyRegionRewardsConfig();
  normalized.enabled = Boolean(config.enabled);
  normalized.rules = (config.rules ?? [])
    .map((r) => normalizeRule(r))
    .filter((r): r is DriverBusyRegionRewardRule => r != null);
  return JSON.stringify(normalized);
}

function addressContainsAreaToken(hay: string, needle: string): boolean {
  const n = needle.trim().toLowerCase();
  if (!n) return false;
  if (hay.includes(n)) return true;
  const withoutDistrict = n.replace(/區$/, '');
  if (withoutDistrict.length >= 2 && hay.includes(withoutDistrict)) return true;
  return false;
}

/** 地址是否包含所選地區（含同一分區群組，例如油尖旺／尖沙咀／旺角／油麻地互視同區） */
export function addressMatchesHkArea(address: string | null | undefined, area: string): boolean {
  if (!address?.trim() || !area?.trim()) return false;
  const hay = address.trim().toLowerCase();
  for (const token of hkAreaMatchersForRule(area)) {
    if (addressContainsAreaToken(hay, token)) return true;
  }
  return false;
}

export function findMatchingBusyRegionRewardRule(
  pickupAddress: string | null | undefined,
  dropoffAddress: string | null | undefined,
  rules: DriverBusyRegionRewardRule[],
): DriverBusyRegionRewardRule | null {
  for (const rule of rules) {
    if (
      addressMatchesHkArea(pickupAddress, rule.fromArea) &&
      addressMatchesHkArea(dropoffAddress, rule.toArea)
    ) {
      return rule;
    }
  }
  return null;
}

export function resolveBusyRegionRewardAtAccept(input: {
  placedAt: Date;
  pickupAddress: string | null | undefined;
  dropoffAddress: string | null | undefined;
  busyHours: DriverBusyHoursConfig;
  regionRewards: DriverBusyRegionRewardsConfig;
}): DriverBusyRegionRewardRule | null {
  if (!input.regionRewards.enabled) return null;
  if (!isBusyHourInHongKong(input.placedAt, input.busyHours)) return null;
  return findMatchingBusyRegionRewardRule(
    input.pickupAddress,
    input.dropoffAddress,
    input.regionRewards.rules,
  );
}
