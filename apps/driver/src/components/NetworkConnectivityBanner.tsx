import NetInfo from '@react-native-community/netinfo';
import {
  clearApiNetworkDegraded,
  getApiNetworkDegraded,
  markApiNetworkDegraded,
  netInfoDeviceAppearsOffline,
  reportApiFetchSuccess,
  subscribeApiNetworkStatus,
} from '@taxima/shared';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pingApiHealth } from '../network/pingApiHealth';
import { useI18n } from '../i18n/I18nProvider';
import { colors } from '../theme/colors';

const RETRY_INTERVAL_MS = 4_000;

function NetworkOfflineBanner() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [deviceOffline, setDeviceOffline] = useState(false);
  const [apiDegraded, setApiDegraded] = useState(getApiNetworkDegraded());
  const [retrying, setRetrying] = useState(false);

  const syncApiFlag = useCallback(() => {
    const degraded = getApiNetworkDegraded();
    setApiDegraded(degraded);
    if (!degraded) {
      void NetInfo.fetch().then((state) => {
        if (!netInfoDeviceAppearsOffline(state)) setDeviceOffline(false);
      });
    }
  }, []);

  const runConnectivityCheck = useCallback(async () => {
    setRetrying(true);
    try {
      const state = await NetInfo.fetch();
      const offline = netInfoDeviceAppearsOffline(state);
      setDeviceOffline(offline);
      if (offline) {
        markApiNetworkDegraded();
        setApiDegraded(true);
        return;
      }
      const ok = await pingApiHealth();
      if (ok) {
        clearApiNetworkDegraded();
        reportApiFetchSuccess();
        setApiDegraded(false);
        setDeviceOffline(false);
      } else {
        markApiNetworkDegraded();
        setApiDegraded(true);
      }
    } finally {
      setRetrying(false);
    }
  }, []);

  const runCheckRef = useRef(runConnectivityCheck);
  runCheckRef.current = runConnectivityCheck;

  useEffect(() => {
    const unsubNet = NetInfo.addEventListener((state) => {
      const offline = netInfoDeviceAppearsOffline(state);
      setDeviceOffline(offline);
      if (!offline) void runCheckRef.current();
    });
    void NetInfo.fetch().then((state) => {
      setDeviceOffline(netInfoDeviceAppearsOffline(state));
    });
    const unsubApi = subscribeApiNetworkStatus(syncApiFlag);
    return () => {
      unsubNet();
      unsubApi();
    };
  }, [syncApiFlag]);

  const visible = deviceOffline || apiDegraded;

  useEffect(() => {
    if (!visible) return;
    void runConnectivityCheck();
    const id = setInterval(() => {
      void runConnectivityCheck();
    }, RETRY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [visible, runConnectivityCheck]);

  if (!visible) return null;

  return (
    <View
      style={[styles.wrap, { paddingTop: insets.top + 6 }]}
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.bar}>
        <View style={styles.textCol}>
          <Text style={styles.title}>{t('network.offlineTitle')}</Text>
          <Text style={styles.sub}>
            {retrying ? t('network.retrying') : t('network.offlineHint')}
          </Text>
        </View>
        {retrying ? (
          <ActivityIndicator color={colors.brandYellow} size="small" />
        ) : (
          <Pressable
            style={styles.retryBtn}
            onPress={() => void runConnectivityCheck()}
            accessibilityRole="button"
            accessibilityLabel={t('network.retry')}
          >
            <Text style={styles.retryText}>{t('network.retry')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function NetworkConnectivityRoot({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <NetworkOfflineBanner />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  bar: {
    marginHorizontal: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#92400e',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  textCol: { flex: 1 },
  title: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sub: { color: 'rgba(255,255,255,0.88)', fontSize: 13, marginTop: 2 },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  retryText: { color: colors.brandYellow, fontSize: 14, fontWeight: '600' },
});
