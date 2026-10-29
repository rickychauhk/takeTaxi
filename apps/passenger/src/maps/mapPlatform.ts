import { Platform } from 'react-native';
import { PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';

/** Android 必須用 Google provider + manifest 內 com.google.android.geo.API_KEY */
export const TRIP_MAP_PROVIDER = Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;
