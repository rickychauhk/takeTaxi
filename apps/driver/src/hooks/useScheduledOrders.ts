import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fetchScheduledOrders } from '../api/orders';
import { mapAvailableOrderToOffer } from '../api/mapAvailableOrder';
import { readDriverPosition } from '../location/readDriverPosition';
import { subscribeScheduledOrdersRefresh } from '../realtime/driverScheduledOrdersRefresh';
import type { OrderOffer } from '../types/order';

const POLL_MS = 30_000;

export function useScheduledOrders(
  driverId: string | undefined,
  maxPickupRadiusKm: number | null | undefined,
  enabled: boolean,
) {
  const [orders, setOrders] = useState<OrderOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!driverId || !enabled) {
      setOrders([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let coord: { latitude: number; longitude: number } | null = null;
      const fix = await readDriverPosition();
      if (fix.ok) coord = { latitude: fix.latitude, longitude: fix.longitude };
      const rows = await fetchScheduledOrders(driverId, maxPickupRadiusKm, coord);
      setOrders(rows.map((r) => mapAvailableOrderToOffer(r, coord)));
    } catch (e) {
      setError(e instanceof Error ? e.message : '無法載入預約柯打');
    } finally {
      setLoading(false);
    }
  }, [driverId, enabled, maxPickupRadiusKm]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (!enabled) return;
    return subscribeScheduledOrdersRefresh(() => {
      void refresh();
    });
  }, [enabled, refresh]);

  useEffect(() => {
    if (!driverId || !enabled) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }
    pollRef.current = setInterval(() => void refresh(), POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      sub.remove();
    };
  }, [driverId, enabled, refresh]);

  return { orders, loading, error, refresh };
}
