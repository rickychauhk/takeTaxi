export const DRIVER_CANCEL_REPORT_PREFIX = 'driver_cancel_report:';

export const DRIVER_CANCEL_REPORT_CODES = [
  'cannot_contact_passenger',
  'passenger_no_longer_needs',
  'passenger_other_vehicle',
  'no_show_at_pickup',
] as const;

export type DriverCancelReportCode = (typeof DRIVER_CANCEL_REPORT_CODES)[number];

export const DRIVER_CANCEL_REPORT_LABELS: Record<DriverCancelReportCode, string> = {
  cannot_contact_passenger: '我聯絡不上乘客',
  passenger_no_longer_needs: '乘客不需要車了',
  passenger_other_vehicle: '乘客已上其他車了',
  no_show_at_pickup: '去到出發地不見乘客',
};

export function isDriverCancelReportCode(value: string): value is DriverCancelReportCode {
  return (DRIVER_CANCEL_REPORT_CODES as readonly string[]).includes(value);
}

export function driverCancelReportStatusNote(code: DriverCancelReportCode): string {
  return `${DRIVER_CANCEL_REPORT_PREFIX}${code}`;
}

function isPassengerPlacementSnapshotNote(note: string): boolean {
  const t = note.trim();
  if (!t.startsWith('{')) return false;
  try {
    const o = JSON.parse(t) as Record<string, unknown>;
    return o != null && typeof o === 'object' && ('selectedOptionIds' in o || 'grossFareHkd' in o);
  } catch {
    return false;
  }
}

/** 司機取消回報文案（非 CRM 狀態軸通用標籤） */
export function labelDriverCancelStatusNote(note: string | null | undefined): string | null {
  const labeled = labelOrderStatusEventNote(note);
  if (!labeled) return null;
  if (labeled.kind === 'driver_report') return labeled.text;
  return null;
}

export type OrderStatusEventNoteLabel = {
  kind: 'driver_report' | 'remark';
  text: string;
};

/** CRM 狀態紀錄：note 轉中文；乘客落單 JSON 快照不顯示 */
export function labelOrderStatusEventNote(
  note: string | null | undefined,
): OrderStatusEventNoteLabel | null {
  if (!note?.trim()) return null;
  const n = note.trim();
  if (isPassengerPlacementSnapshotNote(n)) return null;
  if (n.startsWith(DRIVER_CANCEL_REPORT_PREFIX)) {
    const code = n.slice(DRIVER_CANCEL_REPORT_PREFIX.length);
    if (isDriverCancelReportCode(code)) {
      return { kind: 'driver_report', text: DRIVER_CANCEL_REPORT_LABELS[code] };
    }
  }
  if (n === 'driver_remove_order') {
    return { kind: 'driver_report', text: '司機取消（無回報）' };
  }
  if (n === 'driver_release_to_hall') {
    return { kind: 'remark', text: '司機放出回大廳' };
  }
  if (n === 'passenger_release_to_hall') {
    return { kind: 'remark', text: '乘客放回大廳' };
  }
  if (n.startsWith('{') || n.startsWith('[')) return null;
  return { kind: 'remark', text: n };
}
