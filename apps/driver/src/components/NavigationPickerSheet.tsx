import type { ComponentProps } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { openExternalMap, type ExternalMapProvider } from '../navigation/externalMaps';
import type { NavigationTarget } from '../navigation/navigationTarget';
import {
  setPreferredNavigationApp,
  type DriverNavigationChoice,
} from '../navigation/preferredNavigationApp';
import { MODAL_SUPPORTED_ORIENTATIONS } from '../constants/modalOrientations';
import { colors } from '../theme/colors';

type Props = {
  visible: boolean;
  navigationTarget: NavigationTarget;
  onClose: () => void;
  onInAppNavigate: (target: NavigationTarget) => void;
};

type Option = {
  id: 'in_app' | ExternalMapProvider;
  title: string;
  subtitle: string;
  icon: ComponentProps<typeof Ionicons>['name'];
};

const OPTIONS: Option[] = [
  {
    id: 'in_app',
    title: '應用內導航',
    subtitle: '於本 App 內開啟路線（Google 地圖網頁）',
    icon: 'phone-portrait-outline',
  },
  {
    id: 'apple',
    title: 'Apple 地圖',
    subtitle: Platform.OS === 'ios' ? '開啟 Apple Maps 導航' : '僅 iOS 可用',
    icon: 'map-outline',
  },
  {
    id: 'google',
    title: 'Google 地圖',
    subtitle: '開啟 Google Maps App',
    icon: 'logo-google',
  },
  {
    id: 'gaode',
    title: '高德地圖',
    subtitle: '開啟高德 App 導航',
    icon: 'navigate-circle-outline',
  },
];

export function NavigationPickerSheet({
  visible,
  navigationTarget: target,
  onClose,
  onInAppNavigate,
}: Props) {
  const destLine = target.coord
    ? `${target.label} (${target.coord.latitude.toFixed(4)}, ${target.coord.longitude.toFixed(4)})`
    : target.label;

  const onSelect = async (id: Option['id']) => {
    await setPreferredNavigationApp(id as DriverNavigationChoice);
    if (id === 'in_app') {
      onClose();
      onInAppNavigate(target);
      return;
    }
    if (id === 'apple' && Platform.OS !== 'ios') {
      return;
    }
    onClose();
    await openExternalMap(id, target);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={MODAL_SUPPORTED_ORIENTATIONS}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>選擇導航方式</Text>
          <Text style={styles.dest} numberOfLines={2}>
            導航至：{destLine}
          </Text>
          <Text style={styles.hint}>之後按「導航」會直接用此方式；長按「導航」可更改</Text>

          {OPTIONS.map((opt) => {
            const disabled = opt.id === 'apple' && Platform.OS !== 'ios';
            return (
              <Pressable
                key={opt.id}
                style={[styles.row, disabled && styles.rowDisabled]}
                disabled={disabled}
                onPress={() => onSelect(opt.id)}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={opt.icon} size={22} color={disabled ? colors.textMuted : colors.brandYellow} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, disabled && styles.textMuted]}>{opt.title}</Text>
                  <Text style={styles.rowSub}>{opt.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            );
          })}

          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>取消</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  dest: { color: colors.textMuted, fontSize: 13, marginBottom: 6, lineHeight: 18 },
  hint: { color: colors.textMuted, fontSize: 11, marginBottom: 14, lineHeight: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  rowDisabled: { opacity: 0.45 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rowSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  textMuted: { color: colors.textMuted },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
  },
  cancelText: { color: colors.text, fontWeight: '700', fontSize: 16 },
});
