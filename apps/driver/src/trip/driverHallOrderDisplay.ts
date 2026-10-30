import type { OrderOffer } from '../types/order';
import { formatScheduleDisplay } from '../datetime/hkScheduleTime';
import { passengerPointsRedemptionLine } from './passengerPointsRedemptionLine';

/** 接單司機此單積分淨變化（獎賞 − 接單扣減） */
export function driverAcceptPointsNet(
  offer: Pick<
    OrderOffer,
    | 'orderType'
    | 'driverPointsCostAtOrder'
    | 'driverPointsBusySurcharge'
    | 'driverBusyRegionRewardPoints'
    | 'driverPostBountyPoints'
  >,
): number {
  const cost = Math.round(offer.driverPointsCostAtOrder ?? 0);
  const busy = Math.round(offer.driverPointsBusySurcharge ?? 0);
  const region = Math.round(offer.driverBusyRegionRewardPoints ?? 0);
  const bountyReward =
    offer.orderType === 'driver_posted'
      ? 0
      : Math.round(offer.driverPostBountyPoints ?? 0);
  return busy + region + bountyReward - cost;
}

export function formatHallPointsBadge(
  offer: Pick<OrderOffer, 'driverPointsCostAtOrder'> &
    Parameters<typeof driverAcceptPointsNet>[0],
): { text: string; tone: 'red' | 'yellow' } {
  const cost = Math.round(offer.driverPointsCostAtOrder ?? 0);
  const net = driverAcceptPointsNet(offer);
  const text = net > 0 ? `+${net}` : `${net}`;
  const tone = cost === 8 || cost === 12 ? 'red' : 'yellow';
  return { text, tone };
}

export function hallOrderPickupDistanceLabel(
  offer: Pick<OrderOffer, 'pickupDistanceKm' | 'pickupDistanceIsDriving'>,
): string {
  return offer.pickupDistanceIsDriving ? '距你行車約' : '距你直線約';
}

/** 大廳左上角：司機→上車點距離（API 行車；無則 fallback 直線）；無 GPS／無上車點則不顯示 */
export function hallOrderPickupDistanceKm(
  offer: Pick<OrderOffer, 'pickupDistanceKm'>,
): number | null {
  const km = offer.pickupDistanceKm;
  if (km == null || km <= 0 || !Number.isFinite(km)) return null;
  return km;
}

/** @deprecated 大廳請用 hallOrderPickupDistanceKm（勿用上車→落車行程距離代替） */
export function hallOrderDistanceKm(
  offer: Pick<OrderOffer, 'pickupDistanceKm' | 'distanceKm'>,
): number | null {
  return hallOrderPickupDistanceKm(offer);
}

function contactPreferenceHallLine(
  offer: Pick<OrderOffer, 'passengerContactCall' | 'passengerContactSms'>,
): string | null {
  const bits: string[] = [];
  if (offer.passengerContactCall) bits.push('致電給我');
  if (offer.passengerContactSms) bits.push('短訊給我');
  return bits.length ? `聯絡偏好：${bits.join('、')}` : null;
}

function lineMentionsContact(line: string): boolean {
  return /^聯絡偏好：/.test(line.trim());
}

export type HallOrderExtraLinesOptions = {
  /** 大廳列表不顯示聯絡偏好（接單後行程頁仍顯示） */
  forHallLobby?: boolean;
};

/** 大廳起訖點文字色：正價／千足金、公司白、定食／九折藍 */
export type HallOrderRouteColorKind = 'regular' | 'chin_suchin' | 'company' | 'promo_blue';

export const HALL_ROUTE_TEXT_COLORS: Record<HallOrderRouteColorKind, string> = {
  regular: '#F4D03F',
  chin_suchin: '#F4D03F',
  company: '#FFFFFF',
  promo_blue: '#5D9CEC',
};

export const HALL_LOBBY_GOLD_TEXT = HALL_ROUTE_TEXT_COLORS.chin_suchin;

