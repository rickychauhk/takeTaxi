import type { GeoPoint, OrderOffer, TripPhase } from '../types/order';

export type NavigationTarget = {
  label: string;
  coord?: GeoPoint;
};

export type NavigationTargetCoords = {
  pickupCoord?: GeoPoint | null;
  dropoffCoord?: GeoPoint | null;
  passengerLiveCoord?: GeoPoint | null;
};

/** 依行程階段決定導航目的地：接客前→上車點；送客→目的地（座標優先 track / API） */
export function resolveNavigationTarget(
  order: OrderOffer,
  phase: TripPhase,
  coords?: NavigationTargetCoords,
): NavigationTarget {
  if (phase === 'to_dropoff') {
    const drop =
      coords?.dropoffCoord ?? order.dropoffCoord ?? undefined;
    return {
      label: order.dropoffLabel?.trim() || '目的地',
      coord: drop ?? undefined,
    };
  }

  const pickup = coords?.pickupCoord ?? order.pickupCoord ?? null;
  const live = coords?.passengerLiveCoord ?? null;
  const coord =
    pickup ?? (phase === 'to_pickup' ? live : null) ?? undefined;

  return {
    label: order.pickupLabel?.trim() || '上車點',
    coord,
  };
}
