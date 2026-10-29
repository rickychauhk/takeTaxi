import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useModalOverlayInsets } from '../components/ScreenSafeArea';
import MapView, { type Region } from 'react-native-maps';
import { TRIP_MAP_PROVIDER } from '../maps/mapPlatform';
import type { LatLng } from '../constants/demoDestinations';
import { darkMapStyle } from '../constants/mapStyle';
import { useI18n } from '../i18n/I18nProvider';
import { ensureDisplayPlaceLabel } from '../location/labelForOrderStorage';
import { resolveLabelForCoords } from '../location/resolveLabelForCoords';
import { colors } from '../theme/colors';

const DEFAULT_DELTA = { latitudeDelta: 0.04, longitudeDelta: 0.04 };

type Props = {
  pointKind: 'pickup' | 'dropoff';
  initialCenter?: { latitude: number; longitude: number } | null;
  onBack: () => void;
  onConfirm: (place: LatLng) => void;
};

export default function MapPickLocationScreen({ pointKind, initialCenter, onBack, onConfirm }: Props) {
  const { t, locale, pickupTag, dropoffTag } = useI18n();
  const headerInset = useModalOverlayInsets({ top: 4, right: 0 });
  const safeInsets = useSafeAreaInsets();
  const pointTag = pointKind === 'pickup' ? pickupTag : dropoffTag;
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [center, setCenter] = useState({
    latitude: initialCenter?.latitude ?? 22.3193,
    longitude: initialCenter?.longitude ?? 114.1694,
  });
  const [label, setLabel] = useState(() => t('mapPick.moving'));
  const [geocoding, setGeocoding] = useState(false);

  const updateLabel = useCallback(
    async (lat: number, lng: number) => {
      setGeocoding(true);
      try {
        setLabel(await resolveLabelForCoords(lat, lng, locale));
      } finally {
        setGeocoding(false);
      }
    },
    [locale],
  );

  useEffect(() => {
    setLabel(t('mapPick.moving'));
  }, [t]);

  useEffect(() => {
    void updateLabel(center.latitude, center.longitude);
  }, [center.latitude, center.longitude, locale, updateLabel]);

  const onRegionChangeComplete = (region: Region) => {
    setCenter({ latitude: region.latitude, longitude: region.longitude });
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(() => void updateLabel(region.latitude, region.longitude), 350);
  };

  const pinColor = pointKind === 'pickup' ? colors.pickupDot : colors.dropoffDot;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor={colors.mapDark} />
      <MapView
        style={StyleSheet.absoluteFill}
        provider={TRIP_MAP_PROVIDER}
        customMapStyle={darkMapStyle}
        initialRegion={{ ...center, ...DEFAULT_DELTA }}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
        userInterfaceStyle="dark"
      />
      <View style={styles.centerPinWrap} pointerEvents="none">
        <View style={[styles.pinHead, { backgroundColor: pinColor }]} />
        <View style={styles.pinStick} />
      </View>
      <View style={styles.ui} pointerEvents="box-none">
        <View style={[styles.topBar, headerInset, { paddingLeft: safeInsets.left + 12 }]}>
          <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.title}>
            {t(pointKind === 'pickup' ? 'mapPick.titlePickup' : 'mapPick.titleDropoff')}
          </Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.hintBar} pointerEvents="none">
          <Text style={styles.hintText}>{t('mapPick.hint')}</Text>
        </View>
      </View>
      <View style={[styles.footer, { paddingBottom: safeInsets.bottom + 16 }]}>
        <View style={styles.addressCard}>
          <Text style={styles.pointTag}>{pointTag}</Text>
          {geocoding ? (
            <ActivityIndicator color={colors.brandYellow} />
          ) : (
            <Text style={styles.address} numberOfLines={2}>
              {label}
            </Text>
          )}
        </View>
        <Pressable
          style={styles.confirmBtn}
          onPress={() => {
            void (async () => {
              const place = await ensureDisplayPlaceLabel({
                latitude: center.latitude,
                longitude: center.longitude,
                label,
              });
              onConfirm(place);
            })();
          }}
        >
          <Text style={styles.confirmText}>
            {t(pointKind === 'pickup' ? 'mapPick.confirmPickup' : 'mapPick.confirmDropoff')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mapDark },
  ui: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  backIcon: { color: colors.brandYellow, fontSize: 28, fontWeight: '600' },
  title: { color: '#fff', fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  hintBar: {
    alignSelf: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  hintText: { color: '#eee', fontSize: 13 },
  centerPinWrap: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  pinHead: { width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: '#fff' },
  pinStick: { width: 3, height: 14, backgroundColor: '#fff', marginTop: -2 },
  footer: { position: 'absolute', left: 16, right: 16, bottom: 32, gap: 12 },
  addressCard: {
    backgroundColor: colors.panelBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  pointTag: { fontSize: 16, fontWeight: '800', color: colors.text },
  address: { flex: 1, fontSize: 15, color: colors.text, lineHeight: 22 },
  confirmBtn: { backgroundColor: colors.brandYellow, borderRadius: 28, paddingVertical: 16, alignItems: 'center' },
  confirmText: { fontSize: 17, fontWeight: '700', color: colors.onPrimary },
});
