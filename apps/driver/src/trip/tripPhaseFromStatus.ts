import type { TripPhase } from '../types/order';

/** API 柯打狀態 → 司機 App 行程階段 UI */
export function tripPhaseFromOrderStatus(status: string): TripPhase | null {
  switch (status) {
    case 'accepted':
      return 'to_pickup';
    case 'en_route':
      return 'waiting_passenger';
    case 'in_trip':
      return 'to_dropoff';
    default:
      return null;
  }
}
