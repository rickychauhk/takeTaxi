import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useDriverAuth } from '../auth/DriverAuthContext';
import { colors } from '../theme/colors';
import { SplashAdGate } from '../components/SplashAdGate';
import { AuthStack } from './AuthStack';
import { RootNavigator } from './RootNavigator';

export function AuthNavigator() {
  const { token, bootstrapping } = useDriverAuth();

  if (bootstrapping) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.brandYellow} />
      </View>
    );
  }

  if (!token) {
    return (
      <NavigationContainer theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg } }}>
        <AuthStack />
      </NavigationContainer>
    );
  }

  return (
    <SplashAdGate>
      <RootNavigator />
    </SplashAdGate>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
