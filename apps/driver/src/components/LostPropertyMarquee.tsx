import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { LostPropertyTickerItem } from '../api/lostProperty';
import { colors } from '../theme/colors';

type Props = {
  items: LostPropertyTickerItem[];
  onPress: () => void;
};

const SCROLL_MS_PER_100PX = 1600;
const SEGMENT_GAP = '　　◆　　';

export function LostPropertyMarquee({ items, onPress }: Props) {
  const marqueeText = items.map((i) => i.marqueeText).join(SEGMENT_GAP);
  const itemCount = items.length;

  const translateX = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);

  const shouldScroll =
    itemCount > 0 &&
    trackWidth > 0 &&
    textWidth > 0 &&
    (textWidth > trackWidth + 8 || itemCount >= 2);

  useEffect(() => {
    loopRef.current?.stop();
    translateX.stopAnimation();

    if (!shouldScroll) {
      translateX.setValue(0);
      return;
    }

    const duration = Math.max(
      12_000,
      Math.ceil((textWidth / 100) * SCROLL_MS_PER_100PX),
    );

    translateX.setValue(0);
    const anim = Animated.loop(
      Animated.timing(translateX, {
        toValue: -textWidth,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loopRef.current = anim;
    anim.start();
    return () => anim.stop();
  }, [shouldScroll, textWidth, trackWidth, marqueeText, translateX]);

  if (itemCount === 0 || !marqueeText.trim()) {
    return null;
  }

  const segment = `${marqueeText}${SEGMENT_GAP}`;

  return (
    <Pressable style={styles.wrap} onPress={onPress} accessibilityRole="button">
      <Text style={styles.tag}>失物</Text>
      <View
        style={styles.track}
        onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        <Text
          style={styles.measureText}
          onLayout={(e: LayoutChangeEvent) => setTextWidth(e.nativeEvent.layout.width)}
        >
          {segment}
        </Text>

        <Animated.View
          style={[styles.scrollRow, { transform: [{ translateX }] }]}
          pointerEvents="none"
        >
          <Text style={styles.text}>{segment}</Text>
          <Text style={styles.text}>{segment}</Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2200',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.brandYellow,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  tag: {
    color: colors.brandYellow,
    fontWeight: '800',
    fontSize: 12,
    marginRight: 8,
    flexShrink: 0,
  },
  track: {
    flex: 1,
    overflow: 'hidden',
    height: 20,
    justifyContent: 'center',
  },
  measureText: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    top: 0,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 0,
  },
  scrollRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    color: '#ffeaa7',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 0,
  },
});
