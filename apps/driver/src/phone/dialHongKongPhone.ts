import Constants from 'expo-constants';
import { Alert, Linking, Platform } from 'react-native';
import { formatHongKongPhoneDisplay, toE164HongKong } from '../firebase/phone';

/** 撥打香港電話（不顯示號碼於 UI 時仍可用 raw 值撥號） */
export function dialHongKongPhone(displayLabel: string, rawPhone: string): void {
  const phone = toE164HongKong(rawPhone);
  if (!phone) {
    Alert.alert(displayLabel, '電話格式不正確');
    return;
  }
  void (async () => {
    if (Constants.isDevice === false) {
      Alert.alert(displayLabel, `Simulator 無法撥號：${formatHongKongPhoneDisplay(phone)}`);
      return;
    }
    const url = Platform.OS === 'ios' ? `telprompt:${phone}` : `tel:${phone}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(displayLabel, '此裝置無法撥號');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert(displayLabel, '無法撥號');
    }
  })();
}
