import Constants from 'expo-constants';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useModalOverlayInsets } from '../components/ScreenSafeArea';
import { LegalWebViewModal } from '../components/LegalWebViewModal';
import { useI18n } from '../i18n/I18nProvider';
import type { AppLocale } from '../i18n';
import { colors } from '../theme/colors';

type Props = {
  visible: boolean;
  onClose: () => void;
};

type LangChoice = 'system' | AppLocale;

function LanguageRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.langRow, selected && styles.langRowSelected]} onPress={onPress}>
      <Text style={[styles.langLabel, selected && styles.langLabelSelected]}>{label}</Text>
      {selected ? <Text style={styles.langCheck}>✓</Text> : null}
    </Pressable>
  );
}

export default function SettingsScreen({ visible, onClose }: Props) {
  const { t, languageMode, setLanguageMode } = useI18n();
  const headerInset = useModalOverlayInsets({ top: 4, right: 0 });
  const safeInsets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const [termsOpen, setTermsOpen] = useState(false);

  const select = (choice: LangChoice) => {
    void setLanguageMode(choice);
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
          <Pressable onPress={onClose} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.title}>{t('settings.title')}</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: safeInsets.bottom + 32, paddingLeft: safeInsets.left + 20, paddingRight: safeInsets.right + 20 },
          ]}
        >
          <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
          <LanguageRow
            label={t('settings.languageSystem')}
            selected={languageMode === 'system'}
            onPress={() => select('system')}
          />
          <LanguageRow
            label={t('settings.languageZh')}
            selected={languageMode === 'zh-Hant'}
            onPress={() => select('zh-Hant')}
          />
          <LanguageRow
            label={t('settings.languageEn')}
            selected={languageMode === 'en'}
            onPress={() => select('en')}
          />

          <Text style={[styles.sectionTitle, { marginTop: 28 }]}>{t('settings.legalSection')}</Text>
          <Pressable
            style={styles.langRow}
            onPress={() => setTermsOpen(true)}
            accessibilityRole="button"
          >
            <Text style={styles.langLabel}>{t('settings.termsTitle')}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>{t('settings.about')}</Text>
          <Text style={styles.metaLine}>
            {t('settings.appVersion')}: {version}
          </Text>
        </ScrollView>
        <LegalWebViewModal visible={termsOpen} onClose={() => setTermsOpen(false)} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mapDark },
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
  scroll: {},
  sectionTitle: { color: '#aaa', fontSize: 13, fontWeight: '600', marginBottom: 12, marginTop: 8 },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 10,
  },
  langRowSelected: { borderColor: colors.brandYellow, backgroundColor: colors.brandTintBg },
  langLabel: { color: '#eee', fontSize: 16 },
  langLabelSelected: { color: colors.brandYellow, fontWeight: '700' },
  langCheck: { color: colors.brandYellow, fontSize: 18, fontWeight: '800' },
  metaLine: { color: '#888', fontSize: 14 },
  chevron: { color: '#888', fontSize: 22, fontWeight: '300' },
});
