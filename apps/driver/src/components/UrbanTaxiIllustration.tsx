import { StyleSheet, Text, View } from 'react-native';

/** 訂單頁市區紅的士示意（放大版） */
export function UrbanTaxiIllustration() {
  return (
    <View style={styles.wrap}>
      <View style={styles.roofSign}>
        <Text style={styles.roofText}>TAXI</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.windowRow}>
          <View style={styles.window} />
          <View style={styles.window} />
        </View>
        <View style={styles.bumper} />
      </View>
    </View>
  );
}

const RED = '#C62828';
const RED_DARK = '#8E0000';

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', width: 72 },
  roofSign: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: RED_DARK,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 2,
  },
  roofText: { fontSize: 10, fontWeight: '800', color: RED_DARK, letterSpacing: 0.5 },
  body: {
    width: 64,
    height: 36,
    backgroundColor: RED,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: RED_DARK,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  windowRow: { flexDirection: 'row', gap: 6 },
  window: {
    width: 18,
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 2,
  },
  bumper: {
    position: 'absolute',
    bottom: 4,
    width: 48,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
  },
});
