import { useEffect } from 'react';
import { Platform } from 'react-native';
import { attachDriverPushForegroundNewOrderHandler } from './DriverOneSignalService';

/** iOS：前景唔顯示新柯打 push（待派由 WebSocket）；背景仍收 APNs */
export function DriverIosIncomingPush() {
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const detach = attachDriverPushForegroundNewOrderHandler((event) => {
      event.preventDefault();
    });

    return detach;
  }, []);

  return null;
}
