import { useEffect, useState, type ReactNode } from 'react';
import { fetchPassengerSplashAd, trackAdEvent, type PublicSplashAd } from '../api/ads';
import { AdWebViewModal } from './AdWebViewModal';
import { SplashAdOverlay } from './SplashAdOverlay';

export function SplashAdGate({ children }: { children: ReactNode }) {
  const [ad, setAd] = useState<PublicSplashAd | null>(null);
  const [splashVisible, setSplashVisible] = useState(false);
  const [webviewOpen, setWebviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const splash = await fetchPassengerSplashAd();
      if (cancelled || !splash?.imageUrl) return;
      setAd(splash);
      setSplashVisible(true);
      void trackAdEvent(splash.id, 'impression');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {children}
      {ad?.imageUrl ? (
        <SplashAdOverlay
          visible={splashVisible}
          imageUrl={ad.imageUrl}
          onClose={() => setSplashVisible(false)}
          onPressCover={() => {
            void trackAdEvent(ad.id, 'click');
            setSplashVisible(false);
            setWebviewOpen(true);
          }}
        />
      ) : null}
      {ad ? (
        <AdWebViewModal visible={webviewOpen} adId={ad.id} onClose={() => setWebviewOpen(false)} />
      ) : null}
    </>
  );
}
