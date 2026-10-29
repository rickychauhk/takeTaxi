import { useEffect, useMemo, useState } from 'react';
import { fetchDriverOrderTrack, type DriverOrderTrack } from '../api/driverOrderTrack';
import { normalizeHongKongCoord } from '../geo/hkCoords';
import { forwardGeocodeHongKong } from '../location/forwardGeocodeHongKong';
import type { GeoPoint, OrderOffer, TripPhase } from '../types/order';

function toPoint(lat: number | null | undefined, lng: number | null | undefined): GeoPoint | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return normalizeHongKongCoord({ latitude: lat, longitude: lng });
}

/** 行程座標與 track 輪詢（無 App 內地圖） */
export function useActiveTripNavigationMap(
  driverId: string | undefined,
  order: OrderOffer,
  phase: TripPhase,
) {
  const [track, setTrack] = useState<DriverOrderTrack | null>(null);
  const [trackLost, setTrackLost] = useState(false);
  const [geocodedPickup, setGeocodedPickup] = useState<GeoPoint | null>(null);
  const [geocodedDropoff, setGeocodedDropoff] = useState<GeoPoint | null>(null);

  useEffect(() => {
    if (!driverId) return;
    let cancelled = false;
    setTrackLost(false);

    const poll = async () => {
      try {
        const data = await fetchDriverOrderTrack(driverId, order.id);
        if (!cancelled) {
          setTrack(data);
          setTrackLost(false);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const unassigned =
          msg.includes('404') ||
          msg.includes('Not Found') ||
          msg.toLowerCase().includes('not assigned');
        if (!cancelled && unassigned) {
          setTrackLost(true);
        }
      }
    };

    void poll();
    const id = setInterval(() => void poll(), 2500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [driverId, order.id]);

  const pickupCoord = useMemo(() => {
    const fromTrack = toPoint(track?.pickup.lat, track?.pickup.lng);
    const fromOrder = order.pickupCoord ? normalizeHongKongCoord(order.pickupCoord) : null;
    return fromTrack ?? fromOrder ?? geocodedPickup;
  }, [track, order.pickupCoord, geocodedPickup]);

  const dropoffCoord = useMemo(() => {
    const fromTrack = toPoint(track?.dropoff.lat, track?.dropoff.lng);
    const fromOrder = order.dropoffCoord ? normalizeHongKongCoord(order.dropoffCoord) : null;
    return fromTrack ?? fromOrder ?? geocodedDropoff;
  }, [track, order.dropoffCoord, geocodedDropoff]);

  useEffect(() => {
    setGeocodedPickup(null);
    setGeocodedDropoff(null);
  }, [order.id]);

  useEffect(() => {
    if (pickupCoord || !order.pickupLabel?.trim()) return;
    let cancelled = false;
    void forwardGeocodeHongKong(order.pickupLabel).then((p) => {
      if (!cancelled && p) setGeocodedPickup(p);
    });
    return () => {
      cancelled = true;
    };
  }, [order.id, order.pickupLabel, pickupCoord]);

  useEffect(() => {
    if (dropoffCoord || !order.dropoffLabel?.trim()) return;
    let cancelled = false;
    void forwardGeocodeHongKong(order.dropoffLabel).then((p) => {
      if (!cancelled && p) setGeocodedDropoff(p);
    });
    return () => {
      cancelled = true;
    };
  }, [order.id, order.dropoffLabel, dropoffCoord]);

  const passengerLiveCoord = useMemo(
    () =>
      track?.passenger ? toPoint(track.passenger.lat, track.passenger.lng) : null,
    [track?.passenger],
  );

  const passengerDisplayCoord = useMemo(() => {
    if (phase === 'to_dropoff') return null;
    return passengerLiveCoord ?? pickupCoord;
  }, [phase, passengerLiveCoord, pickupCoord]);

  return {
    pickupCoord,
    dropoffCoord,
    passengerLiveCoord,
    passengerDisplayCoord,
    orderStatus: track?.status ?? null,
    trackLost,
  };
}

export type ActiveTripNavigationMapState = ReturnType<typeof useActiveTripNavigationMap>;
