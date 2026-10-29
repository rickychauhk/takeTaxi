/** 乘客落單聯絡偏好（致電／短訊） */
export type PassengerContactPrefs = {
  passengerContactCall?: boolean;
  passengerContactSms?: boolean;
};

/**
 * 行程中是否顯示短訊／chat（乘客與司機端一致）。
 * 只勾「致電給我」、未勾「短訊給我」→ false；有勾短訊 → true。
 * 無落單紀錄（舊單）→ 保留 chat。
 */
export function passengerOrderTripChatEnabled(prefs: PassengerContactPrefs): boolean {
  if (prefs.passengerContactSms) return true;
  if (prefs.passengerContactCall && !prefs.passengerContactSms) return false;
  return true;
}
