import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/colors';

interface FormDialogProps {
  visible: boolean;
  title: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
}

export const FormDialog = ({ visible, title, submitLabel, onClose, onSubmit, children }: FormDialogProps): React.JSX.Element => (
  <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
          <Ionicons name="close" size={20} color={Colors.secondary} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.saveBtn]} onPress={onSubmit}>
          <Text style={styles.saveText}>{submitLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  header: {
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8ebf2',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: { fontSize: 18, fontWeight: '800', color: Colors.secondary },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#eef2fa', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 24 },
  footer: { flexDirection: 'row', gap: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e8ebf2', padding: 12 },
  actionBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#eef1f6' },
  saveBtn: { backgroundColor: Colors.primary },
  cancelText: { color: Colors.secondary, fontWeight: '700' },
  saveText: { color: '#fff', fontWeight: '700' }
});
