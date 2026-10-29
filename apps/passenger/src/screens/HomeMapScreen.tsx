import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenSafeArea } from '../components/ScreenSafeArea';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { TRIP_MAP_PROVIDER } from '../maps/mapPlatform';
import { PASSENGER_NEARBY_DRIVERS_RADIUS_M } from '../api/client';
import { fetchPassengerMapConfig } from '../api/passengerMapConfig';
import { AnimatedTaxiMarker } from '../components/AnimatedTaxiMarker';
import { PASSENGER_NEARBY_DRIVERS_POLL_MS, useNearbyDriversPoll } from '../hooks/useNearbyDriversPoll';
import { pickRandomDestination, type LatLng } from '../constants/demoDestinations';
import { darkMapStyle } from '../constants/mapStyle';
import { PassengerMenuDrawer } from '../components/PassengerMenuDrawer';
import { usePassengerLocation } from '../hooks/usePassengerLocation';
import { usePassengerMemberProfile } from '../hooks/usePassengerMemberProfile';
import { colors } from '../theme/colors';
import LocationSearchScreen from './LocationSearchScreen';
import { fetchDrivingRoute, type DrivingRouteResult } from '../routing/fetchDrivingRoute';
import { useI18n } from '../i18n/I18nProvider';
import { userFacingError } from '../i18n/userFacingError';
import ReviewOrderScreen from './ReviewOrderScreen';
import type { BookingExtrasSelection } from './BookingMoreOptionsScreen';
import { useTunnelRoutePreference } from '../hooks/useTunnelRoutePreference';
import { createPassengerOrder } from '../api/createOrder';
import { reconcileKowloonTripEndpoints, snapLatLngToKnownHkPlace } from '@taxima/shared';
import { ensureDisplayPlaceLabel } from '../location/labelForOrderStorage';
import ActiveOrderScreen from './ActiveOrderScreen';
import SettingsScreen from './SettingsScreen';
import OrderRecordsScreen from './OrderRecordsScreen';
import FeedbackScreen from './FeedbackScreen';
import ContactUsScreen from './ContactUsScreen';
import RideTipsScreen from './RideTipsScreen';
import PushMessagesScreen from './PushMessagesScreen';
import LostPropertyScreen from './LostPropertyScreen';
import {
  clearActiveOrder,
  restoreActiveOrderFromServer,
  saveActiveOrder,
  type StoredActiveOrder,
} from '../storage/activeOrderStorage';
import { fetchPassengerOrderTrack } from '../api/passengerOrder';
import {
  orderRebookDraftFromSnapshot,
  type OrderRebookDraft,
} from '../storage/orderRebookDraft';

