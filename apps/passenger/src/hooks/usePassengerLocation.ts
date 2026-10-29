import { useCallback, useEffect, useState } from 'react';
import type { LatLng } from '../constants/demoDestinations';
import { useI18n } from '../i18n/I18nProvider';
import { ensureDisplayPlaceLabel } from '../location/labelForOrderStorage';
import {
  getDevicePosition,
  hintForPositionFailure,
  messageForPositionFailure,
} from '../location/getDevicePosition';

export function usePassengerLocation() {
  const { locale } = useI18n();
  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorHint(null);
    const result = await getDevicePosition(locale);
    if (result.ok) {
      const place = await ensureDisplayPlaceLabel(result.place);
      setPickup(place);
      setLoading(false);
      return place;
    }
    setPickup(null);
    setError(messageForPositionFailure(result.reason));
    setErrorHint(hintForPositionFailure(result.reason));
    setLoading(false);
    return null;
  }, [locale]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!loading) return;
    const safety = setTimeout(() => {
      setPickup((current) => {
        if (current) return current;
        setError(messageForPositionFailure('unavailable'));
        setErrorHint(hintForPositionFailure('unavailable'));
        return null;
      });
      setLoading(false);
    }, 32_000);
    return () => clearTimeout(safety);
  }, [loading]);

  return { pickup, loading, error, errorHint, refresh };
}
