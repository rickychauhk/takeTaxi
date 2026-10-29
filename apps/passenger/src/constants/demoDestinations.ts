import { getAppLocale } from '../i18n';

export type LatLng = { latitude: number; longitude: number; label: string };

export type DemoDestination = LatLng & { labelEn: string };

/** 香港 demo 目的地（可隨機選一個） */
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
    latitude: 22.3704,
    longitude: 114.1185,
    label: '葵涌石排街',
    labelEn: 'Shek Pai Street, Kwai Chung',
  },
  {
    latitude: 22.3688,
    longitude: 114.1272,
    label: '葵涌圍乪街石籬（一）邨商場',
    labelEn: 'Shek Lei (I) Estate Shopping Centre, Kwai Chung',
  },
  {
    latitude: 22.3695,
    longitude: 114.1265,
    label: '葵涌圍乪街石籬邨石安樓',
    labelEn: 'Shek On House, Shek Lei Estate, Kwai Chung',
  },
  {
    latitude: 22.3672,
    longitude: 114.1318,
    label: '葵涌大隴街友明大廈',
    labelEn: 'Yau Ming Building, Tai Loong Street, Kwai Chung',
  },
  {
    latitude: 22.3668,
    longitude: 114.1325,
    label: '葵涌大隴街昌榮樓',
    labelEn: 'Cheong Wing House, Tai Loong Street, Kwai Chung',
  },
  {
    latitude: 22.3659,
    longitude: 114.1331,
    label: '葵涌大隴街石籬（二）邨',
    labelEn: 'Shek Lei (II) Estate, Tai Loong Street, Kwai Chung',
  },
  {
    latitude: 22.3364,
    longitude: 114.1936,
    label: '旺角朗豪坊',
    labelEn: 'Langham Place, Mong Kok',
  },
  {
    latitude: 22.2477,
    longitude: 114.2035,
    label: '香港海洋公園',
    labelEn: 'Ocean Park Hong Kong',
  },
];

export function localizedDestinationLabel(d: Pick<DemoDestination, 'label' | 'labelEn'>): string {
  return getAppLocale() === 'en' ? d.labelEn : d.label;
}

export function toLocalizedLatLng(d: DemoDestination): LatLng {
  return {
    latitude: d.latitude,
    longitude: d.longitude,
    label: localizedDestinationLabel(d),
  };
}

export function pickRandomDestination(): LatLng {
  const d = DEMO_DESTINATIONS[Math.floor(Math.random() * DEMO_DESTINATIONS.length)]!;
  return toLocalizedLatLng(d);
}
