import { useWindowDimensions } from 'react-native';

const SIDE_PANEL_MAX = 440;
const SIDE_PANEL_MIN = 320;

/** 橫屏側欄寬度：保留足夠地圖區，同時顯示完整行程／接單資訊 */
export function useLayoutMode() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const sidePanelWidth = Math.round(
    Math.min(SIDE_PANEL_MAX, Math.max(SIDE_PANEL_MIN, width * 0.42)),
  );
  const shortEdge = Math.min(width, height);

  return { width, height, isLandscape, sidePanelWidth, shortEdge };
}
