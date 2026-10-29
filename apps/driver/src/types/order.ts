export type TripPhase = 'to_pickup' | 'waiting_passenger' | 'to_dropoff';

/** WGS84；API 未返座標時仍可只用地址文字導航 */
export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type OrderOffer = {
  id: string;
  /** instant / driver_posted … */
  orderType?: string;
  /** 射柯打：發單司機 id（大廳「我出嘅」） */
  postedByDriverId?: string | null;
  pickupLabel: string;
  dropoffLabel: string;
  fareEstimateHkd: number;
  passengerPointsRedeemed?: number | null;
  passengerPointsDiscountHkd?: number | null;
  passengerPointsHkdPerPointAtOrder?: number | null;
  /** 上車點至目的地概略行程 */
  distanceKm: number;
  /** 司機當前位置至上車點（直線），接單時計算 */
  pickupDistanceKm?: number | null;
  pickupDistanceIsDriving?: boolean;
  driverPointsCostAtOrder?: number | null;
  driverPointsBusySurcharge?: number | null;
  driverBusyRegionRewardPoints?: number | null;
  driverBusyRegionFromArea?: string | null;
  driverBusyRegionToArea?: string | null;
  driverPostBountyPoints?: number | null;
  passengerPhone?: string;
  /** 射柯打：發單司機開工電話（接單後 API 可回傳） */
  postedByDriverPhone?: string | null;
  /** 射柯打：客人聯絡電（API 結構欄位，大廳唔顯示明文） */
  driverPostGuestPhone?: string | null;
  /** 射柯打：貨主聯絡電（API 結構欄位，大廳唔顯示明文） */
  driverPostOwnerPhone?: string | null;
  passengerContactCall?: boolean;
  passengerContactSms?: boolean;
  pickupCoord?: GeoPoint;
  dropoffCoord?: GeoPoint;
  /** 落單選項、貼士、備註等（大廳列表） */
  bookingOptionLines?: string[];
  /** ISO 8601；大廳排序用 */
  createdAt?: string;
  /** ISO 8601；預約上車時間 */
  scheduledAt?: string | null;
  /** matching / pending / accepted / en_route …（預約 Tab 區分已接預約） */
  orderStatus?: string;
};

export type EarningsSnapshot = {
  todayHkd: number;
  tripCount: number;
  onlineMinutes: number;
};

export type DriverAppState = {
  online: boolean;
  alertOffer: OrderOffer | null;
  /** 彈窗是否播放新柯打提示音（大廳手動點開為 false） */
  alertPlaySound: boolean;
  alertSecondsLeft: number;
  /** API 待派柯打（matching / pending） */
  availableOrders: OrderOffer[];
  activeOrder: OrderOffer | null;
  tripPhase: TripPhase | null;
  earnings: EarningsSnapshot;
  onlineSince: number | null;
  dismissedAlertIds: string[];
};

export type DriverAction =
  | { type: 'SET_ONLINE'; online: boolean }
  | { type: 'SET_AVAILABLE_ORDERS'; orders: OrderOffer[] }
  | { type: 'REMOVE_AVAILABLE_ORDER'; orderId: string }
  | { type: 'SHOW_ALERT'; offer: OrderOffer; playSound?: boolean }
  | { type: 'TICK_ALERT' }
  | { type: 'DISMISS_ALERT' }
  | { type: 'ACCEPT_ORDER'; offer?: OrderOffer }
  | { type: 'SET_TRIP_PHASE'; phase: TripPhase }
  | { type: 'COMPLETE_TRIP' }
  | { type: 'CLEAR_LOCAL_TRIP' }
  | { type: 'RESTORE_ACTIVE_TRIP'; offer: OrderOffer; phase: TripPhase }
  | { type: 'SET_EARNINGS_ONLINE_MINUTES'; minutes: number };
