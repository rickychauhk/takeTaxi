import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { useDrivingUi } from '../hooks/useDrivingUi';
import { RadarPulse } from './RadarPulse';

type Props = {
  online: boolean;
  busy?: boolean;
  onToggle: () => void;
  /** 橫屏接單大廳：右上角淨係開關 */
  compact?: boolean;
};

export function OnlineStatusBar({ online, busy, onToggle, compact }: Props) {
  const driving = useDrivingUi();

  const toggleW = Math.round(58 * driving.scale);
  const toggleH = Math.round(34 * driving.scale);
  const knobSize = Math.round(28 * driving.scale);

  if (compact) {
    return (
      <Pressable
        style={[
          styles.compactWrap,
          styles.compactSwitch,
          online ? styles.compactSwitchOn : styles.compactSwitchOff,
          busy && styles.pillBusy,
          { width: toggleW, height: toggleH },
        ]}
        onPress={onToggle}
        disabled={busy && !online}
        accessibilityRole="switch"
        accessibilityLabel={online ? '已上線，點擊收工' : '已收工，點擊上線'}
        accessibilityState={{ checked: online, busy: !!busy }}
      >
        <View
          style={[
            styles.compactTrack,
            { justifyContent: busy ? 'center' : online ? 'flex-end' : 'flex-start' },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.brandYellow} size="small" />
          ) : (
            <View
              style={[
                styles.knob,
                online && styles.knobOn,
                {
                  width: knobSize,
                  height: knobSize,
                  borderRadius: knobSize / 2,
                },
              ]}
            />
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        style={[
          styles.pill,
          online ? styles.pillOn : styles.pillOff,
          busy && styles.pillBusy,
          { minHeight: driving.touchMin + 16 },
        ]}
        onPress={onToggle}
        disabled={busy && !online}
        accessibilityRole="switch"
        accessibilityState={{ checked: online, busy: !!busy }}
      >
        <View style={styles.left}>
          {busy ? (
            <ActivityIndicator color={colors.brandYellow} style={styles.spinner} />
          ) : online ? (
            <RadarPulse />
          ) : (
            <View style={styles.dotOff} />
          )}
          <View>
            <Text style={[styles.title, { fontSize: driving.bodySize }]}>
              {busy ? '處理中…' : online ? '正在尋找乘客…' : '已收工'}
            </Text>
            <Text style={[styles.sub, { fontSize: driving.labelSize }]}>
              {busy
                ? '請稍候'
                : online
                  ? '點擊切換為收工'
                  : '點擊上線接單'}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.toggle,
            online && styles.toggleOn,
            { width: toggleW, height: toggleH },
          ]}
        >
          <View
            style={[
              styles.knob,
              online && styles.knobOn,
              {
                width: knobSize,
                height: knobSize,
                borderRadius: knobSize / 2,
              },
            ]}
          />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  pillOn: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.45)',
  },
  pillOff: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
  },
  pillBusy: { opacity: 0.85 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  spinner: { width: 44, height: 44 },
  dotOff: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.offline,
    marginHorizontal: 17,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '800', flexShrink: 1 },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2, flexShrink: 1, lineHeight: 16 },
  toggle: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#374151',
    padding: 3,
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: '#166534' },
  knob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#d1d5db',
  },
  knobOn: { alignSelf: 'flex-end', backgroundColor: '#fff' },
  compactSwitch: {
    borderRadius: 17,
    padding: 3,
    justifyContent: 'center',
    borderWidth: 1,
  },
  compactSwitchOn: {
    backgroundColor: '#166534',
    borderColor: 'rgba(34,197,94,0.55)',
  },
  compactSwitchOff: {
    backgroundColor: '#374151',
    borderColor: colors.border,
  },
  compactTrack: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactWrap: {
    marginTop: 4,
  },
});
