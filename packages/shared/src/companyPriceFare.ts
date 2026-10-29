/** 公司價：以正價預估（錶旗+隧道，不含貼士）為基準 */
export function applyCompanyPriceFare(estimatedSubtotalHkd: number): number {
  const est = Math.round(Math.max(0, estimatedSubtotalHkd));
  if (est >= 94) return Math.round(est * 0.85);
  if (est >= 80) return 80;
  return est;
}
