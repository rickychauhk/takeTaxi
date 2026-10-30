import Constants from 'expo-constants';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenSafeArea } from '../components/ScreenSafeArea';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { TRIP_MAP_PROVIDER } from '../maps/mapPlatform';
import type { LatLng } from '../constants/demoDestinations';
import { darkMapStyle } from '../constants/mapStyle';
import { AnimatedTaxiMarker } from '../components/AnimatedTaxiMarker';
import { fetchPassengerMapConfig } from '../api/passengerMapConfig';
import { PASSENGER_NEARBY_DRIVERS_RADIUS_M } from '../api/client';
import {
  PASSENGER_NEARBY_DRIVERS_POLL_MS,
  useNearbyDriversPoll,
} from '../hooks/useNearbyDriversPoll';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n/I18nProvider';
import { userFacingError } from '../i18n/userFacingError';
import {
  cancelPassengerOrder,
  fetchPassengerOrderTrack,
  type PassengerOrderTrack,
} from '../api/passengerOrder';
import { useTunnelRoutePreference } from '../hooks/useTunnelRoutePreference';
import { fetchDrivingRoute } from '../routing/fetchDrivingRoute';
import type { OrderRebookDraft } from '../storage/orderRebookDraft';
import { formatPhoneDisplay, phoneToTelUri } from '../phone/phoneToTelUri';
import {
  ACTIVE_TRIP_STATUSES,
  clearActiveOrder,
  saveActiveOrder,
  type StoredActiveOrder,
} from '../storage/activeOrderStorage';
import TripCompletedScreen from './TripCompletedScreen';
import { usePassengerAuth } from '../auth/PassengerAuthContext';
import { usePassengerLiveLocation } from '../hooks/usePassengerLiveLocation';
import { fetchOrderChatUnreadCount } from '../api/orderChat';
import { pingPassengerMatchingWatch } from '../api/passengerMatchingWatch';
import {
  clearPendingPassengerTripChat,
  peekPendingPassengerTripChatOrderId,
  subscribePassengerTripChatOpen,
} from '../notifications/passengerTripChatOpen';
import OrderTripChatScreen from './OrderTripChatScreen';
import { passengerOrderTripChatEnabled } from '@taxima/shared';

type Props = {
  orderId: string;
  pickup: LatLng;
  dropoff: LatLng;
  rebookDraft?: OrderRebookDraft;
  onDone: () => void;
  onBalanceRefresh?: () => void;
  onRebookAfterDriverCancel?: () => void;
  rebooking?: boolean;
};

