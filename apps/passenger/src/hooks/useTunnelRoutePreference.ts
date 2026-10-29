import { useEffect, useMemo, useState } from 'react';
import {
  coalesceHarbourTunnelPreference,
  emptyTunnelRoutePreference,
  tunnelBookingSelectionKey,
  tunnelRoutePreferenceFromSelectedIds,
  type TunnelRoutePreference,
} from '@taxima/shared';
import { fetchBookingOptions } from '../api/bookingOptions';

export type TunnelRoutePreferenceState = {
  preference: TunnelRoutePreference;
  /** 隧道相關 booking option ids；變更時應重新規劃路線 */
  tunnelSelectionKey: string;
  ready: boolean;
};

/** 由「更多選項」已選 id 解析隧道偏好（供路線規劃） */
export function useTunnelRoutePreference(selectedOptionIds: number[]): TunnelRoutePreferenceState {
  const [codeById, setCodeById] = useState<Map<number, string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchBookingOptions().then(({ categories }) => {
      if (cancelled) return;
      const map = new Map<number, string>();
      for (const cat of categories) {
        for (const opt of cat.options) {
          map.set(opt.id, opt.code);
        }
      }
      setCodeById(map);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    if (!codeById) {
      return {
        preference: emptyTunnelRoutePreference(),
        tunnelSelectionKey: '',
        ready: false,
      };
    }
    const preference = coalesceHarbourTunnelPreference(
      tunnelRoutePreferenceFromSelectedIds(selectedOptionIds, codeById),
    );
    return {
      preference,
      tunnelSelectionKey: tunnelBookingSelectionKey(selectedOptionIds, codeById),
      ready: true,
    };
  }, [selectedOptionIds, codeById]);
}
