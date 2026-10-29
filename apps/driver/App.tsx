import './src/firebase/app';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { initDriverCrashlytics } from './src/firebase/crashlytics';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DriverKeepAwake } from './src/components/DriverKeepAwake';
import { DriverAuthProvider } from './src/auth/DriverAuthContext';
import { DriverSettingsProvider } from './src/context/DriverSettingsContext';
import { DriverSessionProvider } from './src/context/DriverSessionContext';
import { I18nProvider } from './src/i18n/I18nProvider';
import { DriverForegroundGpsGuard } from './src/components/DriverForegroundGpsGuard';
import { OneSignalBootstrap } from './src/notifications/OneSignalBootstrap';
import { DriverAndroidIncomingPush } from './src/notifications/DriverAndroidIncomingPush';
import { DriverIosIncomingPush } from './src/notifications/DriverIosIncomingPush';
import { DriverGlobalOrderAlert } from './src/components/DriverGlobalOrderAlert';
import { NetworkConnectivityRoot } from './src/components/NetworkConnectivityBanner';
import { AuthNavigator } from './src/navigation/AuthNavigator';

export default function App() {
  useEffect(() => {
    initDriverCrashlytics();
  }, []);

  return (
    <SafeAreaProvider>
      <OneSignalBootstrap>
      <DriverKeepAwake />
      <I18nProvider>
        <NetworkConnectivityRoot>
          <DriverAuthProvider>
            <DriverSettingsProvider>
              <DriverSessionProvider>
                <DriverAndroidIncomingPush />
                <DriverIosIncomingPush />
                <DriverGlobalOrderAlert />
                <DriverForegroundGpsGuard />
                <StatusBar style="light" />
                <AuthNavigator />
              </DriverSessionProvider>
            </DriverSettingsProvider>
          </DriverAuthProvider>
        </NetworkConnectivityRoot>
      </I18nProvider>
      </OneSignalBootstrap>
    </SafeAreaProvider>
  );
}
