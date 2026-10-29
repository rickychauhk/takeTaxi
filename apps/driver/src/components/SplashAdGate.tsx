import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { fetchDriverSplashAds, trackAdEvent, type PublicSplashAd } from '../api/ads';
import { AdWebViewModal } from './AdWebViewModal';
import { SplashAdOverlay } from './SplashAdOverlay';

export function SplashAdGate({ children }: { children: ReactNode }) {
  const [ads, setAds] = useState<PublicSplashAd[]>([]);
  const [index, setIndex] = useState(0);
  const [webviewAdId, setWebviewAdId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows = await fetchDriverSplashAds();
      if (!cancelled && rows.length) setAds(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const advance = useCallback(() => {
    setIndex((i) => i + 1);
  }, []);

  const current = index < ads.length ? ads[index] : null;
  const splashVisible = Boolean(current?.imageUrl && webviewAdId === null);

  useEffect(() => {
    if (!current?.id || webviewAdId !== null) return;
    void trackAdEvent(current.id, 'impression');
  }, [current?.id, webviewAdId]);

  return (
    <>
      {children}
      {current?.imageUrl ? (
        <SplashAdOverlay
          visible={splashVisible}
          imageUrl={current.imageUrl}
          onClose={advance}
          onPressCover={() => {
            void trackAdEvent(current.id, 'click');
            setWebviewAdId(current.id);
          }}
        />
      ) : null}
      {webviewAdId != null ? (
        <AdWebViewModal
          visible
          adId={webviewAdId}
          onClose={() => {
            setWebviewAdId(null);
            advance();
          }}
        />
      ) : null}
    </>
  );
}
