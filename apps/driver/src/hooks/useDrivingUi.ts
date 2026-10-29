import { useMemo } from 'react';
import { useLayoutMode } from './useLayoutMode';

/** 行車安全：最小可點區域（Apple HIG 建議 ≥44pt，司機場景用更大） */
export const DRIVING_MIN_TOUCH = 56;
export const DRIVING_PRIMARY_HEIGHT = 64;

/**
 * 依螢幕短邊放大字體同按鈕，橫屏側欄同直屏 bottom sheet 共用。
 */
export function useDrivingUi() {
  const { isLandscape, shortEdge, width } = useLayoutMode();

  return useMemo(() => {
    const scale =
      shortEdge < 360 ? 1.05 : shortEdge < 400 ? 1.12 : shortEdge < 430 ? 1.18 : 1.24;

    return {
      isLandscape,
      shortEdge,
      width,
      scale,
      touchMin: Math.round(DRIVING_MIN_TOUCH * scale),
      primaryBtnHeight: Math.round(DRIVING_PRIMARY_HEIGHT * scale),
      /** 新柯打彈窗：行車中一眼可讀 */
      alertBtnHeight: Math.round(72 * scale),
      alertBtnTextSize: Math.round(22 * scale),
      alertFareSize: Math.round(34 * scale),
      alertCountdownSize: Math.round(28 * scale),
      alertPickupSize: Math.round(20 * scale),
      alertDropoffSize: Math.round(17 * scale),
      heroSize: Math.round(26 * scale),
      titleSize: Math.round(22 * scale),
      bodySize: Math.round(18 * scale),
      labelSize: Math.round(15 * scale),
      metaSize: Math.round(16 * scale),
      primaryTextSize: Math.round(21 * scale),
      secondaryTextSize: Math.round(17 * scale),
      iconSize: Math.round(30 * scale),
      quickBtnMinHeight: Math.round(52 * scale),
    };
  }, [isLandscape, shortEdge, width]);
}