/** 大廳 footer 簡稱（無隧道／車類等雜項時） */
export const HALL_LOBBY_COMPANY_SHORT = '公司';

function hallOrderLinesBlob(offer: Pick<OrderOffer, 'bookingOptionLines'>): string {
  return (offer.bookingOptionLines ?? []).join('\n');
}

function driverPostDirectOutLabel(
  offer: Pick<OrderOffer, 'bookingOptionLines'>,
): string | null {
  const direct = (offer.bookingOptionLines ?? []).find((l) => l.trim().startsWith('直出：'));
  if (!direct) return null;
  return direct.trim().slice('直出：'.length).trim();
}

/** 貨主柯打大廳：直出種類簡稱（千足金／九折／定食／公司） */
export type HallLobbyDriverPostDirectLabel = '千足金' | '九折' | '定食' | '公司';

function normalizeDriverPostDirectKind(raw: string): HallLobbyDriverPostDirectLabel | null {
  if (raw === '9两') return '九折';
  if (raw === '千足') return '千足金';
  if (raw === '千足金' || raw === '九折' || raw === '定食' || raw === '公司') return raw;
  return null;
}

export function hallLobbyDriverPostDirectShortLabel(
  offer: Pick<OrderOffer, 'bookingOptionLines'>,
): HallLobbyDriverPostDirectLabel | null {
  const fromLine = driverPostDirectOutLabel(offer);
  if (fromLine) {
    const norm = normalizeDriverPostDirectKind(fromLine);
    if (norm) return norm;
  }
  const blob = hallOrderLinesBlob(offer);
  const m = blob.match(/直出[·：\s]*(九折|9两|定食|千足金|千足|公司)/);
  if (m) return normalizeDriverPostDirectKind(m[1]);
  return null;
}

const DRIVER_POST_DIRECT_REMARK_KINDS = new Set(['直出', '九折', '9两', '定食', '千足金', '千足', '公司']);

function isDriverPostDirectOutRemarkSegment(segment: string): boolean {
  const p = segment.trim();
  if (!p) return true;
  if (p === '直出') return true;
  if (DRIVER_POST_DIRECT_REMARK_KINDS.has(p)) return true;
  return /^直出[·：\s]*(九折|9两|定食|千足金|千足|公司|寵物)/.test(p);
}

function driverPostRemarkWithoutDirectMeta(line: string): string | null {
  const t = line.trim();
  if (!t.startsWith('備註：')) return null;
  const parts = t
    .slice('備註：'.length)
    .split(/\s*·\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const kept = parts.filter((p) => !isDriverPostDirectOutRemarkSegment(p));
  if (!kept.length) return null;
  return `備註：${kept.join(' · ')}`;
}

/** 出貨備註內灰色掣／自訂字，拆成大廳 footer 逐項顯示 */
function driverPostRemarkSegmentsForHall(line: string): string[] {
  const t = line.trim();
  if (!t.startsWith('備註：')) return [];
  return t
    .slice('備註：'.length)
    .split(/\s*·\s*/)
    .map((p) => p.trim())
    .filter(
      (p) =>
        p &&
        !isDriverPostDirectOutRemarkSegment(p) &&
        !/^客人電話：/.test(p) &&
        !/^貨主電話：/.test(p),
    );
}

function stripDriverPostHallLobbyMetaLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;
    if (/^直出：/.test(t)) continue;
    if (t === '直出' || /^直出[·：\s]*$/.test(t)) continue;
    if (t.startsWith('備註：')) {
      out.push(...driverPostRemarkSegmentsForHall(t));
      continue;
    }
    out.push(t);
  }
  return out;
}

/** 出貨柯打：大廳 footer 要顯示的系統選項行（灰色掣對應的 API 行） */
function isDriverPostHallLobbyOptionLine(line: string): boolean {
  const t = line.trim();
  return (
    /^電子付款：/.test(t) ||
    /^貼士：/.test(t) ||
    /^座位：/.test(t) ||
    isHallLobbyBookingExtraLine(t)
  );
}

