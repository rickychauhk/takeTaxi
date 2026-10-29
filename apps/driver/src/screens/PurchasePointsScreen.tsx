import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDriverAuth } from '../auth/DriverAuthContext';
import {
  fetchDriverPendingPointTopups,
  fetchDriverPointPackages,
  fetchDriverPointsTopupConfig,
  submitDriverPointTopup,
  type DriverPendingPointTopup,
  type DriverPointPackage,
  type DriverTopupPaymentMethod,
} from '../api/driverPointPackages';
import { ScreenSafeArea, useTopSafePadding } from '../components/ScreenSafeArea';
import { useLandscapeContentColumn } from '../hooks/useLandscapeContentColumn';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PurchasePoints'>;

function formatHkd(price: string | number): string {
  const n = typeof price === 'string' ? Number(price) : price;
  if (!Number.isFinite(n)) return '—';
  return n % 1 === 0 ? `HK$${n}` : `HK$${n.toFixed(2)}`;
}

export default function PurchasePointsScreen({ navigation, route }: Props) {
  const topPad = useTopSafePadding(8);
  const { outer, inner } = useLandscapeContentColumn(720);
  const { driver, refreshProfile } = useDriverAuth();
  const requiredPoints = route.params?.requiredPoints;
  const balance = Math.round(Number(driver?.pointsBalance ?? 0));

  const [packages, setPackages] = useState<DriverPointPackage[]>([]);
  const [instructions, setInstructions] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<DriverTopupPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DriverPointPackage | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingTopups, setPendingTopups] = useState<DriverPendingPointTopup[]>([]);
  const [pendingPointsTotal, setPendingPointsTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pkgs, topupConfig, pending] = await Promise.all([
        fetchDriverPointPackages(),
        fetchDriverPointsTopupConfig(),
        fetchDriverPendingPointTopups().catch(() => ({
          items: [] as DriverPendingPointTopup[],
          pendingCount: 0,
          pendingPointsTotal: 0,
        })),
      ]);
      setPackages(pkgs);
      setInstructions(topupConfig.instructions);
      setPaymentMethods(topupConfig.paymentMethods);
      setPendingTopups(pending.items);
      setPendingPointsTotal(pending.pendingPointsTotal);
    } catch (e) {
      Alert.alert('無法載入', e instanceof Error ? e.message : '請稍後再試');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void refreshProfile();
  }, [load, refreshProfile]);

  const pickReceiptFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('需要權限', '請允許存取相簿以上傳轉帳憑證。');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setReceiptUri(result.assets[0].uri);
    }
  };

  const pickReceiptFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('需要權限', '請允許使用相機以拍攝過數證明。');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!result.canceled && result.assets[0]?.uri) {
      setReceiptUri(result.assets[0].uri);
    }
  };

  const pickReceipt = () => {
    Alert.alert('上傳憑證', '選擇收據或過數證明來源', [
      { text: '相簿', onPress: () => void pickReceiptFromLibrary() },
      { text: '拍照', onPress: () => void pickReceiptFromCamera() },
      { text: '取消', style: 'cancel' },
    ]);
  };

  const selectedPayment = paymentMethods.find((m) => m.id === paymentMethodId) ?? null;

  const onSubmit = async () => {
    if (!selected) {
      Alert.alert('請選擇套餐', '請先選擇要充值的積分。');
      return;
    }
    if (!paymentMethodId) {
      Alert.alert('請選擇付款方式', '請選擇 FPS、銀行入數等付款方式。');
      return;
    }
    if (!receiptUri) {
      Alert.alert('請上傳憑證', '請上傳銀行轉帳截圖或收據。');
      return;
    }
    setSubmitting(true);
    try {
      await submitDriverPointTopup({
        packageId: selected.id,
        paymentMethodId,
        receiptUri,
      });
      await refreshProfile();
      await load();
      Alert.alert(
        '已提交',
        '我們已收到你的購買申請，批核後積分會入帳。',
        [{ text: '知道了', onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      Alert.alert('提交失敗', e instanceof Error ? e.message : '請稍後再試');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, outer]}>
      <View style={inner}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.headerBg, { paddingTop: topPad }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>購買積分</Text>
          <View style={styles.backBtn} />
        </View>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>當前積分</Text>
        <Text style={styles.balanceValue}>{balance.toLocaleString()} 分</Text>
        {requiredPoints != null && requiredPoints > balance ? (
          <Text style={styles.balanceHint}>
            出貨懸賞至少需要 {requiredPoints} 分，你目前差 {requiredPoints - balance} 分
          </Text>
        ) : null}
      </View>

      {pendingTopups.length > 0 ? (
        <View style={styles.pendingBox}>
          <View style={styles.pendingHeader}>
            <Ionicons name="time-outline" size={20} color="#b45309" />
            <Text style={styles.pendingTitle}>
              {pendingTopups.length === 1
                ? '有 1 筆充值等候批核'
                : `有 ${pendingTopups.length} 筆充值等候批核`}
            </Text>
          </View>
          <Text style={styles.pendingSummary}>
            共 {pendingPointsTotal.toLocaleString()} 分尚未入帳，管理員批核後會自動加入「當前積分」。
          </Text>
          {pendingTopups.map((row) => (
            <View key={row.id} style={styles.pendingRow}>
              <Text style={styles.pendingRowMain}>
                {row.amountPoints.toLocaleString()} 分
                {row.priceHkd ? ` · ${formatHkd(row.priceHkd)}` : ''}
              </Text>
              <Text style={styles.pendingRowSub}>
                {row.bankName ? `${row.bankName} · ` : ''}
                {row.createdAtHk || row.createdAt.slice(0, 16).replace('T', ' ')}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
        <Text style={styles.sectionTitle}>充值套餐</Text>
        {loading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />
        ) : packages.length === 0 ? (
          <Text style={styles.emptyText}>暫無可購買套餐，請聯絡客服。</Text>
        ) : (
          packages.map((pkg) => {
            const isSelected = selected?.id === pkg.id;
            const recommend =
              requiredPoints != null && pkg.points + balance >= requiredPoints && !isSelected;
            return (
              <Pressable
                key={pkg.id}
                style={[styles.pkgRow, isSelected && styles.pkgRowSelected]}
                onPress={() => {
                  setSelected(pkg);
                  setReceiptUri(null);
                  setPaymentMethodId(null);
                }}
              >
                <View style={styles.pkgLeft}>
                  <Text style={styles.pkgPoints}>
                    {pkg.label?.trim() || `${pkg.points.toLocaleString()} 積分`}
                  </Text>
                  <Text style={styles.pkgSub}>{pkg.points.toLocaleString()} 分</Text>
                </View>
                <View style={styles.pkgRight}>
                  <Text style={styles.pkgPrice}>{formatHkd(pkg.priceHkd)}</Text>
                  {recommend ? <Text style={styles.pkgTag}>建議</Text> : null}
                </View>
              </Pressable>
            );
          })
        )}

        {selected ? (
          <View style={styles.checkoutBox}>
            <Text style={styles.checkoutTitle}>
              已選：{selected.points.toLocaleString()} 分 · {formatHkd(selected.priceHkd)}
            </Text>
            {instructions ? <Text style={styles.instructions}>{instructions}</Text> : null}

            <Text style={styles.paymentSectionTitle}>付款方式</Text>
            {paymentMethods.length === 0 ? (
              <Text style={styles.instructionsMuted}>暫無付款方式，請聯絡客服。</Text>
            ) : (
              paymentMethods.map((method) => {
                const active = paymentMethodId === method.id;
                return (
                  <Pressable
                    key={method.id}
                    style={[styles.payMethodRow, active && styles.payMethodRowActive]}
                    onPress={() => setPaymentMethodId(method.id)}
                  >
                    <Text style={[styles.payMethodTitle, active && styles.payMethodTitleActive]}>
                      {method.title}
                    </Text>
                    {active && method.detail ? (
                      <Text style={styles.payMethodDetail}>{method.detail}</Text>
                    ) : null}
                  </Pressable>
                );
              })
            )}
            {selectedPayment?.detail && paymentMethodId ? (
              <Text style={styles.instructionsMuted}>
                請按上方說明付款 {formatHkd(selected.priceHkd)}，完成後上傳證明。
              </Text>
            ) : (
              <Text style={styles.instructionsMuted}>
                請選擇付款方式，按指示付款並上傳轉帳憑證。批核後積分會入帳。
              </Text>
            )}
            <Pressable style={styles.uploadBtn} onPress={pickReceipt}>
              <Ionicons name="cloud-upload-outline" size={22} color={colors.brand} />
              <Text style={styles.uploadBtnText}>
                {receiptUri ? '更換轉帳憑證' : '上傳轉帳憑證'}
              </Text>
            </Pressable>
            {receiptUri ? (
              <Image source={{ uri: receiptUri }} style={styles.receiptPreview} resizeMode="cover" />
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[
            styles.confirmBtn,
            (!selected || !paymentMethodId || submitting) && styles.confirmBtnDisabled,
          ]}
          disabled={!selected || !paymentMethodId || submitting}
          onPress={() => void onSubmit()}
        >
          {submitting ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.confirmText}>確認購買</Text>
          )}
        </Pressable>
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f2f2f5' },
  headerBg: {
    backgroundColor: colors.brand,
    paddingBottom: 48,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  balanceCard: {
    marginHorizontal: 16,
    marginTop: -36,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  balanceLabel: { color: '#888', fontSize: 14 },
  balanceValue: { color: colors.brand, fontSize: 36, fontWeight: '800', marginTop: 6 },
  balanceHint: { color: '#666', fontSize: 13, marginTop: 10, lineHeight: 18 },
  pendingBox: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#fff8eb',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  pendingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pendingTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: '#92400e' },
  pendingSummary: { marginTop: 8, fontSize: 13, color: '#78350f', lineHeight: 18 },
  pendingRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#fde68a',
  },
  pendingRowMain: { fontSize: 14, fontWeight: '700', color: '#444' },
  pendingRowSub: { marginTop: 4, fontSize: 12, color: '#78716c' },
  listScroll: { flex: 1, marginTop: 16 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#222', marginBottom: 12 },
  emptyText: { color: '#888', fontSize: 15 },
  pkgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pkgRowSelected: { borderColor: colors.brand, backgroundColor: colors.brandTintBg },
  pkgLeft: { flex: 1 },
  pkgPoints: { fontSize: 16, fontWeight: '700', color: '#222' },
  pkgSub: { fontSize: 13, color: '#888', marginTop: 4 },
  pkgRight: { alignItems: 'flex-end' },
  pkgPrice: { fontSize: 18, fontWeight: '800', color: colors.brand },
  pkgTag: {
    marginTop: 4,
    fontSize: 11,
    color: colors.brand,
    backgroundColor: colors.brandTintBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  checkoutBox: {
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  checkoutTitle: { fontSize: 15, fontWeight: '700', color: '#333' },
  instructions: { marginTop: 10, fontSize: 14, color: '#444', lineHeight: 20 },
  instructionsMuted: { marginTop: 10, fontSize: 13, color: '#888', lineHeight: 18 },
  paymentSectionTitle: { marginTop: 16, fontSize: 15, fontWeight: '700', color: '#333' },
  payMethodRow: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e8e8ec',
    backgroundColor: '#fafafa',
  },
  payMethodRowActive: { borderColor: colors.brand, backgroundColor: colors.brandTintBg },
  payMethodTitle: { fontSize: 15, fontWeight: '700', color: '#333' },
  payMethodTitleActive: { color: colors.brand },
  payMethodDetail: { marginTop: 8, fontSize: 14, color: '#444', lineHeight: 20 },
  uploadBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.brand,
  },
  uploadBtnText: { color: colors.brand, fontWeight: '700', fontSize: 15 },
  receiptPreview: {
    marginTop: 12,
    width: '100%',
    height: 160,
    borderRadius: 10,
    backgroundColor: '#eee',
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 8,
    backgroundColor: '#f2f2f5',
  },
  confirmBtn: {
    backgroundColor: colors.brand,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.45 },
  confirmText: { color: colors.onPrimary, fontSize: 17, fontWeight: '800' },
});
