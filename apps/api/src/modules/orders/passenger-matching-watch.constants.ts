/** 乘客 App 等候接單心跳最長間隔（超過則從司機大廳隱藏） */
export const PASSENGER_MATCHING_WATCH_TTL_MS = 25_000;

/** 背景檢查過期心跳並通知司機移除 */
export const PASSENGER_MATCHING_WATCH_SWEEP_MS = 10_000;
