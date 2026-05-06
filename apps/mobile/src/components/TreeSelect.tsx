import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/colors';

export interface TreeSelectOption {
  id: string;
  parentId: string | null;
  label: string;
}

interface TreeSelectProps {
  label?: string;
  placeholder: string;
  options: TreeSelectOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  rootLabel?: string;
}

export const TreeSelect = ({ label, placeholder, options, value, onChange, rootLabel }: TreeSelectProps): React.JSX.Element => {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  const byParent = React.useMemo(() => {
    const map = new Map<string | null, TreeSelectOption[]>();
    options.forEach((item) => {
      const list = map.get(item.parentId) ?? [];
      list.push(item);
      map.set(item.parentId, list);
    });
    return map;
  }, [options]);

  const byId = React.useMemo(() => new Map(options.map((item) => [item.id, item])), [options]);
  const selected = value ? byId.get(value) : undefined;
  const query = search.trim().toLowerCase();

  const visibleIds = React.useMemo(() => {
    if (!query) {
      return null;
    }
    const matches = new Set<string>();
    options.forEach((item) => {
      if (item.label.toLowerCase().includes(query)) {
        matches.add(item.id);
        let parent = item.parentId;
        while (parent) {
          matches.add(parent);
          parent = byId.get(parent)?.parentId ?? null;
        }
      }
    });
    return matches;
  }, [byId, options, query]);

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const renderTree = (parentId: string | null, depth: number): React.ReactNode => {
    const children = byParent.get(parentId) ?? [];
    return children.map((item) => {
      if (visibleIds && !visibleIds.has(item.id)) {
        return null;
      }
      const hasChildren = (byParent.get(item.id)?.length ?? 0) > 0;
      const isExpanded = expanded[item.id] ?? false;
      return (
        <View key={item.id}>
          <View style={styles.row}>
            <View style={[styles.indent, { width: depth * 14 }]} />
            <TouchableOpacity disabled={!hasChildren} onPress={() => hasChildren && toggle(item.id)} style={styles.iconWrap}>
              <Ionicons
                name={hasChildren ? (isExpanded ? 'chevron-down-outline' : 'chevron-forward-outline') : 'ellipse-outline'}
                size={14}
                color={hasChildren ? Colors.secondary : '#b9c0d0'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionBtn, value === item.id && styles.optionBtnActive]}
              onPress={() => {
                onChange(item.id);
                setOpen(false);
              }}
            >
              <Text style={[styles.optionText, value === item.id && styles.optionTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          </View>
          {hasChildren && isExpanded ? renderTree(item.id, depth + 1) : null}
        </View>
      );
    });
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={selected ? styles.triggerText : styles.placeholder}>{selected?.label ?? placeholder}</Text>
        <Ionicons name="chevron-down-outline" size={16} color={Colors.textSecondary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{placeholder}</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Ionicons name="close-outline" size={20} color={Colors.secondary} />
              </TouchableOpacity>
            </View>
            <TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Search node..." />
            {rootLabel ? (
              <TouchableOpacity style={styles.rootBtn} onPress={() => { onChange(null); setOpen(false); }}>
                <Text style={styles.rootText}>{rootLabel}</Text>
              </TouchableOpacity>
            ) : null}
            <ScrollView style={styles.treeContainer} contentContainerStyle={styles.treeContent}>
              {renderTree(null, 0)}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
  trigger: {
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  triggerText: { color: Colors.textPrimary, flex: 1, marginRight: 8 },
  placeholder: { color: '#9aa1b3', flex: 1, marginRight: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e6e8ef', maxHeight: '78%', padding: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontWeight: '800', color: Colors.secondary, fontSize: 15 },
  searchInput: { borderWidth: 1, borderColor: '#dde2ef', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, marginBottom: 8 },
  rootBtn: { borderWidth: 1, borderColor: '#d8e1f8', borderRadius: 8, backgroundColor: '#f4f8ff', padding: 10, marginBottom: 8 },
  rootText: { color: Colors.secondary, fontWeight: '700' },
  treeContainer: { borderWidth: 1, borderColor: '#edf0f7', borderRadius: 10, backgroundColor: '#fafbfe' },
  treeContent: { padding: 8 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  indent: { height: 1 },
  iconWrap: { width: 20, height: 28, alignItems: 'center', justifyContent: 'center' },
  optionBtn: { flex: 1, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 8 },
  optionBtnActive: { backgroundColor: '#edf3ff' },
  optionText: { color: Colors.textPrimary, fontSize: 13 },
  optionTextActive: { color: Colors.secondary, fontWeight: '700' }
});
