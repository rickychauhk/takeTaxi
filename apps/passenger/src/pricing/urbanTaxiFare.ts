/**
 * 香港市區的士（紅的）錶旗及跳錶 — 運輸署 2024-07-14 起生效。
 * @see https://www.td.gov.hk/en/transport_in_hong_kong/public_transport/taxi/taxi_fare_of_hong_kong/
 */
const FLAGFALL_HKD = 29;
const FLAGFALL_METERS = 2000;
const INCREMENT_METERS = 200;
const TIER1_INCREMENT_HKD = 2.1;
const TIER1_FARE_CAP_HKD = 102.5;
const TIER2_INCREMENT_HKD = 1.4;

/** 按行車距離估算錶旗價（不含隧道費、行李、電召等）。 */
export function estimateUrbanTaxiFare(distanceMeters: number): number {
  const meters = Math.max(0, Math.round(distanceMeters));
  if (meters <= FLAGFALL_METERS) return FLAGFALL_HKD;

  const extraMeters = meters - FLAGFALL_METERS;
  const jumps = Math.ceil(extraMeters / INCREMENT_METERS);

  let fare = FLAGFALL_HKD;
  for (let i = 0; i < jumps; i++) {
    fare += fare < TIER1_FARE_CAP_HKD ? TIER1_INCREMENT_HKD : TIER2_INCREMENT_HKD;
  }
  return Math.round(fare);
}

export function formatHkd(amount: number): string {
  return `$${amount.toLocaleString('en-HK', { maximumFractionDigits: 0 })}`;
}

/** 市區的士錶旗估算 + 隧道附加費 + 貼士（港元） */
export function estimateUrbanTaxiTotal(
  distanceMeters: number,
  tipHkd: number,
  tunnelTollHkd = 0,
): number {
  const tip = Math.max(0, Math.round(tipHkd));
  const tunnel = Math.max(0, Math.round(tunnelTollHkd));
  return estimateUrbanTaxiFare(distanceMeters) + tunnel + tip;
}
