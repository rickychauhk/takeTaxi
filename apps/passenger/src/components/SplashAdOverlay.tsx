import {
  Image,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useModalOverlayInsets } from './ScreenSafeArea';
import { useI18n } from '../i18n/I18nProvider';

type Props = {
  visible: boolean;
  imageUrl: string;
  onClose: () => void;
  onPressCover: () => void;
};

export function SplashAdOverlay({ visible, imageUrl, onClose, onPressCover }: Props) {
  const { t } = useI18n();
  const closeInset = useModalOverlayInsets();
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.root}>
        <Pressable style={styles.coverPress} onPress={onPressCover} accessibilityRole="button">
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        </Pressable>
        <View style={[styles.closeWrap, closeInset]} pointerEvents="box-none">
          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('ads.closeA11y')}
            hitSlop={12}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  coverPress: { flex: 1 },
  image: { width: '100%', height: '100%' },
  closeWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    alignItems: 'flex-end',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  closeIcon: { color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 20 },
});
