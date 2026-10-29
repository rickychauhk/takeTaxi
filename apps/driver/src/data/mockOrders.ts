import type { OrderOffer } from '../types/order';

const POOL: Omit<OrderOffer, 'id'>[] = [
  {
    pickupLabel: '中環國際金融中心',
    dropoffLabel: '尖沙咀海港城',
    fareEstimateHkd: 168,
    distanceKm: 5.2,
    passengerPhone: '91234567',
    pickupCoord: { latitude: 22.285978, longitude: 114.158798 },
    dropoffCoord: { latitude: 22.294303, longitude: 114.168923 },
  },
  {
    pickupLabel: '旺角朗豪坊',
    dropoffLabel: '何文田孝民街愛民邨康民樓',
    fareEstimateHkd: 142,
    distanceKm: 6.8,
    passengerPhone: '98765432',
    pickupCoord: { latitude: 22.318567, longitude: 114.169773 },
    dropoffCoord: { latitude: 22.312845, longitude: 114.182156 },
  },
  {
    pickupLabel: '銅鑼灣時代廣場',
    dropoffLabel: '香港海洋公園',
    fareEstimateHkd: 195,
    distanceKm: 12.5,
    passengerPhone: '61112222',
    pickupCoord: { latitude: 22.278321, longitude: 114.182777 },
    dropoffCoord: { latitude: 22.246857, longitude: 114.174663 },
  },
  {
    pickupLabel: '葵涌大隴街石籬（二）邨',
    dropoffLabel: '葵涌石排街',
    fareEstimateHkd: 58,
    distanceKm: 2.1,
    pickupCoord: { latitude: 22.363892, longitude: 114.133421 },
    dropoffCoord: { latitude: 22.368104, longitude: 114.128876 },
  },
];

let seq = 90000;

export function createMockIncomingOrder(): OrderOffer {
  const base = POOL[Math.floor(Math.random() * POOL.length)]!;
  seq += 1;
  return { id: String(seq), ...base };
}
