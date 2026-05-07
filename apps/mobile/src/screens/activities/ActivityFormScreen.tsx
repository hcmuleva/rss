import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ActivityRow, createActivity, getActivities, getActivityById, updateActivity } from '@/api/activities.api';
import { AvatarGroup } from '@/components/AvatarGroup';
import { getUsers } from '@/api/users.api';
import { DottedAddCard } from '@/components/DottedAddCard';
import { FormDialog } from '@/components/FormDialog';
import { MediaUploader } from '@/components/MediaUploader';
import { RecordDetailsModal } from '@/components/RecordDetailsModal';
import { ScreenTopBar } from '@/components/ScreenTopBar';
import { TableRowActions } from '@/components/TableRowActions';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';

const categories = ['Satsang', 'DharmRakshaSutra', 'DharmRakshaDivas', 'BharatMataPujan', 'SanYatra'];
const FieldLabel = ({ text }: { text: string }) => <Text style={styles.label}>{text}</Text>;

export const ActivityFormScreen = (): React.JSX.Element => {
  const route = useRoute();
  const params = (route.params ?? {}) as { nodeId?: string; assignmentKey?: string };
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.role);
  const isAdminRole = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const { data: rows = [] } = useQuery({ queryKey: ['activities'], queryFn: getActivities });
  const { data: users = [] } = useQuery({ queryKey: ['admin-users'], queryFn: getUsers, enabled: isAdminRole });
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ nodeId: 'h-l5b3-1', assignedUserIds: [] as string[], mediaUrls: [] as string[], category: 'Satsang', date: new Date().toISOString().slice(0, 10), description: '', maleOld: '0', maleYoung: '0', maleKids: '0', femaleOld: '0', femaleYoung: '0', femaleKids: '0' });
  const [categoryFilter, setCategoryFilter] = React.useState('ALL');
  const [search, setSearch] = React.useState('');
  const [detailState, setDetailState] = React.useState<{ visible: boolean; title: string; lines: Array<{ label: string; value: string }> }>({ visible: false, title: '', lines: [] });

  const mutation = useMutation({ mutationFn: createActivity, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['activities'] }); setEditingId(null); setShowCreateForm(false);} });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof createActivity>[0] }) => updateActivity(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['activities'] });
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
    if (params.assignmentKey && categories.includes(params.assignmentKey)) {
      setCategoryFilter(params.assignmentKey);
      setForm((prev) => ({ ...prev, category: params.assignmentKey ?? prev.category }));
    }
    if (params.nodeId) {
      setSearch(params.nodeId);
      setForm((prev) => ({ ...prev, nodeId: params.nodeId ?? prev.nodeId }));
    }
  }, [params.assignmentKey, params.nodeId]);

  const submit = async () => {
    const payload = { nodeId: form.nodeId, assignedUserIds: isAdminRole ? form.assignedUserIds : undefined, mediaUrls: form.mediaUrls, category: form.category, date: form.date, description: form.description, maleOld: Number(form.maleOld), maleYoung: Number(form.maleYoung), maleKids: Number(form.maleKids), femaleOld: Number(form.femaleOld), femaleYoung: Number(form.femaleYoung), femaleKids: Number(form.femaleKids) };
    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, payload });
      return;
    }
    await mutation.mutateAsync(payload);
  };

  const filtered = rows.filter((item) => {
    const categoryOk = categoryFilter === 'ALL' || item.category === categoryFilter;
    const q = search.trim().toLowerCase();
    const searchOk = !q || `${item.nodeId} ${item.category} ${item.description}`.toLowerCase().includes(q);
    return categoryOk && searchOk;
  });
  const userLabel = (id: string) => users.find((user) => user.id === id)?.name ?? id;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenTopBar title="Activities Module" />
      <Text style={styles.subtitle}>Create and track activity events with attendance details.</Text>

      <DottedAddCard label="Activity Form" onPress={() => { setEditingId(null); setShowCreateForm(true); }} />
      <FormDialog
        visible={showCreateForm}
        title={editingId ? 'Edit Activity' : 'Create Activity'}
        submitLabel={editingId ? 'Update Activity' : 'Save Activity'}
        onClose={() => { setEditingId(null); setShowCreateForm(false); }}
        onSubmit={() => void submit()}
      >
          <FieldLabel text="Node ID" />
          <TextInput style={styles.input} value={form.nodeId} onChangeText={(v) => setForm((p) => ({ ...p, nodeId: v }))} placeholder="e.g. h-l5b3-1" />
          <FieldLabel text="Category" />
          <View style={styles.pickerWrap}><Picker selectedValue={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>{categories.map((c) => <Picker.Item key={c} label={c} value={c} />)}</Picker></View>
          {isAdminRole ? (
            <>
              <FieldLabel text="Assign To Users" />
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
          <MediaUploader value={form.mediaUrls} onChange={(urls) => setForm((prev) => ({ ...prev, mediaUrls: urls }))} label="Activity Media" />
          <FieldLabel text="Date" />
          <TextInput style={styles.input} value={form.date} onChangeText={(v) => setForm((p) => ({ ...p, date: v }))} placeholder="YYYY-MM-DD" />
          <FieldLabel text="Description" />
          <TextInput style={styles.input} value={form.description} onChangeText={(v) => setForm((p) => ({ ...p, description: v }))} placeholder="Activity description" />

          <Text style={styles.groupTitle}>Attendance</Text>
          <View style={styles.row}><View style={styles.halfWrap}><FieldLabel text="Male Old" /><TextInput style={styles.input} value={form.maleOld} keyboardType="numeric" onChangeText={(v) => setForm((p) => ({ ...p, maleOld: v }))} /></View><View style={styles.halfWrap}><FieldLabel text="Male Young" /><TextInput style={styles.input} value={form.maleYoung} keyboardType="numeric" onChangeText={(v) => setForm((p) => ({ ...p, maleYoung: v }))} /></View></View>
          <View style={styles.row}><View style={styles.halfWrap}><FieldLabel text="Male Kids" /><TextInput style={styles.input} value={form.maleKids} keyboardType="numeric" onChangeText={(v) => setForm((p) => ({ ...p, maleKids: v }))} /></View><View style={styles.halfWrap}><FieldLabel text="Female Old" /><TextInput style={styles.input} value={form.femaleOld} keyboardType="numeric" onChangeText={(v) => setForm((p) => ({ ...p, femaleOld: v }))} /></View></View>
          <View style={styles.row}><View style={styles.halfWrap}><FieldLabel text="Female Young" /><TextInput style={styles.input} value={form.femaleYoung} keyboardType="numeric" onChangeText={(v) => setForm((p) => ({ ...p, femaleYoung: v }))} /></View><View style={styles.halfWrap}><FieldLabel text="Female Kids" /><TextInput style={styles.input} value={form.femaleKids} keyboardType="numeric" onChangeText={(v) => setForm((p) => ({ ...p, femaleKids: v }))} /></View></View>
      </FormDialog>

      <Text style={styles.sectionTitle}>Activities Table</Text>
      <View style={styles.filterRow}><TextInput style={[styles.input, styles.filterInput]} placeholder="Search area/category/description" value={search} onChangeText={setSearch} /><View style={[styles.pickerWrap, styles.filterPicker]}><Picker selectedValue={categoryFilter} onValueChange={setCategoryFilter}><Picker.Item label="All Categories" value="ALL" />{categories.map((c) => <Picker.Item key={c} label={c} value={c} />)}</Picker></View></View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={[styles.tableRow, styles.headerRow]}>
            <Text style={[styles.cell, styles.wMedia, styles.headerText]}>Media</Text>
            <Text style={[styles.cell, styles.wArea, styles.headerText]}>Area/Level</Text>
            <Text style={[styles.cell, styles.wDate, styles.headerText]}>Date</Text>
            <Text style={[styles.cell, styles.wCategory, styles.headerText]}>Category</Text>
            <Text style={[styles.cell, styles.wDesc, styles.headerText]}>Description</Text>
            <Text style={[styles.cell, styles.wCreator, styles.headerText]}>Created By</Text>
            <Text style={[styles.cell, styles.wActions, styles.headerText]}>Actions</Text>
          </View>
          {filtered.map((item: ActivityRow) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={[styles.cell, styles.wMedia]}>0 files</Text>
              <Text style={[styles.cell, styles.wArea]}>{item.nodeId}</Text>
              <Text style={[styles.cell, styles.wDate]}>{item.date}</Text>
              <Text style={[styles.cell, styles.wCategory]}>{item.category}</Text>
              <Text style={[styles.cell, styles.wDesc]} numberOfLines={2}>{item.description}</Text>
              <View style={[styles.cell, styles.wCreator]}>{item.assignedUserIds?.length ? <AvatarGroup users={item.assignedUserIds.map(userLabel)} /> : <Text>-</Text>}</View>
              <View style={[styles.cell, styles.wActions]}>
                <TableRowActions
                  onEdit={() => {
                    setForm({
                      nodeId: item.nodeId,
                      assignedUserIds: item.assignedUserIds ?? [],
                      mediaUrls: item.mediaUrls ?? [],
                      category: item.category,
                      date: item.date,
                      description: item.description,
                      maleOld: String(item.maleOld),
                      maleYoung: String(item.maleYoung),
                      maleKids: String(item.maleKids),
                      femaleOld: String(item.femaleOld),
                      femaleYoung: String(item.femaleYoung),
                      femaleKids: String(item.femaleKids)
                    });
                    setEditingId(item.id);
                    setShowCreateForm(true);
                  }}
                  onDetails={async () => {
                    try {
                      const detail = await getActivityById(item.id);
                      setDetailState({
                        visible: true,
                        title: 'Activity Details',
                        lines: [
                          { label: 'Category', value: detail.category },
                          { label: 'Node', value: detail.nodeId },
                          { label: 'Date', value: detail.date },
                          { label: 'Description', value: detail.description },
                          { label: 'Male Attendance', value: `${detail.maleOld}/${detail.maleYoung}/${detail.maleKids}` },
                          { label: 'Female Attendance', value: `${detail.femaleOld}/${detail.femaleYoung}/${detail.femaleKids}` },
                          { label: 'Assigned Users', value: (detail.assignedUserIds ?? []).map(userLabel).join(', ') || '-' },
                          { label: 'Media', value: String(detail.mediaUrls?.length ?? 0) }
                        ]
                      });
                    } catch {
                      Alert.alert('Error', 'Unable to load activity details.');
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
  groupTitle: { marginBottom: 6, marginTop: 2, fontWeight: '700', color: Colors.secondary },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 8, backgroundColor: '#fff' },
  row: { flexDirection: 'row', gap: 8 },
  halfWrap: { flex: 1 },
  pickerWrap: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden', marginBottom: 8, backgroundColor: '#fff' },
  sectionTitle: { marginTop: 14, marginBottom: 8, fontWeight: '700', fontSize: 16, color: Colors.secondary },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filterInput: { flex: 1, marginBottom: 0 },
  filterPicker: { width: 190, marginBottom: 0 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
  headerRow: { backgroundColor: '#f5f7fb' },
  headerText: { fontWeight: '700', color: Colors.secondary },
  cell: { padding: 10, color: Colors.textPrimary, fontSize: 12 },
  wMedia: { width: 80 },
  wArea: { width: 130 },
  wDate: { width: 110 },
  wCategory: { width: 150 },
  wDesc: { width: 220 },
  wCreator: { width: 100 },
  wActions: { width: 170 },
  assignWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  assignChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#d9deea', backgroundColor: '#fff' },
  assignChipActive: { borderColor: '#b8cdfc', backgroundColor: '#edf3ff' },
  assignChipText: { fontSize: 12, color: Colors.textSecondary },
  assignChipTextActive: { color: Colors.secondary, fontWeight: '700' },
  emptyText: { padding: 12, color: Colors.textSecondary }
});
