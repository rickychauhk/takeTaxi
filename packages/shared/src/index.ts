export type DriverTier = 'admin' | 'partner' | 'public';

export enum OrderVisibilityPhase {
  AdminPreview = 'admin_preview',
  PartnerPool = 'partner_pool',
  PublicPool = 'public_pool',
}

export const DRIVER_TIER_ORDER: DriverTier[] = ['admin', 'partner', 'public'];

/** Full-screen splash ad (portrait) */
export const SPLASH_AD_WIDTH = 1080;
export const SPLASH_AD_HEIGHT = 1920;
export const AD_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export {
  API_DEPLOY_UNAVAILABLE_MESSAGE,
  deployUnavailableUserMessage,
} from './apiDeployUnavailable';

export {
  clearApiNetworkDegraded,
  getApiNetworkDegraded,
  isFetchNetworkError,
  markApiNetworkDegraded,
  netInfoDeviceAppearsOffline,
  reportApiFetchFailure,
  reportApiFetchSuccess,
  subscribeApiNetworkStatus,
} from './apiNetworkSignals';

export const ADMIN_LIST_PAGE_SIZE = 10;
export const ORDER_RECORDS_PAGE_SIZE = 20;

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export {
  HK_DEMO_PLACES,
  addressForCrmDisplay,
  hasCjk,
  type HkDemoPlace,
} from './hkDemoPlaces';

export { applyCompanyPriceFare } from './companyPriceFare';

export {
  WEEKDAY_LABELS_ZH,
  computeDriverPointsAtOrderPlacement,
  emptyDriverBusyHoursConfig,
  getHongKongClock,
  isBusyHourInHongKong,
  parseDriverBusyHoursConfig,
  serializeDriverBusyHoursConfig,
  type BusyTimeSlot,
  type DriverBusyHoursConfig,
  type WeekdayKey,
} from './driverBusyHours';

export {
  emptyDriverBusyRegionRewardsConfig,
  findMatchingBusyRegionRewardRule,
  parseDriverBusyRegionRewardsConfig,
  resolveBusyRegionRewardAtAccept,
  serializeDriverBusyRegionRewardsConfig,
  addressMatchesHkArea,
  type DriverBusyRegionRewardRule,
  type DriverBusyRegionRewardsConfig,
} from './driverBusyRegionRewards';

export { HK_AREA_OPTIONS, HK_AREA_VALUES } from './hkAreas';

export {
  HK_AREA_EQUIVALENCE_GROUPS,
  HK_YAU_TSIM_MONG_CLUSTER,
  hkAreaMatchersForRule,
} from './hkAreaEquivalence';

export {
  findHkDemoPlaceForLabel,
  reconcileKowloonTripEndpoints,
  snapLatLngToKnownHkPlace,
} from './snapLatLngToHkPlace';

export {
  DRIVER_POST_BOUNTY_OPTIONS,
  isDriverPostBountyPoints,
  type DriverPostBountyPoints,
} from './driverPostBounty';

export {
  PASSENGER_NEARBY_DRIVERS_RADIUS_KM_DEFAULT,
  PASSENGER_NEARBY_DRIVERS_RADIUS_KM_OPTIONS,
  PASSENGER_NEARBY_DRIVERS_RADIUS_KM_SETTING_KEY,
  parsePassengerNearbyDriversRadiusKm,
  passengerNearbyDriversRadiusMeters,
  type PassengerNearbyDriversRadiusKm,
} from './passengerNearbyDrivers';

export {
  PASSENGER_AUTO_TIP_SETTING_KEYS,
  PASSENGER_TIP_HKD_FIVE_SEAT_DEFAULT,
  PASSENGER_TIP_HKD_FIVE_SEAT_SETTING_KEY,
  PASSENGER_TIP_HKD_LARGE_LUGGAGE_DEFAULT,
  PASSENGER_TIP_HKD_LARGE_LUGGAGE_SETTING_KEY,
  PASSENGER_TIP_HKD_SAFE_DRIVING_DEFAULT,
  PASSENGER_TIP_HKD_SAFE_DRIVING_SETTING_KEY,
  PASSENGER_TIP_HKD_SIX_SEAT_DEFAULT,
  PASSENGER_TIP_HKD_SIX_SEAT_SETTING_KEY,
  PASSENGER_TIP_HKD_WHEELCHAIR_DEFAULT,
  PASSENGER_TIP_HKD_WHEELCHAIR_SETTING_KEY,
  defaultPassengerAutoTipHkdPublic,
  isPassengerAutoTipSettingKey,
  parsePassengerAutoTipHkd,
  type PassengerAutoTipHkdPublic,
} from './passengerAutoTip';

