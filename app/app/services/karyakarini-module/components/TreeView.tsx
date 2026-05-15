import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
  return (
    <View style={styles.container}>

      <Text style={styles.breadcrumbText}>{breadcrumb || 'Root'}</Text>

      {levels.map((level, levelIndex) => (
        <View key={`level-${levelIndex}`} style={styles.levelWrap}>
          <Text style={styles.levelTitle}>
            {level.nodes[0]?.level ? `${titleCase(level.nodes[0].level)}` : 'Nodes'}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {level.nodes.map((node) => (
              <NodeCard
                key={node.id}
                node={node}
                selected={level.selectedNodeId === node.id}
                onPress={() => onSelectNode(levelIndex, node)}
                onMembersPress={() => onOpenMembers(node)}
                onAddMemberPress={
                  canAddMembers && node.can_assign_member && onAddMember ? () => onAddMember(node) : undefined
                }
                onAddNodePress={canAddMembers && node.can_assign_member && onAddNode ? () => onAddNode(node) : undefined}
              />
            ))}
            {level.nodes.length === 0 ? <Text style={styles.empty}>No nodes available</Text> : null}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  breadcrumbLabel: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    fontWeight: '700',
  },
  breadcrumbText: {
    fontSize: 14,
    color: theme.colors.text.primary,
    fontWeight: '600',
  },
  levelWrap: {
    gap: 8,
  },
  levelTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  row: {
    paddingVertical: 2,
    minHeight: 190,
  },
  empty: {
    color: theme.colors.text.secondary,
    fontSize: 12,
    marginTop: 8,
  },
});
