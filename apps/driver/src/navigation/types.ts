import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  ActiveTrip: undefined;
  OrderChat: { orderId: string; headerTitle: string; headerSubtitle?: string };
  TripCompleted: {
    orderId: string;
    pickupLabel: string;
    dropoffLabel: string;
    fareHkd: number;
    passengerPointsRedeemed?: number | null;
    passengerPointsDiscountHkd?: number | null;
    passengerPointsHkdPerPointAtOrder?: number | null;
  };
  TermsWebView: undefined;
  PurchasePoints: { requiredPoints?: number } | undefined;
  TodayCompletedOrders: undefined;
};

export type MainTabParamList = {
  Dashboard: { focusOrderId?: string } | undefined;
  ScheduledOrders: undefined;
  ShootOrder: undefined;
  Earnings: undefined;
  Settings: undefined;
};
