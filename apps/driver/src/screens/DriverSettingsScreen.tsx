import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { patchDriverVehiclePlate } from '../api/driverProfile';
import { useDriverAuth } from '../auth/DriverAuthContext';
import { useDriverSettings } from '../context/DriverSettingsContext';
import { useDrivingUi } from '../hooks/useDrivingUi';
import { useLayoutMode } from '../hooks/useLayoutMode';
import type { DriverExternalMapChoice } from '../navigation/preferredNavigationApp';
import {
  defaultExternalNavigationApp,
  getPreferredExternalMapApp,
  setPreferredNavigationApp,
} from '../navigation/preferredNavigationApp';
import {
  DRIVER_PICKUP_RADIUS_OPTIONS,
  formatPickupRadiusLabel,
  type DriverPickupRadiusKm,
} from '../settings/driverPickupRadius';
import { MODAL_SUPPORTED_ORIENTATIONS } from '../constants/modalOrientations';
import {
  getNewOrderVoiceEnabled,
  setNewOrderVoiceEnabled,
} from '../settings/driverNewOrderVoice';
import { colors } from '../theme/colors';

const MAP_OPTIONS: { id: DriverExternalMapChoice; label: string; hint: string }[] = [
  { id: 'google', label: 'Google 地圖', hint: 'Android 預設' },
  { id: 'apple', label: 'Apple 地圖', hint: 'iPhone 預設' },
  { id: 'gaode', label: '高德地圖', hint: '中國地圖 App' },
];

