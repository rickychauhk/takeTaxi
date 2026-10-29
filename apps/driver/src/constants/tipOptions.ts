/** 附加貼士：0–500 港元，每 $10 一級 */
export const TIP_STEP_HKD = 10;
export const TIP_MAX_HKD = 500;

export const TIP_AMOUNT_OPTIONS: number[] = Array.from(
  { length: TIP_MAX_HKD / TIP_STEP_HKD + 1 },
  (_, i) => i * TIP_STEP_HKD,
);
