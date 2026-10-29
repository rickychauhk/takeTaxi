import { useEffect, type ReactNode } from 'react';
import {
  initializeDriverOneSignal,
  setupDriverOneSignalPushSubscriptionVerification,
} from './DriverOneSignalService';

type Props = { children: ReactNode };

export function OneSignalBootstrap({ children }: Props) {
  useEffect(() => {
    if (initializeDriverOneSignal()) {
      setupDriverOneSignalPushSubscriptionVerification();
    }
  }, []);

  return children;
}
