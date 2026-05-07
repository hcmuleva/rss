import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createProjectTask, getProjectTaskById, getProjectTasks, ProjectTaskRow, updateProjectTask } from '@/api/projects.api';
import { AvatarGroup } from '@/components/AvatarGroup';
import { getUsers } from '@/api/users.api';
import { DottedAddCard } from '@/components/DottedAddCard';
import { FormDialog } from '@/components/FormDialog';
import { MediaUploader } from '@/components/MediaUploader';
import { RecordDetailsModal } from '@/components/RecordDetailsModal';
import { ScreenTopBar } from '@/components/ScreenTopBar';
import { StatusBadge } from '@/components/StatusBadge';
import { TableRowActions } from '@/components/TableRowActions';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';

const statuses = ['Assigned', 'InProgress', 'Completed', 'NotReady', 'OnHold'] as const;
const FieldLabel = ({ text }: { text: string }) => <Text style={styles.label}>{text}</Text>;

export const ProjectTaskScreen = (): React.JSX.Element => {
  const route = useRoute();
  const params = (route.params ?? {}) as { nodeId?: string; assignmentKey?: string };
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.role);
  const isAdminRole = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const { data: tasks = [] } = useQuery({ queryKey: ['project-tasks'], queryFn: getProjectTasks });
  const { data: users = [] } = useQuery({ queryKey: ['admin-users'], queryFn: getUsers, enabled: isAdminRole });
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ projectCategory: 'Education', taskName: '', assignedUserIds: [] as string[], mediaUrls: [] as string[], status: 'Assigned' as (typeof statuses)[number], date: new Date().toISOString().slice(0, 10), description: '' });
  const [statusFilter, setStatusFilter] = React.useState('ALL');
  const [search, setSearch] = React.useState('');
  const [detailState, setDetailState] = React.useState<{ visible: boolean; title: string; lines: Array<{ label: string; value: string }> }>({ visible: false, title: '', lines: [] });

  const mutation = useMutation({ mutationFn: createProjectTask, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['project-tasks'] }); setEditingId(null); setShowCreateForm(false);} });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof createProjectTask>[0] }) => updateProjectTask(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
      setEditingId(null);
      setShowCreateForm(false);
    }
  });

  React.useEffect(() => {
    if (isAdminRole && !form.assignedUserIds.length && users.length) {
      const user = users.find((item) => item.role === 'USER' && item.isActive) ?? users[0];
      setForm((prev) => ({ ...prev, assignedUserIds: user?.id ? [user.id] : [] }));
    }
  }, [form.assignedUserIds.length, isAdminRole, users]);

  React.useEffect(() => {
    if (params.assignmentKey) {
      setStatusFilter('ALL');
      setSearch(params.assignmentKey);
      setForm((prev) => ({ ...prev, projectCategory: params.assignmentKey ?? prev.projectCategory }));
    }
  }, [params.assignmentKey]);

  const submit = async () => {
    const payload = { ...form, assignedUserIds: isAdminRole ? form.assignedUserIds : undefined };
    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, payload });
      return;
    }
    await mutation.mutateAsync(payload);
  };

  const filtered = tasks.filter((item) => {
    const statusOk = statusFilter === 'ALL' || item.status === statusFilter;
    const q = search.trim().toLowerCase();
    const searchOk = !q || `${item.projectCategory} ${item.taskName} ${item.description}`.toLowerCase().includes(q);
    return statusOk && searchOk;
  });
  const userLabel = (id: string) => users.find((user) => user.id === id)?.name ?? id;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenTopBar title="Project Tasks" />
      <Text style={styles.subtitle}>Manage project work items with status-driven tracking.</Text>

      <DottedAddCard label="Project Task Form" onPress={() => { setEditingId(null); setShowCreateForm(true); }} />
      <FormDialog
        visible={showCreateForm}
        title={editingId ? 'Edit Project Task' : 'Create Project Task'}
        submitLabel={editingId ? 'Update Task' : 'Create Task'}
        onClose={() => { setEditingId(null); setShowCreateForm(false); }}
        onSubmit={() => void submit()}
      >
          <FieldLabel text="Project Category" />
          <TextInput style={styles.input} value={form.projectCategory} onChangeText={(v) => setForm((p) => ({ ...p, projectCategory: v }))} placeholder="Education" />
          <FieldLabel text="Task Name" />
          <TextInput style={styles.input} value={form.taskName} onChangeText={(v) => setForm((p) => ({ ...p, taskName: v }))} placeholder="Task title" />
          {isAdminRole ? (
            <>
              <FieldLabel text="Assign To User" />
              <View style={styles.assignWrap}>
                {users
                  .filter((item) => item.role === 'USER' && item.isActive)
                  .map((user) => {
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
          <FieldLabel text="Date" />
          <TextInput style={styles.input} value={form.date} onChangeText={(v) => setForm((p) => ({ ...p, date: v }))} placeholder="YYYY-MM-DD" />
          <FieldLabel text="Description" />
          <TextInput style={styles.input} value={form.description} onChangeText={(v) => setForm((p) => ({ ...p, description: v }))} placeholder="Task details" />
          <MediaUploader value={form.mediaUrls} onChange={(urls) => setForm((prev) => ({ ...prev, mediaUrls: urls }))} label="Task Media" />
          <FieldLabel text="Status" />
          <View style={styles.pickerWrap}><Picker selectedValue={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>{statuses.map((status) => <Picker.Item key={status} label={status} value={status} />)}</Picker></View>
      </FormDialog>

      <Text style={styles.sectionTitle}>Project Task Table</Text>
      <View style={styles.filterRow}><TextInput style={[styles.input, styles.filterInput]} placeholder="Search category/task/description" value={search} onChangeText={setSearch} /><View style={[styles.pickerWrap, styles.filterPicker]}><Picker selectedValue={statusFilter} onValueChange={setStatusFilter}><Picker.Item label="All Status" value="ALL" />{statuses.map((status) => <Picker.Item key={status} label={status} value={status} />)}</Picker></View></View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={[styles.tableRow, styles.headerRow]}>
            <Text style={[styles.cell, styles.wCategory, styles.headerText]}>Project Category</Text>
            <Text style={[styles.cell, styles.wTask, styles.headerText]}>Task Name</Text>
            <Text style={[styles.cell, styles.wStatus, styles.headerText]}>Status</Text>
            <Text style={[styles.cell, styles.wDate, styles.headerText]}>Date</Text>
            <Text style={[styles.cell, styles.wWorkedBy, styles.headerText]}>Worked By</Text>
            <Text style={[styles.cell, styles.wDesc, styles.headerText]}>Description</Text>
            <Text style={[styles.cell, styles.wActions, styles.headerText]}>Actions</Text>
          </View>
          {filtered.map((item: ProjectTaskRow) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={[styles.cell, styles.wCategory]}>{item.projectCategory}</Text>
              <Text style={[styles.cell, styles.wTask]}>{item.taskName}</Text>
              <View style={[styles.cell, styles.wStatus]}><StatusBadge status={item.status} /></View>
              <Text style={[styles.cell, styles.wDate]}>{item.date}</Text>
              <View style={[styles.cell, styles.wWorkedBy]}>{item.assignedUserIds?.length ? <AvatarGroup users={item.assignedUserIds.map(userLabel)} /> : <Text>-</Text>}</View>
              <Text style={[styles.cell, styles.wDesc]} numberOfLines={2}>{item.description}</Text>
              <View style={[styles.cell, styles.wActions]}>
                <TableRowActions
                  onEdit={() => {
                    setForm({
                      projectCategory: item.projectCategory,
                      taskName: item.taskName,
                      assignedUserIds: item.assignedUserIds ?? [],
                      mediaUrls: item.mediaUrls ?? [],
                      status: item.status as (typeof statuses)[number],
                      date: item.date,
                      description: item.description
                    });
                    setEditingId(item.id);
                    setShowCreateForm(true);
                  }}
                  onDetails={async () => {
                    try {
                      const detail = await getProjectTaskById(item.id);
                      setDetailState({
                        visible: true,
                        title: 'Project Task Details',
                        lines: [
                          { label: 'Task', value: detail.taskName },
                          { label: 'Category', value: detail.projectCategory },
                          { label: 'Status', value: detail.status },
                          { label: 'Date', value: detail.date },
                          { label: 'Description', value: detail.description },
                          { label: 'Assigned Users', value: (detail.assignedUserIds ?? []).map(userLabel).join(', ') || '-' },
                          { label: 'Media', value: String(detail.mediaUrls?.length ?? 0) }
                        ]
                      });
                    } catch {
                      Alert.alert('Error', 'Unable to load task details.');
                    }
                  }}
                />
              </View>
            </View>
          ))}
          {!filtered.length ? <Text style={styles.emptyText}>No rows found</Text> : null}
        </View>
      </ScrollView>
      <RecordDetailsModal
        visible={detailState.visible}
        title={detailState.title}
        lines={detailState.lines}
        onClose={() => setDetailState({ visible: false, title: '', lines: [] })}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.secondary },
  subtitle: { marginTop: 4, marginBottom: 12, color: Colors.textSecondary },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 8, backgroundColor: '#fff' },
  pickerWrap: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden', marginBottom: 8, backgroundColor: '#fff' },
  sectionTitle: { marginTop: 14, marginBottom: 8, fontWeight: '700', fontSize: 16, color: Colors.secondary },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filterInput: { flex: 1, marginBottom: 0 },
  filterPicker: { width: 180, marginBottom: 0 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
  headerRow: { backgroundColor: '#f5f7fb' },
  headerText: { fontWeight: '700', color: Colors.secondary },
  cell: { padding: 10, color: Colors.textPrimary, fontSize: 12 },
  wCategory: { width: 150 },
  wTask: { width: 170 },
  wStatus: { width: 120 },
  wDate: { width: 110 },
  wWorkedBy: { width: 120 },
  wDesc: { width: 230 },
  wActions: { width: 170 },
  assignWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  assignChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#d9deea', backgroundColor: '#fff' },
  assignChipActive: { borderColor: '#b8cdfc', backgroundColor: '#edf3ff' },
  assignChipText: { fontSize: 12, color: Colors.textSecondary },
  assignChipTextActive: { color: Colors.secondary, fontWeight: '700' },
  emptyText: { padding: 12, color: Colors.textSecondary }
});
