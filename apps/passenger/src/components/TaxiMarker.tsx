import { StyleSheet, View } from 'react-native';

type Props = {
  /** 車頭朝向（度）；地圖 flat Marker 時用 */
  rotation?: number;
};

/** 香港紅的士俯視 pin（iOS / Android 一致） */
export function TaxiMarker({ rotation = 0 }: Props) {
  return (
    <View style={[styles.wrap, { transform: [{ rotate: `${rotation}deg` }] }]}>
      <View style={styles.shadow} />
      <View style={styles.body}>
        <View style={styles.roof} />
        <View style={styles.hood} />
        <View style={styles.windshield} />
      </View>
    </View>
  );
}

const RED = '#D32F2F';
const RED_EDGE = '#8B1A1A';

const styles = StyleSheet.create({
  wrap: {
    width: 26,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: {
    position: 'absolute',
    bottom: 0,
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  body: {
    width: 22,
    height: 30,
    borderRadius: 7,
    backgroundColor: RED,
    borderWidth: 1.5,
    borderColor: RED_EDGE,
    alignItems: 'center',
    overflow: 'hidden',
  },
  roof: {
    marginTop: 3,
    width: 16,
    height: 11,
    borderRadius: 3,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: RED_EDGE,
  },
  hood: {
    marginTop: 2,
    width: 14,
    height: 6,
    borderRadius: 2,
    backgroundColor: '#B71C1C',
  },
  windshield: {
    position: 'absolute',
    bottom: 4,
    width: 12,
    height: 5,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
});
