/** 司機接客頁快捷句 → 發送至乘客行程訊息（「致電乘客」除外） */
export const DRIVER_QUICK_CHAT = {
  /** 按鈕顯示「致電給我」，乘客端見到此句 */
  callMe: '我打不通你電話，請致電給我，謝謝！',
  arrived: '到達現場',
  oneMin: '一分鐘到',
  threeMin: '三分鐘到',
  fourSixMin: '4-6分鐘到',
  sevenNineMin: '7-9分鐘到',
} as const;

/** 訊息箱預設句（與接客頁快捷掣一致，不含「致電乘客」） */
export const DRIVER_CHAT_PRESET_MESSAGES: readonly string[] = [
  DRIVER_QUICK_CHAT.arrived,
  DRIVER_QUICK_CHAT.oneMin,
  DRIVER_QUICK_CHAT.threeMin,
  DRIVER_QUICK_CHAT.callMe,
  DRIVER_QUICK_CHAT.fourSixMin,
  DRIVER_QUICK_CHAT.sevenNineMin,
];
