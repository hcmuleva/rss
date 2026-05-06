import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AyamEntryRow, AyamMemberRow, createAyamEntry, createAyamMember, deleteAyamMember, getAyamEntries, getAyamEntryById, getAyamMembers, updateAyamEntry, updateAyamMember, updateAyamMemberStatus } from '@/api/ayam.api';
import { AvatarGroup } from '@/components/AvatarGroup';
import { getMasterLists } from '@/api/masterLists.api';
import { getUsers } from '@/api/users.api';
import { DottedAddCard } from '@/components/DottedAddCard';
import { DocumentUploader } from '@/components/DocumentUploader';
import { MediaUploader } from '@/components/MediaUploader';
import { RecordDetailsModal } from '@/components/RecordDetailsModal';
import { ScreenTopBar } from '@/components/ScreenTopBar';
import { TableRowActions } from '@/components/TableRowActions';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';

const subCategories = ['Pralekhan', 'Vanshavali', 'Nidhi', 'Sanskriti', 'MatraShakti', 'Vidhi Aayam'];
const memberSubCategories = ['Nidhi', 'Sanskriti', 'MatraShakti', 'Vidhi Aayam'];
const FieldLabel = ({ text }: { text: string }) => <Text style={styles.label}>{text}</Text>;

export const AyamDetailScreen = (): React.JSX.Element => {
  const route = useRoute();
  const params = (route.params ?? {}) as { nodeId?: string; assignmentKey?: string };
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.role);
  const isAdminRole = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const { data: entries = [] } = useQuery({ queryKey: ['ayam-entries'], queryFn: getAyamEntries });
  const { data: members = [] } = useQuery({ queryKey: ['ayam-members'], queryFn: () => getAyamMembers() });
  const { data: masterLists = [] } = useQuery({ queryKey: ['master-lists'], queryFn: getMasterLists });
  const { data: users = [] } = useQuery({ queryKey: ['admin-users'], queryFn: getUsers, enabled: isAdminRole });
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [showMemberForm, setShowMemberForm] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ subCategory: 'Vidhi Aayam', nodeId: 'h-l5b3-1', assignedUserIds: [] as string[], mediaUrls: [] as string[], documentUrls: [] as string[], description: '', workedFor: '', whoWorked: '', date: new Date().toISOString().slice(0, 10) });
  const [memberForm, setMemberForm] = React.useState({
    subCategory: 'Nidhi' as 'Nidhi' | 'Sanskriti' | 'MatraShakti' | 'Vidhi Aayam',
    nodeId: 'h-l5b3-1',
    memberType: '',
    name: '',
    guardianName: '',
    maritalStatus: 'Single' as 'Single' | 'Married' | 'Widowed' | 'Other',
    dob: '',
    villageOrMohalla: '',
    tehsil: '',
    district: '',
    state: '',
    country: 'India',
    pincode: '',
    photoUrl: '',
    assignedUserIds: [] as string[]
  });
  const [subCategoryFilter, setSubCategoryFilter] = React.useState('ALL');
  const [search, setSearch] = React.useState('');
  const [detailState, setDetailState] = React.useState<{ visible: boolean; title: string; lines: Array<{ label: string; value: string }> }>({ visible: false, title: '', lines: [] });

  const mutation = useMutation({ mutationFn: createAyamEntry, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['ayam-entries'] }); setEditingId(null); setShowCreateForm(false);} });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof createAyamEntry>[0] }) => updateAyamEntry(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ayam-entries'] });
      setEditingId(null);
      setShowCreateForm(false);
    }
  });
  const memberMutation = useMutation({
    mutationFn: createAyamMember,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ayam-members'] });
      setEditingMemberId(null);
      setShowMemberForm(false);
    }
  });
  const updateMemberMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof createAyamMember>[0] }) => updateAyamMember(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ayam-members'] });
      setEditingMemberId(null);
      setShowMemberForm(false);
    }
  });
  const updateMemberStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateAyamMemberStatus(id, isActive),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ayam-members'] });
    }
  });
  const deleteMemberMutation = useMutation({
    mutationFn: deleteAyamMember,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ayam-members'] });
    }
  });

  React.useEffect(() => {
    if (isAdminRole && !form.assignedUserIds.length && users.length) {
      const user = users.find((item) => item.role === 'USER' && item.isActive) ?? users[0];
      setForm((prev) => ({ ...prev, assignedUserIds: user?.id ? [user.id] : [] }));
    }
  }, [form.assignedUserIds.length, isAdminRole, users]);
  React.useEffect(() => {
    if (isAdminRole && !memberForm.assignedUserIds.length && users.length) {
      const user = users.find((item) => item.role === 'USER' && item.isActive) ?? users[0];
      setMemberForm((prev) => ({ ...prev, assignedUserIds: user?.id ? [user.id] : [] }));
    }
  }, [isAdminRole, memberForm.assignedUserIds.length, users]);

  React.useEffect(() => {
    if (params.nodeId) {
      setSearch(params.nodeId);
      setForm((prev) => ({ ...prev, nodeId: params.nodeId ?? prev.nodeId }));
    }
    if (params.assignmentKey) {
      const normalized = params.assignmentKey === 'VidhiAayam' ? 'Vidhi Aayam' : params.assignmentKey;
      if (subCategories.includes(normalized)) {
        setSubCategoryFilter(normalized);
        setForm((prev) => ({ ...prev, subCategory: normalized }));
      } else {
        setSearch((prev) => `${prev} ${params.assignmentKey}`.trim());
      }
    }
  }, [params.assignmentKey, params.nodeId]);

  React.useEffect(() => {
    if (memberSubCategories.includes(form.subCategory)) {
      setMemberForm((prev) => ({
        ...prev,
        subCategory: form.subCategory as 'Nidhi' | 'Sanskriti' | 'MatraShakti' | 'Vidhi Aayam',
        nodeId: form.nodeId
      }));
    }
  }, [form.nodeId, form.subCategory]);

  const submit = async () => {
    const payload = { ...form, assignedUserIds: isAdminRole ? form.assignedUserIds : undefined };
    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, payload });
      return;
    }
    await mutation.mutateAsync(payload);
  };
  const submitMember = async () => {
    if (!memberForm.name || !memberForm.guardianName) {
      Alert.alert('Missing fields', 'Please fill member name and guardian name.');
      return;
    }
    if (!memberForm.villageOrMohalla || !memberForm.district || !memberForm.state || !memberForm.pincode) {
      Alert.alert('Missing address', 'Please fill village/mohalla, district, state, and pincode.');
      return;
    }
    if (memberForm.subCategory !== 'Nidhi' && !memberForm.memberType) {
      Alert.alert('Missing member type', `Please select a member type for ${memberForm.subCategory}.`);
      return;
    }
    const address = [memberForm.villageOrMohalla, memberForm.tehsil, memberForm.district, memberForm.state, memberForm.country, memberForm.pincode]
      .filter(Boolean)
      .join(', ');
    const payload = {
      subCategory: memberForm.subCategory,
      nodeId: memberForm.nodeId,
      memberType: memberForm.memberType || (memberForm.subCategory === 'Nidhi' ? 'DONOR' : undefined),
      name: memberForm.name,
      guardianName: memberForm.guardianName,
      maritalStatus: memberForm.maritalStatus,
      dob: memberForm.dob,
      address,
      addressDetails: {
        villageOrMohalla: memberForm.villageOrMohalla,
        tehsil: memberForm.tehsil,
        district: memberForm.district,
        state: memberForm.state,
        country: memberForm.country,
        pincode: memberForm.pincode
      },
      photoUrl: memberForm.photoUrl || undefined,
      assignedUserIds: isAdminRole ? memberForm.assignedUserIds : undefined
    };
    if (editingMemberId) {
      await updateMemberMutation.mutateAsync({ id: editingMemberId, payload });
      return;
    }
    await memberMutation.mutateAsync(payload);
  };

  const filtered = entries.filter((item) => {
    const categoryOk = subCategoryFilter === 'ALL' || item.subCategory === subCategoryFilter;
    const q = search.trim().toLowerCase();
    const searchOk = !q || `${item.subCategory} ${item.workedFor} ${item.whoWorked} ${item.description}`.toLowerCase().includes(q);
    return categoryOk && searchOk;
  });
  const filteredMembers = members
    .filter((member) => member.subCategory === form.subCategory)
    .filter((member) => {
      const q = search.trim().toLowerCase();
      return !q || `${member.name} ${member.guardianName} ${member.address} ${member.memberType ?? ''}`.toLowerCase().includes(q);
    });
  const memberTypeOptions = React.useMemo(() => {
    if (memberForm.subCategory === 'MatraShakti') {
      return masterLists.filter((item) => item.listType === 'MatraShaktiType').map((item) => item.name_en);
    }
    if (memberForm.subCategory === 'Vidhi Aayam') {
      return masterLists.filter((item) => item.listType === 'VidhiAayamTeam').map((item) => item.name_en);
    }
    if (memberForm.subCategory === 'Sanskriti') {
      return ['Sant', 'Saphakar', 'Badwa', 'Pujari', 'Bhagat'];
    }
    return ['DONOR'];
  }, [masterLists, memberForm.subCategory]);
  const userLabel = (id: string) => users.find((user) => user.id === id)?.name ?? id;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenTopBar title="Ayam Module" />
      <Text style={styles.subtitle}>Capture Ayam sub-category records and monitor progress.</Text>

      {!showCreateForm ? (
        <DottedAddCard label="Ayam Entry Form" onPress={() => { setEditingId(null); setShowCreateForm(true); }} />
      ) : (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{editingId ? 'Edit Ayam Entry' : 'Create Ayam Entry'}</Text>
          <FieldLabel text="Sub Category" />
          <View style={styles.pickerWrap}><Picker selectedValue={form.subCategory} onValueChange={(v) => setForm((p) => ({ ...p, subCategory: v }))}>{subCategories.map((c) => <Picker.Item key={c} label={c} value={c} />)}</Picker></View>
          <FieldLabel text="Node ID" />
          <TextInput style={styles.input} value={form.nodeId} onChangeText={(v) => setForm((p) => ({ ...p, nodeId: v }))} placeholder="h-l5b3-1" />
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
          <FieldLabel text="Worked For" />
          <TextInput style={styles.input} value={form.workedFor} onChangeText={(v) => setForm((p) => ({ ...p, workedFor: v }))} placeholder="Community" />
          <FieldLabel text="Who Worked" />
          <TextInput style={styles.input} value={form.whoWorked} onChangeText={(v) => setForm((p) => ({ ...p, whoWorked: v }))} placeholder="Team member name" />
          <FieldLabel text="Date" />
          <TextInput style={styles.input} value={form.date} onChangeText={(v) => setForm((p) => ({ ...p, date: v }))} placeholder="YYYY-MM-DD" />
          <FieldLabel text="Description" />
          <TextInput style={styles.input} value={form.description} onChangeText={(v) => setForm((p) => ({ ...p, description: v }))} placeholder="Entry details" />
          <MediaUploader value={form.mediaUrls} onChange={(urls) => setForm((prev) => ({ ...prev, mediaUrls: urls }))} label="Ayam Media" />
          {form.subCategory === 'Vidhi Aayam' ? (
            <DocumentUploader value={form.documentUrls} onChange={(urls) => setForm((prev) => ({ ...prev, documentUrls: urls }))} label="Document Upload (PDF/DOC)" />
          ) : null}
          <View style={styles.actionsRow}><TouchableOpacity style={[styles.actionButton, styles.cancelBtn]} onPress={() => { setEditingId(null); setShowCreateForm(false); }}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[styles.actionButton, styles.saveBtn]} onPress={() => void submit()}><Text style={styles.saveText}>{editingId ? 'Update Entry' : 'Save Entry'}</Text></TouchableOpacity></View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Ayam Table</Text>
      <View style={styles.filterRow}><TextInput style={[styles.input, styles.filterInput]} placeholder="Search subcategory/workedFor/whoWorked" value={search} onChangeText={setSearch} /><View style={[styles.pickerWrap, styles.filterPicker]}><Picker selectedValue={subCategoryFilter} onValueChange={setSubCategoryFilter}><Picker.Item label="All Subcategories" value="ALL" />{subCategories.map((c) => <Picker.Item key={c} label={c} value={c} />)}</Picker></View></View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={[styles.tableRow, styles.headerRow]}>
            <Text style={[styles.cell, styles.wSub, styles.headerText]}>Sub Category</Text>
            <Text style={[styles.cell, styles.wNode, styles.headerText]}>Node</Text>
            <Text style={[styles.cell, styles.wDate, styles.headerText]}>Date</Text>
            <Text style={[styles.cell, styles.wWorkedFor, styles.headerText]}>Worked For</Text>
            <Text style={[styles.cell, styles.wWho, styles.headerText]}>Who Worked</Text>
            <Text style={[styles.cell, styles.wDesc, styles.headerText]}>Description</Text>
            <Text style={[styles.cell, styles.wActions, styles.headerText]}>Actions</Text>
          </View>
          {filtered.map((item: AyamEntryRow) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={[styles.cell, styles.wSub]}>{item.subCategory}</Text>
              <Text style={[styles.cell, styles.wNode]}>{item.nodeId}</Text>
              <Text style={[styles.cell, styles.wDate]}>{item.date}</Text>
              <Text style={[styles.cell, styles.wWorkedFor]}>{item.workedFor}</Text>
              <View style={[styles.cell, styles.wWho]}>{item.assignedUserIds?.length ? <AvatarGroup users={item.assignedUserIds.map(userLabel)} /> : <Text>-</Text>}</View>
              <Text style={[styles.cell, styles.wDesc]} numberOfLines={2}>{item.description}</Text>
              <View style={[styles.cell, styles.wActions]}>
                <TableRowActions
                  onEdit={() => {
                    setForm({
                      subCategory: item.subCategory,
                      nodeId: item.nodeId,
                      assignedUserIds: item.assignedUserIds ?? [],
                      mediaUrls: item.mediaUrls ?? [],
                      documentUrls: item.documentUrls ?? [],
                      workedFor: item.workedFor,
                      whoWorked: item.whoWorked,
                      date: item.date,
                      description: item.description
                    });
                    setEditingId(item.id);
                    setShowCreateForm(true);
                  }}
                  onDetails={async () => {
                    try {
                      const detail = await getAyamEntryById(item.id);
                      setDetailState({
                        visible: true,
                        title: 'Ayam Details',
                        lines: [
                          { label: 'Sub Category', value: detail.subCategory },
                          { label: 'Node', value: detail.nodeId },
                          { label: 'Worked For', value: detail.workedFor },
                          { label: 'Who Worked', value: detail.whoWorked },
                          { label: 'Date', value: detail.date },
                          { label: 'Assigned Users', value: (detail.assignedUserIds ?? []).map(userLabel).join(', ') || '-' },
                          { label: 'Media', value: String(detail.mediaUrls?.length ?? 0) },
                          { label: 'Documents', value: String(detail.documentUrls?.length ?? 0) }
                        ]
                      });
                    } catch {
                      Alert.alert('Error', 'Unable to load ayam details.');
                    }
                  }}
                />
              </View>
            </View>
          ))}
          {!filtered.length ? <Text style={styles.emptyText}>No rows found</Text> : null}
        </View>
      </ScrollView>

      {memberSubCategories.includes(form.subCategory) ? (
        <>
          <Text style={styles.sectionTitle}>{form.subCategory} Members</Text>
          {!showMemberForm ? (
            <DottedAddCard
              label={`${form.subCategory} Member Form`}
              onPress={() => {
                setEditingMemberId(null);
                setMemberForm((prev) => ({
                  ...prev,
                  subCategory: form.subCategory as 'Nidhi' | 'Sanskriti' | 'MatraShakti' | 'Vidhi Aayam',
                  nodeId: form.nodeId,
                  memberType: memberTypeOptions[0] ?? '',
                  name: '',
                  guardianName: '',
                  maritalStatus: 'Single',
                  dob: '',
                  villageOrMohalla: '',
                  tehsil: '',
                  district: '',
                  state: '',
                  country: 'India',
                  pincode: '',
                  photoUrl: ''
                }));
                setShowMemberForm(true);
              }}
            />
          ) : (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>{editingMemberId ? 'Edit Member' : 'Create Member'}</Text>
              <FieldLabel text="Node ID" />
              <TextInput style={styles.input} value={memberForm.nodeId} onChangeText={(v) => setMemberForm((p) => ({ ...p, nodeId: v }))} />
              <FieldLabel text="Member Type" />
              <View style={styles.pickerWrap}>
                <Picker selectedValue={memberForm.memberType} onValueChange={(v) => setMemberForm((p) => ({ ...p, memberType: v }))}>
                  {memberTypeOptions.map((item) => (
                    <Picker.Item key={item} label={item} value={item} />
                  ))}
                </Picker>
              </View>
              <FieldLabel text="Name" />
              <TextInput style={styles.input} value={memberForm.name} onChangeText={(v) => setMemberForm((p) => ({ ...p, name: v }))} />
              <FieldLabel text="Father/Husband Name" />
              <TextInput style={styles.input} value={memberForm.guardianName} onChangeText={(v) => setMemberForm((p) => ({ ...p, guardianName: v }))} />
              <FieldLabel text="Marital Status" />
              <View style={styles.pickerWrap}>
                <Picker selectedValue={memberForm.maritalStatus} onValueChange={(v) => setMemberForm((p) => ({ ...p, maritalStatus: v }))}>
                  <Picker.Item label="Single" value="Single" />
                  <Picker.Item label="Married" value="Married" />
                  <Picker.Item label="Widowed" value="Widowed" />
                  <Picker.Item label="Other" value="Other" />
                </Picker>
              </View>
              <FieldLabel text="DOB" />
              <TextInput style={styles.input} value={memberForm.dob} onChangeText={(v) => setMemberForm((p) => ({ ...p, dob: v }))} placeholder="YYYY-MM-DD" />
              <FieldLabel text="Village / Mohalla" />
              <TextInput style={styles.input} value={memberForm.villageOrMohalla} onChangeText={(v) => setMemberForm((p) => ({ ...p, villageOrMohalla: v }))} />
              <FieldLabel text="Tehsil" />
              <TextInput style={styles.input} value={memberForm.tehsil} onChangeText={(v) => setMemberForm((p) => ({ ...p, tehsil: v }))} />
              <View style={styles.filterRow}>
                <TextInput style={[styles.input, styles.filterInput]} value={memberForm.district} onChangeText={(v) => setMemberForm((p) => ({ ...p, district: v }))} placeholder="District" />
                <TextInput style={[styles.input, styles.filterInput]} value={memberForm.state} onChangeText={(v) => setMemberForm((p) => ({ ...p, state: v }))} placeholder="State" />
              </View>
              <View style={styles.filterRow}>
                <TextInput style={[styles.input, styles.filterInput]} value={memberForm.country} onChangeText={(v) => setMemberForm((p) => ({ ...p, country: v }))} placeholder="Country" />
                <TextInput style={[styles.input, styles.filterInput]} value={memberForm.pincode} onChangeText={(v) => setMemberForm((p) => ({ ...p, pincode: v }))} placeholder="Pincode" keyboardType="numeric" />
              </View>
              <MediaUploader
                value={memberForm.photoUrl ? [memberForm.photoUrl] : []}
                onChange={(urls) => setMemberForm((p) => ({ ...p, photoUrl: urls[0] ?? '' }))}
                label="Member Photo"
              />
              {isAdminRole ? (
                <>
                  <FieldLabel text="Assign To Users" />
                  <View style={styles.assignWrap}>
                    {users
                      .filter((item) => item.role === 'USER' && item.isActive)
                      .map((user) => {
                        const selected = memberForm.assignedUserIds.includes(user.id);
                        return (
                          <TouchableOpacity
                            key={user.id}
                            style={[styles.assignChip, selected && styles.assignChipActive]}
                            onPress={() =>
                              setMemberForm((prev) => ({
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
              <View style={styles.actionsRow}>
                <TouchableOpacity style={[styles.actionButton, styles.cancelBtn]} onPress={() => setShowMemberForm(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.saveBtn]} onPress={() => void submitMember()}>
                  <Text style={styles.saveText}>{editingMemberId ? 'Update Member' : 'Save Member'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {filteredMembers.map((member: AyamMemberRow) => (
            <View key={member.id} style={styles.userMemberRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.userMemberTitle}>{member.name} ({member.memberType ?? '-'}) {member.isActive === false ? '• Inactive' : ''}</Text>
                <Text style={styles.userMemberSub}>{member.guardianName} • {member.maritalStatus} • {member.dob}</Text>
                <Text style={styles.userMemberSub}>{member.address}</Text>
              </View>
              <View style={styles.rowActionsWrap}>
                <TableRowActions
                  onEdit={() => {
                    setMemberForm({
                      subCategory: member.subCategory,
                      nodeId: member.nodeId,
                      memberType: member.memberType ?? '',
                      name: member.name,
                      guardianName: member.guardianName,
                      maritalStatus: member.maritalStatus,
                      dob: member.dob,
                      villageOrMohalla: member.addressDetails?.villageOrMohalla ?? '',
                      tehsil: member.addressDetails?.tehsil ?? '',
                      district: member.addressDetails?.district ?? '',
                      state: member.addressDetails?.state ?? '',
                      country: member.addressDetails?.country ?? 'India',
                      pincode: member.addressDetails?.pincode ?? '',
                      photoUrl: member.photoUrl ?? '',
                      assignedUserIds: member.assignedUserIds
                    });
                    setEditingMemberId(member.id);
                    setShowMemberForm(true);
                  }}
                  onDetails={() =>
                    setDetailState({
                      visible: true,
                      title: 'Member Details',
                      lines: [
                        { label: 'Name', value: member.name },
                        { label: 'Type', value: member.memberType ?? '-' },
                        { label: 'Guardian', value: member.guardianName },
                        { label: 'DOB', value: member.dob },
                        { label: 'Marital', value: member.maritalStatus },
                        { label: 'Address', value: member.address },
                        { label: 'Pincode', value: member.addressDetails?.pincode ?? '-' },
                        { label: 'Status', value: member.isActive === false ? 'Inactive' : 'Active' }
                      ]
                    })
                  }
                />
                {isAdminRole ? (
                  <>
                    <TouchableOpacity
                      style={[styles.statusBtn, member.isActive === false ? styles.activeBtn : styles.inactiveBtn]}
                      onPress={() => void updateMemberStatusMutation.mutateAsync({ id: member.id, isActive: member.isActive === false })}
                    >
                      <Text style={styles.statusBtnText}>{member.isActive === false ? 'Activate' : 'Deactivate'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.statusBtn, styles.inactiveBtn]} onPress={() => void deleteMemberMutation.mutateAsync(member.id)}>
                      <Text style={styles.statusBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            </View>
          ))}
          {!filteredMembers.length ? <Text style={styles.emptyText}>No member rows for {form.subCategory}</Text> : null}
        </>
      ) : null}
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
  filterPicker: { width: 190, marginBottom: 0 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
  headerRow: { backgroundColor: '#f5f7fb' },
  headerText: { fontWeight: '700', color: Colors.secondary },
  cell: { padding: 10, color: Colors.textPrimary, fontSize: 12 },
  wSub: { width: 140 },
  wNode: { width: 120 },
  wDate: { width: 110 },
  wWorkedFor: { width: 130 },
  wWho: { width: 130 },
  wDesc: { width: 230 },
  wActions: { width: 170 },
  assignWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  assignChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#d9deea', backgroundColor: '#fff' },
  assignChipActive: { borderColor: '#b8cdfc', backgroundColor: '#edf3ff' },
  assignChipText: { fontSize: 12, color: Colors.textSecondary },
  assignChipTextActive: { color: Colors.secondary, fontWeight: '700' },
  userMemberRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8e8ee', borderRadius: 10, padding: 10, marginTop: 8 },
  userMemberTitle: { color: Colors.textPrimary, fontWeight: '700' },
  userMemberSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  rowActionsWrap: { gap: 6, alignItems: 'flex-end' },
  statusBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  activeBtn: { backgroundColor: '#ffe8e8' },
  inactiveBtn: { backgroundColor: '#edf3ff' },
  statusBtnText: { color: Colors.secondary, fontWeight: '700', fontSize: 12 },
  emptyText: { padding: 12, color: Colors.textSecondary }
});
