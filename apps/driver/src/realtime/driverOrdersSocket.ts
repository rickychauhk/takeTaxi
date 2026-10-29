import { io, type Socket } from 'socket.io-client';
import type { DriverAvailableOrderDto } from '../api/orders';
import { getRealtimeOrigin } from '../api/realtime';
import type { DriverPickupRadiusKm } from '../settings/driverPickupRadius';

export type DriverOrderSocketPayload =
  | { type: 'created' | 'updated'; order: DriverAvailableOrderDto }
  | { type: 'removed'; orderId: string };

export type DriverPostedOrderNotice = {
  orderId: string;
  message: string;
  kind?: 'bounty_refunded' | 'accepted';
};

type Handlers = {
  onSnapshot: (rows: DriverAvailableOrderDto[]) => void;
  onEvent: (payload: DriverOrderSocketPayload) => void;
  onConnectionChange?: (connected: boolean) => void;
  onPostedOrderNotice?: (payload: DriverPostedOrderNotice) => void;
  onSessionRevoked?: (message: string) => void;
};

export type DriverOrdersSocketGeo = {
  latitude: number;
  longitude: number;
};

type ConnectOptions = {
  maxPickupRadiusKm?: DriverPickupRadiusKm;
  driverCoord?: DriverOrdersSocketGeo | null;
};

let socket: Socket | null = null;
let lastToken: string | null = null;
let lastRadius: DriverPickupRadiusKm | undefined;
let lastCoord: DriverOrdersSocketGeo | null | undefined;

function subscribePayload(
  token: string,
  maxPickupRadiusKm?: DriverPickupRadiusKm,
  driverCoord?: DriverOrdersSocketGeo | null,
) {
  const payload: Record<string, unknown> = {
    token,
    maxPickupRadiusKm: maxPickupRadiusKm ?? null,
  };
  if (driverCoord) {
    payload.driverLat = driverCoord.latitude;
    payload.driverLng = driverCoord.longitude;
  }
  return payload;
}

export function connectDriverOrdersSocket(
  token: string,
  handlers: Handlers,
  options?: ConnectOptions,
) {
  lastToken = token;
  lastRadius = options?.maxPickupRadiusKm;
  lastCoord = options?.driverCoord;

  disconnectDriverOrdersSocket();
  const origin = getRealtimeOrigin();
  socket = io(origin, { path: '/socket.io', transports: ['websocket', 'polling'] });

  socket.on('connect', () => {
    handlers.onConnectionChange?.(true);
    socket?.emit(
      'driver:orders:subscribe',
      subscribePayload(token, lastRadius, lastCoord),
    );
  });
  socket.on('disconnect', () => handlers.onConnectionChange?.(false));
  socket.on('driver:order:snapshot', (rows: DriverAvailableOrderDto[]) => {
    handlers.onSnapshot(Array.isArray(rows) ? rows : []);
  });
  socket.on('driver:order:event', (payload: DriverOrderSocketPayload) => {
    if (payload?.type === 'removed' && payload.orderId) {
      handlers.onEvent(payload);
      return;
    }
    if (payload?.type && payload.type !== 'removed' && payload.order?.orderId) {
      handlers.onEvent(payload);
    }
  });
  socket.on('driver:posted-order:notice', (payload: DriverPostedOrderNotice) => {
    if (payload?.message) handlers.onPostedOrderNotice?.(payload);
  });
  socket.on('driver:session:revoked', (payload: { message?: string }) => {
    handlers.onSessionRevoked?.(
      payload?.message?.trim() || '帳戶已在另一部裝置登入，此裝置已登出。',
    );
  });
}

/** 登入後監聽「另一部裝置登入」強制登出（與派單 socket 分開，行程中仍有效） */
export function connectDriverSessionRevokedListener(
  token: string,
  onRevoked: (message: string) => void,
): () => void {
  const origin = getRealtimeOrigin();
  const s = io(origin, { path: '/socket.io', transports: ['websocket', 'polling'] });
  s.on('connect', () => {
    s.emit('driver:orders:subscribe', { token, maxPickupRadiusKm: null });
  });
  s.on('driver:session:revoked', (payload: { message?: string }) => {
    onRevoked(payload?.message?.trim() || '帳戶已在另一部裝置登入，此裝置已登出。');
  });
  return () => {
    s.disconnect();
  };
}

/** 設定改變時重新訂閱，更新後端推送範圍 */
export function resubscribeDriverOrdersSocket(
  maxPickupRadiusKm: DriverPickupRadiusKm,
  driverCoord?: DriverOrdersSocketGeo | null,
) {
  lastRadius = maxPickupRadiusKm;
  if (driverCoord !== undefined) lastCoord = driverCoord;
  if (!socket?.connected || !lastToken) return;
  socket.emit(
    'driver:orders:subscribe',
    subscribePayload(lastToken, maxPickupRadiusKm, lastCoord),
  );
}

export function connectDriverPostedNotices(token: string, onNotice: (p: DriverPostedOrderNotice) => void) {
  const origin = getRealtimeOrigin();
  const s = io(origin, { path: '/socket.io', transports: ['websocket', 'polling'] });
  s.on('connect', () => s.emit('driver:orders:subscribe', { token, maxPickupRadiusKm: null }));
  s.on('driver:posted-order:notice', (payload: DriverPostedOrderNotice) => {
    if (payload?.message) onNotice(payload);
  });
  return () => {
    s.disconnect();
  };
}

export function requestDriverOrdersRefresh(
  token: string,
  maxPickupRadiusKm?: DriverPickupRadiusKm,
  driverCoord?: DriverOrdersSocketGeo | null,
) {
  if (driverCoord !== undefined) lastCoord = driverCoord;
  socket?.emit(
    'driver:orders:refresh',
    subscribePayload(token, maxPickupRadiusKm ?? lastRadius, lastCoord),
  );
}

export function disconnectDriverOrdersSocket() {
  socket?.disconnect();
  socket = null;
  lastToken = null;
}

export function isDriverOrdersSocketConnected(): boolean {
  return Boolean(socket?.connected);
}
