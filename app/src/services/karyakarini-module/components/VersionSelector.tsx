import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '@/theme';
import type { KaryakariniVersion } from '../types';

type Props = {
  versions: KaryakariniVersion[];
  selectedVersionId: number | null;
  onChange: (versionId: number) => void;
  loading?: boolean;
};

const formatVersionLabel = (version: KaryakariniVersion) => {
  if (version.is_current) return `${version.name} (Current)`;
  return version.name;
};

export function VersionSelector({ versions, selectedVersionId, onChange, loading = false }: Props) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) || versions[0] || null,
    [versions, selectedVersionId]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Karyakarini Version</Text>
      <TouchableOpacity
        style={[styles.trigger, loading && styles.triggerDisabled]}
        onPress={() => !loading && setOpen(true)}
        disabled={loading}
      >
        <Text style={styles.triggerText}>{selected ? formatVersionLabel(selected) : 'Select version'}</Text>
        <Text style={styles.chevron}>▼</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Version</Text>
            <ScrollView contentContainerStyle={styles.optionList}>
              {versions.map((version) => {
                const active = version.id === selectedVersionId;
                return (
                  <TouchableOpacity
                    key={version.id}
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => {
                      onChange(version.id);
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>
                      {formatVersionLabel(version)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setOpen(false)}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text.secondary,
  },
  trigger: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerDisabled: {
    opacity: 0.6,
  },
  triggerText: {
    fontSize: 14,
    color: theme.colors.text.primary,
    fontWeight: '600',
  },
  chevron: {
    color: theme.colors.text.secondary,
    fontSize: 11,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '70%',
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  optionList: {
    gap: 8,
  },
  option: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  optionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  optionText: {
    color: theme.colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  optionTextActive: {
    color: theme.colors.primary,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceContainerHigh,
  },
  closeText: {
    color: theme.colors.text.secondary,
    fontWeight: '700',
  },
});
