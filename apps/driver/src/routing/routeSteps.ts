import { haversineMeters } from '../geo/navigationGeometry';
import type { Coord } from './fetchDrivingRoute';

export type RouteStep = {
  distanceMeters: number;
  instruction: string;
  streetName: string;
  maneuver: string | null;
  endLocation: Coord;
};

export function stripHtmlInstructions(html: string): string {
  return html
    .replace(/<div[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 由 Google step 文字抽出路名（最後一段） */
export function extractStreetName(instruction: string): string {
  const onIdx = instruction.search(/(?:上|入|到|向|往|沿)/);
  if (onIdx >= 0) {
    const tail = instruction.slice(onIdx).replace(/^[^A-Za-z0-9\u4e00-\u9fff]+/, '');
    if (tail.length >= 2) return tail.slice(0, 48);
  }
  const parts = instruction.split(/[,，]/);
  const last = parts[parts.length - 1]?.trim();
  return last && last.length >= 2 ? last.slice(0, 48) : instruction.slice(0, 48);
}

export function findActiveStepIndex(driver: Coord, steps: RouteStep[]): number {
  if (!steps.length) return 0;
  for (let i = 0; i < steps.length; i++) {
    const end = steps[i]!.endLocation;
    if (haversineMeters(driver, end) >= 40) return i;
  }
  return steps.length - 1;
}

export function distanceToStepEndMeters(driver: Coord, step: RouteStep): number {
  return haversineMeters(driver, step.endLocation);
}

export function formatNavDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} 公里`;
  if (meters >= 500) return `${Math.round(meters / 100) * 100} 米`;
  return `${Math.max(20, Math.round(meters / 10) * 10)} 米`;
}

export type ManeuverIcon = 'straight' | 'left' | 'right' | 'uturn' | 'merge' | 'roundabout' | 'arrive';

export function maneuverToIcon(maneuver: string | null): ManeuverIcon {
  const m = (maneuver ?? '').toLowerCase();
  if (m.includes('uturn') || m.includes('u-turn')) return 'uturn';
  if (m.includes('roundabout')) return 'roundabout';
  if (m.includes('merge') || m.includes('ramp')) return 'merge';
  if (m.includes('left')) return 'left';
  if (m.includes('right')) return 'right';
  if (m.includes('straight') || m.includes('continue')) return 'straight';
  if (m.includes('arrive') || m.includes('destination')) return 'arrive';
  return 'straight';
}