function hallOrderIsSetMeal(
  offer: Pick<OrderOffer, 'orderType' | 'bookingOptionLines'>,
): boolean {
  if (isDriverPostedHallOrder(offer)) {
    return hallLobbyDriverPostDirectShortLabel(offer) === '定食';
  }
  return hallLobbyPromoShortLabel(offer) === '定食';
}

/** 定食柯打：booking 行常只有「定食／公司價」，大廳用 fareEstimate 補 HK$ */
function hallLobbySetMealPriceDisplay(
  offer: Pick<OrderOffer, 'orderType' | 'bookingOptionLines' | 'fareEstimateHkd'>,
  lines: string[],
): string | null {
  if (!hallOrderIsSetMeal(offer)) return null;
  const existing = lines.find((l) => /^價格：/.test(l.trim()))?.trim();
  if (existing && /HK\$\d/.test(existing)) return existing;
  const fare = Math.round(offer.fareEstimateHkd ?? 0);
  if (fare > 0) return `價格：HK$${fare}`;
  return existing ?? null;
}

function applyHallLobbyFooterCompactDriverPost(offer: OrderOffer, lines: string[]): string[] {
  const directShort = hallLobbyDriverPostDirectShortLabel(offer);
  const setMealPrice = hallLobbySetMealPriceDisplay(offer, lines);
  const stripped = stripDriverPostHallLobbyMetaLines(lines);
  const optionLines = lines.filter(isDriverPostHallLobbyOptionLine);
  const mergedOptions = [...optionLines];
  for (const s of stripped) {
    if (!mergedOptions.includes(s)) mergedOptions.push(s);
  }

  const out: string[] = [];
  const pushUnique = (item: string) => {
    const t = item.trim();
    if (!t || out.includes(t)) return;
    out.push(t);
  };

  if (directShort) pushUnique(directShort);
  if (setMealPrice) pushUnique(setMealPrice);
  for (const line of mergedOptions) pushUnique(line);

  return out;
}

export function hallOrderRouteColorKind(
  offer: Pick<OrderOffer, 'orderType' | 'bookingOptionLines'>,
): HallOrderRouteColorKind {
  const blob = hallOrderLinesBlob(offer);
  if (isDriverPostedHallOrder(offer)) {
    const directShort = hallLobbyDriverPostDirectShortLabel(offer);
    if (directShort === '千足金') return 'chin_suchin';
    if (directShort === '九折' || directShort === '定食') return 'promo_blue';
    if (directShort === '公司') return 'company';
    const directLabel = driverPostDirectOutLabel(offer);
    if (directLabel === '九折' || directLabel === '定食') return 'promo_blue';
    if (directLabel === '公司') return 'company';
    if (/九折|定食/.test(blob)) return 'promo_blue';
    if (/直出：公司/.test(blob)) return 'company';
    if (/千足金|千足/.test(blob)) return 'chin_suchin';
    return 'regular';
  }
  if (blob.includes('價格：公司價')) return 'company';
  if (/千足金|千足/.test(blob)) return 'chin_suchin';
  if (/九折|9两/.test(blob)) return 'promo_blue';
  if (/定食/.test(blob)) return 'promo_blue';
  return 'regular';
}

export function hallLobbyTypeLabelTextColor(label: HallLobbyDriverPostDirectLabel): string {
  if (label === '千足金') return HALL_ROUTE_TEXT_COLORS.chin_suchin;
  if (label === '九折' || label === '定食') return HALL_ROUTE_TEXT_COLORS.promo_blue;
  return HALL_ROUTE_TEXT_COLORS.company;
}

