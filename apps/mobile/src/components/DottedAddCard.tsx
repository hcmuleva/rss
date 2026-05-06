import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/colors';

interface DottedAddCardProps {
  label: string;
  onPress: () => void;
}

export const DottedAddCard = ({ label, onPress }: DottedAddCardProps): React.JSX.Element => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} accessibilityLabel={`create ${label}`}>
      <View style={styles.iconWrap}>
        <Ionicons name="add" size={20} color={Colors.primary} />
      </View>
      <Text style={styles.title}>Create</Text>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#ffcfb3',
    backgroundColor: '#fff8f3',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    marginBottom: 12
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffece1'
  },
  title: {
    marginTop: 8,
    fontWeight: '800',
    color: Colors.secondary
  },
  label: {
    marginTop: 2,
    color: Colors.textSecondary,
    fontSize: 12
  }
});
