import Constants from 'expo-constants';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenSafeArea } from './ScreenSafeArea';
import { useI18n } from '../i18n/I18nProvider';
import type { PassengerMemberProfile } from '../api/passengerProfile';
import type { TranslationKey } from '../i18n';
import { formatHongKongPhoneDisplay } from '@taxima/shared';
import { colors } from '../theme/colors';

type MenuKey =
  | 'call'
  | 'records'
  | 'messages'
  | 'feedback'
  | 'contactUs'
  | 'rideTips'
  | 'lostProperty'
  | 'shareFriend'
  | 'shareDriver';

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onMenuItem?: (key: MenuKey) => void;
  memberProfile?: PassengerMemberProfile | null;
  memberLoading?: boolean;
};

const MENU_ITEMS: { key: MenuKey; icon: string; labelKey: TranslationKey }[] = [
  { key: 'call', icon: '➰', labelKey: 'menu.callTaxi' },
  { key: 'records', icon: '↻', labelKey: 'menu.records' },
  { key: 'messages', icon: '✉', labelKey: 'menu.messages' },
  { key: 'feedback', icon: '✎', labelKey: 'menu.feedback' },
  { key: 'contactUs', icon: '☎', labelKey: 'menu.contactUs' },
  { key: 'rideTips', icon: '📖', labelKey: 'menu.rideTips' },
  { key: 'lostProperty', icon: '🔎', labelKey: 'menu.lostProperty' },
  { key: 'shareFriend', icon: '⎘', labelKey: 'menu.shareFriend' },
  { key: 'shareDriver', icon: '⎘', labelKey: 'menu.shareDriver' },
];

export function PassengerMenuDrawer({
  visible,
  onClose,
  onOpenSettings,
  onMenuItem,
  memberProfile,
  memberLoading,
}: Props) {
  const { t } = useI18n();
  const userId = memberLoading ? '…' : (memberProfile?.id ?? '—');
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('menu.close')} />
        <View style={styles.panel}>
          <ScreenSafeArea style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarIcon}>👤</Text>
              </View>
              <Text style={styles.userIdLine}>
                {t('menu.userId')}: {userId}
              </Text>
              {memberProfile?.phone ? (
                <Text style={styles.userIdLine}>
                  {t('menu.memberPhone')}: {formatHongKongPhoneDisplay(memberProfile.phone)}
                </Text>
              ) : null}
              <Pressable
                style={styles.settingsPill}
                onPress={() => {
                  onClose();
                  onOpenSettings();
                }}
              >
                <Text style={styles.settingsGear}>⚙</Text>
                <Text style={styles.settingsPillText}>{t('menu.settings')}</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
              {MENU_ITEMS.map((item) => (
                <Pressable
                  key={item.key}
                  style={styles.menuRow}
                  onPress={() => {
                    onClose();
                    if (item.key === 'call') return;
                    onMenuItem?.(item.key);
                  }}
                >
                  <Text style={styles.menuIcon}>{item.icon}</Text>
                  <Text style={styles.menuLabel}>{t(item.labelKey)}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.version}>
              {t('menu.appVersion')}: {version}
            </Text>
          </ScreenSafeArea>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  panel: {
    width: '82%',
    maxWidth: 340,
    backgroundColor: colors.panelBgSolid,
    height: '100%',
  },
  safe: { flex: 1 },
  profileHeader: {
    backgroundColor: colors.brandYellow,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarIcon: { fontSize: 28 },
  userIdLine: { color: colors.onPrimary, fontSize: 15, fontWeight: '700' },
  settingsPill: {
    marginTop: 16,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.onPrimary,
    backgroundColor: 'transparent',
  },
  settingsGear: { fontSize: 18, color: colors.onPrimary },
  settingsPillText: { fontSize: 16, fontWeight: '800', color: colors.onPrimary },
  menuScroll: { flex: 1 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a2a',
  },
  menuIcon: { width: 28, textAlign: 'center', color: '#eee', fontSize: 18 },
  menuLabel: { flex: 1, color: '#f0f0f0', fontSize: 16, fontWeight: '600' },
  version: { color: '#666', fontSize: 12, padding: 16, textAlign: 'center' },
});
