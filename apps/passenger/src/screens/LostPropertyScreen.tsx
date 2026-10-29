import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatHongKongPhoneInputValue } from '@taxima/shared';
import {
  submitLostPropertyRequest,
  type LostPropertyImageUpload,
} from '../api/submitLostProperty';
import type { PassengerMemberProfile } from '../api/passengerProfile';
import { useModalOverlayInsets } from '../components/ScreenSafeArea';
import { useI18n } from '../i18n/I18nProvider';
import { userFacingError } from '../i18n/userFacingError';
import { colors } from '../theme/colors';

type Props = {
  visible: boolean;
  onClose: () => void;
  memberProfile: PassengerMemberProfile | null;
};

function buildLostPropertyItemName(
  typedName: string,
  seekPersonLabel: string | null,
  seekPetLabel: string | null,
): string {
  const parts: string[] = [];
  const typed = typedName.trim();
  if (typed) parts.push(typed);
  if (seekPersonLabel?.trim()) parts.push(seekPersonLabel.trim());
  if (seekPetLabel?.trim()) parts.push(seekPetLabel.trim());
  return parts.join(' · ');
}

function formatLostAtLabel(d: Date): string {
  return d.toLocaleString('zh-HK', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function LostPropertyScreen({ visible, onClose, memberProfile }: Props) {
  const { t } = useI18n();
  const headerInset = useModalOverlayInsets({ top: 4, right: 0 });
  const safeInsets = useSafeAreaInsets();
  const [itemName, setItemName] = useState('');
  const [seekPerson, setSeekPerson] = useState(false);
  const [seekPet, setSeekPet] = useState(false);
  const [description, setDescription] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [lostAt, setLostAt] = useState(() => new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [images, setImages] = useState<LostPropertyImageUpload[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setItemName('');
    setSeekPerson(false);
    setSeekPet(false);
    setDescription('');
    setContactName(memberProfile?.displayName?.trim() ?? '');
    setContactPhone(
      memberProfile?.phone?.trim() ? formatHongKongPhoneInputValue(memberProfile.phone) : '',
    );
    setLostAt(new Date());
    setImages([]);
  }, [visible, memberProfile?.displayName, memberProfile?.phone]);

  const pickImages = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('lostProperty.title'), t('lostProperty.photoPermission'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsMultipleSelection: Platform.OS === 'ios',
        selectionLimit: 6,
      });
      if (result.canceled) return;
      const picked = result.assets
        .filter((a) => a.uri)
        .map((a) => ({
          uri: a.uri,
          name: a.fileName,
          mimeType: a.mimeType ?? (a.uri.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg'),
        }));
      setImages((prev) => [...prev, ...picked].slice(0, 6));
    } catch (e) {
      Alert.alert(t('lostProperty.title'), userFacingError(e, t('lostProperty.photoPermission')));
    }
  };

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type === 'dismissed') return;
    if (selected) setLostAt(selected);
    if (Platform.OS === 'android' && pickerMode === 'date') {
      setPickerMode('time');
      setShowPicker(true);
    }
  };

  const openDateTimePicker = () => {
    setPickerMode('date');
    setShowPicker(true);
  };

  const onSubmit = async () => {
    const resolvedItemName = buildLostPropertyItemName(
      itemName,
      seekPerson ? t('lostProperty.seekPerson') : null,
      seekPet ? t('lostProperty.seekPet') : null,
    );
    if (!resolvedItemName) {
      Alert.alert(t('lostProperty.title'), t('lostProperty.itemNameRequired'));
      return;
    }
    if (!description.trim()) {
      Alert.alert(t('lostProperty.title'), t('lostProperty.descriptionRequired'));
      return;
    }
    if (!contactName.trim()) {
      Alert.alert(t('lostProperty.title'), t('lostProperty.nameRequired'));
      return;
    }
    if (!contactPhone.trim()) {
      Alert.alert(t('lostProperty.title'), t('lostProperty.phoneRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await submitLostPropertyRequest({
        itemName: resolvedItemName,
        description,
        lostAt,
        contactPhone,
        contactName,
        images,
      });
      Alert.alert(t('lostProperty.title'), t('lostProperty.submitSuccess'), [
        { text: t('common.ok'), onPress: onClose },
      ]);
    } catch (e) {
      Alert.alert(t('lostProperty.title'), userFacingError(e, t('lostProperty.submitFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" translucent backgroundColor={colors.mapDark} />
      <View style={styles.root}>
        <View
          style={[
            styles.header,
            headerInset,
            { paddingLeft: safeInsets.left + 8, paddingRight: safeInsets.right + 8 },
          ]}
        >
          <Pressable onPress={onClose} hitSlop={12} style={styles.backBtn} disabled={submitting}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.title}>{t('lostProperty.title')}</Text>
          <View style={styles.backBtn} />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={8}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              {
                paddingBottom: safeInsets.bottom + 24,
                paddingLeft: safeInsets.left + 20,
                paddingRight: safeInsets.right + 20,
              },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.hint}>{t('lostProperty.hint')}</Text>

            <Text style={styles.label}>{t('lostProperty.itemNameLabel')}</Text>
            <TextInput
              style={styles.input}
              value={itemName}
              onChangeText={setItemName}
              placeholder={t('lostProperty.itemNamePlaceholder')}
              placeholderTextColor="#666"
              editable={!submitting}
            />
            <View style={styles.seekRow}>
              <Pressable
                style={[styles.seekChip, seekPerson && styles.seekChipOn]}
                onPress={() => {
                  setSeekPerson((v) => {
                    const next = !v;
                    if (next) setSeekPet(false);
                    return next;
                  });
                }}
                disabled={submitting}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: seekPerson }}
              >
                <Text style={[styles.seekChipText, seekPerson && styles.seekChipTextOn]}>
                  {t('lostProperty.seekPerson')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.seekChip, seekPet && styles.seekChipOn]}
                onPress={() => {
                  setSeekPet((v) => {
                    const next = !v;
                    if (next) setSeekPerson(false);
                    return next;
                  });
                }}
                disabled={submitting}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: seekPet }}
              >
                <Text style={[styles.seekChipText, seekPet && styles.seekChipTextOn]}>
                  {t('lostProperty.seekPet')}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.label}>{t('lostProperty.descriptionLabel')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder={t('lostProperty.descriptionPlaceholder')}
              placeholderTextColor="#666"
              multiline
              editable={!submitting}
            />

            <Text style={styles.label}>{t('lostProperty.lostAtLabel')}</Text>
            <Pressable style={styles.dateBtn} onPress={openDateTimePicker} disabled={submitting}>
              <Text style={styles.dateBtnText}>{formatLostAtLabel(lostAt)}</Text>
            </Pressable>
            {showPicker ? (
              <DateTimePicker
                value={lostAt}
                mode={Platform.OS === 'ios' ? 'datetime' : pickerMode}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onPickerChange}
              />
            ) : null}
            {Platform.OS === 'ios' && showPicker ? (
              <Pressable style={styles.donePicker} onPress={() => setShowPicker(false)}>
                <Text style={styles.donePickerText}>{t('common.ok')}</Text>
              </Pressable>
            ) : null}

            <Text style={styles.label}>{t('lostProperty.photosLabel')}</Text>
            <Pressable style={styles.photoBtn} onPress={() => void pickImages()} disabled={submitting}>
              <Text style={styles.photoBtnText}>{t('lostProperty.addPhotos')}</Text>
            </Pressable>
            <View style={styles.photoRow}>
              {images.map((img) => (
                <Image key={img.uri} source={{ uri: img.uri }} style={styles.thumb} />
              ))}
            </View>

            <Text style={styles.label}>{t('lostProperty.nameLabel')}</Text>
            <TextInput
              style={styles.input}
              value={contactName}
              onChangeText={setContactName}
              placeholder={t('lostProperty.namePlaceholder')}
              placeholderTextColor="#666"
              editable={!submitting}
            />

            <Text style={styles.label}>{t('lostProperty.phoneLabel')}</Text>
            <TextInput
              style={styles.input}
              value={contactPhone}
              onChangeText={(v) => setContactPhone(formatHongKongPhoneInputValue(v))}
              placeholder={t('lostProperty.phonePlaceholder')}
              placeholderTextColor="#666"
              keyboardType="phone-pad"
              maxLength={8}
              editable={!submitting}
            />

            <Pressable
              style={[styles.submit, submitting && styles.submitDisabled]}
              onPress={() => void onSubmit()}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#111" />
              ) : (
                <Text style={styles.submitText}>{t('lostProperty.submit')}</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mapDark },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: colors.brandYellow, fontSize: 28, fontWeight: '600' },
  title: { color: colors.brandYellow, fontSize: 18, fontWeight: '700' },
  scroll: { paddingTop: 8 },
  hint: { color: '#aaa', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  label: { color: '#ccc', fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
  },
  seekRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  seekChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#555',
    alignItems: 'center',
  },
  seekChipOn: { borderColor: colors.brandYellow, backgroundColor: 'rgba(247,58,11,0.12)' },
  seekChipText: { color: '#ccc', fontSize: 16, fontWeight: '700' },
  seekChipTextOn: { color: colors.brandYellow },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  dateBtn: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dateBtnText: { color: '#fff', fontSize: 16 },
  donePicker: { alignSelf: 'flex-end', paddingVertical: 8 },
  donePickerText: { color: colors.brandYellow, fontWeight: '700' },
  photoBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.brandYellow,
  },
  photoBtnText: { color: colors.brandYellow, fontWeight: '700' },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#333' },
  submit: {
    marginTop: 28,
    backgroundColor: colors.brandYellow,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#111', fontSize: 17, fontWeight: '800' },
});
