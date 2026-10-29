import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { fetchPassengerMemberProfile, type PassengerMemberProfile } from '../api/passengerProfile';

const CACHE_KEY = 'taxima_passenger_member_profile';

export function usePassengerMemberProfile(enabled: boolean) {
  const [profile, setProfile] = useState<PassengerMemberProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPassengerMemberProfile();
      setProfile(data);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
      return data;
    } catch {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as PassengerMemberProfile;
          setProfile(parsed);
          return parsed;
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void (async () => {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          setProfile(JSON.parse(cached) as PassengerMemberProfile);
        } catch {
          /* ignore */
        }
      }
      await refresh();
    })();
  }, [enabled, refresh]);

  return { profile, loading, refresh };
}
