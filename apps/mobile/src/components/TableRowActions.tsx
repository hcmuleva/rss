import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/colors';

interface TableRowActionsProps {
  onEdit: () => void;
  onDetails: () => void;
}

export const TableRowActions = ({ onEdit, onDetails }: TableRowActionsProps): React.JSX.Element => (
  <View style={styles.row}>
    <TouchableOpacity style={[styles.btn, styles.editBtn]} onPress={onEdit}>
      <Text style={styles.editText}>Edit</Text>
    </TouchableOpacity>
    <TouchableOpacity style={[styles.btn, styles.detailsBtn]} onPress={onDetails}>
      <Text style={styles.detailsText}>Details</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6
  },
  btn: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  editBtn: {
    backgroundColor: '#fff1e8',
    borderWidth: 1,
    borderColor: '#ffd7bd'
  },
  detailsBtn: {
    backgroundColor: '#edf3ff',
    borderWidth: 1,
    borderColor: '#d4e2ff'
  },
  editText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary
  },
  detailsText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.secondary
  }
});
