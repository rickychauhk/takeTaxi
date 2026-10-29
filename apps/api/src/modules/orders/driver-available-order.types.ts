/** 司機 WebSocket / GET available 共用 DTO */
export type DriverAvailableOrderDto = {
  orderId: string;
  orderType: string;
  /** 射柯打發單司機（大廳「我出嘅」） */
  postedByDriverId: string | null;
  status: string;
  fareEstimate: string | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  stopCount: number;
  pickupLat: number | null;
  pickupLng: number | null;
  /** 司機現位→上車點行車距離（km）；需請求帶 driverLat/Lng */
  pickupDistanceKm?: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  createdAt: string;
  /** ISO 8601；預約柯打上車時間（即時單為 null） */
  scheduledAt: string | null;
  passengerPointsRedeemed: number | null;
  passengerPointsDiscountHkd: number | null;
  passengerPointsHkdPerPointAtOrder: number | null;
  driverPointsCostAtOrder: number | null;
  driverPointsBusySurcharge: number | null;
  /** 接單前預覽：繁忙時段地區配對獎賞（與接單成功後發放一致） */
  driverBusyRegionRewardPoints: number | null;
  driverBusyRegionFromArea: string | null;
  driverBusyRegionToArea: string | null;
  driverPostBountyPoints: number | null;
  /** 僅已接單／進行中柯打：供司機致電乘客（待派單不應回傳） */
  passengerPhone: string | null;
  /** 射柯打：發單司機開工電話（僅已接單／進行中回傳） */
  postedByDriverPhone?: string | null;
  /** 乘客落單時選：希望司機致電聯絡 */
  passengerContactCall: boolean;
  /** 乘客落單時選：希望司機短訊聯絡 */
  passengerContactSms: boolean;
  /** 落單選項、貼士、備註等（大廳列表第三行） */
  bookingOptionLines: string[];
  /** 射柯打：客人聯絡電（大廳僅供撥號，唔回傳明文行） */
  driverPostGuestPhone?: string | null;
  /** 射柯打：貨主聯絡電（大廳僅供撥號，唔回傳明文行） */
  driverPostOwnerPhone?: string | null;
};