/** footer「千足金／九折／定食／公司」可後接 · 電話等 */
export function splitHallLobbyFooterLeadingType(extraText: string): {
  typeLabel: HallLobbyDriverPostDirectLabel | null;
  remainder: string;
} {
  const t = extraText.trim();
  const labels: HallLobbyDriverPostDirectLabel[] = ['千足金', '九折', '定食', '公司'];
  for (const label of labels) {
    if (t === label) return { typeLabel: label, remainder: '' };
    const prefix = `${label} · `;
    if (t.startsWith(prefix)) {
      return { typeLabel: label, remainder: t.slice(prefix.length).trim() };
    }
  }
  return { typeLabel: null, remainder: t };
}

export function hallLobbyPromoShortLabel(
  offer: Pick<OrderOffer, 'orderType' | 'bookingOptionLines'>,
): '九折' | '定食' | null {
  const direct = hallLobbyDriverPostDirectShortLabel(offer);
  if (direct === '九折' || direct === '定食') return direct;
  const blob = hallOrderLinesBlob(offer);
  if (/九折|9两/.test(blob)) return '九折';
  if (/定食/.test(blob)) return '定食';
  return null;
}

function isHallLobbyPriceOrTypeMetaLine(line: string): boolean {
  const t = line.trim();
  return (
    /^價格：/.test(t) ||
    /^直出：/.test(t) ||
    /^聯絡偏好：/.test(t) ||
    isHallPassengerRequestLine(t)
  );
}

/** 大廳 footer 不計入「雜項要求」的系統行（仍可在有雜項時一併顯示） */
function isHallLobbySystemMetaLine(line: string): boolean {
  const t = line.trim();
  return (
    isHallLobbyPriceOrTypeMetaLine(t) ||
    /^估計車資：/.test(t) ||
    /^乘客積分：/.test(t) ||
    /^備註：/.test(t) ||
    /^駕駛偏好：/.test(t) ||
    /^電子付款：/.test(t) ||
    /^貼士：/.test(t) ||
    /^用車時間：/.test(t) ||
    /^預約時間：/.test(t) ||
    /^客人電話：/.test(t) ||
    /^貨主電話：/.test(t)
  );
}

function hallLobbyPassengerRequestExtraBody(line: string): string | null {
  const m = line.trim().match(/^乘客要求[：:](.+)$/);
  const body = m?.[1]?.trim() ?? '';
  return body || null;
}

/** 隧道、停站、車類、其他選項等 — 有則 footer 顯示詳細要求 */
function isHallLobbyBookingExtraLine(line: string): boolean {
  const t = line.trim();
  if (!t || isHallLobbySystemMetaLine(t)) return false;
  const reqBody = hallLobbyPassengerRequestExtraBody(t);
  if (reqBody != null) {
    return reqBody.length > 0;
  }
  return true;
}

function stripHallLobbyTypeMetaFromLines(lines: string[]): string[] {
  return lines.filter((l) => !isHallLobbyPriceOrTypeMetaLine(l));
}

/** 大廳列表：無雜項時精簡 footer；正價僅金色起訖點 */
function applyHallLobbyFooterCompact(offer: OrderOffer, lines: string[]): string[] {
  if (isDriverPostedHallOrder(offer)) {
    return applyHallLobbyFooterCompactDriverPost(offer, lines);
  }

  const extras = lines.filter(isHallLobbyBookingExtraLine);
  const kind = hallOrderRouteColorKind(offer);

  if (extras.length === 0) {
    if (kind === 'regular') return [];
    if (kind === 'company') return [HALL_LOBBY_COMPANY_SHORT];
    const promo = hallLobbyPromoShortLabel(offer);
    if (!promo) return [];
    const setMealPrice = hallLobbySetMealPriceDisplay(offer, lines);
    return setMealPrice ? [promo, setMealPrice] : [promo];
  }

  const out = stripHallLobbyTypeMetaFromLines(lines);
  if (kind === 'company' && !out.some((l) => l === HALL_LOBBY_COMPANY_SHORT)) {
    out.unshift(HALL_LOBBY_COMPANY_SHORT);
  } else if (kind === 'promo_blue') {
    const promo = hallLobbyPromoShortLabel(offer);
    if (promo && !out.includes(promo)) out.unshift(promo);
  }
  const setMealPrice = hallLobbySetMealPriceDisplay(offer, lines);
  if (setMealPrice && !out.includes(setMealPrice)) out.push(setMealPrice);
  return out;
}

