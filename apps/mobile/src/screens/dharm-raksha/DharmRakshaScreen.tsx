import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createDharmRakshaEntry, getDharmRakshaEntries } from '@/api/dharmRaksha.api';
import { getUsers } from '@/api/users.api';
import { DottedAddCard } from '@/components/DottedAddCard';
import { FormDialog } from '@/components/FormDialog';
import { MediaUploader } from '@/components/MediaUploader';
import { ScreenTopBar } from '@/components/ScreenTopBar';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';

const FieldLabel = ({ text }: { text: string }) => <Text style={styles.label}>{text}</Text>;

export const DharmRakshaScreen = (): React.JSX.Element => {
  const role = useAuthStore((state) => state.role);
  const isAdminRole = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const queryClient = useQueryClient();
  const { data: rows = [] } = useQuery({ queryKey: ['dharm-raksha'], queryFn: getDharmRakshaEntries });
  const { data: users = [] } = useQuery({ queryKey: ['admin-users'], queryFn: getUsers, enabled: isAdminRole });
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({ nodeId: 'h-l5b3-1', category: 'Samiti', date: new Date().toISOString().slice(0, 10), description: '', mediaUrls: [] as string[], assignedUserIds: [] as string[] });

  React.useEffect(() => {
    if (isAdminRole && !form.assignedUserIds.length && users.length) {
      const first = users.find((item) => item.role === 'USER' && item.isActive);
      if (first) {
        setForm((prev) => ({ ...prev, assignedUserIds: [first.id] }));
      }
    }
  }, [form.assignedUserIds.length, isAdminRole, users]);

  const createMutation = useMutation({
    mutationFn: createDharmRakshaEntry,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dharm-raksha'] });
      setShowForm(false);
    }
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenTopBar title="Dharm Raksha Samiti" />
      <DottedAddCard label="Dharm Raksha Entry Form" onPress={() => setShowForm(true)} />
      <FormDialog
        visible={showForm}
        title="Create Dharm Raksha Entry"
        submitLabel="Save Entry"
        onClose={() => setShowForm(false)}
        onSubmit={() => void createMutation.mutateAsync({ ...form, assignedUserIds: isAdminRole ? form.assignedUserIds : undefined })}
      >
          <FieldLabel text="Node ID" />
          <TextInput style={styles.input} value={form.nodeId} onChangeText={(v) => setForm((p) => ({ ...p, nodeId: v }))} />
          <FieldLabel text="Category" />
          <TextInput style={styles.input} value={form.category} onChangeText={(v) => setForm((p) => ({ ...p, category: v }))} />
          <FieldLabel text="Date" />
          <TextInput style={styles.input} value={form.date} onChangeText={(v) => setForm((p) => ({ ...p, date: v }))} />
          <FieldLabel text="Description" />
          <TextInput style={styles.input} value={form.description} onChangeText={(v) => setForm((p) => ({ ...p, description: v }))} />
          {isAdminRole ? (
            <>
              <FieldLabel text="Assign To Users" />
              <View style={styles.assignWrap}>
                {users.filter((item) => item.role === 'USER' && item.isActive).map((user) => {
                  const selected = form.assignedUserIds.includes(user.id);
                  return (
                    <TouchableOpacity
                      key={user.id}
                      style={[styles.assignChip, selected && styles.assignChipActive]}
                      onPress={() =>
                        setForm((prev) => ({
                          ...prev,
                          assignedUserIds: selected ? prev.assignedUserIds.filter((id) => id !== user.id) : [...prev.assignedUserIds, user.id]
                        }))
                      }
                    >
                      <Text style={[styles.assignChipText, selected && styles.assignChipTextActive]}>{user.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : null}
          <MediaUploader value={form.mediaUrls} onChange={(urls) => setForm((prev) => ({ ...prev, mediaUrls: urls }))} label="Samiti Media" />
      </FormDialog>

      <Text style={styles.sectionTitle}>Dharm Raksha Entries</Text>
      {rows.map((item) => (
        <View key={item.id} style={styles.rowCard}>
          <Text style={styles.rowTitle}>{item.category}</Text>
          <Text style={styles.rowSub}>{item.description}</Text>
          <Text style={styles.rowSub}>{item.nodeId} • {item.date}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 8, backgroundColor: '#fff' },
  assignWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  assignChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#d9deea', backgroundColor: '#fff' },
  assignChipActive: { borderColor: '#b8cdfc', backgroundColor: '#edf3ff' },
  assignChipText: { fontSize: 12, color: Colors.textSecondary },
  assignChipTextActive: { color: Colors.secondary, fontWeight: '700' },
  sectionTitle: { marginTop: 14, marginBottom: 8, fontWeight: '700', fontSize: 16, color: Colors.secondary },
  rowCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e6e8ef', borderRadius: 10, padding: 10, marginBottom: 8 },
  rowTitle: { fontWeight: '700', color: Colors.secondary },
  rowSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 }
});
