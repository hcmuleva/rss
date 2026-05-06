import React, { memo } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/colors';

interface FlatListCardProps {
  titleHi: string;
  titleEn: string;
  area: string;
  level: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}

export const FlatListCard = memo(({ titleHi, titleEn, area, level, icon, onPress }: FlatListCardProps): React.JSX.Element => {
  return (
    <TouchableOpacity style={styles.card} accessibilityLabel={`${titleEn} card`} activeOpacity={0.86} onPress={onPress}>
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={18} color={Colors.primary} />
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.titleHi}>{titleHi}</Text>
          <Text style={styles.titleEn}>{titleEn}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{level}</Text>
        </View>
      </View>
      <Text style={styles.areaLabel}>Assigned Area</Text>
      <Text style={styles.areaValue}>{area}</Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0ede8',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff3eb'
  },
  titleWrap: {
    flex: 1,
    marginLeft: 10
  },
  titleHi: {
    fontWeight: '700',
    fontSize: 14,
    color: Colors.textPrimary
  },
  titleEn: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.textSecondary
  },
  badge: {
    borderRadius: 999,
    backgroundColor: '#edf3ff',
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  badgeText: {
    color: Colors.secondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2
  },
  areaLabel: {
    marginTop: 14,
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: 'uppercase'
  },
  areaValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary
  }
});
