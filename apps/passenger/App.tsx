import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initPassengerCrashlytics } from './src/firebase/crashlytics';
import { PassengerAuthProvider, usePassengerAuth } from './src/auth/PassengerAuthContext';
import { SplashAdGate } from './src/components/SplashAdGate';
import { I18nProvider } from './src/i18n/I18nProvider';
import { OneSignalBootstrap } from './src/notifications/OneSignalBootstrap';
import { useLocationAccessGuard } from './src/hooks/useLocationAccessGuard';
import HomeMapScreen from './src/screens/HomeMapScreen';
import PassengerLoginScreen from './src/screens/PassengerLoginScreen';
import { NetworkConnectivityRoot } from './src/components/NetworkConnectivityBanner';
import { colors } from './src/theme/colors';

function PassengerRoot() {
  const { token, bootstrapping } = usePassengerAuth();
  useLocationAccessGuard(!bootstrapping && Boolean(token));

  if (bootstrapping) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.brandYellow} />
      </View>
    );
  }

  if (!token) {
    return <PassengerLoginScreen />;
  }

  return (
    <SplashAdGate>
      <HomeMapScreen />
    </SplashAdGate>
  );
}

export default function App() {
  useEffect(() => {
    initPassengerCrashlytics();
  }, []);

  return (
    <SafeAreaProvider>
      <OneSignalBootstrap>
        <I18nProvider>
          <NetworkConnectivityRoot>
            <PassengerAuthProvider>
              <PassengerRoot />
            </PassengerAuthProvider>
          </NetworkConnectivityRoot>
        </I18nProvider>
      </OneSignalBootstrap>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mapDark },
});
