import { StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { colors } from '../theme/colors';

type Props = {
  iconKey: string | null;
  label: string;
  selected?: boolean;
  variant: 'tunnel' | 'vehicle' | 'chip';
};

function TunnelGlyph({ glyph }: { glyph: string }) {
  return (
    <View style={styles.tunnelOuter}>
      <View style={styles.tunnelArch} />
      <Text style={styles.tunnelGlyph}>{glyph}</Text>
    </View>
  );
}

function VehicleGlyph({ kind }: { kind: string }) {
  const isVan = kind.includes('wheelchair') || kind.includes('luggage');
  return (
    <View style={[styles.vehicleBody, isVan && styles.vehicleVan]}>
      <View style={styles.vehicleWindow} />
      {kind.includes('wheelchair') ? <Text style={styles.vehicleBadge}>♿</Text> : null}
      {kind.includes('luggage') ? <Text style={styles.vehicleBadge}>🧳</Text> : null}
    </View>
  );
}

export function BookingOptionIcon({ iconKey, label, selected, variant }: Props) {
  if (variant === 'tunnel') {
    const glyph =
      iconKey === 'tunnel_red'
        ? t('booking.tunnel.red')
        : iconKey === 'tunnel_west'
          ? t('booking.tunnel.west')
          : iconKey === 'tunnel_east'
            ? t('booking.tunnel.east')
            : iconKey === 'tunnel_single'
              ? t('booking.tunnel.single')
              : label.charAt(0);
    return <TunnelGlyph glyph={glyph} />;
  }
  if (variant === 'vehicle') {
    return <VehicleGlyph kind={iconKey ?? 'car'} />;
  }
  return (
    <View style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tunnelOuter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
  },
  tunnelArch: {
    position: 'absolute',
    top: 10,
    width: 28,
    height: 18,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: '#aaa',
  },
  tunnelGlyph: { marginTop: 14, fontSize: 16, fontWeight: '800', color: '#eee' },
  vehicleBody: {
    width: 56,
    height: 32,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ccc',
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleVan: { width: 62, height: 36 },
  vehicleWindow: {
    width: 24,
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 2,
  },
  vehicleBadge: { position: 'absolute', bottom: 2, right: 4, fontSize: 10 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#888',
  },
  chipSelected: {
    borderColor: colors.brandYellow,
    backgroundColor: colors.brandTintBg,
  },
  chipText: { color: '#eee', fontSize: 15, fontWeight: '600' },
  chipTextSelected: { color: colors.brandYellow },
});