export function isHallRegularPriceOrder(
  offer: Pick<OrderOffer, 'orderType' | 'bookingOptionLines'>,
): boolean {
  return hallOrderRouteColorKind(offer) === 'regular';
}

function isHallPassengerRequestLine(line: string): boolean {
  return /^乘客要求[：:]/.test(line.trim());
}

/** 預約列表：按上車時間由近到遠 */
export function sortScheduledOrdersNearestFirst(orders: OrderOffer[]): OrderOffer[] {
  return [...orders].sort((a, b) => {
    const ta = a.scheduledAt ? Date.parse(a.scheduledAt) : Number.MAX_SAFE_INTEGER;
    const tb = b.scheduledAt ? Date.parse(b.scheduledAt) : Number.MAX_SAFE_INTEGER;
    if (ta !== tb) return ta - tb;
    return (a.createdAt ? Date.parse(a.createdAt) : 0) - (b.createdAt ? Date.parse(b.createdAt) : 0);
  });
}

export function formatHallScheduledAtLabel(iso: string): string {
  return formatScheduleDisplay(iso, 'zh-Hant');
}

/** 大廳列表：司機→上車點距離由近到遠（無距離則排後，再以落單時間新→舊） */
export function sortHallOrdersNearestPickupFirst(orders: OrderOffer[]): OrderOffer[] {
  return [...orders].sort((a, b) => {
    const da = hallOrderDistanceKm(a);
    const db = hallOrderDistanceKm(b);
    const aHas = da != null && da > 0;
    const bHas = db != null && db > 0;
    if (aHas && bHas && da !== db) return da - db;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    if (tb !== ta) return tb - ta;
    return b.id.localeCompare(a.id);
  });
}

/** @deprecated 請用 sortHallOrdersNearestPickupFirst */
export function sortHallOrdersNewestFirst(orders: OrderOffer[]): OrderOffer[] {
  return sortHallOrdersNearestPickupFirst(orders);
}

/** 大廳／進行中：落單全部選項與附加資訊（完整「類別：內容」） */
export function hallOrderExtraLines(
  offer: OrderOffer,
  options?: HallOrderExtraLinesOptions,
): string[] {
  const forHallLobby = options?.forHallLobby ?? false;
  const omitContact = forHallLobby;
  const lines: string[] = [];
  const isScheduled = !!offer.scheduledAt?.trim();
  for (const raw of offer.bookingOptionLines ?? []) {
    const t = raw.trim();
    if (!t) continue;
    if (isHallPhoneDisplayLine(t)) continue;
    if (forHallLobby && isHallPassengerRequestLine(t)) continue;
    if (omitContact && lineMentionsContact(t)) continue;
    if (isScheduled && (/^預約時間：/.test(t) || /^用車時間：/.test(t))) continue;
    if (!isScheduled && (/^用車時間：/.test(t) || /^預約時間：/.test(t))) continue;
    lines.push(t);
  }

  const redeem = passengerPointsRedemptionLine(offer);
  if (redeem && !lines.some((l) => /乘客積分|積分抵扣/.test(l))) {
    lines.push(redeem);
  }

  if (!omitContact && !lines.some(lineMentionsContact)) {
    const contact = contactPreferenceHallLine(offer);
    if (contact) lines.push(contact);
  }

  if (
    !forHallLobby &&
    offer.fareEstimateHkd > 0 &&
    !isDriverPostedHallOrder(offer) &&
    !lines.some((l) => /車資|HK\$|fare/i.test(l))
  ) {
    lines.push(`估計車資：HK$${offer.fareEstimateHkd}`);
  }

  if (isDriverPostedHallOrder(offer)) {
    const posted = ensureDriverPostHallLinesFromRemark(lines);
    return forHallLobby ? applyHallLobbyFooterCompact(offer, posted) : posted;
  }

  /** 大廳／預約列表卡片左上角已有「預約 …」，footer 唔重複用車時間 */
  if (isScheduled && !forHallLobby) {
    const timeLabel = formatHallScheduledAtLabel(offer.scheduledAt!);
    let replaced = false;
    for (let i = 0; i < lines.length; i++) {
      if (/^用車時間：/.test(lines[i])) {
        lines[i] = `用車時間：${timeLabel}`;
        replaced = true;
        break;
      }
    }
    if (!replaced && !lines.some((l) => /^預約時間：/.test(l))) {
      lines.unshift(`用車時間：${timeLabel}`);
    }
  }

  return forHallLobby ? applyHallLobbyFooterCompact(offer, lines) : lines;
}

