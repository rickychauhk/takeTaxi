import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useDriverSession } from '../context/DriverSessionContext';
import { requestScheduledOrdersRefresh } from '../realtime/driverScheduledOrdersRefresh';
import { scheduledOrderHallHintMessage } from '../trip/driverHallOrderDisplay';
import { useAcceptDriverOrder } from './useAcceptDriverOrder';

export function useAcceptIncomingOrderAlert() {
  const { state, rejectAlert } = useDriverSession();
  const { acceptOffer, acceptingOrderId } = useAcceptDriverOrder();

  const onAccept = useCallback(async () => {
    const offer = state.alertOffer;
    if (!offer) return;
    if (offer.scheduledAt?.trim()) {
      const ok = await acceptOffer(offer, { reserveOnly: true });
      if (!ok) return;
      rejectAlert();
      requestScheduledOrdersRefresh();
      Alert.alert('已接受預約', scheduledOrderHallHintMessage(offer.scheduledAt), [
        { text: '知道了' },
      ]);
      return;
    }
    await acceptOffer(offer);
  }, [acceptOffer, rejectAlert, state.alertOffer]);

  const accepting = Boolean(state.alertOffer && acceptingOrderId === state.alertOffer.id);

  return { accepting, onAccept, rejectAlert };
}
