import { io, type Socket } from 'socket.io-client';
import { readStoredToken } from '../auth/session';

export type LiveOrderRow = {
  orderId: string;
  orderType: string;
  status: string;
  fareEstimate: string | null;
  fareFinal: string | null;
  passengerId: string | null;
  passengerName: string | null;
  placedAtHk: string | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  stopCount: number;
  tipHkd?: number;
  remark?: string | null;
  bookingOptionLines?: string[];
  driverPointsCostAtOrder?: number | null;
  driverPointsBusySurcharge?: number | null;
};

type Handlers = {
  onSnapshot: (rows: LiveOrderRow[]) => void;
  onEvent: (payload:
    | { type: 'created' | 'updated'; order: LiveOrderRow }
    | { type: 'removed'; orderId: string }) => void;
  onConnectionChange?: (connected: boolean) => void;
};

let socket: Socket | null = null;

export function connectAdminOrdersSocket(handlers: Handlers) {
  disconnectAdminOrdersSocket();
  const token = readStoredToken();
  if (!token) return;

  const origin = window.location.origin;
  socket = io(origin, { path: '/socket.io', transports: ['websocket', 'polling'] });

  socket.on('connect', () => {
    handlers.onConnectionChange?.(true);
    socket?.emit('admin:orders:subscribe', { token });
  });
  socket.on('disconnect', () => handlers.onConnectionChange?.(false));
  socket.on('admin:order:snapshot', (rows: LiveOrderRow[]) => {
    handlers.onSnapshot(Array.isArray(rows) ? rows : []);
  });
  socket.on(
    'admin:order:event',
    (
      payload:
        | { type: 'created' | 'updated'; order: LiveOrderRow }
        | { type: 'removed'; orderId: string },
    ) => {
      if (payload?.type === 'removed' && payload.orderId) {
        handlers.onEvent(payload);
        return;
      }
      if (payload?.type && payload.type !== 'removed' && payload.order?.orderId) {
        handlers.onEvent(payload);
      }
    },
  );
}

export function disconnectAdminOrdersSocket() {
  socket?.disconnect();
  socket = null;
}
