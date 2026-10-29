import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { isHarbourTunnelId } from '@taxima/shared';
import { fetchBookingOptions, type BookingOptionDto } from '../api/bookingOptions';
import { BookingOptionIcon } from './BookingOptionIcon';
import { getAppLocale } from '../i18n';
import { useI18n } from '../i18n/I18nProvider';
import { colors } from '../theme/colors';

type Props = {
  selectedOptionIds: number[];
  onChange?: (nextIds: number[]) => void;
  /** 等候接單時只顯示已選隧道，不可更改 */
  readOnly?: boolean;
};

function optionLabel(o: BookingOptionDto, locale: ReturnType<typeof getAppLocale>) {
  return locale === 'en' ? o.labelEn : o.labelZh;
}

/** 過海隧道（單選）；readOnly 時僅展示叫車時已選項目 */
export function WaitingHarbourTunnelPicker({ selectedOptionIds, onChange, readOnly }: Props) {
  const { t } = useI18n();
  const appLocale = getAppLocale();
  const [harbourOptions, setHarbourOptions] = useState<BookingOptionDto[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetchBookingOptions().then(({ categories }) => {
      if (cancelled) return;
      const opts = categories
        .flatMap((c) => c.options)
        .filter((o) => isHarbourTunnelId(o.code));
      setHarbourOptions(opts);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const harbourOptionIds = useMemo(() => harbourOptions.map((o) => o.id), [harbourOptions]);

  if (harbourOptions.length === 0) return null;

  const toggleHarbour = (option: BookingOptionDto) => {
    if (readOnly || !onChange) return;
    const isOn = selectedOptionIds.includes(option.id);
    const withoutHarbour = selectedOptionIds.filter((id) => !harbourOptionIds.includes(id));
    onChange(isOn ? withoutHarbour : [...withoutHarbour, option.id]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('trip.harbourTunnelRoute')}</Text>
      <View style={styles.row}>
        {harbourOptions.map((opt) => {
          const selected = selectedOptionIds.includes(opt.id);
          const label = optionLabel(opt, appLocale);
          const content = (
            <>
              <BookingOptionIcon variant="tunnel" iconKey={opt.iconKey} label={label} selected={selected} />
              <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
                {label}
              </Text>
            </>
          );
          if (readOnly) {
            return (
              <View
                key={opt.id}
                style={[styles.item, selected && styles.itemSelected, !selected && styles.itemReadOnlyDim]}
                accessibilityRole="text"
              >
                {content}
              </View>
            );
          }
          return (
            <Pressable
              key={opt.id}
              style={[styles.item, selected && styles.itemSelected]}
              onPress={() => toggleHarbour(opt)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              {content}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  title: { fontSize: 13, fontWeight: '700', color: '#666', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  item: {
    alignItems: 'center',
    width: 72,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemSelected: { borderColor: colors.brandYellow, backgroundColor: '#fffbeb' },
  itemReadOnlyDim: { opacity: 0.45 },
  label: { fontSize: 11, color: '#555', marginTop: 4, textAlign: 'center', fontWeight: '600' },
  labelSelected: { color: '#111', fontWeight: '800' },
});
