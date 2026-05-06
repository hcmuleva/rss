import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createSensitiveEntry, getSensitiveEntries, getSensitiveEntryById, updateSensitiveEntry } from '@/api/sensitive.api';
import { AvatarGroup } from '@/components/AvatarGroup';
import { getUsers } from '@/api/users.api';
import { DottedAddCard } from '@/components/DottedAddCard';
import { MediaUploader } from '@/components/MediaUploader';
import { RecordDetailsModal } from '@/components/RecordDetailsModal';
import { ScreenTopBar } from '@/components/ScreenTopBar';
import { StatusBadge } from '@/components/StatusBadge';
import { TableRowActions } from '@/components/TableRowActions';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';

const statusOptions = ['Assigned', 'Delayed', 'NotStarted', 'Completed', 'NotReady', 'OnHold'] as const;

const FieldLabel = ({ text }: { text: string }) => <Text style={styles.label}>{text}</Text>;

export const SensitiveDetailScreen = (): React.JSX.Element => {
  const route = useRoute();
  const params = (route.params ?? {}) as { nodeId?: string; assignmentKey?: string };
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.role);
  const isAdminRole = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const { data: entries = [] } = useQuery({ queryKey: ['sensitive-entries'], queryFn: getSensitiveEntries });
  const { data: users = [] } = useQuery({ queryKey: ['admin-users'], queryFn: getUsers, enabled: isAdminRole });
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    nodeId: 'h-l5b3-1',
    assignedUserIds: [] as string[],
    fromType: 'Hindu',
    toType: 'Other',
    date: new Date().toISOString().slice(0, 10),
    isPartial: false,
    hinduCount: '0',
    convertedCount: '0',
    status: 'Assigned' as (typeof statusOptions)[number],
    address: 'Nandlalpura, Indore',
    mediaUrls: [] as string[]
  });
  const [statusFilter, setStatusFilter] = React.useState('ALL');
  const [search, setSearch] = React.useState('');
  const [detailState, setDetailState] = React.useState<{ visible: boolean; title: string; lines: Array<{ label: string; value: string }> }>({ visible: false, title: '', lines: [] });

  const mutation = useMutation({
    mutationFn: createSensitiveEntry,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sensitive-entries'] });
      setEditingId(null);
      setShowCreateForm(false);
    }
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof createSensitiveEntry>[0] }) => updateSensitiveEntry(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sensitive-entries'] });
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
    if (params.nodeId) {
      setSearch(params.nodeId);
      setForm((prev) => ({ ...prev, nodeId: params.nodeId ?? prev.nodeId }));
    }
    if (params.assignmentKey) {
      setSearch((prev) => `${prev} ${params.assignmentKey}`.trim());
    }
  }, [params.assignmentKey, params.nodeId]);

  const submit = async () => {
    const payload = {
      nodeId: form.nodeId,
      assignedUserIds: isAdminRole ? form.assignedUserIds : undefined,
      fromType: form.fromType,
      toType: form.toType,
      date: form.date,
      isPartial: form.isPartial,
      hinduCount: Number(form.hinduCount),
      convertedCount: Number(form.convertedCount),
      status: form.status,
      address: form.address,
      mediaUrls: form.mediaUrls
    };
    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, payload });
      return;
    }
    await mutation.mutateAsync(payload);
  };

  const filtered = entries.filter((item) => {
    const statusOk = statusFilter === 'ALL' || item.status === statusFilter;
    const q = search.trim().toLowerCase();
    const searchOk = !q || `${item.nodeId} ${item.address ?? ''} ${item.fromType} ${item.toType}`.toLowerCase().includes(q);
    return statusOk && searchOk;
  });
  const userLabel = (id: string) => users.find((user) => user.id === id)?.name ?? id;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenTopBar title="Sensitive Module" />
      <Text style={styles.subtitle}>Capture conversion-sensitive area updates with structured fields.</Text>

      {!showCreateForm ? (
        <DottedAddCard label="Sensitive Entry Form" onPress={() => { setEditingId(null); setShowCreateForm(true); }} />
      ) : (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{editingId ? 'Edit Sensitive Entry' : 'Create Sensitive Entry'}</Text>
          <FieldLabel text="Area Node ID" />
          <TextInput style={styles.input} value={form.nodeId} onChangeText={(v) => setForm((p) => ({ ...p, nodeId: v }))} placeholder="e.g. h-l5b3-1" />

          <View style={styles.row}>
            <View style={styles.halfWrap}><FieldLabel text="From" /><TextInput style={styles.input} value={form.fromType} onChangeText={(v) => setForm((p) => ({ ...p, fromType: v }))} placeholder="Hindu" /></View>
            <View style={styles.halfWrap}><FieldLabel text="To" /><TextInput style={styles.input} value={form.toType} onChangeText={(v) => setForm((p) => ({ ...p, toType: v }))} placeholder="Other" /></View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfWrap}><FieldLabel text="Date" /><TextInput style={styles.input} value={form.date} onChangeText={(v) => setForm((p) => ({ ...p, date: v }))} placeholder="YYYY-MM-DD" /></View>
            <View style={styles.halfWrap}><FieldLabel text="Address" /><TextInput style={styles.input} value={form.address} onChangeText={(v) => setForm((p) => ({ ...p, address: v }))} placeholder="Area address" /></View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfWrap}><FieldLabel text="Still Hindu" /><TextInput style={styles.input} value={form.hinduCount} onChangeText={(v) => setForm((p) => ({ ...p, hinduCount: v }))} keyboardType="numeric" /></View>
            <View style={styles.halfWrap}><FieldLabel text="Converted" /><TextInput style={styles.input} value={form.convertedCount} onChangeText={(v) => setForm((p) => ({ ...p, convertedCount: v }))} keyboardType="numeric" /></View>
          </View>

          <FieldLabel text="Status" />
          <View style={styles.pickerWrap}><Picker selectedValue={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>{statusOptions.map((status) => <Picker.Item key={status} label={status} value={status} />)}</Picker></View>
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
          <MediaUploader value={form.mediaUrls} onChange={(urls) => setForm((prev) => ({ ...prev, mediaUrls: urls }))} label="Sensitive Media" />

          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.actionButton, styles.cancelBtn]} onPress={() => { setEditingId(null); setShowCreateForm(false); }}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.saveBtn]} onPress={() => void submit()}><Text style={styles.saveText}>{editingId ? 'Update Entry' : 'Save Entry'}</Text></TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Sensitive Table</Text>
      <View style={styles.filterRow}>
        <TextInput style={[styles.input, styles.filterInput]} placeholder="Search area/from/to" value={search} onChangeText={setSearch} />
        <View style={[styles.pickerWrap, styles.filterPicker]}><Picker selectedValue={statusFilter} onValueChange={setStatusFilter}><Picker.Item label="All Status" value="ALL" />{statusOptions.map((status) => <Picker.Item key={status} label={status} value={status} />)}</Picker></View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={[styles.tableRow, styles.headerRow]}>
            <Text style={[styles.cell, styles.wArea, styles.headerText]}>Area Name</Text>
            <Text style={[styles.cell, styles.wAddress, styles.headerText]}>Address</Text>
            <Text style={[styles.cell, styles.wTeam, styles.headerText]}>Team</Text>
            <Text style={[styles.cell, styles.wStatus, styles.headerText]}>Status</Text>
            <Text style={[styles.cell, styles.wFromTo, styles.headerText]}>From→To</Text>
            <Text style={[styles.cell, styles.wDate, styles.headerText]}>Date</Text>
            <Text style={[styles.cell, styles.wPart, styles.headerText]}>Fully/Partially</Text>
            <Text style={[styles.cell, styles.wActions, styles.headerText]}>Actions</Text>
          </View>
          {filtered.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={[styles.cell, styles.wArea]}>{item.nodeId}</Text>
              <Text style={[styles.cell, styles.wAddress]}>{item.address ?? '-'}</Text>
              <View style={[styles.cell, styles.wTeam]}>{item.assignedUserIds?.length ? <AvatarGroup users={item.assignedUserIds.map(userLabel)} /> : <Text>-</Text>}</View>
              <View style={[styles.cell, styles.wStatus]}><StatusBadge status={item.status} /></View>
              <Text style={[styles.cell, styles.wFromTo]}>{item.fromType} → {item.toType}</Text>
              <Text style={[styles.cell, styles.wDate]}>{item.date}</Text>
              <Text style={[styles.cell, styles.wPart]}>{item.isPartial ? `Partial (${item.hinduCount ?? 0}/${item.convertedCount ?? 0})` : 'Fully'}</Text>
              <View style={[styles.cell, styles.wActions]}>
                <TableRowActions
                  onEdit={() => {
                    setForm((prev) => ({ ...prev, nodeId: item.nodeId, assignedUserIds: item.assignedUserIds ?? [], fromType: item.fromType, toType: item.toType, date: item.date, address: item.address ?? '', status: item.status, mediaUrls: item.mediaUrls ?? [] }));
                    setEditingId(item.id);
                    setShowCreateForm(true);
                  }}
                  onDetails={async () => {
                    try {
                      const detail = await getSensitiveEntryById(item.id);
                      setDetailState({
                        visible: true,
                        title: 'Sensitive Entry Details',
                        lines: [
                          { label: 'Node', value: detail.nodeId },
                          { label: 'Status', value: detail.status },
                          { label: 'From → To', value: `${detail.fromType} → ${detail.toType}` },
                          { label: 'Date', value: detail.date },
                          { label: 'Address', value: detail.address ?? '-' },
                          { label: 'Partial', value: detail.isPartial ? `Yes (${detail.hinduCount ?? 0}/${detail.convertedCount ?? 0})` : 'No' },
                          { label: 'Assigned Users', value: (detail.assignedUserIds ?? []).map(userLabel).join(', ') || '-' },
                          { label: 'Media', value: String(detail.mediaUrls?.length ?? 0) }
                        ]
                      });
                    } catch {
                      Alert.alert('Error', 'Unable to load entry details.');
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
  formCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e6e6e9', padding: 12, marginBottom: 10 },
  formTitle: { fontWeight: '800', color: Colors.secondary, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 8, backgroundColor: '#fff' },
  row: { flexDirection: 'row', gap: 8 },
  halfWrap: { flex: 1 },
  pickerWrap: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden', marginBottom: 8, backgroundColor: '#fff' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionButton: { flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#eef1f6' },
  saveBtn: { backgroundColor: Colors.primary },
  cancelText: { color: Colors.secondary, fontWeight: '700' },
  saveText: { color: '#fff', fontWeight: '700' },
  sectionTitle: { marginTop: 14, marginBottom: 8, fontWeight: '700', fontSize: 16, color: Colors.secondary },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filterInput: { flex: 1, marginBottom: 0 },
  filterPicker: { width: 180, marginBottom: 0 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
  headerRow: { backgroundColor: '#f5f7fb', borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  headerText: { fontWeight: '700', color: Colors.secondary },
  cell: { padding: 10, color: Colors.textPrimary, fontSize: 12 },
  wArea: { width: 120 },
  wAddress: { width: 190 },
  wTeam: { width: 90 },
  wStatus: { width: 110 },
  wFromTo: { width: 120 },
  wDate: { width: 110 },
  wPart: { width: 170 },
  wActions: { width: 170 },
  assignWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  assignChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#d9deea', backgroundColor: '#fff' },
  assignChipActive: { borderColor: '#b8cdfc', backgroundColor: '#edf3ff' },
  assignChipText: { fontSize: 12, color: Colors.textSecondary },
  assignChipTextActive: { color: Colors.secondary, fontWeight: '700' },
  emptyText: { padding: 12, color: Colors.textSecondary }
});
