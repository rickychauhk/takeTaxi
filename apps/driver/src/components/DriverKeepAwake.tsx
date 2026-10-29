import { useKeepAwake } from 'expo-keep-awake';

/** 司機 App 全頁保持屏幕常亮（揸車／等柯打） */
export function DriverKeepAwake() {
  useKeepAwake();
  return null;
}
