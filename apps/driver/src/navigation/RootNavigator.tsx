import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useDriverAuth } from '../auth/DriverAuthContext';
import { useDriverLaunchSync } from '../hooks/useDriverLaunchSync';
import { useDriverAutoOnline } from '../hooks/useDriverAutoOnline';
import { useDriverLiveLocation } from '../hooks/useDriverLiveLocation';
import { useDriverOnlineBackgroundLocation } from '../hooks/useDriverOnlineBackgroundLocation';
import { isDriverApproved } from '../constants/driverApproval';
import { useDriverSession } from '../context/DriverSessionContext';
import { connectDriverPostedNotices } from '../realtime/driverOrdersSocket';
import DashboardScreen from '../screens/DashboardScreen';
import ActiveTripScreen from '../screens/ActiveTripScreen';
import OrderChatScreen from '../screens/OrderChatScreen';
import TripCompletedScreen from '../screens/TripCompletedScreen';
import EarningsScreen from '../screens/EarningsScreen';
import DriverSettingsScreen from '../screens/DriverSettingsScreen';
import TermsWebViewScreen from '../screens/TermsWebViewScreen';
import ShootOrderScreen from '../screens/ShootOrderScreen';
import ScheduledOrdersScreen from '../screens/ScheduledOrdersScreen';
import PurchasePointsScreen from '../screens/PurchasePointsScreen';
import TodayCompletedOrdersScreen from '../screens/TodayCompletedOrdersScreen';
import { useDriverSettings } from '../context/DriverSettingsContext';
import { useScheduledOrdersEnabled } from '../hooks/useScheduledOrdersEnabled';
import { colors } from '../theme/colors';
import { navigationRef, tryOpenPushOrder } from './navigationRef';
import type { MainTabParamList, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.surface,
    border: colors.border,
    primary: colors.brandYellow,
    text: colors.text,
  },
};

function MainTabs() {
  useDriverLaunchSync();
  useDriverAutoOnline();
  const { token, driver } = useDriverAuth();
  const { state } = useDriverSession();
  const { syncPickupRadiusFromStorage } = useDriverSettings();
  const scheduledOrdersEnabled = useScheduledOrdersEnabled();
  const approved = isDriverApproved(driver?.verificationStatus);
  const gpsActive = Boolean(token && approved && state.online);
  useDriverLiveLocation(driver?.id, gpsActive);
  useDriverOnlineBackgroundLocation(driver?.id, gpsActive && !state.activeOrder);
  useEffect(() => {
    if (!token) return;
    return connectDriverPostedNotices(token, (payload) => {
      Alert.alert('出貨通知', payload.message);
    });
  }, [token]);
  return (
    <Tab.Navigator
      screenListeners={{
        tabPress: () => {
          void syncPickupRadiusFromStorage();
        },
      }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.brandYellow,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ color, size }) => {
          const name =
            route.name === 'Dashboard'
              ? 'grid-outline'
              : route.name === 'ScheduledOrders'
                ? 'calendar-outline'
              : route.name === 'ShootOrder'
                ? 'navigate-circle-outline'
                : route.name === 'Settings'
                  ? 'settings-outline'
                  : 'wallet-outline';
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: '大廳' }} />
      {scheduledOrdersEnabled ? (
        <Tab.Screen
          name="ScheduledOrders"
          component={ScheduledOrdersScreen}
          options={{ title: '預約' }}
        />
      ) : null}
      <Tab.Screen name="ShootOrder" component={ShootOrderScreen} options={{ title: '出貨' }} />
      <Tab.Screen name="Earnings" component={EarningsScreen} options={{ title: '收入' }} />
      <Tab.Screen name="Settings" component={DriverSettingsScreen} options={{ title: '設定' }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} onReady={() => tryOpenPushOrder()}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen
          name="ActiveTrip"
          component={ActiveTripScreen}
          options={{
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
            statusBarTranslucent: false,
          }}
        />
        <Stack.Screen
          name="OrderChat"
          component={OrderChatScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="TripCompleted"
          component={TripCompletedScreen}
          options={{ presentation: 'fullScreenModal', animation: 'fade' }}
        />
        <Stack.Screen
          name="TermsWebView"
          component={TermsWebViewScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="PurchasePoints"
          component={PurchasePointsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="TodayCompletedOrders"
          component={TodayCompletedOrdersScreen}
          options={{ animation: 'slide_from_right' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
