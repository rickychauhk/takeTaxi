import { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fetchDriverActiveOrder } from '../api/orders';
import { mapAvailableOrderToOffer } from '../api/mapAvailableOrder';
import { useDriverAuth } from '../auth/DriverAuthContext';
import { readActiveTripSnapshot } from '../auth/session';
import { useDriverSession } from '../context/DriverSessionContext';
import type { RootStackParamList } from '../navigation/types';
import { tripPhaseFromOrderStatus } from '../trip/tripPhaseFromStatus';

/** 登入後向 API 還原進行中柯打並進入行程畫面 */
export function useDriverLaunchSync() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { driver, token, bootstrapping: authBoot } = useDriverAuth();
  const { sessionReady, restoreActiveTrip, state } = useDriverSession();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (authBoot || !sessionReady || !driver?.id || !token || syncedRef.current) return;
    if (state.activeOrder && state.tripPhase) {
      syncedRef.current = true;
      navigation.navigate('ActiveTrip');
      return;
    }
    syncedRef.current = true;
    void (async () => {
      try {
        const row = await fetchDriverActiveOrder(driver.id);
        if (!row?.orderId) return;
        const phase = tripPhaseFromOrderStatus(row.status);
        if (!phase) return;
        restoreActiveTrip(mapAvailableOrderToOffer(row), phase);
        navigation.navigate('ActiveTrip');
      } catch {
        const local = await readActiveTripSnapshot();
        if (!local) return;
        restoreActiveTrip(
          {
            id: local.offer.id,
            pickupLabel: local.offer.pickupLabel,
            dropoffLabel: local.offer.dropoffLabel,
            fareEstimateHkd: local.offer.fareEstimateHkd,
            distanceKm: 0,
          },
          local.phase,
        );
        navigation.navigate('ActiveTrip');
      }
    })();
  }, [
    authBoot,
    sessionReady,
    driver?.id,
    token,
    navigation,
    restoreActiveTrip,
    state.activeOrder,
    state.tripPhase,
  ]);
}
