import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  defaultScheduleParts,
  SCHEDULE_MINUTE_STEPS,
  schedulePartsFromIso,
  schedulePartsToIso,
  type ScheduleDayOffset,
  type ScheduleParts,
} from '../datetime/hkScheduleTime';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n/I18nProvider';

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const DAY_OFFSETS: ScheduleDayOffset[] = [0, 1];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

type Props = {
  visible: boolean;
  initialIso: string | null;
  onCancel: () => void;
  onConfirm: (iso: string) => void;
};

function WheelColumn<T extends string | number>({
  items,
  selectedIndex,
  onIndexChange,
  labelFor,
}: {
  items: readonly T[];
  selectedIndex: number;
  onIndexChange: (index: number) => void;
  labelFor: (item: T) => string;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const pad = ((VISIBLE_ROWS - 1) / 2) * ITEM_HEIGHT;

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
    });
  }, [selectedIndex, items.length]);

  const sync = (y: number) => {
    const idx = Math.round(y / ITEM_HEIGHT);
    onIndexChange(Math.max(0, Math.min(items.length - 1, idx)));
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.wheelCol}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => sync(e.nativeEvent.contentOffset.y)}
      onScrollEndDrag={(e) => sync(e.nativeEvent.contentOffset.y)}
      contentContainerStyle={{ paddingVertical: pad }}
    >
      {items.map((item, index) => {
        const selected = index === selectedIndex;
        return (
          <View key={String(item)} style={[styles.item, { height: ITEM_HEIGHT }]}>
            <Text style={[styles.itemText, selected && styles.itemTextSelected]} numberOfLines={1}>
              {labelFor(item)}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

export function ScheduleTimePickerModal({ visible, initialIso, onCancel, onConfirm }: Props) {
  const { t } = useI18n();
  const [parts, setParts] = useState<ScheduleParts>(() => defaultScheduleParts());

  useEffect(() => {
    if (!visible) return;
    const fromIso = initialIso ? schedulePartsFromIso(initialIso) : null;
    setParts(fromIso ?? defaultScheduleParts());
  }, [visible, initialIso]);

  const dayIndex = DAY_OFFSETS.indexOf(parts.dayOffset);
  const hourIndex = parts.hour;
  const minuteIndex = Math.max(0, SCHEDULE_MINUTE_STEPS.indexOf(parts.minute as (typeof SCHEDULE_MINUTE_STEPS)[number]));

  const pad = useMemo(() => ((VISIBLE_ROWS - 1) / 2) * ITEM_HEIGHT, []);

  const confirm = () => {
    onConfirm(schedulePartsToIso(parts));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={styles.sheet}>
        <Text style={styles.title}>{t('schedule.title')}</Text>
        <Text style={styles.disclaimer}>{t('schedule.disclaimer')}</Text>

        <View style={[styles.pickerWrap, { height: PICKER_HEIGHT }]}>
          <View style={[styles.selectionBand, { top: pad }]} pointerEvents="none" />
          <View style={styles.wheelsRow}>
            <WheelColumn
              items={DAY_OFFSETS}
              selectedIndex={dayIndex >= 0 ? dayIndex : 0}
              onIndexChange={(idx) =>
                setParts((p) => ({ ...p, dayOffset: DAY_OFFSETS[idx] ?? 0 }))
              }
              labelFor={(d) => (d === 0 ? t('schedule.dayToday') : t('schedule.dayTomorrow'))}
            />
            <WheelColumn
              items={HOURS}
              selectedIndex={hourIndex}
              onIndexChange={(idx) => setParts((p) => ({ ...p, hour: HOURS[idx] ?? 0 }))}
              labelFor={(h) => String(h)}
            />
            <WheelColumn
              items={SCHEDULE_MINUTE_STEPS}
              selectedIndex={minuteIndex}
              onIndexChange={(idx) =>
                setParts((p) => ({ ...p, minute: SCHEDULE_MINUTE_STEPS[idx] ?? 0 }))
              }
              labelFor={(m) => String(m)}
            />
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>{t('schedule.cancel')}</Text>
          </Pressable>
          <Pressable style={styles.confirmBtn} onPress={confirm}>
            <Text style={styles.confirmBtnText}>{t('schedule.confirm')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 8 },
  disclaimer: { fontSize: 13, color: '#666', lineHeight: 18, marginBottom: 8 },
  pickerWrap: { position: 'relative', marginVertical: 4 },
  selectionBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(245, 197, 24, 0.22)',
    borderRadius: 8,
    zIndex: 0,
  },
  wheelsRow: { flexDirection: 'row', zIndex: 1 },
  wheelCol: { flex: 1 },
  item: { alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 18, color: '#bbb', fontWeight: '500' },
  itemTextSelected: { fontSize: 22, color: '#111', fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
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
