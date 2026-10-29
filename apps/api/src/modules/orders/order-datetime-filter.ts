import { SelectQueryBuilder } from 'typeorm';

const HK = '+08:00';

/** Filter by Hong Kong calendar date (YYYY-MM-DD) and optional time (HH:mm) on a datetime SQL expression */
export function applyHkDateTimeFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  qb: SelectQueryBuilder<any>,
  datetimeExpr: string,
  date?: string,
  time?: string,
  paramPrefix = 'dt',
) {
  if (date?.trim()) {
    qb.andWhere(`DATE(CONVERT_TZ(${datetimeExpr}, '+00:00', '${HK}')) = :${paramPrefix}Date`, {
      [`${paramPrefix}Date`]: date.trim(),
    });
  }
  if (time?.trim()) {
    qb.andWhere(`TIME_FORMAT(CONVERT_TZ(${datetimeExpr}, '+00:00', '${HK}'), '%H:%i') = :${paramPrefix}Time`, {
      [`${paramPrefix}Time`]: time.trim(),
    });
  }
}

/** 香港時區日期區間（含起訖日整天） */
export function applyHkDateRangeFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  qb: SelectQueryBuilder<any>,
  datetimeExpr: string,
  dateFrom?: string,
  dateTo?: string,
  paramPrefix = 'dr',
) {
  const hkDateExpr = `DATE(CONVERT_TZ(${datetimeExpr}, '+00:00', '${HK}'))`;
  const from = dateFrom?.trim();
  const to = dateTo?.trim();
  if (from && to && from > to) {
    qb.andWhere(`${hkDateExpr} BETWEEN :${paramPrefix}To AND :${paramPrefix}From`, {
      [`${paramPrefix}From`]: from,
      [`${paramPrefix}To`]: to,
    });
    return;
  }
  if (from) {
    qb.andWhere(`${hkDateExpr} >= :${paramPrefix}From`, { [`${paramPrefix}From`]: from });
  }
  if (to) {
    qb.andWhere(`${hkDateExpr} <= :${paramPrefix}To`, { [`${paramPrefix}To`]: to });
  }
}

export function formatHkDateTime(iso: Date | string | null | undefined): string | null {
  if (!iso) return null;
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', hour12: false });
}
