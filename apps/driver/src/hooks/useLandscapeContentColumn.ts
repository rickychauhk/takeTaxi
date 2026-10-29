import { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useLayoutMode } from './useLayoutMode';

/** 橫屏時將表單／列表置中，避免內容拉太闊 */
export function useLandscapeContentColumn(maxWidth = 640) {
  const { isLandscape, width } = useLayoutMode();

  return useMemo(() => {
    const columnWidth = Math.min(maxWidth, Math.round(width * 0.72));
    const outer: StyleProp<ViewStyle> = isLandscape
      ? { flex: 1, alignSelf: 'stretch', alignItems: 'center' }
      : { flex: 1 };
    const inner: StyleProp<ViewStyle> = isLandscape
      ? { width: columnWidth, maxWidth: '100%', flex: 1, alignSelf: 'stretch' }
      : { flex: 1, alignSelf: 'stretch' };
    return { isLandscape, outer, inner, columnWidth };
  }, [isLandscape, maxWidth, width]);
}
