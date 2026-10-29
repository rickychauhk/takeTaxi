import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import type { DriverCancelReportCode } from '@taxima/shared';
import { cancelDriverOrder } from '../api/orders';

type Options = {
  driverId: string | undefined;
  onSuccess?: () => void | Promise<void>;
  isBusy?: () => boolean;
};

export function useDriverCancelOrderSheet({ driverId, onSuccess, isBusy }: Options) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const closeSheet = useCallback(() => {
    if (cancelling) return;
    setSheetOpen(false);
    setPendingOrderId(null);
  }, [cancelling]);

  const runCancel = useCallback(
    async (orderId: string, cancelReportCode?: DriverCancelReportCode) => {
      if (!driverId || cancelling) return;
      setCancelling(true);
      try {
        await cancelDriverOrder(driverId, orderId, cancelReportCode);
        setSheetOpen(false);
        setPendingOrderId(null);
        await onSuccess?.();
      } catch (e) {
        const msg = e instanceof Error ? e.message : '無法取消訂單';
        Alert.alert('取消失敗', msg);
      } finally {
        setCancelling(false);
      }
    },
    [cancelling, closeSheet, driverId, onSuccess],
  );

  const openCancelSheet = useCallback(
    (orderId: string) => {
      if (!driverId || isBusy?.() || cancelling) return;
      setPendingOrderId(orderId);
      setSheetOpen(true);
    },
    [cancelling, driverId, isBusy],
  );

  const onDirectCancel = useCallback(() => {
    if (!pendingOrderId) return;
    void runCancel(pendingOrderId);
  }, [pendingOrderId, runCancel]);

  const onCancelWithReport = useCallback(
    (code: DriverCancelReportCode) => {
      if (!pendingOrderId) return;
      void runCancel(pendingOrderId, code);
    },
    [pendingOrderId, runCancel],
  );

  return {
    sheetOpen,
    cancelling,
    cancellingOrderId: cancelling ? pendingOrderId : null,
    closeSheet,
    openCancelSheet,
    onDirectCancel,
    onCancelWithReport,
  };
}
