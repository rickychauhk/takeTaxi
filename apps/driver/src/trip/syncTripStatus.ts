import type { DriverOrderStatus } from '../api/orders';
import type { TripPhase } from '../types/order';

/** 司機 App 階段 → API 柯打狀態（按「下一步」時同步） */
export function apiStatusAfterAdvance(fromPhase: TripPhase): DriverOrderStatus | null {
  switch (fromPhase) {
    case 'to_pickup':
      return 'en_route';
    case 'waiting_passenger':
      return 'in_trip';
    case 'to_dropoff':
      return 'completed';
    default:
      return null;
  }
}