export default function DriverSettingsScreen() {
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { driver, refreshProfile } = useDriverAuth();
  const { pickupRadiusKm, setPickupRadiusKm } = useDriverSettings();
  const pointsBalance = Math.round(Number(driver?.pointsBalance ?? 0));
  const driving = useDrivingUi();
  const { isLandscape } = useLayoutMode();
  const [mapChoice, setMapChoice] = useState<DriverExternalMapChoice>(defaultExternalNavigationApp());
  const [plateModalOpen, setPlateModalOpen] = useState(false);
  const [plateDraft, setPlateDraft] = useState('');
  const [plateSaving, setPlateSaving] = useState(false);
  const [plateHistoryOpen, setPlateHistoryOpen] = useState(false);
  const [platePicking, setPlatePicking] = useState<string | null>(null);
  const [newOrderVoiceOn, setNewOrderVoiceOn] = useState(true);

  const pastPlates = driver?.vehiclePlateHistory ?? [];
  const currentPlate = driver?.vehiclePlate?.trim() ?? '';

  const onSelect = (value: DriverPickupRadiusKm) => {
    void setPickupRadiusKm(value);
  };

  const loadMapPreference = useCallback(() => {
    void getPreferredExternalMapApp().then(setMapChoice);
  }, []);

  const loadNewOrderVoice = useCallback(() => {
    void getNewOrderVoiceEnabled().then(setNewOrderVoiceOn);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
      loadMapPreference();
      loadNewOrderVoice();
    }, [refreshProfile, loadMapPreference, loadNewOrderVoice]),
  );

  const onToggleNewOrderVoice = (value: boolean) => {
    setNewOrderVoiceOn(value);
    void setNewOrderVoiceEnabled(value);
  };

  const openPlateEditor = () => {
    setPlateDraft(driver?.vehiclePlate?.trim() ?? '');
    setPlateModalOpen(true);
  };

  const savePlate = async () => {
    const next = plateDraft.trim();
    if (next.length < 2) return;
    setPlateSaving(true);
    try {
      await patchDriverVehiclePlate(next);
      await refreshProfile();
      setPlateModalOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '更新車牌失敗';
      Alert.alert('無法更新車牌', msg);
    } finally {
      setPlateSaving(false);
    }
  };

  const selectPastPlate = async (plate: string) => {
    if (plate === currentPlate || platePicking) return;
    setPlatePicking(plate);
    try {
      await patchDriverVehiclePlate(plate);
      await refreshProfile();
      setPlateHistoryOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '更新車牌失敗';
      Alert.alert('無法更新車牌', msg);
    } finally {
      setPlatePicking(null);
    }
  };

  const onSelectMap = (id: DriverExternalMapChoice) => {
    if (id === 'apple' && Platform.OS !== 'ios') return;
    void setPreferredNavigationApp(id).then(() => setMapChoice(id));
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, isLandscape && styles.scrollLandscape]}
        showsVerticalScrollIndicator
      >
        <Text style={[styles.title, { fontSize: driving.titleSize }]}>設定</Text>

        <Text style={[styles.sectionTitle, { fontSize: driving.bodySize }]}>帳號車牌</Text>
        <Text style={[styles.sectionHint, { fontSize: driving.metaSize }]}>
          每日如轉車，可在此更新；接單及平台紀錄會用最新車牌。
        </Text>
        <Pressable
          style={[styles.linkRow, { minHeight: driving.touchMin }]}
          onPress={openPlateEditor}
        >
          <View style={styles.linkRowMain}>
            <Text style={[styles.linkLabel, { fontSize: driving.bodySize }]}>
              {driver?.vehiclePlate?.trim() || '未設定車牌'}
            </Text>
            <Text style={[styles.linkSub, { fontSize: driving.metaSize }]}>點擊修改</Text>
          </View>
          <Ionicons name="create-outline" size={22} color={colors.brandYellow} />
        </Pressable>

        {pastPlates.length > 0 ? (
          <View style={styles.plateHistoryBlock}>
            <Pressable
              style={[styles.plateHistoryToggle, { minHeight: driving.touchMin }]}
              onPress={() => setPlateHistoryOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: plateHistoryOpen }}
            >
              <Text style={[styles.plateHistoryToggleLabel, { fontSize: driving.bodySize }]}>
                選擇以往車牌
              </Text>
              <Ionicons
                name={plateHistoryOpen ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={colors.textMuted}
              />
            </Pressable>
            {plateHistoryOpen ? (
              <View style={styles.optionList}>
                {pastPlates.map((plate) => {
                  const busy = platePicking === plate;
                  return (
                    <Pressable
                      key={plate}
                      style={[styles.optionRow, { minHeight: driving.touchMin }]}
                      onPress={() => void selectPastPlate(plate)}
                      disabled={Boolean(platePicking)}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.optionLabel, { fontSize: driving.bodySize }]}>{plate}</Text>
                      {busy ? (
                        <ActivityIndicator color={colors.brandYellow} />
                      ) : (
                        <Ionicons name="arrow-redo-outline" size={20} color={colors.brandYellow} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, { fontSize: driving.bodySize, marginTop: 28 }]}>
          預設導航地圖
        </Text>
        <Text style={[styles.sectionHint, { fontSize: driving.metaSize }]}>
          進行中行程按「導航」時開啟的 App。預設：{Platform.OS === 'ios' ? 'Apple 地圖' : 'Google 地圖'}。
        </Text>
        <View style={styles.optionList}>
          {MAP_OPTIONS.map((opt) => {
            if (opt.id === 'apple' && Platform.OS !== 'ios') return null;
            const selected = mapChoice === opt.id;
            return (
              <Pressable
                key={opt.id}
                style={[
                  styles.optionRow,
                  { minHeight: driving.touchMin },
                  selected && styles.optionRowSelected,
                ]}
                onPress={() => onSelectMap(opt.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View>
                  <Text style={[styles.optionLabel, { fontSize: driving.bodySize }]}>{opt.label}</Text>
                  <Text style={[styles.linkSub, { fontSize: driving.metaSize }]}>{opt.hint}</Text>
                </View>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={driving.iconSize} color={colors.brandYellow} />
                ) : (
                  <View style={styles.optionRing} />
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { fontSize: driving.bodySize, marginTop: 28 }]}>
          新柯打語音
        </Text>
        <Text style={[styles.sectionHint, { fontSize: driving.metaSize }]}>
          有新柯打時以廣東話讀出「起點 去 目的地」（僅大廳 Tab 前景）。App 在前景任何頁面都不彈全屏接單；在背景時 Android 仍會全屏提示。
        </Text>
        <View style={[styles.optionRow, styles.switchRow, { minHeight: driving.touchMin }]}>
          <Text style={[styles.optionLabel, { fontSize: driving.bodySize }]}>語音播放</Text>
          <Switch
            value={newOrderVoiceOn}
            onValueChange={onToggleNewOrderVoice}
            trackColor={{ false: colors.border, true: colors.brandYellow }}
            thumbColor={colors.onPrimary}
          />
        </View>

        <Text style={[styles.sectionTitle, { fontSize: driving.bodySize, marginTop: 28 }]}>
          接單範圍（距離上車點）
        </Text>
        <Text style={[styles.sectionHint, { fontSize: driving.metaSize }]}>
          目前：{formatPickupRadiusLabel(pickupRadiusKm)}。範圍內柯打顯示於大廳列表；登入後需開啟定位。
        </Text>

        <View style={styles.optionList}>
          {DRIVER_PICKUP_RADIUS_OPTIONS.map((opt) => {
            const selected = pickupRadiusKm === opt.value;
            return (
              <Pressable
                key={opt.label}
                style={[
                  styles.optionRow,
                  { minHeight: driving.touchMin },
                  selected && styles.optionRowSelected,
                ]}
                onPress={() => onSelect(opt.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.optionLabel, { fontSize: driving.bodySize }]}>{opt.label}</Text>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={driving.iconSize} color={colors.brandYellow} />
                ) : (
                  <View style={styles.optionRing} />
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { fontSize: driving.bodySize, marginTop: 28 }]}>積分</Text>
        <Text style={[styles.sectionHint, { fontSize: driving.metaSize }]}>
          目前結餘 {pointsBalance.toLocaleString()} 分。充值後上傳過數證明，批核後入帳。
        </Text>
        <Pressable
          style={[styles.linkRow, { minHeight: driving.touchMin }]}
          onPress={() => rootNav.navigate('PurchasePoints')}
        >
          <View style={styles.linkRowMain}>
            <Text style={[styles.linkLabel, { fontSize: driving.bodySize }]}>購買積分</Text>
            <Text style={[styles.linkSub, { fontSize: driving.metaSize }]}>
              {pointsBalance.toLocaleString()} 分
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
        </Pressable>

        <Text style={[styles.sectionTitle, { fontSize: driving.bodySize, marginTop: 28 }]}>
          法律及關於
        </Text>
        <Pressable
          style={[styles.linkRow, { minHeight: driving.touchMin }]}
          onPress={() => rootNav.navigate('TermsWebView')}
        >
          <Text style={[styles.linkLabel, { fontSize: driving.bodySize }]}>使用條款</Text>
          <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
        </Pressable>
        <Text style={[styles.meta, { fontSize: driving.metaSize }]}>
          程式版本 {Constants.expoConfig?.version ?? '—'}
        </Text>
      </ScrollView>

      <Modal
        visible={plateModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPlateModalOpen(false)}
        supportedOrientations={MODAL_SUPPORTED_ORIENTATIONS}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPlateModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>修改車牌</Text>
            <TextInput
              style={styles.plateInput}
              value={plateDraft}
              onChangeText={setPlateDraft}
              placeholder="例如 AB1234"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtnGhost} onPress={() => setPlateModalOpen(false)}>
                <Text style={styles.modalBtnGhostText}>取消</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtnPrimary, plateSaving && styles.modalBtnDisabled]}
                onPress={() => void savePlate()}
                disabled={plateSaving}
              >
                {plateSaving ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>儲存</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 },
  scrollLandscape: { maxWidth: 560, alignSelf: 'center', width: '100%' },
  title: { color: colors.text, fontWeight: '800', marginBottom: 20 },
  sectionTitle: { color: colors.text, fontWeight: '800', marginBottom: 8 },
  sectionHint: { color: colors.textMuted, lineHeight: 24, marginBottom: 16 },
  plateHistoryBlock: { marginTop: 10, gap: 10 },
  plateHistoryToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  plateHistoryToggleLabel: { color: colors.text, fontWeight: '700' },
  optionList: { gap: 10 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionRowSelected: { borderColor: colors.brandYellow, borderWidth: 2 },
  switchRow: { marginBottom: 4 },
  optionLabel: { color: colors.text, fontWeight: '700' },
  optionRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
  },
  meta: { color: colors.textMuted, marginTop: 8 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkLabel: { color: colors.text, fontWeight: '700' },
  linkRowMain: { flex: 1, paddingRight: 8 },
  linkSub: { color: colors.textMuted, marginTop: 4 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  plateInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalBtnGhost: { paddingVertical: 10, paddingHorizontal: 14 },
  modalBtnGhostText: { color: colors.textMuted, fontWeight: '700', fontSize: 16 },
  modalBtnPrimary: {
    backgroundColor: colors.brandYellow,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: 88,
    alignItems: 'center',
  },
  modalBtnDisabled: { opacity: 0.6 },
  modalBtnPrimaryText: { color: colors.onPrimary, fontWeight: '800', fontSize: 16 },
});
