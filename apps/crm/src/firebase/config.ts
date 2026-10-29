import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

/** UAT 本地預設 singkee-driver；PROD 由 docker build 注入 VITE_FIREBASE_*（taketaxionlinemain Web App） */
function viteEnv(key: keyof ImportMetaEnv, fallback: string): string {
  const v = import.meta.env[key];
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

const measurementId = viteEnv('VITE_FIREBASE_MEASUREMENT_ID', '');

const firebaseConfig = {
  apiKey: viteEnv('VITE_FIREBASE_API_KEY', 'AIzaSyD5feWgQj9ALBpnMFJKq6wIUnMQNVBskSI'),
  authDomain: viteEnv('VITE_FIREBASE_AUTH_DOMAIN', 'singkee-driver.firebaseapp.com'),
  projectId: viteEnv('VITE_FIREBASE_PROJECT_ID', 'singkee-driver'),
  storageBucket: viteEnv('VITE_FIREBASE_STORAGE_BUCKET', 'singkee-driver.firebasestorage.app'),
  messagingSenderId: viteEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '412124194923'),
  appId: viteEnv('VITE_FIREBASE_APP_ID', '1:412124194923:web:a0cf5898989a90a2e5692e'),
  ...(measurementId ? { measurementId } : {}),
};

const app = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);
