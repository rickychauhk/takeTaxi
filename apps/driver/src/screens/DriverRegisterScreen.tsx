import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { checkRegisterPhones, registerDriver, uploadDriverDocument } from '../api/driverRegister';
import { useDriverAuth } from '../auth/DriverAuthContext';
import { saveRememberPhone } from '../auth/session';
import {
  formatHongKongPhoneInputValue,
  parseHongKongIdentityNumberParts,
  validateHongKongIdentityNumberPartsField,
  HK_LICENSED_BANK_NAMES,
  validateHongKongBankAccountNumberField,
} from '@taxima/shared';
import { toE164HongKong, validateHongKongPhoneField } from '../firebase/phone';
import { MODAL_SUPPORTED_ORIENTATIONS } from '../constants/modalOrientations';
import type { AuthStackParamList } from '../navigation/AuthStack';
import { colors } from '../theme/colors';

const VEHICLE_MODEL_OPTIONS = ['混燃', '六人車', '輪椅'] as const;

function parseApiError(text: string): string {
  try {
    const j = JSON.parse(text) as { message?: string | string[] };
    const m = j.message;
    const msg = Array.isArray(m) ? m.join(' ') : m;
    if (msg) return msg;
  } catch {
    /* ignore */
  }
  return text || '註冊失敗';
}

/** 英文小寫即時轉大寫（中文等不受影響） */
function uppercaseLatin(text: string): string {
  return text.replace(/[a-z]/g, (ch) => ch.toUpperCase());
}

function formatDateYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateYmd(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export default function DriverRegisterScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const route = useRoute<RouteProp<AuthStackParamList, 'Register'>>();
  const { loginWithPhone } = useDriverAuth();

  const [displayName, setDisplayName] = useState('');
  const [workPhone, setWorkPhone] = useState(() =>
    formatHongKongPhoneInputValue(route.params?.phone ?? ''),
  );
  const [offDutyPhone, setOffDutyPhone] = useState('');
  const [licenseMain, setLicenseMain] = useState('');
  const [licenseCheck, setLicenseCheck] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehiclePlateExpiry, setVehiclePlateExpiry] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [firstRegistrationDate, setFirstRegistrationDate] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [licenseUri, setLicenseUri] = useState<string | null>(null);
  const [driverCertUri, setDriverCertUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickDocumentImage = async (kind: '行車證' | '司機證', onPicked: (uri: string) => void) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('需要權限', `請允許存取相簿以上傳${kind}。`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      onPicked(result.assets[0].uri);
    }
  };

  const validateForm = (): string | null => {
    if (!displayName.trim()) return '請輸入名字';
    const workErr = validateHongKongPhoneField('開工電話', workPhone);
    if (workErr) return workErr;
    const offErr = validateHongKongPhoneField('收工電話', offDutyPhone);
    if (offErr) return offErr;
    if (toE164HongKong(workPhone) === toE164HongKong(offDutyPhone)) {
      return '收工電話不可與開工電話相同';
    }
    const licenseErr = validateHongKongIdentityNumberPartsField('執照號碼', licenseMain, licenseCheck);
    if (licenseErr) return licenseErr;
    if (!vehiclePlate.trim()) return '請輸入車牌號碼';
    if (!vehiclePlateExpiry.trim()) return '請選擇車牌到期日';
    if (!vehicleModel.trim()) return '請選擇車型';
    if (!firstRegistrationDate.trim()) return '請選擇首次登記日期';
    if (!bankName.trim()) return '請選擇銀行';
    const bankAccErr = validateHongKongBankAccountNumberField('銀行戶口號碼', bankAccountNumber);
    if (bankAccErr) return bankAccErr;
    if (!licenseUri) return '請上傳行車證';
    if (!driverCertUri) return '請上傳司機證';
    return null;
  };

  const submit = async () => {
    setError(null);
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      Alert.alert('請檢查資料', validationError);
      return;
    }
    setLoading(true);
    try {
      const phone = toE164HongKong(workPhone);
      const offE164 = toE164HongKong(offDutyPhone);
      const phoneCheck = await checkRegisterPhones(phone, offE164);
      if (!phoneCheck.available) {
        const msg = phoneCheck.message ?? '電話已被登記';
        setError(msg);
        Alert.alert('無法註冊', msg);
        return;
      }
      const licenseParsed = parseHongKongIdentityNumberParts(licenseMain, licenseCheck);
      if (!licenseParsed.ok) {
        const msg =
          validateHongKongIdentityNumberPartsField('執照號碼', licenseMain, licenseCheck) ??
          '執照號碼格式不正確';
        setError(msg);
        Alert.alert('請檢查資料', msg);
        return;
      }
      const { driver, promoApplied, promoRejectReason } = await registerDriver({
        phone,
        offDutyPhone: offE164,
        displayName: displayName.trim(),
        licenseNumber: licenseParsed.normalized,
        vehiclePlate: vehiclePlate.trim(),
        vehiclePlateExpiry: vehiclePlateExpiry.trim(),
        vehicleModel: vehicleModel.trim(),
        firstRegistrationDate: firstRegistrationDate.trim(),
        bankName: bankName.trim(),
        bankAccountNumber: bankAccountNumber.replace(/\s+/g, '').replace(/-/g, ''),
        promoCode: promoCode.trim() || undefined,
      });
      const uploadFailures: string[] = [];
      try {
        await uploadDriverDocument(driver.id, 'driving_license', licenseUri!);
      } catch {
        uploadFailures.push('行車證');
      }
      try {
        await uploadDriverDocument(driver.id, 'driver_id', driverCertUri!);
      } catch {
        uploadFailures.push('司機證');
      }
      if (uploadFailures.length > 0) {
        Alert.alert(
          '提示',
          `註冊成功，但${uploadFailures.join('、')}上傳失敗，請於 App 主畫面「補交證件」重試。`,
        );
      }
      await saveRememberPhone(workPhone);
      await loginWithPhone(phone);
      const promoNote = promoApplied
        ? '優惠碼已套用。'
        : promoRejectReason
          ? `${promoRejectReason} `
          : '';
      Alert.alert(
        '已提交註冊',
        `${promoNote}管理員審批後方可接柯打、出貨及上線。`,
      );
    } catch (e) {
      const raw = e instanceof Error ? e.message : '註冊失敗';
      setError(parseApiError(raw));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => navigation.goBack()} style={styles.backLink}>
            <Text style={styles.backText}>← 返回登入</Text>
          </Pressable>
          <Text style={styles.title}>司機登記</Text>
          <Text style={styles.sub}>開工電話會顯示予乘客；提交後須待 CRM 審批。</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Field
            label="名字 *"
            value={displayName}
            onChangeText={(v) => setDisplayName(uppercaseLatin(v))}
          />
          <Field
            label="開工電話（顯示給乘客）*"
            value={workPhone}
            onChangeText={setWorkPhone}
            keyboardType="phone-pad"
            placeholder="8 位數字"
          />
          <Field
            label="收工電話 *"
            value={offDutyPhone}
            onChangeText={setOffDutyPhone}
            keyboardType="phone-pad"
            placeholder="8 位數字"
          />
          <Text style={styles.label}>執照號碼 *</Text>
          <View style={styles.licenseRow}>
            <TextInput
              style={[styles.input, styles.licenseMainInput]}
              value={licenseMain}
              onChangeText={(v) =>
                setLicenseMain(uppercaseLatin(v).replace(/[^A-Z0-9]/g, '').slice(0, 8))
              }
              placeholder="S123456"
              placeholderTextColor="#666"
              autoCapitalize="characters"
              maxLength={8}
            />
            <Text style={styles.licenseParen}>(</Text>
            <TextInput
              style={[styles.input, styles.licenseCheckInput]}
              value={licenseCheck}
              onChangeText={(v) =>
                setLicenseCheck(uppercaseLatin(v).replace(/[^0-9A-Z]/g, '').slice(0, 1))
              }
              placeholder="1"
              placeholderTextColor="#666"
              autoCapitalize="characters"
              maxLength={1}
            />
            <Text style={styles.licenseParen}>)</Text>
          </View>
          <Text style={styles.licenseHint}>
            主號：英文字母 + 6 位數字；括號內為驗證碼（0–9 或 A–Z，小寫會自動轉大寫）
          </Text>
          <Field
            label="車牌號碼 *"
            value={vehiclePlate}
            onChangeText={(v) => setVehiclePlate(uppercaseLatin(v))}
            autoCapitalize="characters"
          />
          <DateField label="車牌到期日 *" value={vehiclePlateExpiry} onChange={setVehiclePlateExpiry} />
          <VehicleModelField label="車型 *" value={vehicleModel} onChange={setVehicleModel} />
          <DateField label="首次登記 *" value={firstRegistrationDate} onChange={setFirstRegistrationDate} />

          <BankSelectField label="銀行 *" value={bankName} onChange={setBankName} />
          <Field
            label="銀行戶口號碼 *"
            value={bankAccountNumber}
            onChangeText={(v) => setBankAccountNumber(v.replace(/[^\d\s-]/g, ''))}
            keyboardType="number-pad"
            placeholder="6–20 位數字"
            maxLength={24}
          />

          <DocumentUploadField
            label="行車證"
            uri={licenseUri}
            onPick={() => void pickDocumentImage('行車證', setLicenseUri)}
          />
          <DocumentUploadField
            label="司機證"
            uri={driverCertUri}
            onPick={() => void pickDocumentImage('司機證', setDriverCertUri)}
          />

          <Field
            label="優惠碼"
            value={promoCode}
            onChangeText={(v) => setPromoCode(uppercaseLatin(v))}
            autoCapitalize="characters"
          />

          <Pressable style={styles.primaryBtn} onPress={() => void submit()} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.primaryText}>註冊</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DocumentUploadField({
  label,
  uri,
  onPick,
}: {
  label: string;
  uri: string | null;
  onPick: () => void;
}) {
  return (
    <>
      <Text style={styles.label}>{label} *</Text>
      <Pressable
        style={[styles.uploadBox, uri ? styles.uploadBoxFilled : null]}
        onPress={onPick}
      >
        {uri ? (
          <Image source={{ uri }} style={styles.uploadPreview} resizeMode="cover" />
        ) : (
          <View style={styles.uploadPlaceholder}>
            <Ionicons name="cloud-upload-outline" size={36} color={colors.brandYellow} />
            <Text style={styles.uploadBtnText}>檔案上傳</Text>
            <Text style={styles.uploadSub}>點擊從相簿選擇圖片</Text>
          </View>
        )}
      </Pressable>
      {uri ? (
        <Pressable onPress={onPick} style={styles.changeFileLink}>
          <Text style={styles.changeFileText}>更換檔案</Text>
        </Pressable>
      ) : null}
    </>
  );
}

