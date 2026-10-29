import { Alert, Linking, Platform } from 'react-native';
import type { NavigationTarget } from './navigationTarget';

export type ExternalMapProvider = 'apple' | 'google' | 'gaode';

const APP_NAME = '搭的司機版';

function encodeLabel(label: string): string {
  return encodeURIComponent(label.trim());
}

function destinationQuery(target: NavigationTarget): string {
  if (target.coord) {
    return `${target.coord.latitude},${target.coord.longitude}`;
  }
  return encodeLabel(target.label || '目的地');
}

export function appleMapsUrls(target: NavigationTarget): { primary: string; fallback: string } {
  const daddr = destinationQuery(target);
  return {
    primary: `maps://?daddr=${daddr}&dirflg=d`,
    fallback: `http://maps.apple.com/?daddr=${daddr}&dirflg=d`,
  };
}

export function googleMapsUrls(target: NavigationTarget): { primary: string; fallback: string } {
  const dest = destinationQuery(target);
  const universal = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
  if (Platform.OS === 'ios') {
    return {
      primary: `comgooglemaps://?daddr=${dest}&directionsmode=driving`,
      fallback: universal,
    };
  }
  return {
    primary: `google.navigation:q=${dest}`,
    fallback: universal,
  };
}

export function gaodeMapsUrls(target: NavigationTarget): { primary: string; fallback: string } {
  const dname = encodeLabel(target.label);
  if (target.coord) {
    const { latitude, longitude } = target.coord;
    if (Platform.OS === 'ios') {
      return {
        primary: `iosamap://path?sourceApplication=${encodeURIComponent(APP_NAME)}&dlat=${latitude}&dlon=${longitude}&dname=${dname}&dev=0&t=0`,
        fallback: `https://uri.amap.com/navigation?to=${longitude},${latitude},${dname}&mode=car&coordinate=gaode`,
      };
    }
    return {
      primary: `androidamap://route?sourceApplication=${encodeURIComponent(APP_NAME)}&dlat=${latitude}&dlon=${longitude}&dname=${dname}&dev=0&t=0`,
      fallback: `https://uri.amap.com/navigation?to=${longitude},${latitude},${dname}&mode=car&coordinate=gaode`,
    };
  }
  const keyword = dname;
  if (Platform.OS === 'ios') {
    return {
      primary: `iosamap://keywordNavi?sourceApplication=${encodeURIComponent(APP_NAME)}&keyword=${keyword}&t=0`,
      fallback: `https://uri.amap.com/search?keyword=${keyword}`,
    };
  }
  return {
    primary: `androidamap://keywordNavi?sourceApplication=${encodeURIComponent(APP_NAME)}&keyword=${keyword}&t=0`,
    fallback: `https://uri.amap.com/search?keyword=${keyword}`,
  };
}

async function openWithFallback(primary: string, fallback: string, appLabel: string): Promise<boolean> {
  try {
    const canPrimary = await Linking.canOpenURL(primary);
    if (canPrimary) {
      await Linking.openURL(primary);
      return true;
    }
  } catch {
    // canOpenURL 可能因 plist 未列 scheme 而 false；仍嘗試 primary
    try {
      await Linking.openURL(primary);
      return true;
    } catch {
      // fall through
    }
  }

  try {
    await Linking.openURL(fallback);
    return true;
  } catch {
    Alert.alert('無法開啟地圖', `請確認已安裝 ${appLabel}，或改用「應用內導航」。`);
    return false;
  }
}

export async function openExternalMap(provider: ExternalMapProvider, target: NavigationTarget): Promise<void> {
  if (provider === 'apple') {
    if (Platform.OS !== 'ios') {
      Alert.alert('Apple 地圖', '僅適用於 iPhone / iPad。');
      return;
    }
    const { primary, fallback } = appleMapsUrls(target);
    await openWithFallback(primary, fallback, 'Apple 地圖');
    return;
  }

  if (provider === 'google') {
    const { primary, fallback } = googleMapsUrls(target);
    await openWithFallback(primary, fallback, 'Google 地圖');
    return;
  }

  const { primary, fallback } = gaodeMapsUrls(target);
  await openWithFallback(primary, fallback, '高德地圖');
}