export function scheduledOrderHallHintMessage(scheduledAtIso: string): string {
  const time = formatHallScheduledAtLabel(scheduledAtIso);
  return `請於 ${time} 準時接客。\n\n出發前請到「預約」分頁選擇此柯打，再按「開始接客」進入行程。`;
}

/** 預約 Tab「開始接客」：用車時間前 45 分鐘內才可按 */
export const SCHEDULED_START_TRIP_LEAD_MS = 45 * 60 * 1000;

export function canStartScheduledTripNow(
  scheduledAtIso: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!scheduledAtIso?.trim()) return true;
  const t = Date.parse(scheduledAtIso);
  if (!Number.isFinite(t)) return true;
  return nowMs >= t - SCHEDULED_START_TRIP_LEAD_MS;
}

export function scheduledStartTripBlockedAlert(scheduledAtIso: string): {
  title: string;
  message: string;
} {
  const time = formatHallScheduledAtLabel(scheduledAtIso);
  return {
    title: '尚未到開始接客時間',
    message: `此柯打用車時間為 ${time}。\n\n請於用車時間前 45 分鐘內再按「開始接客」。`,
  };
}

/** @deprecated 使用 hallOrderExtraLines */
export function hallOrderExtraTags(offer: OrderOffer): string[] {
  return hallOrderExtraLines(offer);
}

const SHOOT_HALL_BLUE_KEYWORDS = ['九折', '9两', '定食', '寵物', '無煙'] as const;

export function isDriverPostedHallOrder(
  offer: Pick<OrderOffer, 'orderType'>,
): boolean {
  return offer.orderType === 'driver_posted';
}

export function isOwnDriverPostedHallOrder(
  offer: Pick<OrderOffer, 'orderType' | 'postedByDriverId'>,
  driverId: string | null | undefined,
): boolean {
  if (!driverId || offer.orderType !== 'driver_posted') return false;
  const poster = offer.postedByDriverId?.trim();
  return Boolean(poster && poster === driverId);
}

const SHOOT_GUEST_PHONE_PREFIX = '客人電話：';
const SHOOT_OWNER_PHONE_PREFIX = '貨主電話：';

export function isHallPhoneDisplayLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith(SHOOT_GUEST_PHONE_PREFIX) || t.startsWith(SHOOT_OWNER_PHONE_PREFIX);
}

/** 大廳 footer：「其他：xxx」只顯示 xxx（類別名稱唔重複） */
function hallLobbyFormatFooterSegment(segment: string): string {
  const t = segment.trim();
  if (!t) return '';
  if (/^其他[：:]/.test(t)) {
    return t.replace(/^其他[：:]\s*/, '').trim();
  }
  return t;
}

function stripPhoneSegmentsFromJoinedText(text: string): string {
  return text
    .split(/\s*·\s*/)
    .map((p) => hallLobbyFormatFooterSegment(p))
    .filter(
      (p) =>
        p &&
        !/^客人電話：/.test(p) &&
        !/^貨主電話：/.test(p) &&
        !/^直出·/.test(p),
    )
    .join(' · ');
}