function BankSelectField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? HK_LICENSED_BANK_NAMES.filter((name) => name.includes(query.trim()))
    : HK_LICENSED_BANK_NAMES;

  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.dateInput} onPress={() => setOpen(true)}>
        <Text style={[styles.dateInputText, !value && styles.datePlaceholder]} numberOfLines={2}>
          {value || '請選擇銀行'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} style={styles.selectChevron} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        supportedOrientations={MODAL_SUPPORTED_ORIENTATIONS}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.bankModalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>選擇銀行</Text>
            <TextInput
              style={styles.bankSearchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="搜尋銀行名稱"
              placeholderTextColor="#666"
              autoCorrect={false}
            />
            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              style={styles.bankList}
              ListEmptyComponent={
                <Text style={styles.bankEmpty}>沒有相符銀行</Text>
              }
              renderItem={({ item }) => {
                const selected = value === item;
                return (
                  <Pressable
                    style={[styles.modalOption, selected && styles.modalOptionSelected]}
                    onPress={() => {
                      onChange(item);
                      setQuery('');
                      setOpen(false);
                    }}
                  >
                    <Text
                      style={[styles.modalOptionText, selected && styles.modalOptionTextSelected]}
                    >
                      {item}
                    </Text>
                    {selected ? (
                      <Ionicons name="checkmark" size={20} color={colors.brandYellow} />
                    ) : null}
                  </Pressable>
                );
              }}
            />
            <Pressable
              style={styles.modalCancel}
              onPress={() => {
                setQuery('');
                setOpen(false);
              }}
            >
              <Text style={styles.modalCancelText}>取消</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function VehicleModelField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.dateInput} onPress={() => setOpen(true)}>
        <Text style={[styles.dateInputText, !value && styles.datePlaceholder]}>
          {value || '請選擇車型'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} style={styles.selectChevron} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        supportedOrientations={MODAL_SUPPORTED_ORIENTATIONS}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>選擇車型</Text>
            {VEHICLE_MODEL_OPTIONS.map((option) => {
              const selected = value === option;
              return (
                <Pressable
                  key={option}
                  style={[styles.modalOption, selected && styles.modalOptionSelected]}
                  onPress={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, selected && styles.modalOptionTextSelected]}>
                    {option}
                  </Text>
                  {selected ? <Ionicons name="checkmark" size={20} color={colors.brandYellow} /> : null}
                </Pressable>
              );
            })}
            <Pressable style={styles.modalCancel} onPress={() => setOpen(false)}>
              <Text style={styles.modalCancelText}>取消</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  const pickerDate = parseDateYmd(value);

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
    }
    if (event.type === 'dismissed') {
      return;
    }
    if (selected) {
      onChange(formatDateYmd(selected));
    }
  };

  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.dateInput} onPress={() => setShow(true)}>
        <Text style={[styles.dateInputText, !value && styles.datePlaceholder]}>
          {value || '選擇日期'}
        </Text>
      </Pressable>
      {show && Platform.OS === 'ios' ? (
        <View style={styles.iosPickerWrap}>
          <DateTimePicker
            value={pickerDate}
            mode="date"
            display="spinner"
            locale="zh-Hant"
            onChange={onPickerChange}
          />
          <Pressable style={styles.dateDoneBtn} onPress={() => setShow(false)}>
            <Text style={styles.dateDoneText}>完成</Text>
          </Pressable>
        </View>
      ) : null}
      {show && Platform.OS === 'android' ? (
        <DateTimePicker value={pickerDate} mode="date" display="default" onChange={onPickerChange} />
      ) : null}
    </>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'phone-pad' | 'number-pad' | 'default';
  autoCapitalize?: 'none' | 'characters';
  maxLength?: number;
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#666"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'none'}
        maxLength={maxLength ?? (keyboardType === 'phone-pad' ? 11 : undefined)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  backLink: { marginBottom: 12 },
  backText: { color: colors.brandYellow, fontSize: 15 },
  title: { color: colors.brandYellow, fontSize: 24, fontWeight: '900', marginBottom: 8 },
  sub: { color: colors.textMuted, marginBottom: 20, lineHeight: 20 },
  label: { color: colors.textMuted, marginBottom: 8, fontSize: 13 },
  licenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  licenseMainInput: { flex: 1, marginBottom: 0 },
  licenseCheckInput: {
    width: 52,
    marginBottom: 0,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  licenseParen: { color: colors.textMuted, fontSize: 18, fontWeight: '600' },
  licenseHint: { color: colors.textMuted, fontSize: 12, marginBottom: 14, lineHeight: 18 },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  dateInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectChevron: { marginLeft: 8 },
  dateInputText: { color: colors.text, fontSize: 16 },
  datePlaceholder: { color: '#888' },
  iosPickerWrap: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    marginBottom: 14,
    overflow: 'hidden',
  },
  dateDoneBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dateDoneText: { color: colors.brandYellow, fontWeight: '700', fontSize: 16 },
  uploadBox: {
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.brandYellow,
    backgroundColor: colors.surfaceElevated,
    marginBottom: 8,
    overflow: 'hidden',
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBoxFilled: {
    borderStyle: 'solid',
    borderColor: colors.border,
  },
  uploadPlaceholder: {
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  uploadBtnText: { color: colors.text, fontSize: 17, fontWeight: '700' },
  uploadSub: { color: colors.textMuted, fontSize: 13 },
  uploadPreview: {
    width: '100%',
    height: 200,
  },
  changeFileLink: {
    alignSelf: 'flex-end',
    marginBottom: 14,
  },
  changeFileText: { color: colors.brandYellow, fontSize: 14, fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalOptionSelected: {
    backgroundColor: 'rgba(247, 58, 11, 0.08)',
    borderRadius: 8,
    marginHorizontal: -4,
    paddingHorizontal: 8,
  },
  modalOptionText: { color: colors.text, fontSize: 16 },
  modalOptionTextSelected: { fontWeight: '700', color: colors.brandYellow },
  modalCancel: { marginTop: 12, alignItems: 'center', paddingVertical: 12 },
  modalCancelText: { color: colors.textMuted, fontSize: 16 },
  bankModalSheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    maxHeight: '85%',
  },
  bankSearchInput: {
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  bankList: { maxHeight: 420 },
  bankEmpty: {
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 15,
  },
  primaryBtn: {
    backgroundColor: colors.brandYellow,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryText: { color: colors.onPrimary, fontWeight: '800', fontSize: 17 },
  error: { color: colors.danger, marginBottom: 12, lineHeight: 20 },
});
