import type { LatLng } from './latLng';

export type { LatLng } from './latLng';

export type DemoDestination = LatLng & { labelEn: string };

/** 香港常用地點（搜尋建議／預設目的地） */
export const DEMO_DESTINATIONS: DemoDestination[] = [
  {
    latitude: 22.3193,
    longitude: 114.1694,
    label: '何文田孝民街愛民邨康民樓',
    labelEn: 'Hong Ning House, Oi Man Estate, Ho Man Tin',
  },
  {
    latitude: 22.2938,
    longitude: 114.1689,
    label: '尖沙咀海港城',
    labelEn: 'Harbour City, Tsim Sha Tsui',
  },
  {
    latitude: 22.2855,
    longitude: 114.1577,
    label: '中環國際金融中心',
    labelEn: 'International Finance Centre, Central',
  },
  {
    latitude: 22.3364,
    longitude: 114.1936,
    label: '旺角朗豪坊',
    labelEn: 'Langham Place, Mong Kok',
  },
  {
    latitude: 22.3704,
    longitude: 114.1185,
    label: '葵涌石排街',
    labelEn: 'Shek Pai Street, Kwai Chung',
  },
  {
    latitude: 22.2477,
    longitude: 114.2035,
    label: '香港海洋公園',
    labelEn: 'Ocean Park Hong Kong',
  },
];

export function toLocalizedLatLng(d: DemoDestination): LatLng {
  return { latitude: d.latitude, longitude: d.longitude, label: d.label };
}

export function pickRandomDestination(): LatLng {
  const d = DEMO_DESTINATIONS[Math.floor(Math.random() * DEMO_DESTINATIONS.length)]!;
  return toLocalizedLatLng(d);
}
