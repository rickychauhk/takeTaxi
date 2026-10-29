import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DriverLoginScreen from '../screens/DriverLoginScreen';
import DriverRegisterScreen from '../screens/DriverRegisterScreen';

export type AuthStackParamList = {
  Login: undefined;
  Register: { phone?: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={DriverLoginScreen} />
      <Stack.Screen name="Register" component={DriverRegisterScreen} />
    </Stack.Navigator>
  );
}
