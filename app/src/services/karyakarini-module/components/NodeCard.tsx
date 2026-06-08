import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '@/theme';
import type { KaryakariniNode } from '../types';

type Props = {
  node: KaryakariniNode;
  selected?: boolean;
  onPress: () => void;
  onMembersPress: () => void;
  onAddMemberPress?: () => void;
  onAddNodePress?: () => void;
};

const titleCase = (text: string) =>
  String(text || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const RELIGION_SYMBOLS = {
  hindu: 'ૐ',
  muslim: '☪︎',
  isai: '†',
  other: '𝒪',
} as const;

export function NodeCard({ node, selected = false, onPress, onMembersPress, onAddMemberPress, onAddNodePress }: Props) {
  const normalizedLevel = String(node.level || '').trim().toLowerCase();
  const isVillageLevel = normalizedLevel === 'gram' || normalizedLevel === 'mohalla';
  const villageReligionChips = [
    {
      key: 'hindu',
      symbol: RELIGION_SYMBOLS.hindu,
      count: Number(node.hindu_family_count || 0),
    },
    {
      key: 'muslim',
      symbol: RELIGION_SYMBOLS.muslim,
      count: Number(node.muslim_family_count || 0),
    },
    {
      key: 'isai',
      symbol: RELIGION_SYMBOLS.isai,
      count: Number(node.isai_family_count || 0),
    },
    {
      key: 'other',
      symbol: RELIGION_SYMBOLS.other,
      count: Number(node.other_family_count || 0),
    },
  ].filter((entry) => entry.count > 0);

  return (
    <TouchableOpacity style={[styles.card, selected && styles.cardSelected]} onPress={onPress}>
      <Text style={styles.name} numberOfLines={2}>
        {node.name}
      </Text>
      <Text style={styles.level}>{titleCase(node.level)}</Text>

      <View style={styles.badges}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>कार्यकर्ता: {Number(node.member_count || 0)}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>उप-स्तर: {Number(node.child_count || 0)}</Text>
        </View>
      </View>

      {isVillageLevel && villageReligionChips.length > 0 ? (
        <View style={styles.religionIconsRow}>
          {villageReligionChips.map((entry) => (
            <View key={entry.key} style={styles.religionIconChip}>
              <Text style={styles.religionIconText}>{entry.symbol}</Text>
              <Text style={styles.religionCountText}>{entry.count}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onMembersPress}>
          <Text style={styles.actionText}>कार्यकर्ता</Text>
        </TouchableOpacity>
        {onAddMemberPress ? (
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={onAddMemberPress}>
            <Text style={[styles.actionText, styles.actionTextPrimary]}>जोड़ें</Text>
          </TouchableOpacity>
        ) : null}
        {onAddNodePress ? (
          <TouchableOpacity style={styles.actionBtn} onPress={onAddNodePress}>
            <Text style={styles.actionText}>नोड जोड़ें</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 220,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  cardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  level: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    backgroundColor: theme.colors.surfaceContainerHigh,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  religionIconsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  religionIconChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: theme.colors.background,
  },
  religionIconText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  religionCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text.secondary,
  },
  actions: {
    marginTop: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexGrow: 1,
    minWidth: 62,
    alignItems: 'center',
  },
  actionBtnPrimary: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text.secondary,
  },
  actionTextPrimary: {
    color: '#fff',
  },
});
