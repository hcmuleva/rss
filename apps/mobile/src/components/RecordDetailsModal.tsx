import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/colors';

interface RecordDetailsModalProps {
  visible: boolean;
  title: string;
  lines: Array<{ label: string; value: string }>;
  onClose: () => void;
}

export const RecordDetailsModal = ({ visible, title, lines, onClose }: RecordDetailsModalProps): React.JSX.Element => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <ScrollView style={styles.content}>
          {lines.map((line) => (
            <View key={`${line.label}-${line.value}`} style={styles.row}>
              <Text style={styles.label}>{line.label}</Text>
              <Text style={styles.value}>{line.value || '-'}</Text>
            </View>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#0007', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 420, maxHeight: '80%', backgroundColor: '#fff', borderRadius: 12, padding: 12 },
  title: { fontSize: 16, fontWeight: '800', color: Colors.secondary, marginBottom: 8 },
  content: { maxHeight: 420 },
  row: { marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#eef0f6', paddingBottom: 6 },
  label: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  value: { color: Colors.textPrimary, fontSize: 13, marginTop: 2 },
  closeBtn: { marginTop: 8, backgroundColor: Colors.secondary, borderRadius: 8, alignItems: 'center', paddingVertical: 10 },
  closeText: { color: '#fff', fontWeight: '700' }
});
