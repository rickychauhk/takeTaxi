import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  mode: 'loading' | 'empty';
  /** 有接單公里數設定時顯示 */
  radiusHint?: string | null;
};

/** 大廳：首次拉待派列表（loading）或已就緒但範圍內無柯打（empty） */
export function DriverHallDispatchPlaceholder({ mode, radiusHint }: Props) {
  return (
    <View style={styles.root}>
      {mode === 'loading' ? (
        <>
          <ActivityIndicator size="large" color={colors.brandYellow} style={styles.spinner} />
          <Text style={styles.caption}>載入待派柯打…</Text>
        </>
      ) : (
        <Text style={styles.caption}>
          {radiusHint ? `${radiusHint} · 範圍內暫無柯打` : '監聽新柯打中…'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    minHeight: 200,
  },
  spinner: {
    marginBottom: 12,
  },
  caption: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