export function hallOrderExtraLinesForDisplay(
  offer: OrderOffer,
  opts?: { forHallLobby?: boolean; omitPassengerContact?: boolean },
): string[] {
  return hallOrderExtraLines(offer, opts)
    .filter((line) => !isHallPhoneDisplayLine(line))
    .map((line) => {
      if (line.startsWith('備註：')) {
        const body = stripPhoneSegmentsFromJoinedText(line.slice('備註：'.length));
        return body ? `備註：${body}` : '';
      }
      return stripPhoneSegmentsFromJoinedText(line);
    })
    .filter((line) => line.trim().length > 0);
}

function guestPhoneFromRemarkLines(lines: string[] | undefined): string | null {
  for (const raw of lines ?? []) {
    const t = raw.trim();
    const body = t.startsWith('備註：') ? t.slice('備註：'.length) : t;
    const guest = body.match(/客人電話：([^·]+)/);
    if (guest?.[1]?.trim()) return guest[1].trim();
  }
  return null;
}

function ownerPhoneFromRemarkLines(lines: string[] | undefined): string | null {
  for (const raw of lines ?? []) {
    const t = raw.trim();
    const body = t.startsWith('備註：') ? t.slice('備註：'.length) : t;
    const owner = body.match(/貨主電話：([^·]+)/);
    if (owner?.[1]?.trim()) return owner[1].trim();
  }
  return null;
}

/** 射柯打備註行內的聯絡電話（供接單後致電，非 App 乘客帳號） */
export function parseDriverPostedPhoneFromLines(
  lines: string[] | undefined,
  prefix: typeof SHOOT_GUEST_PHONE_PREFIX | typeof SHOOT_OWNER_PHONE_PREFIX,
): string | null {
  for (const raw of lines ?? []) {
    const t = raw.trim();
    if (t.startsWith(prefix)) {
      const phone = t.slice(prefix.length).trim();
      return phone || null;
    }
  }
  return null;
}

export function driverPostedTripGuestPhone(
  offer: Pick<OrderOffer, 'bookingOptionLines' | 'driverPostGuestPhone'>,
): string | null {
  const fromApi = offer.driverPostGuestPhone?.trim();
  if (fromApi) return fromApi;
  const lines = offer.bookingOptionLines;
  const fromDedicated = parseDriverPostedPhoneFromLines(lines, SHOOT_GUEST_PHONE_PREFIX);
  if (fromDedicated?.trim()) return fromDedicated.trim();
  return guestPhoneFromRemarkLines(lines);
}

/** 射柯打接單後：備註「客人電話」或 API passengerPhone */
export function driverPostedTripPassengerPhone(
  offer: Pick<
    OrderOffer,
    'bookingOptionLines' | 'passengerPhone' | 'driverPostGuestPhone'
  >,
): string | null {
  const fromLines = driverPostedTripGuestPhone(offer);
  if (fromLines?.trim()) return fromLines.trim();
  const direct = offer.passengerPhone?.trim();
  return direct || null;
}

export function driverPostedTripOwnerPhone(
  offer: Pick<OrderOffer, 'bookingOptionLines' | 'driverPostOwnerPhone'>,
): string | null {
  const fromApi = offer.driverPostOwnerPhone?.trim();
  if (fromApi) return fromApi;
  const lines = offer.bookingOptionLines;
  const fromDedicated = parseDriverPostedPhoneFromLines(lines, SHOOT_OWNER_PHONE_PREFIX);
  if (fromDedicated?.trim()) return fromDedicated.trim();
  return ownerPhoneFromRemarkLines(lines);
}

/** 出貨柯打大廳：九折／定食等關鍵字藍字 */
export function hallFooterHighlightsShootKeywords(
  offer: Pick<OrderOffer, 'orderType'>,
  extraText: string,
): boolean {
  if (!isDriverPostedHallOrder(offer)) return false;
  return SHOOT_HALL_BLUE_KEYWORDS.some((k) => extraText.includes(k));
}

