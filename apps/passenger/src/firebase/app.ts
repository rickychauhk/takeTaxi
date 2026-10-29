import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, type Persistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig } from './config';

const { getReactNativePersistence } = require('firebase/auth') as {
  getReactNativePersistence: (storage: typeof ReactNativeAsyncStorage) => Persistence;
};

const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

export const firebaseAuth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
})();
