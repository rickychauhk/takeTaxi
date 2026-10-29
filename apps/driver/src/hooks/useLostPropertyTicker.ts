import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import {
  fetchActiveLostPropertyTicker,
  type LostPropertyTickerItem,
} from '../api/lostProperty';

const POLL_MS = 5_000;

/** 大廳失物走馬燈：前景 Tab 定期拉取，無資料時 items 為空 */
export function useLostPropertyTicker() {
  const [items, setItems] = useState<LostPropertyTickerItem[]>([]);
  const ticking = useRef(false);

  const refresh = useCallback(async () => {
    if (ticking.current) return;
    ticking.current = true;
    try {
      const rows = await fetchActiveLostPropertyTicker();
      setItems(rows);
    } finally {
      ticking.current = false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      const id = setInterval(() => void refresh(), POLL_MS);
      return () => clearInterval(id);
    }, [refresh]),
  );

  return { items, refresh };
}
