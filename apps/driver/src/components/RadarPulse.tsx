import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

export function RadarPulse() {
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.6,
            duration: 1800,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scale, { toValue: 0.4, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 1800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.8, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, scale]);

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View
        style={[styles.ring, { transform: [{ scale }], opacity }]}
      />
      <View style={styles.core} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.online,
  },
  core: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.online,
  },
});
