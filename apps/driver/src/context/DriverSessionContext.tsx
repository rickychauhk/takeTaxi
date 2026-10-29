import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';
import { useDriverAuth } from '../auth/DriverAuthContext';
import {
  persistActiveOrderId,
  persistActiveTripSnapshot,
  persistDriverOnline,
} from '../auth/session';
import {
  addTodayOnlineMinutes,
  readTodayOnlineMinutesAccumulated,
} from '../earnings/todayOnlineTime';
import { playNewOrderAlertIfEnabled } from '../audio/newOrderAlertSound';
import { createMockIncomingOrder } from '../data/mockOrders';
import {
  isDriverHallFocused,
  shouldSuppressHallNewOrderModal,
} from '../navigation/driverHallFocus';
import type { DriverAction, DriverAppState, OrderOffer, TripPhase } from '../types/order';

const initialEarnings = { todayHkd: 486, tripCount: 4, onlineMinutes: 0 };

const initialState: DriverAppState = {
  online: false,
  alertOffer: null,
  alertPlaySound: true,
  alertSecondsLeft: 10,
  availableOrders: [],
  activeOrder: null,
  tripPhase: null,
  earnings: initialEarnings,
  onlineSince: null,
  dismissedAlertIds: [],
};

function reducer(state: DriverAppState, action: DriverAction): DriverAppState {
  switch (action.type) {
    case 'SET_ONLINE':
      return {
        ...state,
        online: action.online,
        onlineSince: action.online ? Date.now() : null,
        alertOffer: action.online ? state.alertOffer : null,
        alertSecondsLeft: 10,
        availableOrders: action.online ? state.availableOrders : [],
        dismissedAlertIds: action.online ? state.dismissedAlertIds : [],
      };
    case 'SET_AVAILABLE_ORDERS':
      return { ...state, availableOrders: action.orders };
    case 'REMOVE_AVAILABLE_ORDER':
      return {
        ...state,
        availableOrders: state.availableOrders.filter((o) => o.id !== action.orderId),
      };
    case 'SHOW_ALERT':
      if (state.activeOrder) return state;
      return {
        ...state,
        alertOffer: action.offer,
        alertPlaySound: action.playSound !== false,
        alertSecondsLeft: 10,
      };
    case 'TICK_ALERT': {
      if (!state.alertOffer) return state;
      const next = state.alertSecondsLeft - 1;
      if (next <= 0) {
        return { ...state, alertOffer: null, alertPlaySound: true, alertSecondsLeft: 10 };
      }
      return { ...state, alertSecondsLeft: next };
    }
    case 'DISMISS_ALERT': {
      const dismissedId = state.alertOffer?.id;
      return {
        ...state,
        alertOffer: null,
        alertPlaySound: true,
        alertSecondsLeft: 10,
        dismissedAlertIds: dismissedId
          ? [...new Set([...state.dismissedAlertIds, dismissedId])]
          : state.dismissedAlertIds,
      };
    }
    case 'ACCEPT_ORDER': {
      const accepted = action.offer ?? state.alertOffer;
      if (!accepted) return state;
      return {
        ...state,
        activeOrder: accepted,
        tripPhase: 'to_pickup',
        alertOffer: null,
        alertPlaySound: true,
        alertSecondsLeft: 10,
        availableOrders: state.availableOrders.filter((o) => o.id !== accepted.id),
      };
    }
    case 'RESTORE_ACTIVE_TRIP':
      return {
        ...state,
        online: true,
        onlineSince: state.onlineSince ?? Date.now(),
        activeOrder: action.offer,
        tripPhase: action.phase,
        alertOffer: null,
        alertSecondsLeft: 10,
      };
    case 'SET_TRIP_PHASE':
      return { ...state, tripPhase: action.phase };
    case 'CLEAR_LOCAL_TRIP':
      return {
        ...state,
        activeOrder: null,
        tripPhase: null,
        alertOffer: null,
        alertSecondsLeft: 10,
      };
    case 'COMPLETE_TRIP': {
      if (!state.activeOrder) return state;
      const fare = state.activeOrder.fareEstimateHkd;
      return {
        ...state,
        activeOrder: null,
        tripPhase: null,
        earnings: {
          todayHkd: state.earnings.todayHkd + fare,
          tripCount: state.earnings.tripCount + 1,
          onlineMinutes: state.earnings.onlineMinutes,
        },
      };
    }
    case 'SET_EARNINGS_ONLINE_MINUTES':
      return {
        ...state,
        earnings: { ...state.earnings, onlineMinutes: Math.max(0, Math.round(action.minutes)) },
      };
    default:
      return state;
  }
}

type Ctx = {
  state: DriverAppState;
  sessionReady: boolean;
  setOnline: (online: boolean) => void;
  setAvailableOrders: (orders: OrderOffer[]) => void;
  removeAvailableOrder: (orderId: string) => void;
  showIncomingOffer: (offer: OrderOffer, options?: { playSound?: boolean }) => void;
  acceptAlert: (offer?: OrderOffer) => void;
  rejectAlert: () => void;
  tickAlert: () => void;
  advanceTrip: () => void;
  setTripPhase: (phase: TripPhase) => void;
  clearLocalTrip: () => void;
  restoreActiveTrip: (offer: OrderOffer, phase: TripPhase) => void;
  simulateIncomingOrder: () => void;
  dismissedOfferIds: Set<string>;
};

const DriverSessionContext = createContext<Ctx | null>(null);

