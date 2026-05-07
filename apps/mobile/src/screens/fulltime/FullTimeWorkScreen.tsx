import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createFullTimeTask, getFullTimeTasks, updateFullTimeTask } from '@/api/fulltime.api';
import { getUsers } from '@/api/users.api';
import { DottedAddCard } from '@/components/DottedAddCard';
import { FormDialog } from '@/components/FormDialog';
import { MediaUploader } from '@/components/MediaUploader';
import { ScreenTopBar } from '@/components/ScreenTopBar';
import { TableRowActions } from '@/components/TableRowActions';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';

const statuses = ['Assigned', 'InProgress', 'Completed', 'NotReady', 'OnHold'] as const;
const FieldLabel = ({ text }: { text: string }) => <Text style={styles.label}>{text}</Text>;

export const FullTimeWorkScreen = (): React.JSX.Element => {
  const role = useAuthStore((state) => state.role);
  const isAdminRole = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const queryClient = useQueryClient();
  const { data: tasks = [] } = useQuery({ queryKey: ['fulltime-tasks'], queryFn: getFullTimeTasks });
  const { data: users = [] } = useQuery({ queryKey: ['admin-users'], queryFn: getUsers, enabled: isAdminRole });
  const [showForm, setShowForm] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    title: '',
    description: '',
    date: new Date().toISOString().slice(0, 10),
    status: 'Assigned' as (typeof statuses)[number],
    location: '',
    mediaUrls: [] as string[],
    assignedUserIds: [] as string[]
  });

  React.useEffect(() => {
    if (isAdminRole && !form.assignedUserIds.length && users.length) {
      const list = users.filter((item) => item.role === 'USER' && item.isActive).slice(0, 1).map((item) => item.id);
      setForm((prev) => ({ ...prev, assignedUserIds: list }));
    }
  }, [form.assignedUserIds.length, isAdminRole, users]);

  const createMutation = useMutation({
    mutationFn: createFullTimeTask,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['fulltime-tasks'] });
      setEditingId(null);
      setShowForm(false);
    }
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof createFullTimeTask>[0] }) => updateFullTimeTask(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['fulltime-tasks'] });
      setEditingId(null);
      setShowForm(false);
    }
  });

  const submit = async () => {
    const payload = { ...form, assignedUserIds: isAdminRole ? form.assignedUserIds : undefined };
    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, payload });
      return;
    }
    await createMutation.mutateAsync(payload);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenTopBar title="FullTime Work" />
      <DottedAddCard label="FullTime Task Form" onPress={() => { setEditingId(null); setShowForm(true); }} />
      <FormDialog
        visible={showForm}
        title={editingId ? 'Edit FullTime Task' : 'Create FullTime Task'}
        submitLabel={editingId ? 'Update Task' : 'Save Task'}
        onClose={() => setShowForm(false)}
        onSubmit={() => void submit()}
      >
          <FieldLabel text="Task Title" />
          <TextInput style={styles.input} value={form.title} onChangeText={(v) => setForm((p) => ({ ...p, title: v }))} />
          <FieldLabel text="Description" />
          <TextInput style={styles.input} value={form.description} onChangeText={(v) => setForm((p) => ({ ...p, description: v }))} />
          <FieldLabel text="Location" />
          <TextInput style={styles.input} value={form.location} onChangeText={(v) => setForm((p) => ({ ...p, location: v }))} />
          <FieldLabel text="Date" />
          <TextInput style={styles.input} value={form.date} onChangeText={(v) => setForm((p) => ({ ...p, date: v }))} />
          <FieldLabel text="Status" />
          <View style={styles.pickerWrap}><Picker selectedValue={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>{statuses.map((status) => <Picker.Item key={status} label={status} value={status} />)}</Picker></View>
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
          <MediaUploader value={form.mediaUrls} onChange={(urls) => setForm((prev) => ({ ...prev, mediaUrls: urls }))} label="Task Media" />
      </FormDialog>

      <Text style={styles.sectionTitle}>FullTime Tasks</Text>
      {tasks.map((item) => (
        <View key={item.id} style={styles.rowCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Text style={styles.rowSub}>{item.location} • {item.status} • {item.date}</Text>
            <Text style={styles.rowSub}>{item.assignedUserIds?.length ?? 0} users</Text>
          </View>
          <TableRowActions
            onEdit={() => {
              setForm({ title: item.title, description: item.description, date: item.date, status: item.status, location: item.location, mediaUrls: item.mediaUrls ?? [], assignedUserIds: item.assignedUserIds ?? [] });
              setEditingId(item.id);
              setShowForm(true);
            }}
            onDetails={() => {
              // simple details for now
            }}
          />
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
  pickerWrap: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden', marginBottom: 8, backgroundColor: '#fff' },
  assignWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  assignChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#d9deea', backgroundColor: '#fff' },
  assignChipActive: { borderColor: '#b8cdfc', backgroundColor: '#edf3ff' },
  assignChipText: { fontSize: 12, color: Colors.textSecondary },
  assignChipTextActive: { color: Colors.secondary, fontWeight: '700' },
  sectionTitle: { marginTop: 14, marginBottom: 8, fontWeight: '700', fontSize: 16, color: Colors.secondary },
  rowCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e6e8ef', borderRadius: 10, padding: 10, marginBottom: 8, flexDirection: 'row', gap: 8 },
  rowTitle: { fontWeight: '700', color: Colors.secondary },
  rowSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 }
});
