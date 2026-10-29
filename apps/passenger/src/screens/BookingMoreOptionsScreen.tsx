import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScreenSafeArea } from '../components/ScreenSafeArea';
import {
  fetchBookingOptions,
  type BookingOptionCategoryDto,
  type BookingOptionDto,
} from '../api/bookingOptions';
import { BookingOptionIcon } from '../components/BookingOptionIcon';
import { ScheduleTimePickerModal } from '../components/ScheduleTimePickerModal';
import { formatScheduleDisplay } from '../datetime/hkScheduleTime';
import { isHarbourTunnelId, type PassengerAutoTipHkdPublic } from '@taxima/shared';
import {
  autoTipHkdForBookingOption,
  optionTriggersAutoTipPicker,
} from '../booking/passengerAutoTipApply';
import { formatHkd } from '../pricing/urbanTaxiFare';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n/I18nProvider';
import { getAppLocale } from '../i18n';

export type BookingExtrasSelection = {
  selectedOptionIds: number[];
  remark: string;
  scheduledAt: string | null;
};

type Props = {
  initialSelection: BookingExtrasSelection;
  tipEnabled: boolean;
  tipAmountHkd: number;
  onBack: () => void;
  onConfirm: (selection: BookingExtrasSelection) => void;
  onPressRegular: () => void;
  onPressTip: () => void;
  autoTipConfig: PassengerAutoTipHkdPublic;
  onOpenTipPicker: (seedHkd: number) => void;
};

function optionLabel(o: BookingOptionDto, locale: ReturnType<typeof getAppLocale>) {
  return locale === 'en' ? o.labelEn : o.labelZh;
}

function categoryLabel(c: BookingOptionCategoryDto, locale: ReturnType<typeof getAppLocale>) {
  return locale === 'en' ? c.labelEn : c.labelZh;
}

