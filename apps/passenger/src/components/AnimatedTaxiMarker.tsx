import { useEffect, useRef } from 'react';
import { Marker } from 'react-native-maps';
import type { MapMarker } from 'react-native-maps';
import { TaxiMarker } from './TaxiMarker';
import { distanceMetersApprox } from '../geo/bearingDegrees';

type Props = {
  latitude: number;
  longitude: number;
  rotation?: number;
  /** 與位置輪詢間隔接近，兩次更新之間平滑移動 */
  animateDurationMs?: number;
  zIndex?: number;
};

/**
 * 移動中的的士 pin：用 animateMarkerToCoordinate，iOS / Android 自訂 Marker 都會跟住 GPS 更新。
 */
export function AnimatedTaxiMarker({
  latitude,
  longitude,
  rotation = 0,
  animateDurationMs = 3800,
  zIndex = 5,
}: Props) {
  const markerRef = useRef<MapMarker>(null);
  const last = useRef({ latitude, longitude });
  const seeded = useRef(false);

  useEffect(() => {
    const prev = last.current;
    const next = { latitude, longitude };
    const jumpM = distanceMetersApprox(prev.latitude, prev.longitude, latitude, longitude);

    if (!seeded.current) {
      seeded.current = true;
    } else if (jumpM > 400) {
      markerRef.current?.animateMarkerToCoordinate(next, 0);
    } else if (prev.latitude !== latitude || prev.longitude !== longitude) {
      markerRef.current?.animateMarkerToCoordinate(next, animateDurationMs);
    }
    last.current = next;
  }, [latitude, longitude, animateDurationMs]);

  return (
    <Marker
      ref={markerRef}
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      flat
      rotation={rotation}
      zIndex={zIndex}
    >
      <TaxiMarker />
    </Marker>
  );
}
