import { useEffect, useMemo, useState } from 'react';
import {
  emptyTunnelRoutePreference,
  tunnelBookingSelectionKey,
  tunnelRoutePreferenceFromSelectedIds,
  type TunnelRoutePreference,
} from '@taxima/shared';
import { fetchBookingOptions } from '../api/bookingOptions';

export type TunnelRoutePreferenceState = {
  preference: TunnelRoutePreference;
  tunnelSelectionKey: string;
  ready: boolean;
};

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
    return {
      preference: tunnelRoutePreferenceFromSelectedIds(selectedOptionIds, codeById),
      tunnelSelectionKey: tunnelBookingSelectionKey(selectedOptionIds, codeById),
      ready: true,
    };
  }, [selectedOptionIds, codeById]);
}
