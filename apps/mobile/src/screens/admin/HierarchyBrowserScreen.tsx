import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';

import { HierarchyPicker } from '@/components/HierarchyPicker';
import { ScreenTopBar } from '@/components/ScreenTopBar';
import { HierarchyNode } from '@/types/models';

const mockNodes: HierarchyNode[] = [
  {
    id: 'p1',
    name_hi: 'मालवा',
    name_en: 'Malwa',
    level: 'PRANT',
    branch: 'rural',
    parentId: null,
    address: 'MP',
    lat: 0,
    long: 0
  },
  {
    id: 's1',
    name_hi: 'उज्जैन संभाग',
    name_en: 'Ujjain Sambhag',
    level: 'SAMBHAG',
    branch: 'rural',
    parentId: 'p1',
    address: 'Ujjain',
    lat: 0,
    long: 0
  },
  {
    id: 'd1',
    name_hi: 'उज्जैन जिला',
    name_en: 'Ujjain District',
    level: 'DISTRICT',
    branch: 'rural',
    parentId: 's1',
    address: 'Ujjain',
    lat: 0,
    long: 0
  }
];

export const HierarchyBrowserScreen = (): React.JSX.Element => {
  const [selectedPath, setSelectedPath] = useState<string[]>([]);

  return (
    <View style={styles.container} accessibilityLabel="hierarchy browser screen">
      <ScreenTopBar title="Hierarchy Browser" />
      <HierarchyPicker nodes={mockNodes} value={selectedPath} onChange={setSelectedPath} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16
  }
});
