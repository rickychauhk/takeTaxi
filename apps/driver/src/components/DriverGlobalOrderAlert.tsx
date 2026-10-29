import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { NewOrderAlertModal } from './NewOrderAlertModal';
import { postAndroidFullScreenNewOrderAlert } from '../native/incomingOrderWindow';
import { useAcceptIncomingOrderAlert } from '../hooks/useAcceptIncomingOrderAlert';
import { useAndroidIncomingOrderWindow } from '../hooks/useAndroidIncomingOrderWindow';
import { useDriverSession } from '../context/DriverSessionContext';
import { useNewOrderAlertSound } from '../hooks/useNewOrderAlertSound';
import {
  shouldSuppressHallNewOrderModal,
  subscribeDriverHallFocus,
} from '../navigation/driverHallFocus';
/** 全 App 層新柯打全屏（App 前景不彈；Android 背景全屏 intent） */
export function DriverGlobalOrderAlert() {
  const { state, tickAlert, rejectAlert } = useDriverSession();
  const { accepting, onAccept } = useAcceptIncomingOrderAlert();
  const [, setHallFocusEpoch] = useState(0);

  useEffect(() => subscribeDriverHallFocus(() => setHallFocusEpoch((n) => n + 1)), []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      setHallFocusEpoch((n) => n + 1);
      if (next === 'active') rejectAlert();
    });
    return () => sub.remove();
  }, [rejectAlert]);

  const visible = Boolean(
    state.alertOffer && state.online && !shouldSuppressHallNewOrderModal(),
  );
  useAndroidIncomingOrderWindow(visible, state.alertOffer?.id);
  useNewOrderAlertSound(state.alertOffer, state.online, state.alertPlaySound);

  useEffect(() => {
    if (Platform.OS !== 'android' || !visible || !state.alertOffer) return;
    if (AppState.currentState === 'active') return;
    const o = state.alertOffer;
    const body = `${o.pickupLabel} → ${o.dropoffLabel}`;
    postAndroidFullScreenNewOrderAlert(o.id, '新柯打', body);
  }, [visible, state.alertOffer?.id, state.alertOffer?.pickupLabel, state.alertOffer?.dropoffLabel]);

  return (
    <NewOrderAlertModal
      visible={visible}
      offer={state.alertOffer}
      secondsLeft={state.alertSecondsLeft}
      accepting={accepting}
      onAccept={() => void onAccept()}
      onReject={rejectAlert}
      onTick={tickAlert}
    />
  );
}