export {
  DRIVER_HALL_PRIORITY_PREVIEW_SECONDS_DEFAULT,
  DRIVER_HALL_PRIORITY_PREVIEW_SECONDS_MAX,
  DRIVER_HALL_PRIORITY_PREVIEW_SECONDS_SETTING_KEY,
  driverHasHallPriorityPreview,
  parseDriverHallPriorityPreviewSeconds,
  type DriverHallVisibilityContext,
} from './driverHallPriority';

export {
  HK_LICENSED_BANK_NAMES,
  isHkLicensedBankName,
  normalizeHongKongBankAccountNumber,
  validateHongKongBankAccountNumberField,
} from './hkLicensedBanks';

export {
  formatHongKongPhoneDisplay,
  formatHongKongPhoneInputValue,
  formatHongKongPhoneValidationMessage,
  isHongKong8DigitPhone,
  normalizePhoneE164,
  validateHongKongLocalPhone,
  type HongKongPhoneValidation,
} from './phone';

export {
  combineHongKongIdentityNumber,
  formatHongKongIdentityNumberError,
  parseHongKongDriverLicenseNumber,
  parseHongKongIdentityNumber,
  parseHongKongIdentityNumberParts,
  validateHongKongIdentityNumberField,
  validateHongKongIdentityNumberPartsField,
  type HongKongIdentityNumberParseResult,
} from './hkIdentityNumber';

export {
  HK_TAXI_URBAN_TUNNEL_ONE_WAY_HKD,
  ORDER_TUNNEL_ONE_WAY_HKD,
  isHarbourTunnelCode,
  isHkTaxiTunnelCode,
  PASSENGER_APP_FREE_TUNNEL_CODES,
  passengerAppTunnelTollFromDetectedIds,
  passengerTunnelSurchargeForCode,
  passengerTunnelTollFromDetectedIds,
  type HkTaxiTunnelCode,
} from './hkTaxiTunnelTolls';

export {
  HARBOUR_TUNNEL_CODES,
  HARBOUR_TUNNEL_WAYPOINTS,
  TUNNEL_BOOKING_OPTION_ORDER,
  adjustHarbourTunnelTollHkd,
  coalesceHarbourTunnelPreference,
  emptyTunnelRoutePreference,
  hasTunnelRoutePreference,
  isHarbourTunnelId,
  tripLikelyCrossesHarbour,
  tunnelRoutePreferenceFromOptionCodes,
  tunnelRoutePreferenceFromSelectedIds,
  tunnelBookingSelectionKey,
  passengerAppTunnelTollHkdForRoute,
  tunnelTollHkdForRoute,
  type HarbourTunnelCode,
  type TunnelRoutePreference,
} from './tunnelRoutePreference';

export {
  DRIVER_CANCEL_REPORT_CODES,
  DRIVER_CANCEL_REPORT_LABELS,
  DRIVER_CANCEL_REPORT_PREFIX,
  driverCancelReportStatusNote,
  isDriverCancelReportCode,
  labelDriverCancelStatusNote,
  labelOrderStatusEventNote,
  type DriverCancelReportCode,
  type OrderStatusEventNoteLabel,
} from './driverCancelReport';

export {
  TUNNEL_WAYPOINTS,
  isLandTunnelBookingCode,
  orderTunnelCodesAlongTrip,
  waypointForTunnel,
  waypointsForTunnelPreference,
  type TunnelWaypoint,
} from './tunnelWaypoints';

export {
  passengerOrderTripChatEnabled,
  type PassengerContactPrefs,
} from './passengerContactPrefs';
