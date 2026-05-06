import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';

import { HierarchyNode } from '@/types/models';

interface HierarchyPickerProps {
  nodes: HierarchyNode[];
  value: string[];
  onChange: (path: string[]) => void;
}

const LEVELS = ['PRANT', 'SAMBHAG', 'VIBHAG', 'DISTRICT', 'KHAND', 'MANDAL', 'GRAM', 'NAGAR', 'BASTI', 'MOHALLA'];

export const HierarchyPicker = ({ nodes, value, onChange }: HierarchyPickerProps): React.JSX.Element => {
  const selectedByLevel = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    value.forEach((id) => {
      const node = nodes.find((n) => n.id === id);
      if (node) map[node.level] = node.id;
    });
    return map;
  }, [nodes, value]);

  const getOptions = (level: string) => {
    const currentIndex = LEVELS.indexOf(level);
    if (currentIndex === 0) return nodes.filter((n) => n.level === level);
    const parentLevel = LEVELS[currentIndex - 1];
    const parentId = selectedByLevel[parentLevel];
    return nodes.filter((n) => n.level === level && n.parentId === parentId);
  };

  const handleSelect = (level: string, selectedNodeId: string) => {
    const index = LEVELS.indexOf(level);
    const filtered = value.filter((id) => {
      const node = nodes.find((n) => n.id === id);
      return node ? LEVELS.indexOf(node.level) < index : false;
    });
    onChange(selectedNodeId ? [...filtered, selectedNodeId] : filtered);
  };

  return (
    <View accessibilityLabel="hierarchy picker">
      {LEVELS.map((level) => {
        const options = getOptions(level);
        if (!options.length) return null;

        return (
          <View key={level} style={styles.fieldRow}>
            <Text style={styles.label}>{level}</Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={selectedByLevel[level] ?? ''}
                onValueChange={(selected) => handleSelect(level, selected)}
                accessibilityLabel={`${level} picker`}
              >
                <Picker.Item label={`Select ${level}`} value="" />
                {options.map((node) => (
                  <Picker.Item key={node.id} label={`${node.name_hi} / ${node.name_en}`} value={node.id} />
                ))}
              </Picker>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  fieldRow: {
    marginBottom: 10
  },
  label: {
    fontSize: 13,
    fontWeight: '600'
  },
  pickerWrap: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden'
  }
});
