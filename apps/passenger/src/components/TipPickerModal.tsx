import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { TIP_AMOUNT_OPTIONS } from '../constants/tipOptions';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n/I18nProvider';

const ITEM_HEIGHT = 48;
const VISIBLE_ROWS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;

type Props = {
  visible: boolean;
  initialAmount: number;
  onCancel: () => void;
  onConfirm: (amountHkd: number) => void;
};

function indexForAmount(amount: number): number {
  const idx = TIP_AMOUNT_OPTIONS.indexOf(amount);
  if (idx >= 0) return idx;
  const clamped = Math.max(0, Math.min(500, Math.round(amount / 10) * 10));
  return TIP_AMOUNT_OPTIONS.indexOf(clamped);
}

export function TipPickerModal({ visible, initialAmount, onCancel, onConfirm }: Props) {
  const { t } = useI18n();
  const scrollRef = useRef<ScrollView>(null);
  const [selectedIndex, setSelectedIndex] = useState(() => indexForAmount(initialAmount));

  useEffect(() => {
    if (!visible) return;
    const idx = indexForAmount(initialAmount);
    setSelectedIndex(idx);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
    });
  }, [visible, initialAmount]);

  const syncIndexFromOffset = (y: number) => {
    const idx = Math.round(y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(TIP_AMOUNT_OPTIONS.length - 1, idx));
    setSelectedIndex(clamped);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    syncIndexFromOffset(e.nativeEvent.contentOffset.y);
  };

  const pad = ((VISIBLE_ROWS - 1) / 2) * ITEM_HEIGHT;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={styles.sheet}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('tip.title')}</Text>
          <Text style={styles.currency}>{t('tip.currency')}</Text>
        </View>

        <View style={[styles.pickerWrap, { height: PICKER_HEIGHT }]}>
          <View style={[styles.selectionBand, { top: pad }]} pointerEvents="none" />
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_HEIGHT}
            decelerationRate="fast"
            onMomentumScrollEnd={onScrollEnd}
            onScrollEndDrag={onScrollEnd}
            onScroll={(e) => syncIndexFromOffset(e.nativeEvent.contentOffset.y)}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingVertical: pad }}
          >
            {TIP_AMOUNT_OPTIONS.map((amount, index) => {
              const selected = index === selectedIndex;
              return (
                <View key={amount} style={[styles.item, { height: ITEM_HEIGHT }]}>
                  <Text style={[styles.itemText, selected && styles.itemTextSelected]}>{amount}</Text>
                </View>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>{t('tip.cancel')}</Text>
          </Pressable>
          <Pressable
            style={styles.confirmBtn}
            onPress={() => onConfirm(TIP_AMOUNT_OPTIONS[selectedIndex] ?? 0)}
          >
            <Text style={styles.confirmBtnText}>{t('tip.confirm')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 8,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#111' },
  currency: { fontSize: 16, fontWeight: '600', color: '#999' },
  pickerWrap: { position: 'relative', marginVertical: 8 },
  selectionBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(245, 197, 24, 0.22)',
    borderRadius: 8,
    zIndex: 0,
  },
  item: { alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  itemText: { fontSize: 20, color: '#bbb', fontWeight: '500' },
  itemTextSelected: { fontSize: 26, color: '#111', fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.brandYellow,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  cancelBtnText: { fontSize: 17, fontWeight: '700', color: '#111' },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: colors.brandYellow,
    alignItems: 'center',
  },
  confirmBtnText: { fontSize: 17, fontWeight: '800', color: colors.onPrimary },
});
