import { useEffect } from 'react';
import { Platform } from 'react-native';
import {
  activateAndroidIncomingOrderDisplay,
  bringAndroidMainActivityToFront,
  deactivateAndroidIncomingOrderDisplay,
} from '../native/incomingOrderWindow';

/** Android：新柯打彈窗時亮屏、鎖屏上顯示，並嘗試置前主 Activity */
export function useAndroidIncomingOrderWindow(alertVisible: boolean, orderId: string | null | undefined) {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (alertVisible) {
      activateAndroidIncomingOrderDisplay();
      if (orderId) bringAndroidMainActivityToFront(orderId);
      return () => deactivateAndroidIncomingOrderDisplay();
    }
    deactivateAndroidIncomingOrderDisplay();
  }, [alertVisible, orderId]);
}