export function splitHallFooterShootBlueParts(text: string): string[] {
  const re = /(九折|9两|定食|寵物|無煙)/g;
  return text.split(re);
}

export function hallFooterPartIsShootBlue(part: string): boolean {
  return (SHOOT_HALL_BLUE_KEYWORDS as readonly string[]).includes(part);
}

export const HALL_FOOTER_REGULAR_PRICE_LABEL = '正價';
export const HALL_FOOTER_COMPANY_PRICE_LABEL = '公司價';

export function hallFooterNeedsPriceHighlight(extraText: string): boolean {
  return (
    extraText.includes(HALL_FOOTER_COMPANY_PRICE_LABEL) ||
    extraText.includes(HALL_FOOTER_REGULAR_PRICE_LABEL)
  );
}

export function hallFooterNeedsAnyHighlight(
  offer: Pick<OrderOffer, 'orderType'>,
  extraText: string,
): boolean {
  return (
    hallFooterNeedsPriceHighlight(extraText) ||
    hallFooterHighlightsShootKeywords(offer, extraText) ||
    hallLobbyFooterUsesShortTypeLabel(extraText)
  );
}

export function hallLobbyFooterUsesShortTypeLabel(extraText: string): boolean {
  return splitHallLobbyFooterLeadingType(extraText).typeLabel != null;
}

export function hallLobbyFooterShortLabelStyle(
  label: string,
): 'company' | 'promo' | 'gold' | 'regular' | null {
  const { typeLabel } = splitHallLobbyFooterLeadingType(label);
  if (typeLabel === '公司') return 'company';
  if (typeLabel === '九折' || typeLabel === '定食') return 'promo';
  if (typeLabel === '千足金') return 'gold';
  if (label.trim() === HALL_FOOTER_REGULAR_PRICE_LABEL) return 'regular';
  return null;
}

/** 大廳起訖點文字色（含千足金直出、貨主柯打直出種類） */
export function hallOrderRouteTextColor(
  offer: Pick<OrderOffer, 'orderType' | 'bookingOptionLines'>,
): string {
  return HALL_ROUTE_TEXT_COLORS[hallOrderRouteColorKind(offer)];
}

/** 大廳 footer：公司價／正價／出貨關鍵字分段 */
export function splitHallFooterHighlightParts(extraText: string): string[] {
  return extraText.split(/(公司價|正價|九折|9两|定食|千足金|寵物|無煙|公司)/g);
}

/** 舊 API 備註內電話／直出（新 API 已拆行） */
export function ensureDriverPostHallLinesFromRemark(lines: string[]): string[] {
  const out = [...lines];
  let remarkIdx = out.findIndex((l) => l.startsWith('備註：'));
  const remarkBody = remarkIdx >= 0 ? out[remarkIdx].slice('備註：'.length) : '';
  const source = remarkBody || out.join(' · ');

  if (!out.some((l) => l.startsWith('直出：'))) {
    const directMatch = source.match(/直出[·：\s]*(九折|9两|定食|千足金|千足|公司|寵物)/);
    if (directMatch) {
      const label =
        directMatch[1] === '9两' ? '九折' : directMatch[1] === '千足' ? '千足金' : directMatch[1];
      out.unshift(`直出：${label}`);
    }
  }
  const guest = source.match(/客人電話：([^·]+)/);
  if (guest?.[1]?.trim() && !out.some((l) => l.startsWith('客人電話：'))) {
    out.push(`客人電話：${guest[1].trim()}`);
  }
  remarkIdx = out.findIndex((l) => l.startsWith('備註：'));
  if (remarkIdx >= 0) {
    const cleaned = driverPostRemarkWithoutDirectMeta(out[remarkIdx]);
    if (cleaned) out[remarkIdx] = cleaned;
    else out.splice(remarkIdx, 1);
  }
  return out;
}