export default function HomeMapScreen() {
  const insets = useSafeAreaInsets();
  const { t, pickupTag, dropoffTag } = useI18n();
  const { pickup: gpsPickup, loading, error, errorHint, refresh: refreshPickup } = usePassengerLocation();
  const [pickupOverride, setPickupOverride] = useState<LatLng | null>(null);
  const [dropoff, setDropoff] = useState<LatLng>(() => pickRandomDestination());
  const [nearbyRadiusM, setNearbyRadiusM] = useState(PASSENGER_NEARBY_DRIVERS_RADIUS_M);
  const [searchMode, setSearchMode] = useState<'pickup' | 'dropoff' | null>(null);
  const [route, setRoute] = useState<DrivingRouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [bookingExtras, setBookingExtras] = useState<BookingExtrasSelection>({
    selectedOptionIds: [],
    remark: '',
    scheduledAt: null,
  });
  const {
    preference: tunnelPreference,
    tunnelSelectionKey,
    ready: tunnelPreferenceReady,
  } = useTunnelRoutePreference(bookingExtras.selectedOptionIds);
  const [flow, setFlow] = useState<'map' | 'review'>('map');
  const [activeOrder, setActiveOrder] = useState<StoredActiveOrder | null>(null);
  const [restoringTrip, setRestoringTrip] = useState(true);
  const [calling, setCalling] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lostPropertyOpen, setLostPropertyOpen] = useState(false);
  const { profile: memberProfile, loading: memberLoading, refresh: refreshMemberProfile } =
    usePassengerMemberProfile(menuOpen || lostPropertyOpen || flow === 'review');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [contactUsOpen, setContactUsOpen] = useState(false);
  const [rideTipsOpen, setRideTipsOpen] = useState(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const restored = await restoreActiveOrderFromServer();
      if (!cancelled && restored) setActiveOrder(restored);
      if (!cancelled) setRestoringTrip(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const finishActiveOrder = () => {
    setActiveOrder(null);
    void clearActiveOrder();
    void refreshMemberProfile();
  };

  const startActiveOrder = (order: StoredActiveOrder) => {
    setActiveOrder(order);
    void saveActiveOrder(order);
  };

  const rebookAfterDriverCancel = async () => {
    if (!activeOrder || calling) {
      finishActiveOrder();
      return;
    }
    setCalling(true);
    try {
      let draft = activeOrder.rebookDraft;
      let pickup = activeOrder.pickup;
      let dropoff = activeOrder.dropoff;

      if (!draft) {
        const track = await fetchPassengerOrderTrack(activeOrder.orderId);
        if (track.rebookSnapshot) {
          draft = orderRebookDraftFromSnapshot(track.rebookSnapshot);
          if (track.pickup.lat != null && track.pickup.lng != null) {
            pickup = {
              latitude: track.pickup.lat,
              longitude: track.pickup.lng,
              label: track.pickup.label?.trim() || pickup.label,
            };
          }
          if (track.dropoff.lat != null && track.dropoff.lng != null) {
            dropoff = {
              latitude: track.dropoff.lat,
              longitude: track.dropoff.lng,
              label: track.dropoff.label?.trim() || dropoff.label,
            };
          }
        }
      }

      if (!draft) {
        finishActiveOrder();
        return;
      }

      const [pickupDisplay, dropoffDisplay] = await Promise.all([
        ensureDisplayPlaceLabel(pickup),
        ensureDisplayPlaceLabel(dropoff),
      ]);
      const order = await createPassengerOrder({
        pickup: pickupDisplay,
        dropoff: dropoffDisplay,
        estimateDistanceMeters: draft.estimateDistanceMeters,
        fareEstimate: draft.fareEstimate,
        tipHkd: draft.tipHkd,
        extras: draft.extras,
        sixSeat: draft.sixSeat,
        paymentMethods: draft.paymentMethods,
        pointsToRedeem: draft.pointsToRedeem,
        scheduledAt: draft.extras.scheduledAt,
        passengerContactCall: draft.passengerContactCall ?? true,
        passengerContactSms: draft.passengerContactSms ?? false,
        orderContactPhone: draft.orderContactPhone?.trim() || undefined,
        companyPrice: draft.companyPrice ?? false,
        safeDriving: draft.safeDriving ?? false,
      });
      void refreshMemberProfile();
      const next: StoredActiveOrder = {
        orderId: order.id,
        pickup: pickupDisplay,
        dropoff: dropoffDisplay,
        rebookDraft: draft,
      };
      setActiveOrder(next);
      await saveActiveOrder(next);
    } catch (e) {
      Alert.alert(t('review.callNow'), userFacingError(e, 'trip.rebookFailed'));
      finishActiveOrder();
    } finally {
      setCalling(false);
    }
  };

  const routeCoords = route?.coordinates ?? [];

  const displayPickup = pickupOverride ?? gpsPickup;

  const tripPlaces = useMemo(() => {
    if (!displayPickup) return null;
    return reconcileKowloonTripEndpoints(
      snapLatLngToKnownHkPlace(displayPickup),
      snapLatLngToKnownHkPlace(dropoff),
    );
  }, [displayPickup, dropoff]);

  const routePickup = useMemo((): LatLng | null => {
    if (!displayPickup) return null;
    return tripPlaces?.pickup ?? displayPickup;
  }, [displayPickup, tripPlaces]);
  const routeDropoff = tripPlaces?.dropoff ?? dropoff;

  useEffect(() => {
    if (!tripPlaces) return;
    const d = tripPlaces.dropoff;
    if (
      Math.abs(d.latitude - dropoff.latitude) > 0.0008 ||
      Math.abs(d.longitude - dropoff.longitude) > 0.0008 ||
      d.label !== dropoff.label
    ) {
      setDropoff(d);
    }
  }, [tripPlaces, dropoff.latitude, dropoff.longitude, dropoff.label]);

  const nearbyCenter = routePickup ?? displayPickup;
  const nearbyDrivers = useNearbyDriversPoll(nearbyCenter, nearbyRadiusM);

  useEffect(() => {
    let cancelled = false;
    const refreshConfig = async () => {
      const cfg = await fetchPassengerMapConfig();
      if (!cancelled) setNearbyRadiusM(cfg.nearbyDriversRadiusM);
    };
    void refreshConfig();
    const configInterval = setInterval(refreshConfig, 60_000);
    return () => {
      cancelled = true;
      clearInterval(configInterval);
    };
  }, []);

  const mapRegion = useMemo(() => {
    if (!routePickup) {
      return {
        latitude: 22.3193,
        longitude: 114.1694,
        latitudeDelta: 0.12,
        longitudeDelta: 0.12,
      };
    }
    return {
      latitude: (routePickup.latitude + routeDropoff.latitude) / 2,
      longitude: (routePickup.longitude + routeDropoff.longitude) / 2,
      latitudeDelta: Math.max(0.06, Math.abs(routePickup.latitude - routeDropoff.latitude) * 1.8 + 0.04),
      longitudeDelta: Math.max(0.06, Math.abs(routePickup.longitude - routeDropoff.longitude) * 1.8 + 0.04),
    };
  }, [routePickup, routeDropoff]);

  useEffect(() => {
    if (!routePickup) {
      setRoute(null);
      setRouteLoading(false);
      return;
    }
    if (!tunnelPreferenceReady) {
      return;
    }
    let cancelled = false;
    setRoute(null);
    setRouteLoading(true);
    void fetchDrivingRoute(routePickup, routeDropoff, { tunnelPreference })
      .then((result) => {
        if (!cancelled) setRoute(result);
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [routePickup, routeDropoff, tunnelSelectionKey, tunnelPreference, tunnelPreferenceReady]);

  useEffect(() => {
    if (routeCoords.length < 2 || !mapRef.current) return;
    mapRef.current.fitToCoordinates(routeCoords, {
      edgePadding: { top: 200, right: 48, bottom: 140, left: 48 },
      animated: true,
    });
  }, [routeCoords]);

  const handleSwap = () => {
    const currentPickup = pickupOverride ?? gpsPickup;
    if (!currentPickup) return;
    setPickupOverride(dropoff);
    setDropoff(currentPickup);
  };

  const pickupLabel = pickupOverride
    ? pickupOverride.label
    : loading
      ? t('home.locating')
      : (displayPickup?.label ?? t('home.tapPickPickup'));

  if (restoringTrip) {
    return (
      <View style={styles.restoreLoading}>
        <ActivityIndicator size="large" color={colors.brandYellow} />
      </View>
    );
  }

  if (activeOrder) {
    return (
      <ActiveOrderScreen
        orderId={activeOrder.orderId}
        pickup={activeOrder.pickup}
        dropoff={activeOrder.dropoff}
        rebookDraft={activeOrder.rebookDraft}
        onDone={finishActiveOrder}
        onBalanceRefresh={() => void refreshMemberProfile()}
        onRebookAfterDriverCancel={() => void rebookAfterDriverCancel()}
        rebooking={calling}
      />
    );
  }

  if (flow === 'review' && routePickup) {
    return (
      <ReviewOrderScreen
        pickup={routePickup}
        dropoff={routeDropoff}
        distanceMeters={route?.distanceMeters ?? 0}
        durationSeconds={route?.durationSeconds ?? 0}
        tunnelTollHkd={route?.tunnelTollHkd ?? 0}
        routeLoading={routeLoading}
        pointsBalance={memberProfile?.pointsBalance ?? 0}
        pointsHkdPerPoint={memberProfile?.pointsHkdPerPoint ?? 1}
        pointsRedeemEnabled={memberProfile?.pointsRedeemEnabled !== false}
        bookingExtras={bookingExtras}
        onBookingExtrasChange={setBookingExtras}
        onBack={() => setFlow('map')}
        callLoading={calling}
        onCallCar={async ({
          fareEstimate,
          tipHkd,
          extras,
          sixSeat,
          paymentMethods,
          pointsToRedeem,
          passengerContactCall,
          passengerContactSms,
          orderContactPhone,
          companyPrice,
          safeDriving,
        }) => {
          if (!routePickup || calling) return;
          setCalling(true);
          try {
            const order = await createPassengerOrder({
              pickup: routePickup,
              dropoff: routeDropoff,
              estimateDistanceMeters: route?.distanceMeters ?? 0,
              fareEstimate,
              tipHkd,
              extras,
              sixSeat,
              paymentMethods,
              scheduledAt: extras.scheduledAt ?? undefined,
              pointsToRedeem,
              passengerContactCall,
              passengerContactSms,
              orderContactPhone,
              companyPrice,
              safeDriving,
            });
            setFlow('map');
            void refreshMemberProfile();
            const rebookDraft: OrderRebookDraft = {
              fareEstimate,
              tipHkd,
              estimateDistanceMeters: route?.distanceMeters ?? 0,
              pointsToRedeem,
              sixSeat: sixSeat ?? false,
              paymentMethods,
              extras,
              passengerContactCall,
              passengerContactSms,
              orderContactPhone: orderContactPhone ?? null,
              companyPrice,
              safeDriving: safeDriving ?? false,
            };
            startActiveOrder({
              orderId: order.id,
              pickup: routePickup,
              dropoff: routeDropoff,
              rebookDraft,
            });
          } catch (e) {
            Alert.alert(t('review.callNow'), userFacingError(e, 'review.callFailed'));
          } finally {
            setCalling(false);
          }
        }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={TRIP_MAP_PROVIDER}
        customMapStyle={darkMapStyle}
        initialRegion={mapRegion}
        showsUserLocation
        showsMyLocationButton={false}
        userInterfaceStyle="dark"
      >
        {routePickup && (
          <Marker coordinate={routePickup} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.pickupPin} />
          </Marker>
        )}
        <Marker coordinate={routeDropoff} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.dropPin} />
        </Marker>
        {routeCoords.length >= 2 && (
          <Polyline coordinates={routeCoords} strokeColor={colors.routeLine} strokeWidth={4} />
        )}
        {nearbyDrivers.map((d) => (
          <AnimatedTaxiMarker
            key={String(d.driver_id)}
            latitude={d.lat}
            longitude={d.lng}
            rotation={d.heading}
            animateDurationMs={PASSENGER_NEARBY_DRIVERS_POLL_MS - 200}
          />
        ))}
      </MapView>

      <ScreenSafeArea style={styles.overlay} pointerEvents="box-none" edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable
            style={styles.menuBtn}
            hitSlop={12}
            onPress={() => {
              setMenuOpen(true);
              void refreshMemberProfile();
            }}
          >
            <Text style={styles.menuIcon}>☰</Text>
          </Pressable>
          <Text style={styles.logoText}>{t('home.brand')}</Text>
          <View style={styles.menuBtn} />
        </View>

        <View style={styles.tripCard}>
          <View style={styles.tripRow}>
            <View style={styles.tripIconCol}>
              <View style={[styles.dot, styles.dotPickup]} />
              <View style={styles.tripLine} />
              <View style={[styles.dot, styles.dotDrop]} />
            </View>
            <View style={styles.tripTextCol}>
              <Pressable
                style={styles.labelRow}
                onPress={() => {
                  if (loading && !pickupOverride && !displayPickup) void refreshPickup();
                  else setSearchMode('pickup');
                }}
              >
                <Text style={styles.tripTag}>{pickupTag}</Text>
                {loading && !pickupOverride && !displayPickup ? (
                  <ActivityIndicator size="small" color={colors.brandYellow} />
                ) : (
                  <View style={styles.pickupTextWrap}>
                    <Text
                      style={[styles.address, !displayPickup && !pickupOverride && error ? styles.addressMuted : null]}
                      numberOfLines={2}
                    >
                      {error && !displayPickup && !pickupOverride ? error : pickupLabel}
                    </Text>
                    {errorHint && !displayPickup && !pickupOverride ? (
                      <Text style={styles.pickupHint} numberOfLines={2}>
                        {errorHint}
                      </Text>
                    ) : null}
                  </View>
                )}
              </Pressable>
              <Pressable style={[styles.labelRow, { marginTop: 14 }]} onPress={() => setSearchMode('dropoff')}>
                <Text style={styles.tripTag}>{dropoffTag}</Text>
                <Text style={styles.address} numberOfLines={2}>
                  {dropoff.label}
                </Text>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation?.();
                    setDropoff(pickRandomDestination());
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.clearBtn}>{t('home.clear')}</Text>
                </Pressable>
              </Pressable>
            </View>
            <Pressable
              style={[styles.swapBtn, !(pickupOverride ?? gpsPickup) && styles.swapBtnDisabled]}
              onPress={handleSwap}
              disabled={!(pickupOverride ?? gpsPickup)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('home.swapA11y')}
            >
              <Text style={styles.swapIcon}>⇅</Text>
            </Pressable>
          </View>
        </View>
      </ScreenSafeArea>

      <View style={[styles.footer, { bottom: 32 + insets.bottom }]} pointerEvents="box-none">
        <Pressable
          style={styles.nextBtn}
          onPress={() => {
            if (!displayPickup) {
              Alert.alert(t('home.brand'), t('home.needPickup'));
              return;
            }
            setFlow('review');
          }}
        >
          <Text style={styles.nextText}>{t('home.next')}</Text>
          <View style={styles.nextArrow}>
            <Text style={styles.nextArrowText}>→</Text>
          </View>
        </Pressable>
      </View>

      <PassengerMenuDrawer
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onOpenSettings={() => setSettingsOpen(true)}
        onMenuItem={(key) => {
          setMenuOpen(false);
          if (key === 'records') {
            setRecordsOpen(true);
            return;
          }
          if (key === 'messages') {
            setMessagesOpen(true);
            return;
          }
          if (key === 'feedback') {
            setFeedbackOpen(true);
            return;
          }
          if (key === 'contactUs') {
            setContactUsOpen(true);
            return;
          }
          if (key === 'rideTips') {
            setRideTipsOpen(true);
            return;
          }
          if (key === 'lostProperty') {
            setLostPropertyOpen(true);
            return;
          }
          Alert.alert(t('home.brand'), t('menu.comingSoon'));
        }}
        memberProfile={memberProfile}
        memberLoading={memberLoading}
      />
      <SettingsScreen visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <OrderRecordsScreen visible={recordsOpen} onClose={() => setRecordsOpen(false)} />
      <FeedbackScreen
        visible={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        memberProfile={memberProfile}
      />
      <PushMessagesScreen visible={messagesOpen} onClose={() => setMessagesOpen(false)} />
      <LostPropertyScreen
        visible={lostPropertyOpen}
        onClose={() => setLostPropertyOpen(false)}
        memberProfile={memberProfile}
      />
      <ContactUsScreen visible={contactUsOpen} onClose={() => setContactUsOpen(false)} />
      <RideTipsScreen visible={rideTipsOpen} onClose={() => setRideTipsOpen(false)} />

      <Modal
        visible={searchMode !== null}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSearchMode(null)}
      >
        {searchMode && (
          <LocationSearchScreen
            pointKind={searchMode}
            initialText={searchMode === 'pickup' ? (displayPickup?.label ?? '') : dropoff.label}
            near={gpsPickup ?? displayPickup}
            onClose={() => setSearchMode(null)}
            onSelect={(place) => {
              const snapped = snapLatLngToKnownHkPlace(place);
              if (searchMode === 'pickup') setPickupOverride(snapped);
              else setDropoff(snapped);
              setSearchMode(null);
            }}
            allowCurrentLocation={searchMode === 'pickup'}
            onUseCurrentLocation={async () => {
              setPickupOverride(null);
              return refreshPickup();
            }}
          />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mapDark },
  restoreLoading: {
    flex: 1,
    backgroundColor: colors.mapDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: { flex: 1, zIndex: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  menuBtn: { width: 40, height: 40, justifyContent: 'center' },
  menuIcon: { color: colors.brandYellow, fontSize: 26, fontWeight: '700' },
  logoText: { color: colors.brandYellow, fontSize: 26, fontWeight: '800', letterSpacing: 1 },
  tripCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.panelBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 20,
  },
  tripRow: { flexDirection: 'row', alignItems: 'stretch' },
  tripIconCol: { width: 24, alignItems: 'center', paddingTop: 4 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
  dotPickup: { backgroundColor: colors.pickupDot },
  dotDrop: { backgroundColor: colors.dropoffDot, borderRadius: 2, width: 12, height: 12 },
  tripLine: { width: 2, flex: 1, backgroundColor: 'rgba(255,255,255,0.35)', marginVertical: 4, minHeight: 28 },
  tripTextCol: { flex: 1, paddingHorizontal: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tripTag: { fontSize: 15, fontWeight: '700', color: colors.text, minWidth: 36 },
  address: { flex: 1, fontSize: 15, color: colors.text, lineHeight: 22 },
  addressMuted: { color: colors.textMuted },
  pickupTextWrap: { flex: 1 },
  pickupHint: { fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 16 },
  clearBtn: { color: colors.textMuted, fontSize: 14, marginLeft: 4 },
  swapBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.panelBgSolid,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: colors.brandYellow,
    zIndex: 30,
  },
  swapBtnDisabled: { opacity: 0.35 },
  swapIcon: { color: colors.brandYellow, fontSize: 22, fontWeight: '700' },
  pickupPin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.pickupDot,
    borderWidth: 2,
    borderColor: '#fff',
  },
  dropPin: {
    width: 14,
    height: 14,
    backgroundColor: colors.dropoffDot,
    borderWidth: 2,
    borderColor: '#fff',
  },
  footer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 32,
    zIndex: 10,
  },
  nextBtn: {
    backgroundColor: colors.brandYellow,
    borderRadius: 28,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  nextText: { fontSize: 18, fontWeight: '700', color: colors.onPrimary },
  nextArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextArrowText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
});
