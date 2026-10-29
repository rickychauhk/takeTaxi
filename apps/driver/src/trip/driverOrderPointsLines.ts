import type { OrderOffer } from '../types/order';

export type DriverOrderPointsLine = { text: string; tone: 'cost' | 'reward' | 'bounty' };

export function driverOrderPointsLines(
  offer: Pick<
    OrderOffer,
    | 'orderType'
    | 'driverPointsCostAtOrder'
    | 'driverPointsBusySurcharge'
    | 'driverBusyRegionRewardPoints'
    | 'driverBusyRegionFromArea'
    | 'driverBusyRegionToArea'
    | 'driverPostBountyPoints'
  >,
): DriverOrderPointsLine[] {
  const lines: DriverOrderPointsLine[] = [];
  const cost = Math.round(offer.driverPointsCostAtOrder ?? 0);
  if (cost > 0) {
    const label =
      offer.orderType === 'driver_posted'
        ? `出貨柯打接單扣減 ${cost} 積分`
        : `接單扣減 ${cost} 積分`;
    lines.push({
      tone: 'cost',
      text: label,
    });
  }

  const busyReward = Math.round(offer.driverPointsBusySurcharge ?? 0);
  if (busyReward > 0) {
    lines.push({
      tone: 'reward',
      text: `繁忙時段獎賞 +${busyReward} 積分（平台發放）`,
    });
  }

  const reward = Math.round(offer.driverBusyRegionRewardPoints ?? 0);
  if (reward > 0) {
    const from = offer.driverBusyRegionFromArea?.trim();
    const to = offer.driverBusyRegionToArea?.trim();
    const route = from && to ? ` · ${from}→${to}` : '';
    lines.push({
      tone: 'reward',
      text: `同區／地區獎賞 +${reward} 積分（平台發放）${route}`,
    });
  }

  if (offer.orderType !== 'driver_posted') {
    const bounty = Math.round(offer.driverPostBountyPoints ?? 0);
    if (bounty > 0) {
      lines.push({ tone: 'bounty', text: `出貨懸賞 +${bounty} 積分` });
    }
  }

  return lines;
}