function formatArrivalClock(durationSeconds: number): string {
  const d = new Date(Date.now() + Math.max(60, durationSeconds) * 1000);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatEtaMinutes(durationSeconds: number): number {
  return Math.max(1, Math.ceil(Math.max(60, durationSeconds) / 60));
}

function formatDistanceKm(distanceMeters: number): string {
  const km = Math.max(0.1, distanceMeters / 1000);
  return km.toFixed(1);
}

type MapCoord = { latitude: number; longitude: number };

/** 等候接單：以 pickup 為中心，框住 CRM 半徑內的附近司機 */
function waitingMapFitPoints(
  pickup: MapCoord,
  nearbyDrivers: { lat: number; lng: number }[],
  radiusM: number,
): MapCoord[] {
  const points: MapCoord[] = [{ ...pickup }];
  for (const d of nearbyDrivers) {
    points.push({ latitude: d.lat, longitude: d.lng });
  }
  if (nearbyDrivers.length === 0 && radiusM > 0) {
    const dLat = radiusM / 111_320;
    const cosLat = Math.cos((pickup.latitude * Math.PI) / 180);
    const dLng = radiusM / (111_320 * Math.max(0.2, cosLat));
    points.push(
      { latitude: pickup.latitude + dLat, longitude: pickup.longitude },
      { latitude: pickup.latitude - dLat, longitude: pickup.longitude },
      { latitude: pickup.latitude, longitude: pickup.longitude + dLng },
      { latitude: pickup.latitude, longitude: pickup.longitude - dLng },
    );
  }
  return points;
}

export default function ActiveOrderScreen({
  orderId,
  pickup,
  dropoff,
  rebookDraft,
  onDone,
  onBalanceRefresh,
  onRebookAfterDriverCancel,
  rebooking,
}: Props) {
  const { t, pickupTag, dropoffTag } = useI18n();
  const { passenger } = usePassengerAuth();
  const mapRef = useRef<MapView>(null);
  const releaseAlertShown = useRef(false);
  const cancelledSideEffectsDone = useRef(false);
  const hadDriverAssigned = useRef(false);

  useEffect(() => {
    cancelledSideEffectsDone.current = false;
  }, [orderId]);
  const [track, setTrack] = useState<PassengerOrderTrack | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [driverRoute, setDriverRoute] = useState<{
    coordinates: { latitude: number; longitude: number }[];
    durationSeconds: number;
    distanceMeters: number;
  } | null>(null);
  const [tripRoute, setTripRoute] = useState<{
    coordinates: { latitude: number; longitude: number }[];
  } | null>(null);
  const [bookingOptionIds, setBookingOptionIds] = useState<number[]>([]);
  const [routeExpanded, setRouteExpanded] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [nearbyRadiusM, setNearbyRadiusM] = useState(PASSENGER_NEARBY_DRIVERS_RADIUS_M);

  const shareLiveWithDriver =
    !!track &&
    ACTIVE_TRIP_STATUSES.has(track.status) &&
    track.status !== 'pending' &&
    track.status !== 'matching' &&
    track.status !== 'cancelled' &&
    track.status !== 'completed';
  usePassengerLiveLocation(passenger?.id, shareLiveWithDriver);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchPassengerOrderTrack(orderId);
      setTrack(data);
      setLoadError(null);
      if (ACTIVE_TRIP_STATUSES.has(data.status)) {
        const snapshot: StoredActiveOrder = {
          orderId,
          pickup: {
            latitude: data.pickup.lat ?? pickup.latitude,
            longitude: data.pickup.lng ?? pickup.longitude,
            label: pickup.label,
          },
          dropoff: {
            latitude: data.dropoff.lat ?? dropoff.latitude,
            longitude: data.dropoff.lng ?? dropoff.longitude,
            label: dropoff.label,
          },
        };
        void saveActiveOrder(snapshot);
      }
      if (data.status === 'completed' || data.status === 'cancelled') {
        void clearActiveOrder();
      }
    } catch (e) {
      setLoadError(userFacingError(e, 'trip.loadFailed'));
    }
  }, [orderId, onDone, t]);

  useEffect(() => {
    void refresh();
    const assigned =
      track?.driver &&
      (track.status === 'accepted' ||
        track.status === 'en_route' ||
        track.status === 'in_trip');
    const ms = assigned ? 1500 : track?.status === 'in_trip' ? 2000 : 3000;
    const id = setInterval(() => void refresh(), ms);
    return () => clearInterval(id);
  }, [refresh, track?.status, track?.driver?.id]);

  const waiting = track?.status === 'pending' || track?.status === 'matching';
  useEffect(() => {
    if (!waiting || !passenger?.id) return;
    let cancelled = false;
    const ping = () => {
      void pingPassengerMatchingWatch(orderId).catch(() => {});
    };
    ping();
    const id = setInterval(() => {
      if (!cancelled) ping();
    }, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [waiting, orderId, passenger?.id]);
  const inTrip = track?.status === 'in_trip';
  const driverAssigned =
    track?.driver &&
    (track.status === 'accepted' || track.status === 'en_route' || track.status === 'in_trip');
  const tripChatEnabled = passengerOrderTripChatEnabled({
    passengerContactCall: track?.rebookSnapshot?.passengerContactCall,
    passengerContactSms: track?.rebookSnapshot?.passengerContactSms,
  });
  const chatAvailable =
    tripChatEnabled &&
    driverAssigned &&
    !inTrip &&
    (track?.status === 'accepted' || track?.status === 'en_route');

  useEffect(() => {
    if (!chatAvailable && chatOpen) setChatOpen(false);
  }, [chatAvailable, chatOpen]);

  const openTripChat = useCallback(() => {
    if (!chatAvailable || chatOpen) return;
    setChatUnread(0);
    setChatOpen(true);
    clearPendingPassengerTripChat(orderId);
  }, [chatAvailable, chatOpen, orderId]);

  useEffect(() => {
    return subscribePassengerTripChatOpen((targetOrderId) => {
      if (targetOrderId !== orderId) return;
      openTripChat();
    });
  }, [orderId, openTripChat]);

  useEffect(() => {
    if (!chatAvailable) return;
    if (peekPendingPassengerTripChatOrderId() === orderId) openTripChat();
  }, [chatAvailable, orderId, openTripChat]);

  const prevChatUnreadRef = useRef(0);
  useEffect(() => {
    if (!chatAvailable || chatOpen) {
      prevChatUnreadRef.current = chatUnread;
      return;
    }
    if (chatUnread > prevChatUnreadRef.current && chatUnread > 0) {
      openTripChat();
    }
    prevChatUnreadRef.current = chatUnread;
  }, [chatUnread, chatAvailable, chatOpen, openTripChat]);

  useEffect(() => {
    if (!chatAvailable || chatOpen) {
      if (!chatAvailable) setChatUnread(0);
      return;
    }
    let cancelled = false;
    const poll = () => {
      void fetchOrderChatUnreadCount(orderId)
        .then((n) => {
          if (!cancelled) setChatUnread(n);
        })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [chatAvailable, chatOpen, orderId]);

  const pickupCoord = useMemo(() => {
    if (track?.pickup.lat != null && track.pickup.lng != null) {
      return { latitude: track.pickup.lat, longitude: track.pickup.lng };
    }
    return pickup;
  }, [track, pickup]);

  const dropoffCoord = useMemo(() => {
    if (track?.dropoff.lat != null && track.dropoff.lng != null) {
      return { latitude: track.dropoff.lat, longitude: track.dropoff.lng };
    }
    return dropoff;
  }, [track, dropoff]);

  useEffect(() => {
    const fromTrack = track?.rebookSnapshot?.selectedOptionIds;
    const fromDraft = rebookDraft?.extras.selectedOptionIds;
    const ids = fromTrack?.length ? fromTrack : fromDraft;
    if (!ids?.length) return;
    setBookingOptionIds((prev) => (prev.length === 0 ? ids : prev));
  }, [track?.rebookSnapshot?.selectedOptionIds, rebookDraft?.extras.selectedOptionIds]);

  const {
    preference: tunnelPreference,
    tunnelSelectionKey,
    ready: tunnelPreferenceReady,
  } = useTunnelRoutePreference(bookingOptionIds);

  const driverCoord = useMemo(() => {
    if (track?.driver?.lat != null && track?.driver?.lng != null) {
      return { latitude: track.driver.lat, longitude: track.driver.lng };
    }
    return null;
  }, [track]);

  const showNearbyDriversOnMap = waiting && !driverCoord;
  const nearbyDrivers = useNearbyDriversPoll(
    showNearbyDriversOnMap ? pickupCoord : null,
    nearbyRadiusM,
  );

  useEffect(() => {
    if (!showNearbyDriversOnMap) return;
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
  }, [showNearbyDriversOnMap]);

  const nearbyDriversFitKey = useMemo(
    () =>
      nearbyDrivers
        .map((d) => `${d.driver_id}:${d.lat.toFixed(5)},${d.lng.toFixed(5)}`)
        .join('|'),
    [nearbyDrivers],
  );

  const routeDestination = inTrip ? dropoffCoord : pickupCoord;

  useEffect(() => {
    if (!waiting) {
      setTripRoute(null);
      return;
    }
    if (!tunnelPreferenceReady) return;
    let cancelled = false;
    void fetchDrivingRoute(pickupCoord, dropoffCoord, { tunnelPreference }).then((r) => {
      if (!cancelled) {
        setTripRoute({ coordinates: r.coordinates });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    waiting,
    pickupCoord.latitude,
    pickupCoord.longitude,
    dropoffCoord.latitude,
    dropoffCoord.longitude,
    tunnelSelectionKey,
    tunnelPreference,
    tunnelPreferenceReady,
  ]);

  useEffect(() => {
    if (!driverCoord) {
      setDriverRoute(null);
      return;
    }
    let cancelled = false;
    void fetchDrivingRoute(
      { latitude: driverCoord.latitude, longitude: driverCoord.longitude },
      routeDestination,
    ).then((r) => {
      if (!cancelled) {
        setDriverRoute({
          coordinates: r.coordinates,
          durationSeconds: r.durationSeconds,
          distanceMeters: r.distanceMeters,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    driverCoord?.latitude,
    driverCoord?.longitude,
    routeDestination.latitude,
    routeDestination.longitude,
    inTrip,
  ]);

  const mapPolyline = useMemo(() => {
    if (driverRoute?.coordinates.length) return driverRoute.coordinates;
    if (waiting && tripRoute?.coordinates.length) return tripRoute.coordinates;
    return [];
  }, [driverRoute, waiting, tripRoute]);

  useEffect(() => {
    if (showNearbyDriversOnMap) {
      const points = waitingMapFitPoints(pickupCoord, nearbyDrivers, nearbyRadiusM);
      mapRef.current?.fitToCoordinates(points, {
        edgePadding: { top: 120, right: 40, bottom: 280, left: 40 },
        animated: true,
      });
      return;
    }
    const routePts = mapPolyline.length >= 2 ? mapPolyline : [];
    const points = inTrip
      ? [dropoffCoord, ...(driverCoord ? [driverCoord] : []), ...routePts]
      : [pickupCoord, dropoffCoord, ...(driverCoord ? [driverCoord] : []), ...routePts];
    mapRef.current?.fitToCoordinates(points, {
      edgePadding: { top: inTrip ? 140 : 120, right: 40, bottom: 280, left: 40 },
      animated: true,
    });
  }, [
    showNearbyDriversOnMap,
    nearbyDriversFitKey,
    nearbyRadiusM,
    pickupCoord,
    dropoffCoord,
    driverCoord,
    inTrip,
    mapPolyline,
  ]);

  useEffect(() => {
    if (
      track?.driver &&
      (track.status === 'accepted' ||
        track.status === 'en_route' ||
        track.status === 'in_trip')
    ) {
      hadDriverAssigned.current = true;
    }
    if (
      hadDriverAssigned.current &&
      (track?.status === 'pending' || track?.status === 'matching') &&
      !track?.driver &&
      !releaseAlertShown.current
    ) {
      releaseAlertShown.current = true;
      Alert.alert(t('trip.driverReleasedTitle'), t('trip.driverReleasedMessage'), [
        { text: t('common.ok') },
      ]);
    }
  }, [track?.status, track?.driver, t]);

  useEffect(() => {
    if (track?.status !== 'cancelled') return;
    setChatOpen(false);
    void clearActiveOrder();
    if (cancelledSideEffectsDone.current) return;
    cancelledSideEffectsDone.current = true;
    onBalanceRefresh?.();
  }, [track?.status, onBalanceRefresh]);

  useEffect(() => {
    if (!chatOpen) return;
    if (track?.status === 'cancelled' || track?.status === 'completed') {
      setChatOpen(false);
    }
  }, [chatOpen, track?.status]);

  const etaClockLabel = driverRoute ? formatArrivalClock(driverRoute.durationSeconds) : '--:--';
  const etaTripLabel =
    driverRoute && inTrip
      ? t('trip.etaToDestination', {
          minutes: formatEtaMinutes(driverRoute.durationSeconds),
          distanceKm: formatDistanceKm(driverRoute.distanceMeters),
        })
      : null;

  const statusLine = waiting
    ? t('trip.waitingForDriver')
    : inTrip
      ? t('trip.headingToDestination')
      : driverAssigned && track?.driver
        ? t('trip.driverEnRoutePickup', { name: track.driver.displayName })
        : t('trip.processing');

  const progressOn = waiting ? 1 : inTrip ? 4 : driverAssigned ? 3 : 2;
  const canCancel = track?.status !== 'in_trip' && track?.status !== 'cancelled';

  const vehiclePlateLabel =
    driverAssigned && track?.driver
      ? t('trip.vehiclePlate', {
          plate: track.driver.vehiclePlate?.trim() || '—',
        })
      : null;

  const ratingLabel =
    track?.driver?.ratingAvg != null
      ? t('trip.ratingAvg', { score: track.driver.ratingAvg.toFixed(1) })
      : null;

  const showRouteStops = !inTrip || routeExpanded;

  const pickupLabel = pickup.label;
  const dropoffLabel = dropoff.label;

  const confirmCancel = () => {
    Alert.alert(t('trip.cancelConfirmTitle'), t('trip.cancelConfirmMessage'), [
      { text: t('trip.cancelDismiss'), style: 'cancel' },
      {
        text: t('trip.cancelConfirm'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setCancelling(true);
            try {
              await cancelPassengerOrder(orderId);
              setTrack((prev) =>
                prev ? { ...prev, status: 'cancelled', cancelBy: 'passenger' } : prev,
              );
              void clearActiveOrder();
              onBalanceRefresh?.();
              await refresh();
            } catch (e) {
              Alert.alert(t('trip.cancelOrder'), userFacingError(e, 'trip.cancelFailed'));
            } finally {
              setCancelling(false);
            }
          })();
        },
      },
    ]);
  };

  const callDriver = () => {
    void (async () => {
      const phone = track?.driver?.phone?.trim();
      if (!phone) {
        Alert.alert(t('trip.callDriver'), t('trip.driverPhoneUnavailable'));
        return;
      }
      const display = formatPhoneDisplay(phone);
      if (Constants.isDevice === false) {
        Alert.alert(t('trip.callDriver'), t('trip.simulatorNoDial', { phone: display }));
        return;
      }
      const url = phoneToTelUri(phone, { prompt: Platform.OS === 'ios' });
      try {
        const supported = await Linking.canOpenURL(url);
        if (!supported) {
          Alert.alert(t('trip.callDriver'), t('trip.callNotSupported'));
          return;
        }
        const opened = await Linking.openURL(url);
        if (!opened) {
          Alert.alert(t('trip.callDriver'), t('trip.callFailed'));
        }
      } catch {
        Alert.alert(t('trip.callDriver'), t('trip.callFailed'));
      }
    })();
  };

  if (rebooking) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={colors.brandYellow} />
        <Text style={styles.rebookingText}>{t('trip.rebooking')}</Text>
      </View>
    );
  }

  if (!track && !loadError) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={colors.brandYellow} />
      </View>
    );
  }

  if (track?.status === 'completed') {
    return (
      <TripCompletedScreen
        track={track}
        pickupLabel={pickupLabel}
        dropoffLabel={dropoffLabel}
        onDone={onDone}
      />
    );
  }

  if (track?.status === 'cancelled') {
    const driverCancelled = track.cancelBy === 'driver';
    return (
      <View style={styles.loadingRoot}>
        <View style={styles.terminalCard}>
          <Text style={styles.terminalTitle}>
            {driverCancelled ? t('trip.driverCancelledTitle') : t('trip.cancelledTitle')}
          </Text>
          <Text style={styles.terminalBody}>
            {driverCancelled && onRebookAfterDriverCancel
              ? t('trip.driverCancelledRebookMessage')
              : t('trip.cancelledMessage')}
          </Text>
          {driverCancelled && onRebookAfterDriverCancel ? (
            <View style={styles.terminalBtnRow}>
              <Pressable
                style={[styles.terminalBtn, styles.terminalBtnSecondary]}
                onPress={onDone}
                accessibilityRole="button"
              >
                <Text style={styles.terminalBtnSecondaryText}>{t('trip.rebookNo')}</Text>
              </Pressable>
              <Pressable
                style={[styles.terminalBtn, styles.terminalBtnPrimary]}
                onPress={() => onRebookAfterDriverCancel()}
                accessibilityRole="button"
              >
                <Text style={styles.terminalBtnPrimaryText}>{t('trip.rebookYes')}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[styles.terminalBtn, styles.terminalBtnPrimary, styles.terminalBtnSingle]}
              onPress={onDone}
              accessibilityRole="button"
            >
              <Text style={styles.terminalBtnPrimaryText}>{t('common.ok')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <ScreenSafeArea style={[styles.header, inTrip && styles.headerInTrip]} edges={['top', 'left', 'right']}>
        {inTrip && etaTripLabel ? (
          <Text style={styles.etaTripBanner}>{etaTripLabel}</Text>
        ) : (
          <View style={styles.headerRow}>
            <Text style={styles.etaTime}>{driverAssigned ? etaClockLabel : '--:--'}</Text>
            <Text style={styles.etaCaption}>{t('trip.estimatedArrival')}</Text>
          </View>
        )}
        <View style={styles.progressRow}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.progressSeg, i <= progressOn && styles.progressSegOn]} />
          ))}
        </View>
        <Text style={styles.statusLine}>{statusLine}</Text>
        {driverAssigned && !driverCoord ? (
          <Text style={styles.driverLocPending}>{t('trip.waitingDriverLocation')}</Text>
        ) : null}
      </ScreenSafeArea>

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={TRIP_MAP_PROVIDER}
        customMapStyle={darkMapStyle}
        initialRegion={{
          latitude: pickupCoord.latitude,
          longitude: pickupCoord.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
        userInterfaceStyle="dark"
      >
        <Marker coordinate={pickupCoord} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.dot, styles.dotPickup]} />
        </Marker>
        <Marker coordinate={dropoffCoord} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.dot, styles.dotDrop]} />
        </Marker>
        {showNearbyDriversOnMap
          ? nearbyDrivers.map((d) => (
              <AnimatedTaxiMarker
                key={String(d.driver_id)}
                latitude={d.lat}
                longitude={d.lng}
                rotation={d.heading}
                animateDurationMs={PASSENGER_NEARBY_DRIVERS_POLL_MS - 200}
              />
            ))
          : null}
        {driverCoord ? (
          <AnimatedTaxiMarker
            latitude={driverCoord.latitude}
            longitude={driverCoord.longitude}
            animateDurationMs={1400}
            zIndex={10}
          />
        ) : null}
        {mapPolyline.length >= 2 ? (
          <Polyline
            coordinates={mapPolyline}
            strokeColor={inTrip ? colors.brandYellow : waiting ? colors.routeLine : '#111'}
            strokeWidth={inTrip ? 5 : 4}
          />
        ) : null}
      </MapView>

      <View style={styles.sheet}>
        {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

        {driverAssigned && track?.driver ? (
          <View style={styles.driverRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{track.driver.displayName.slice(0, 1)}</Text>
            </View>
            <View style={styles.driverMeta}>
              <View style={styles.driverNameRow}>
                <Text style={styles.driverName}>{track.driver.displayName}</Text>
                {ratingLabel ? <Text style={styles.ratingBadge}>★ {ratingLabel}</Text> : null}
              </View>
              <Text style={styles.plate}>{vehiclePlateLabel}</Text>
            </View>
            {!inTrip ? (
              <View style={styles.driverActions}>
                {chatAvailable ? (
                  <Pressable
                    style={styles.msgBtn}
                    onPress={() => {
                      setChatUnread(0);
                      setChatOpen(true);
                    }}
                    hitSlop={12}
                    accessibilityLabel={t('trip.chatButton')}
                    accessibilityRole="button"
                  >
                    <Text style={styles.msgIcon}>💬</Text>
                    {chatUnread > 0 ? <View style={styles.unreadDot} /> : null}
                  </Pressable>
                ) : null}
                <Pressable
                  style={[styles.callBtn, !track.driver.phone?.trim() && styles.callBtnDisabled]}
                  onPress={callDriver}
                  hitSlop={12}
                  accessibilityLabel={t('trip.callDriver')}
                  accessibilityRole="button"
                >
                  <Text style={styles.callIcon}>📞</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {inTrip ? (
          <Pressable
            style={styles.routeToggle}
            onPress={() => setRouteExpanded((v) => !v)}
            accessibilityRole="button"
          >
            <Text style={styles.routeToggleText}>
              {routeExpanded ? t('trip.routeCollapse') : t('trip.routeDetails')}
            </Text>
            <Text style={styles.routeToggleChevron}>{routeExpanded ? '▲' : '▼'}</Text>
          </Pressable>
        ) : null}

        {showRouteStops ? (
          <>
            <View style={styles.stopRow}>
              <View style={[styles.dot, styles.dotPickup, styles.dotSmall]} />
              <View style={styles.stopTextWrap}>
                <Text style={styles.stopTag}>{pickupTag}</Text>
                <Text style={styles.stopLabel}>{pickupLabel}</Text>
              </View>
            </View>
            <View style={styles.stopRow}>
              <View style={[styles.dot, styles.dotDrop, styles.dotSmall]} />
              <View style={styles.stopTextWrap}>
                <Text style={styles.stopTag}>{dropoffTag}</Text>
                <Text style={styles.stopLabel}>{dropoffLabel}</Text>
              </View>
            </View>
          </>
        ) : null}

        {canCancel ? (
        <Pressable
          style={[styles.cancelBtn, cancelling && styles.cancelBtnDisabled]}
          onPress={confirmCancel}
          disabled={cancelling || track?.status === 'cancelled'}
        >
          {cancelling ? (
            <ActivityIndicator color="#c62828" />
          ) : (
            <Text style={styles.cancelBtnText}>{t('trip.cancelOrder')}</Text>
          )}
        </Pressable>
        ) : null}
        <Pressable
          onPress={() =>
            Alert.alert(t('trip.needHelp'), t('trip.needHelpHint'), [{ text: t('common.ok') }])
          }
        >
          <Text style={styles.helpLink}>{t('trip.needHelp')}</Text>
        </Pressable>
      </View>

      <Modal
        visible={chatOpen}
        animationType="slide"
        statusBarTranslucent={false}
        onRequestClose={() => setChatOpen(false)}
      >
        {track?.driver ? (
          <OrderTripChatScreen
            orderId={orderId}
            driverName={track.driver.displayName}
            vehiclePlate={track.driver.vehiclePlate?.trim() || '—'}
            onBack={() => {
              setChatOpen(false);
              void refresh();
            }}
            onOrderEnded={() => {
              setChatOpen(false);
              void refresh();
              onBalanceRefresh?.();
            }}
            onReleasedToHall={() => {
              setChatOpen(false);
              void refresh();
            }}
          />
        ) : (
          <View style={styles.chatFallback}>
            <Pressable style={styles.chatFallbackBack} onPress={() => setChatOpen(false)}>
              <Text style={styles.chatFallbackBackText}>← {t('common.ok')}</Text>
            </Pressable>
            <Text style={styles.chatFallbackMsg}>{t('trip.chatSessionEnded')}</Text>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  loadingRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mapDark },
  rebookingText: { color: '#fff', marginTop: 16, fontSize: 16, fontWeight: '600' },
  terminalCard: {
    width: '88%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  terminalTitle: { fontSize: 20, fontWeight: '800', color: '#111', textAlign: 'center' },
  terminalBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#444',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  terminalBtnRow: { flexDirection: 'row', gap: 10 },
  terminalBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  terminalBtnSingle: { alignSelf: 'stretch' },
  terminalBtnPrimary: { backgroundColor: colors.brandYellow },
  terminalBtnPrimaryText: { fontSize: 16, fontWeight: '800', color: colors.onPrimary },
  terminalBtnSecondary: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ccc',
  },
  terminalBtnSecondaryText: { fontSize: 16, fontWeight: '700', color: '#333' },
  header: {
    backgroundColor: colors.brandYellow,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerInTrip: { paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  etaTime: { fontSize: 28, fontWeight: '800', color: colors.onPrimary },
  etaCaption: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  etaTripBanner: { fontSize: 16, fontWeight: '800', color: colors.onPrimary, lineHeight: 22 },
  progressRow: { flexDirection: 'row', gap: 6, marginTop: 10, marginBottom: 10 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  progressSegOn: { backgroundColor: colors.onPrimary },
  statusLine: { fontSize: 15, fontWeight: '700', color: colors.onPrimary },
  driverLocPending: {
    fontSize: 13,
    fontWeight: '600',
    color: '#b45309',
    marginTop: 6,
    textAlign: 'center',
  },
  map: { flex: 1 },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginTop: -12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  errorText: { color: '#c62828', marginBottom: 8, fontSize: 13 },
  driverRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#444' },
  driverMeta: { flex: 1, marginLeft: 12 },
  driverNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  driverName: { fontSize: 17, fontWeight: '800', color: '#111' },
  ratingBadge: { fontSize: 13, fontWeight: '700', color: '#555' },
  plate: { fontSize: 14, color: '#666', marginTop: 2 },
  routeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 8,
  },
  routeToggleText: { fontSize: 15, fontWeight: '700', color: '#333' },
  routeToggleChevron: { fontSize: 12, color: '#666' },
  driverActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  msgBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgIcon: { fontSize: 20 },
  unreadDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff1744',
    borderWidth: 2,
    borderColor: '#fff',
  },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtnDisabled: { opacity: 0.45 },
  callIcon: { fontSize: 20 },
  stopRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  stopTextWrap: { flex: 1, marginLeft: 10 },
  stopTag: { fontSize: 12, color: '#888', fontWeight: '700' },
  stopLabel: { fontSize: 15, color: '#111', marginTop: 2, lineHeight: 20 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
  dotPickup: { backgroundColor: colors.pickupDot },
  dotDrop: { backgroundColor: colors.dropoffDot, borderRadius: 2, width: 12, height: 12 },
  dotSmall: { marginTop: 4 },
  cancelBtn: {
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#c62828',
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnDisabled: { opacity: 0.6 },
  cancelBtnText: { color: '#c62828', fontSize: 17, fontWeight: '800' },
  helpLink: { textAlign: 'center', marginTop: 12, color: '#888', fontSize: 14 },
  chatFallback: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  chatFallbackBack: { position: 'absolute', top: 56, left: 16, padding: 12 },
  chatFallbackBackText: { fontSize: 17, fontWeight: '700', color: colors.brand },
  chatFallbackMsg: { fontSize: 16, fontWeight: '600', color: '#444', textAlign: 'center' },
});
