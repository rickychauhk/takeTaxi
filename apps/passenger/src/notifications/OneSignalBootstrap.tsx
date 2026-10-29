import { useEffect, useRef, type ReactNode } from 'react';
import {
  attachPassengerPushInboxListener,
  attachPushSubscriptionVerification,
  detachPushSubscriptionVerification,
  initializePassengerOneSignal,
} from './PassengerOneSignalService';

type Props = { children: ReactNode };

/**
 * Initializes OneSignal once at app root and retains the push-subscription observer (required by OneSignal).
 * Push permission is requested only from the integration verification dialog — not at launch.
 */
export function OneSignalBootstrap({ children }: Props) {
  initializePassengerOneSignal();

  const subscriptionListenerRef = useRef<
    ((event: { current: { id?: string | null } }) => void) | null
  >(null);

  useEffect(() => {
    const ok = initializePassengerOneSignal();
    let detachInbox = () => {};
    if (ok) {
      attachPushSubscriptionVerification(subscriptionListenerRef);
      detachInbox = attachPassengerPushInboxListener();
    }
    return () => {
      detachPushSubscriptionVerification(subscriptionListenerRef);
      detachInbox();
    };
  }, []);

  return children;
}
