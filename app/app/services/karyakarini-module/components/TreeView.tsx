import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../../../theme';
import type { KaryakariniNode } from '../types';
import { NodeCard } from './NodeCard';

export type TreeLevelState = {
  parentNode: KaryakariniNode | null;
  nodes: KaryakariniNode[];
  selectedNodeId: number | null;
};

type Props = {
  levels: TreeLevelState[];
  breadcrumb: string;
  onSelectNode: (levelIndex: number, node: KaryakariniNode) => void;
  onOpenMembers: (node: KaryakariniNode) => void;
  onAddMember?: (node: KaryakariniNode) => void;
  onAddNode?: (node: KaryakariniNode) => void;
  canAddMembers?: boolean;
};

const titleCase = (value?: string | null) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export function TreeView({
  levels,
  breadcrumb,
  onSelectNode,
  onOpenMembers,
  onAddMember,
  onAddNode,
  canAddMembers = false,
}: Props) {
  const activeLevelIndex = levels.length - 1;
  const activeLevel = activeLevelIndex >= 0 ? levels[activeLevelIndex] : null;

  return (
    <View style={styles.container}>
      <View style={styles.selectorWrap}>
        <View style={styles.selectorHeader}>
          <Text style={styles.selectorTitle}>Hierarchy Selector</Text>
          <Text style={styles.selectorSubtitle}>Select level by level</Text>
        </View>
        <View style={styles.breadcrumbChip}>
          <Text style={styles.breadcrumbText}>{breadcrumb || 'Root'}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.columnsRow}>
            {levels.map((level, levelIndex) => (
              <View key={`level-${levelIndex}`} style={styles.column}>
                <View style={styles.columnHeader}>
                  <Text style={styles.columnStep}>L{levelIndex + 1}</Text>
                  <Text style={styles.columnTitle}>
                    {level.nodes[0]?.level ? titleCase(level.nodes[0].level) : 'Nodes'}
                  </Text>
                </View>
                <ScrollView style={styles.optionList} nestedScrollEnabled>
                  {level.nodes.map((node) => {
                    const selected = level.selectedNodeId === node.id;
                    return (
                      <TouchableOpacity
                        key={`node-option-${levelIndex}-${node.id}`}
                        style={[styles.optionItem, selected && styles.optionItemSelected]}
                        onPress={() => onSelectNode(levelIndex, node)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.optionText, selected && styles.optionTextSelected]} numberOfLines={1}>
                          {node.name}
                        </Text>
                        <Text style={[styles.optionMeta, selected && styles.optionMetaSelected]}>
                          {Number(node.child_count || 0) > 0 ? '›' : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {level.nodes.length === 0 ? <Text style={styles.empty}>No nodes</Text> : null}
                </ScrollView>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {activeLevel ? (
        <View style={styles.cardsSection}>
          <View style={styles.cardsHeader}>
            <Text style={styles.cardsTitle}>
              {activeLevel.nodes[0]?.level ? titleCase(activeLevel.nodes[0].level) : 'Nodes'}
            </Text>
            <Text style={styles.cardsHint}>
              {activeLevel.parentNode
                ? `Children of ${activeLevel.parentNode.name}`
                : 'Start by selecting a node'}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardsRow}>
            {activeLevel.nodes.map((node) => (
              <NodeCard
                key={node.id}
                node={node}
                selected={activeLevel.selectedNodeId === node.id}
                onPress={() => onSelectNode(activeLevelIndex, node)}
                onMembersPress={() => onOpenMembers(node)}
                onAddMemberPress={
                  canAddMembers && node.can_assign_member && onAddMember ? () => onAddMember(node) : undefined
                }
                onAddNodePress={canAddMembers && node.can_assign_member && onAddNode ? () => onAddNode(node) : undefined}
              />
            ))}
            {activeLevel.nodes.length === 0 ? <Text style={styles.empty}>No nodes available</Text> : null}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  selectorWrap: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    padding: 12,
    gap: 10,
  },
  selectorHeader: {
    gap: 2,
  },
  selectorTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  selectorSubtitle: {
    fontSize: 11,
    color: theme.colors.text.secondary,
  },
  breadcrumbChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  breadcrumbText: {
    fontSize: 12,
    color: theme.colors.text.primary,
    fontWeight: '600',
  },
  columnsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  column: {
    width: 180,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.background,
    overflow: 'hidden',
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  columnStep: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  columnTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  optionList: {
    maxHeight: 230,
  },
  optionItem: {
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  optionItemSelected: {
    backgroundColor: theme.colors.primarySoft,
  },
  optionText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.text.primary,
    fontWeight: '500',
  },
  optionTextSelected: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  optionMeta: {
    marginLeft: 8,
    fontSize: 16,
    color: theme.colors.text.disabled,
    lineHeight: 18,
  },
  optionMetaSelected: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  cardsSection: {
    gap: 8,
  },
  cardsHeader: {
    gap: 2,
  },
  cardsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  cardsHint: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  empty: {
    color: theme.colors.text.secondary,
    fontSize: 12,
    marginTop: 8,
  },
});
