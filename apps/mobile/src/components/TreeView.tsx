import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/colors';

interface TreeNodeItem {
  id: string;
  parentId: string | null;
  title: string;
  subtitle?: string;
  badge?: string;
  tag?: string;
}

interface TreeViewProps {
  nodes: TreeNodeItem[];
  emptyText: string;
}

export const TreeView = ({ nodes, emptyText }: TreeViewProps): React.JSX.Element => {
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set(nodes.map((node) => node.id)));

  React.useEffect(() => {
    setExpandedIds(new Set(nodes.map((node) => node.id)));
  }, [nodes]);

  if (!nodes.length) {
    return <Text style={styles.emptyText}>{emptyText}</Text>;
  }

  const childCountByParent = nodes.reduce<Record<string, number>>((acc, node) => {
    if (node.parentId) {
      acc[node.parentId] = (acc[node.parentId] ?? 0) + 1;
    }
    return acc;
  }, {});

  const toggleNode = (nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const renderTree = (parentId: string | null, depth: number): React.JSX.Element[] => {
    return nodes
      .filter((node) => node.parentId === parentId)
      .flatMap((node) => {
        const hasChildren = (childCountByParent[node.id] ?? 0) > 0;
        const isExpanded = expandedIds.has(node.id);
        const children = hasChildren && isExpanded ? renderTree(node.id, depth + 1) : [];
        return [
          <View key={node.id} style={[styles.nodeRow, { marginLeft: depth * 14 }]}> 
            <Text style={styles.branch}>{depth ? '└─' : '●'}</Text>
            <View style={styles.textWrap}>
              <View style={styles.headerRow}>
                <Text style={styles.title}>{node.title}</Text>
                <View style={styles.rightMeta}>
                  {node.badge ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{node.badge}</Text>
                    </View>
                  ) : null}
                  {hasChildren ? (
                    <Pressable style={styles.expandButton} onPress={() => toggleNode(node.id)} accessibilityLabel="expand collapse node button">
                      <Ionicons name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={14} color={Colors.secondary} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
              {node.subtitle ? <Text style={styles.subtitle}>{node.subtitle}</Text> : null}
              <View style={styles.tagRow}>
                {node.tag ? <Text style={styles.tag}>{node.tag}</Text> : null}
                {hasChildren ? <Text style={styles.childrenText}>{childCountByParent[node.id]} child nodes</Text> : null}
              </View>
            </View>
          </View>,
          ...children
        ];
      });
  };

  return <View>{renderTree(null, 0)}</View>;
};

const styles = StyleSheet.create({
  nodeRow: {
    flexDirection: 'row',
    paddingVertical: 6
  },
  branch: {
    width: 22,
    color: Colors.primary,
    fontWeight: '700'
  },
  textWrap: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e7e8ec',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  rightMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  title: {
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
    flex: 1,
    paddingRight: 8
  },
  subtitle: {
    marginTop: 4,
    color: Colors.textSecondary,
    fontSize: 12
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#eef3ff',
    borderRadius: 999
  },
  badgeText: {
    color: Colors.secondary,
    fontSize: 11,
    fontWeight: '700'
  },
  expandButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4f6fb'
  },
  tagRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  tag: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
    textTransform: 'capitalize'
  },
  childrenText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600'
  },
  emptyText: {
    color: Colors.textSecondary
  }
});
