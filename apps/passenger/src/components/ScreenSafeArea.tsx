import type { ComponentProps } from 'react';
import { Platform, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = ComponentProps<typeof SafeAreaView>;

/** Android 必須用 safe-area-context；RN 內建 SafeAreaView 喺 Android 唔會留 status bar 位。 */
export function ScreenSafeArea(props: Props) {
  return <SafeAreaView {...props} />;
}

/**
 * Modal + statusBarTranslucent 時 SafeAreaView 常計唔到 top；用 insets 同 StatusBar 高度 fallback。
 */
export function useModalOverlayInsets(padding = { top: 8, right: 12 }) {
  const insets = useSafeAreaInsets();
  const topFallback = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 28) : 0;
  return {
    paddingTop: Math.max(insets.top, topFallback) + padding.top,
    paddingRight: insets.right + padding.right,
  };
}
