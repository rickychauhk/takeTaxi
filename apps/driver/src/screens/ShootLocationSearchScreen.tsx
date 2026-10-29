import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScreenSafeArea } from '../components/ScreenSafeArea';
import type { LatLng } from '../constants/latLng';
import { searchPlaces, type PlaceSuggestion } from '../location/placeSearch';
import { colors } from '../theme/colors';
type Props = {
  pointKind: 'pickup' | 'dropoff';
  initialText: string;
  near?: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onSelect: (place: LatLng) => void;
  onUseCurrentLocation: () => Promise<LatLng | null>;
  allowCurrentLocation?: boolean;
};

export default function ShootLocationSearchScreen({
  pointKind,
  initialText,
  near,
  onClose,
  onSelect,
  onUseCurrentLocation,
  allowCurrentLocation = true,
}: Props) {
  const pointTag = pointKind === 'pickup' ? '起' : '終';
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState(initialText);
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  useEffect(() => {
    const debounce = setTimeout(() => {
      setSearching(true);
      void searchPlaces(query, near ?? undefined)
        .then(setResults)
        .finally(() => setSearching(false));
    }, 280);
    return () => clearTimeout(debounce);
  }, [query, near?.latitude, near?.longitude]);

  useEffect(() => {
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(focusTimer);
  }, []);

  const sectionTitle = query.trim() ? '搜尋結果' : '附近地點';

  return (
    <ScreenSafeArea style={styles.root} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <View style={styles.searchRow}>
            <Text style={styles.pointTag}>{pointTag}</Text>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder="搜尋香港地址或地標"
              placeholderTextColor="#999"
              returnKeyType="search"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Text style={styles.clearIcon}>✕</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.quickRow}>
          {allowCurrentLocation ? (
            <Pressable
              style={styles.quickItem}
              disabled={locating}
              onPress={async () => {
                setLocating(true);
                try {
                  const place = await onUseCurrentLocation();
                  if (place) onSelect(place);
                } finally {
                  setLocating(false);
                }
              }}
            >
              {locating ? (
                <ActivityIndicator color="#4da3ff" size="small" />
              ) : (
                <Text style={styles.gpsIcon}>◎</Text>
              )}
              <Text style={styles.quickBlue}>使用目前位置</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{sectionTitle}</Text>
          {searching && <ActivityIndicator size="small" color={colors.brandYellow} />}
        </View>

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={!searching ? <Text style={styles.empty}>找不到相符地點</Text> : null}
          renderItem={({ item }) => (
            <Pressable style={styles.resultRow} onPress={() => onSelect(item)}>
              <Text style={styles.bookmark}>🔖</Text>
              <Text style={styles.resultText}>{item.label}</Text>
            </Pressable>
          )}
        />
      </KeyboardAvoidingView>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mapDark },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  backIcon: { color: colors.brandYellow, fontSize: 28, fontWeight: '600' },
  searchRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panelBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  pointTag: { color: colors.brandYellow, fontSize: 17, fontWeight: '800', minWidth: 28 },
  input: { flex: 1, fontSize: 16, color: colors.text, padding: 0 },
  clearIcon: { color: '#aaa', fontSize: 18, paddingHorizontal: 4 },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  quickItem: { alignItems: 'center', gap: 8, minWidth: 100 },
  gpsIcon: { color: '#4da3ff', fontSize: 28 },
  quickBlue: { color: '#4da3ff', fontSize: 15, fontWeight: '600' },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2a3038',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sectionTitle: { color: '#b0b0b0', fontSize: 14, fontWeight: '600' },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a3038',
  },
  bookmark: { fontSize: 18, marginTop: 2, opacity: 0.85 },
  resultText: { flex: 1, color: '#f0f0f0', fontSize: 16, lineHeight: 22 },
  empty: { color: '#888', padding: 20, textAlign: 'center' },
});