export function DriverSessionProvider({ children }: { children: ReactNode }) {
  const { token } = useDriverAuth();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const mins = await readTodayOnlineMinutesAccumulated();
      dispatch({ type: 'SET_EARNINGS_ONLINE_MINUTES', minutes: mins });
      setSessionReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!token) {
      dispatch({ type: 'SET_ONLINE', online: false });
    }
  }, [token]);

  useEffect(() => {
    if (!sessionReady) return;
    void persistDriverOnline(state.online);
  }, [state.online, sessionReady]);

  useEffect(() => {
    if (!sessionReady) return;
    void persistActiveOrderId(state.activeOrder?.id ?? null);
  }, [state.activeOrder?.id, sessionReady]);

  useEffect(() => {
    if (!sessionReady) return;
    if (state.activeOrder && state.tripPhase) {
      void persistActiveTripSnapshot({
        offer: {
          id: state.activeOrder.id,
          pickupLabel: state.activeOrder.pickupLabel,
          dropoffLabel: state.activeOrder.dropoffLabel,
          fareEstimateHkd: state.activeOrder.fareEstimateHkd,
        },
        phase: state.tripPhase,
      });
    } else {
      void persistActiveTripSnapshot(null);
    }
  }, [state.activeOrder, state.tripPhase, sessionReady]);

  const setOnline = useCallback(
    (online: boolean) => {
      void (async () => {
        if (!online && state.online && state.onlineSince != null) {
          const deltaMin = (Date.now() - state.onlineSince) / 60_000;
          const total = await addTodayOnlineMinutes(deltaMin);
          dispatch({ type: 'SET_EARNINGS_ONLINE_MINUTES', minutes: total });
        }
        dispatch({ type: 'SET_ONLINE', online });
      })();
    },
    [state.online, state.onlineSince],
  );

  const setAvailableOrders = useCallback((orders: OrderOffer[]) => {
    dispatch({ type: 'SET_AVAILABLE_ORDERS', orders });
  }, []);

  const removeAvailableOrder = useCallback((orderId: string) => {
    dispatch({ type: 'REMOVE_AVAILABLE_ORDER', orderId });
  }, []);

  const showIncomingOffer = useCallback((offer: OrderOffer, options?: { playSound?: boolean }) => {
    if (shouldSuppressHallNewOrderModal()) {
      if (isDriverHallFocused() && options?.playSound !== false) {
        void playNewOrderAlertIfEnabled(offer);
      }
      return;
    }
    dispatch({ type: 'SHOW_ALERT', offer, playSound: options?.playSound });
  }, []);

  const clearLocalTrip = useCallback(() => {
    dispatch({ type: 'CLEAR_LOCAL_TRIP' });
  }, []);

  const acceptAlert = useCallback((offer?: OrderOffer) => {
    dispatch({ type: 'ACCEPT_ORDER', offer });
  }, []);

  const restoreActiveTrip = useCallback((offer: OrderOffer, phase: TripPhase) => {
    dispatch({ type: 'RESTORE_ACTIVE_TRIP', offer, phase });
  }, []);

  const rejectAlert = useCallback(() => {
    dispatch({ type: 'DISMISS_ALERT' });
  }, []);

  const advanceTrip = useCallback(() => {
    const phase = state.tripPhase;
    if (!phase) return;
    const next: Record<TripPhase, TripPhase | 'done'> = {
      to_pickup: 'waiting_passenger',
      waiting_passenger: 'to_dropoff',
      to_dropoff: 'done',
    };
    const n = next[phase];
    if (n === 'done') {
      dispatch({ type: 'COMPLETE_TRIP' });
    } else {
      dispatch({ type: 'SET_TRIP_PHASE', phase: n });
    }
  }, [state.tripPhase]);

  const setTripPhase = useCallback((phase: TripPhase) => {
    dispatch({ type: 'SET_TRIP_PHASE', phase });
  }, []);

  const tickAlert = useCallback(() => {
    dispatch({ type: 'TICK_ALERT' });
  }, []);

  const simulateIncomingOrder = useCallback(() => {
    dispatch({ type: 'SHOW_ALERT', offer: createMockIncomingOrder() });
  }, []);

  const dismissedOfferIds = useMemo(
    () => new Set(state.dismissedAlertIds),
    [state.dismissedAlertIds],
  );

  const value = useMemo(
    () => ({
      state,
      sessionReady,
      setOnline,
      setAvailableOrders,
      removeAvailableOrder,
      showIncomingOffer,
      acceptAlert,
      rejectAlert,
      tickAlert,
      advanceTrip,
      setTripPhase,
      clearLocalTrip,
      restoreActiveTrip,
      simulateIncomingOrder,
      dismissedOfferIds,
    }),
    [
      state,
      sessionReady,
      setOnline,
      setAvailableOrders,
      removeAvailableOrder,
      showIncomingOffer,
      acceptAlert,
      rejectAlert,
      tickAlert,
      advanceTrip,
      setTripPhase,
      clearLocalTrip,
      restoreActiveTrip,
      simulateIncomingOrder,
      dismissedOfferIds,
    ],
  );

  return <DriverSessionContext.Provider value={value}>{children}</DriverSessionContext.Provider>;
}

export function useDriverSession() {
  const ctx = useContext(DriverSessionContext);
  if (!ctx) throw new Error('useDriverSession must be used within DriverSessionProvider');
  return ctx;
}
