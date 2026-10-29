import { useCallback, useEffect, useRef } from 'react';
import { Alert, AppState, Linking } from 'react-native';
import { useI18n } from '../i18n/I18nProvider';
import {
  assessLocationAccess,
  hintForPositionFailure,
  messageForPositionFailure,
} from '../location/getDevicePosition';

/** 登入後每次進 App／回到前景都檢查定位；無權限則提示開啟 GPS */
export function useLocationAccessGuard(enabled: boolean) {
  const { t } = useI18n();
  const alertOpenRef = useRef(false);

  const promptIfNeeded = useCallback(async () => {
    if (!enabled || alertOpenRef.current) return;
    const reason = await assessLocationAccess();
    if (!reason) return;

    alertOpenRef.current = true;
    Alert.alert(
      t('location.promptTitle'),
      `${messageForPositionFailure(reason)}\n\n${hintForPositionFailure(reason)}`,
      [
        {
          text: t('location.notNow'),
          style: 'cancel',
          onPress: () => {
            alertOpenRef.current = false;
          },
        },
        {
          text: t('location.openSettings'),
          onPress: () => {
            alertOpenRef.current = false;
            void Linking.openSettings();
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          alertOpenRef.current = false;
        },
      },
    );
  }, [enabled, t]);

  useEffect(() => {
    void promptIfNeeded();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void promptIfNeeded();
    });
    return () => sub.remove();
  }, [promptIfNeeded]);
}
