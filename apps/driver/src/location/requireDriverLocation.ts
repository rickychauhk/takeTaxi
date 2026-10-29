import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';
import { alertForDriverPositionFailure, readDriverPosition } from './readDriverPosition';

/** 上線前：權限 + 必須讀到真實 GPS，否則提示並禁止上線。 */
export async function ensureDriverGpsForOnline(): Promise<boolean> {
  const permOk = await ensureDriverForegroundLocation();
  if (!permOk) return false;
  const result = await readDriverPosition();
  if (!result.ok) {
    alertForDriverPositionFailure(result.reason);
    return false;
  }
  return true;
}

/** 司機上線／接單前必須授權前景定位。 */
export async function ensureDriverForegroundLocation(): Promise<boolean> {
  let perm = await Location.getForegroundPermissionsAsync();
  if (perm.status === 'granted') return true;

  if (perm.status === 'denied' && !perm.canAskAgain) {
    Alert.alert(
      '需要定位權限',
      '請到系統設定開啟「搭的司機版」的位置權限，才可上線及接單。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '開啟設定',
          onPress: () => {
            void Linking.openSettings();
          },
        },
      ],
    );
    return false;
  }

  perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') {
    Alert.alert(
      '需要定位權限',
      '請允許「使用 App 時」取用位置，方可上線及接單；乘客需查看你的即時位置。',
    );
    return false;
  }
  return true;
}

/** 接單前立即上報一次 GPS，配合 API 檢查 live_locations。 */
export async function postImmediateDriverLocation(
  post: (lat: number, lng: number) => Promise<void>,
): Promise<boolean> {
  const result = await readDriverPosition();
  if (!result.ok) {
    alertForDriverPositionFailure(result.reason);
    return false;
  }
  try {
    await post(result.latitude, result.longitude);
    return true;
  } catch {
    Alert.alert('無法上報位置', '網絡或伺服器異常，請稍後再試。');
    return false;
  }
}

export function locationServicesHint(): string {
  return Platform.OS === 'ios'
    ? '設定 → 私隱與保安 → 定位服務 → 搭的司機版 → 使用 App 時'
    : '設定 → 應用程式 → 搭的司機版 → 權限 → 位置';
}

export type DriverGpsResumeIssue = 'services_off' | 'permission_denied' | 'unavailable';

/** 從背景回前景：只檢查、唔彈權限請求。 */
export async function checkDriverGpsOnAppResume(): Promise<
  { ok: true } | { ok: false; reason: DriverGpsResumeIssue }
> {
  const servicesOn = await Location.hasServicesEnabledAsync();
  if (!servicesOn) return { ok: false, reason: 'services_off' };

  const perm = await Location.getForegroundPermissionsAsync();
  if (perm.status !== 'granted') return { ok: false, reason: 'permission_denied' };

  const result = await readDriverPosition();
  if (!result.ok) {
    if (result.reason === 'services_off') return { ok: false, reason: 'services_off' };
    if (result.reason === 'simulator_no_location') return { ok: false, reason: 'unavailable' };
    return { ok: false, reason: 'unavailable' };
  }
  return { ok: true };
}

export function alertDriverGpsOnResume(
  reason: DriverGpsResumeIssue,
  options?: { forcedOffline?: boolean; activeTrip?: boolean },
): void {
  const offlineNote = options?.forcedOffline
    ? '\n\n你已切換為下線，請開啟定位後再按上線。'
    : options?.activeTrip
      ? '\n\n已暫停接單狀態，請立即開啟定位以繼續導航及讓乘客看到車輛位置。'
      : '';
  switch (reason) {
    case 'services_off':
      Alert.alert(
        '定位服務已關閉',
        `請到系統設定開啟「定位服務」，司機版才能上線及接單。${offlineNote}`,
        [
          { text: '知道了', style: 'cancel' },
          {
            text: '開啟設定',
            onPress: () => {
              void Linking.openSettings();
            },
          },
        ],
      );
      break;
    case 'permission_denied':
      Alert.alert(
        '需要定位權限',
        `請到系統設定允許「搭的司機版」使用位置。${offlineNote}`,
        [
          { text: '知道了', style: 'cancel' },
          {
            text: '開啟設定',
            onPress: () => {
              void Linking.openSettings();
            },
          },
        ],
      );
      break;
    default:
      Alert.alert(
        '無法取得 GPS',
        `請確認定位服務及權限已開啟，並稍等數秒再試。${offlineNote}`,
      );
      break;
  }
}