export default function BookingMoreOptionsScreen({
  initialSelection,
  tipEnabled,
  tipAmountHkd,
  onBack,
  onConfirm,
  onPressRegular,
  onPressTip,
  autoTipConfig,
  onOpenTipPicker,
}: Props) {
  const { t, locale } = useI18n();
  const appLocale = getAppLocale();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<BookingOptionCategoryDto[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>(initialSelection.selectedOptionIds);
  const [remark, setRemark] = useState(initialSelection.remark);
  const [scheduledAt, setScheduledAt] = useState<string | null>(initialSelection.scheduledAt ?? null);
  const [schedulePickerVisible, setSchedulePickerVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchBookingOptions().then((data) => {
      if (cancelled) return;
      setCategories(data.categories);
      if (selectedIds.length === 0) {
        const now = data.categories
          .find((c) => c.code === 'booking_time')
          ?.options.find((o) => o.code === 'now');
        if (now) setSelectedIds([now.id]);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const preferenceCategories = useMemo(
    () => categories.filter((c) => c.screenGroup === 'preferences'),
    [categories],
  );
  const extraCategories = useMemo(
    () => categories.filter((c) => c.screenGroup === 'extras'),
    [categories],
  );

  const bookingTimeCategory = useMemo(
    () => categories.find((c) => c.code === 'booking_time'),
    [categories],
  );
  const nowOption = bookingTimeCategory?.options.find((o) => o.code === 'now');
  const scheduledOption = bookingTimeCategory?.options.find((o) => o.code === 'scheduled');

  const selectNowTime = () => {
    setScheduledAt(null);
    if (!bookingTimeCategory || !nowOption) return;
    const inCat = bookingTimeCategory.options.map((o) => o.id);
    setSelectedIds((prev) => {
      const withoutCat = prev.filter((id) => !inCat.includes(id));
      return [...withoutCat, nowOption.id];
    });
  };

  const openSchedulePicker = () => {
    if (!bookingTimeCategory || !scheduledOption) return;
    const inCat = bookingTimeCategory.options.map((o) => o.id);
    setSelectedIds((prev) => {
      const withoutCat = prev.filter((id) => !inCat.includes(id));
      return [...withoutCat, scheduledOption.id];
    });
    setSchedulePickerVisible(true);
  };

  const toggleOption = (category: BookingOptionCategoryDto, option: BookingOptionDto) => {
    if (category.code === 'booking_time') {
      if (option.code === 'now') {
        selectNowTime();
        return;
      }
      if (option.code === 'scheduled') {
        openSchedulePicker();
        return;
      }
    }
    const optionId = option.id;
    const inCat = category.options.map((o) => o.id);
    const isOn = selectedIds.includes(optionId);
    const turningOn = !isOn;

    setSelectedIds((prev) => {
      const wasOn = prev.includes(optionId);
      if (isHarbourTunnelId(option.code)) {
        const harbourOptionIds = categories
          .flatMap((c) => c.options)
          .filter((o) => isHarbourTunnelId(o.code))
          .map((o) => o.id);
        const withoutHarbour = prev.filter((id) => !harbourOptionIds.includes(id));
        return wasOn ? withoutHarbour : [...withoutHarbour, optionId];
      }
      if (category.selectionMode === 'multi') {
        return wasOn ? prev.filter((id) => id !== optionId) : [...prev, optionId];
      }
      const withoutCat = prev.filter((id) => !inCat.includes(id));
      return wasOn ? withoutCat : [...withoutCat, optionId];
    });

    if (turningOn && optionTriggersAutoTipPicker(option)) {
      const seed = Math.max(0, Math.round(autoTipHkdForBookingOption(autoTipConfig, option)));
      queueMicrotask(() => onOpenTipPicker(seed > 0 ? seed : 10));
    }
  };

  const tipChipSelected = tipEnabled && tipAmountHkd > 0;
  const regularChipSelected = !tipChipSelected;

  const tipLabel = tipChipSelected
    ? t('review.tipWithAmount', { amount: formatHkd(tipAmountHkd) })
    : t('review.tip');

  const renderCategoryRow = (cat: BookingOptionCategoryDto) => (
    <View key={cat.id} style={styles.categoryBlock}>
      <Text style={styles.categoryLabel}>{categoryLabel(cat, appLocale)}</Text>
      <View style={styles.optionsCol}>
        <View style={styles.optionsRow}>
        {cat.options.map((opt) => {
          const selected = selectedIds.includes(opt.id);
          const label = optionLabel(opt, appLocale);
          if (cat.displayStyle === 'chip') {
            return (
              <Pressable key={opt.id} onPress={() => toggleOption(cat, opt)}>
                <BookingOptionIcon variant="chip" iconKey={opt.iconKey} label={label} selected={selected} />
              </Pressable>
            );
          }
          return (
            <Pressable
              key={opt.id}
              style={[styles.iconOption, selected && styles.iconOptionSelected]}
              onPress={() => toggleOption(cat, opt)}
            >
              <BookingOptionIcon
                variant={cat.displayStyle === 'tunnel' ? 'tunnel' : 'vehicle'}
                iconKey={opt.iconKey}
                label={label}
                selected={selected}
              />
              <Text style={[styles.iconLabel, selected && styles.iconLabelSelected]} numberOfLines={2}>
                {label}
              </Text>
            </Pressable>
          );
        })}
        </View>
        {cat.code === 'booking_time' && scheduledAt ? (
          <Text style={styles.scheduledTimeText}>
            {t('review.scheduledAt', {
              time: formatScheduleDisplay(scheduledAt, locale === 'en' ? 'en' : 'zh-Hant'),
            })}
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <ScreenSafeArea style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.title}>{t('moreOptions.title')}</Text>
          <View style={styles.backBtn} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.brandYellow} size="large" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {preferenceCategories.map(renderCategoryRow)}

            <Text style={styles.sectionHeading}>{t('moreOptions.priceSection')}</Text>
            <View style={styles.priceRow}>
              <Pressable
                style={[styles.priceChip, regularChipSelected && styles.priceChipOn]}
                onPress={onPressRegular}
              >
                <Text style={styles.priceChipIcon}>💵</Text>
                <Text style={[styles.priceChipText, regularChipSelected && styles.priceChipTextOn]}>
                  {t('review.regularPrice')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.priceChip, tipChipSelected && styles.priceChipOn]}
                onPress={onPressTip}
              >
                <Text style={styles.priceChipIcon}>🐷</Text>
                <Text style={[styles.priceChipText, tipChipSelected && styles.priceChipTextOn]}>
                  {tipLabel}
                </Text>
              </Pressable>
            </View>

            {extraCategories.map(renderCategoryRow)}

            <Text style={styles.remarkLabel}>{t('moreOptions.remarkLabel')}</Text>
            <Text style={styles.remarkHint}>{t('moreOptions.remarkHint')}</Text>
            <TextInput
              style={styles.remarkInput}
              placeholder={t('moreOptions.remarkPlaceholder')}
              placeholderTextColor="#666"
              value={remark}
              onChangeText={setRemark}
              multiline
            />
          </ScrollView>
        )}

        <View style={styles.footer}>
          <Pressable
            style={styles.confirmBtn}
            onPress={() => {
              if (scheduledOption && selectedIds.includes(scheduledOption.id) && !scheduledAt) {
                openSchedulePicker();
                return;
              }
              onConfirm({
                selectedOptionIds: selectedIds,
                remark: remark.trim(),
                scheduledAt,
              });
            }}
          >
            <Text style={styles.confirmBtnText}>{t('moreOptions.confirm')}</Text>
          </Pressable>
        </View>
      </ScreenSafeArea>
      <ScheduleTimePickerModal
        visible={schedulePickerVisible}
        initialIso={scheduledAt}
        onCancel={() => {
          setSchedulePickerVisible(false);
          if (!scheduledAt) selectNowTime();
        }}
        onConfirm={(iso) => {
          setScheduledAt(iso);
          setSchedulePickerVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mapDark },
  safe: { flex: 1 },
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
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 16, paddingBottom: 24 },
  categoryBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 20,
    gap: 12,
  },
  categoryLabel: {
    width: 56,
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
    paddingTop: 8,
  },
  optionsCol: { flex: 1, gap: 6 },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  scheduledTimeText: { color: colors.brandYellow, fontSize: 13, fontWeight: '600', marginLeft: 4 },
  iconOption: {
    width: 72,
    alignItems: 'center',
    gap: 6,
  },
  iconOptionSelected: {},
  iconLabel: { color: '#aaa', fontSize: 11, textAlign: 'center' },
  iconLabelSelected: { color: colors.brandYellow, fontWeight: '600' },
  sectionHeading: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 28,
    marginBottom: 12,
  },
  priceRow: { flexDirection: 'row', gap: 12 },
  priceChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.brandYellow,
  },
  priceChipOn: { backgroundColor: 'rgba(245,197,24,0.12)' },
  priceChipIcon: { fontSize: 18 },
  priceChipText: { color: '#eee', fontSize: 15, fontWeight: '700' },
  priceChipTextOn: { color: colors.brandYellow },
  remarkLabel: { color: '#eee', fontSize: 15, marginTop: 28, fontWeight: '600' },
  remarkHint: { color: '#888', fontSize: 12, marginTop: 4, lineHeight: 16 },
  remarkInput: {
    marginTop: 10,
    minHeight: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#444',
    padding: 12,
    color: '#fff',
    fontSize: 15,
    textAlignVertical: 'top',
  },
  footer: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8 },
  confirmBtn: {
    backgroundColor: colors.brandYellow,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnText: { fontSize: 18, fontWeight: '800', color: colors.onPrimary },
});
