import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { TreeView } from '@/components/TreeView';
import { DottedAddCard } from '@/components/DottedAddCard';
import { TreeSelect } from '@/components/TreeSelect';
import { Colors } from '@/constants/colors';
import { createHierarchyNode, getHierarchyNodes } from '@/api/hierarchy.api';
import { createUser, getUsers, updateUser, updateUserStatus } from '@/api/users.api';
import { createMasterListItem, deleteMasterListItem, getMasterLists } from '@/api/masterLists.api';
import { deleteAssignment, getAssignments, saveAssignment } from '@/api/assignments.api';
import { TableRowActions } from '@/components/TableRowActions';
import { useAuthStore } from '@/store/authStore';

const LEVEL_META = [
  { key: 'PRANT', code: 'L1', label: 'Prant' },
  { key: 'SAMBHAG', code: 'L2', label: 'Sambhag' },
  { key: 'VIBHAG', code: 'L3', label: 'Vibhag' },
  { key: 'DISTRICT', code: 'L4', label: 'District' },
  { key: 'KHAND', code: 'L5a1', label: 'Khand (Rural)' },
  { key: 'MANDAL', code: 'L5a2', label: 'Mandal (Rural)' },
  { key: 'GRAM', code: 'L5a3', label: 'Gram (Rural)' },
  { key: 'NAGAR', code: 'L5b1', label: 'Nagar (Urban)' },
  { key: 'BASTI', code: 'L5b2', label: 'Basti (Urban)' },
  { key: 'MOHALLA', code: 'L5b3', label: 'Mohalla (Urban)' }
] as const;

const levelToCode = Object.fromEntries(LEVEL_META.map((item) => [item.key, item.code]));
const levelToLabel = Object.fromEntries(LEVEL_META.map((item) => [item.key, item.label]));
const CORE_LEVELS = new Set(['PRANT', 'SAMBHAG', 'VIBHAG', 'DISTRICT']);
const AYAM_SUB_CATEGORIES = ['Pralekhan', 'Vanshavali', 'Nidhi', 'Sanskriti', 'MatraShakti', 'VidhiAayam'];
const FieldLabel = ({ text }: { text: string }) => <Text style={styles.label}>{text}</Text>;

type Panel = 'locations' | 'admin' | 'super';
type AdminTab = 'users' | 'assignments';

const initialLocationForm = {
  name_hi: '',
  name_en: '',
  level: 'KHAND',
  branch: 'rural' as 'rural' | 'urban',
  parentId: null as string | null,
  villageOrMohalla: '',
  tehsil: '',
  district: '',
  state: '',
  country: 'India',
  pincode: '',
  lat: '0',
  long: '0'
};

export const TeamScreen = (): React.JSX.Element => {
  const role = useAuthStore((state) => state.role);
  const currentAssignedNodeId = useAuthStore((state) => state.assignedNodeId);
  const route = useRoute();
  const queryClient = useQueryClient();

  const [panel, setPanel] = React.useState<Panel>(route.name === 'Admin' ? (role === 'SUPER_ADMIN' ? 'super' : 'admin') : 'locations');
  const [adminTab, setAdminTab] = React.useState<AdminTab>('users');
  const [showLocationForm, setShowLocationForm] = React.useState(false);
  const [showUserForm, setShowUserForm] = React.useState(false);
  const [showMasterForm, setShowMasterForm] = React.useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = React.useState(false);
  const [editingUserId, setEditingUserId] = React.useState<string | null>(null);

  const [locationForm, setLocationForm] = React.useState(initialLocationForm);
  const [userForm, setUserForm] = React.useState({ name: '', phone: '', password: '', role: 'USER' as 'ADMIN' | 'USER', assignedNodeId: '', isFullTime: false });
  const [masterForm, setMasterForm] = React.useState({ listType: 'ConversionFrom' as 'ConversionFrom' | 'ConversionTo' | 'ProjectCategories' | 'MatraShaktiType' | 'VidhiAayamTeam', name_hi: '', name_en: '' });
  const [assignmentForm, setAssignmentForm] = React.useState({
    moduleType: 'Project' as 'Sensitive' | 'Activities' | 'Project' | 'Ayam' | 'DharmRaksha' | 'FullTime',
    assignmentKey: '',
    nodeId: null as string | null,
    assignedUserIds: [] as string[]
  });
  const [assignmentModuleFilter, setAssignmentModuleFilter] = React.useState<'ALL' | 'Sensitive' | 'Activities' | 'Project' | 'Ayam' | 'DharmRaksha' | 'FullTime'>('ALL');
  const [assignmentNodeFilter, setAssignmentNodeFilter] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (route.name === 'Admin') {
      setPanel(role === 'SUPER_ADMIN' ? 'super' : 'admin');
      return;
    }
    setPanel('locations');
  }, [route.name, role]);

  const { data: nodes = [] } = useQuery({ queryKey: ['hierarchy-nodes'], queryFn: getHierarchyNodes });
  const { data: users = [] } = useQuery({ queryKey: ['admin-users'], queryFn: getUsers, enabled: role !== 'USER' });
  const { data: masterLists = [] } = useQuery({ queryKey: ['master-lists'], queryFn: getMasterLists, enabled: role !== 'USER' });
  const { data: assignments = [] } = useQuery({ queryKey: ['module-assignments'], queryFn: getAssignments, enabled: role !== 'USER' });

  React.useEffect(() => {
    if (!userForm.assignedNodeId && nodes.length) {
      setUserForm((prev) => ({ ...prev, assignedNodeId: nodes[0].id }));
    }
  }, [nodes, userForm.assignedNodeId]);

  React.useEffect(() => {
    if (!assignmentForm.assignedUserIds.length) {
      const firstUser = users.find((item) => item.role === 'USER' && item.isActive);
      if (firstUser) {
        setAssignmentForm((prev) => ({ ...prev, assignedUserIds: [firstUser.id] }));
      }
    }
  }, [assignmentForm.assignedUserIds.length, users]);

  React.useEffect(() => {
    if (role === 'ADMIN' && !assignmentForm.nodeId) {
      setAssignmentForm((prev) => ({ ...prev, nodeId: currentAssignedNodeId ?? null }));
    }
  }, [assignmentForm.nodeId, currentAssignedNodeId, role]);

  const createLocationMutation = useMutation({
    mutationFn: createHierarchyNode,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['hierarchy-nodes'] });
      setLocationForm(initialLocationForm);
      setShowLocationForm(false);
    }
  });

  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setUserForm({ name: '', phone: '', password: '', role: 'USER', assignedNodeId: nodes[0]?.id ?? '', isFullTime: false });
      setEditingUserId(null);
      setShowUserForm(false);
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name: string; phone: string; password?: string; role: 'ADMIN' | 'USER'; assignedNodeId: string; isFullTime?: boolean } }) =>
      updateUser(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setUserForm({ name: '', phone: '', password: '', role: 'USER', assignedNodeId: nodes[0]?.id ?? '', isFullTime: false });
      setEditingUserId(null);
      setShowUserForm(false);
    }
  });

  const updateUserStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateUserStatus(id, isActive),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    }
  });

  const createMasterMutation = useMutation({
    mutationFn: createMasterListItem,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['master-lists'] });
      setMasterForm({ listType: 'ConversionFrom', name_hi: '', name_en: '' });
      setShowMasterForm(false);
    }
  });

  const deleteMasterMutation = useMutation({
    mutationFn: deleteMasterListItem,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['master-lists'] });
    }
  });

  const saveAssignmentMutation = useMutation({
    mutationFn: saveAssignment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['module-assignments'] });
      setShowAssignmentForm(false);
      setAssignmentForm((prev) => ({ ...prev, assignmentKey: '', nodeId: null }));
    }
  });
  const deleteAssignmentMutation = useMutation({
    mutationFn: deleteAssignment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['module-assignments'] });
    }
  });

  const selectedParent = nodes.find((node) => node.id === locationForm.parentId);
  const ruralTreeNodes = nodes.filter((node) => node.branch === 'rural');
  const urbanTreeNodes = nodes.filter((node) => node.branch === 'urban' || CORE_LEVELS.has(node.level));
  const nodeSelectOptions = React.useMemo(
    () =>
      nodes.map((node) => ({
        id: node.id,
        parentId: node.parentId,
        label: `${(levelToCode[node.level] ?? node.level) as string} • ${node.name_en} (${node.name_hi})`
      })),
    [nodes]
  );

  const useParentCoordinates = () => {
    if (!selectedParent) {
      Alert.alert('Parent missing', 'Select a parent node first to use its coordinates.');
      return;
    }
    setLocationForm((prev) => ({ ...prev, lat: String(selectedParent.lat), long: String(selectedParent.long) }));
  };

  const submitLocation = async () => {
    if (!locationForm.name_hi || !locationForm.name_en) {
      Alert.alert('Missing fields', 'Please fill Hindi and English name.');
      return;
    }
    const address = [locationForm.villageOrMohalla, locationForm.tehsil, locationForm.district, locationForm.state, locationForm.country, locationForm.pincode].join(', ');
    await createLocationMutation.mutateAsync({
      name_hi: locationForm.name_hi,
      name_en: locationForm.name_en,
      level: locationForm.level,
      branch: locationForm.branch,
      parentId: locationForm.parentId,
      address,
      addressDetails: {
        villageOrMohalla: locationForm.villageOrMohalla,
        tehsil: locationForm.tehsil,
        district: locationForm.district,
        state: locationForm.state,
        country: locationForm.country,
        pincode: locationForm.pincode
      },
      lat: Number(locationForm.lat),
      long: Number(locationForm.long)
    });
  };

  const submitUser = async () => {
    if (!userForm.name || !userForm.phone) {
      Alert.alert('Missing fields', 'Please fill user name and phone.');
      return;
    }
    if (!userForm.assignedNodeId) {
      Alert.alert('Missing node', 'Please select an assigned node.');
      return;
    }
    const roleValue = role === 'ADMIN' ? 'USER' : userForm.role;
    if (!editingUserId) {
      if (!userForm.password) {
        Alert.alert('Missing password', 'Please enter password for new user.');
        return;
      }
      await createUserMutation.mutateAsync({ ...userForm, role: roleValue, isFullTime: userForm.isFullTime });
      return;
    }
    await updateUserMutation.mutateAsync({
      id: editingUserId,
      payload: {
        name: userForm.name,
        phone: userForm.phone,
        role: roleValue,
        assignedNodeId: userForm.assignedNodeId,
        isFullTime: userForm.isFullTime,
        ...(userForm.password ? { password: userForm.password } : {})
      }
    });
  };

  const submitMaster = async () => {
    if (!masterForm.name_hi || !masterForm.name_en) {
      Alert.alert('Missing fields', 'Please fill Hindi and English names.');
      return;
    }
    await createMasterMutation.mutateAsync(masterForm);
  };

  const projectCategoryOptions = masterLists
    .filter((item) => item.listType === 'ProjectCategories')
    .map((item) => item.name_en);

  const assignmentKeyOptions = React.useMemo(() => {
    if (assignmentForm.moduleType === 'Project') {
      return projectCategoryOptions;
    }
    if (assignmentForm.moduleType === 'Ayam') {
      return AYAM_SUB_CATEGORIES;
    }
    return ['General'];
  }, [assignmentForm.moduleType, projectCategoryOptions]);

  React.useEffect(() => {
    if (!assignmentForm.assignmentKey) {
      setAssignmentForm((prev) => ({ ...prev, assignmentKey: assignmentKeyOptions[0] ?? '' }));
    }
  }, [assignmentForm.assignmentKey, assignmentKeyOptions]);

  const submitAssignment = async () => {
    if (!assignmentForm.assignmentKey) {
      Alert.alert('Missing assignment key', 'Select project category / ayam category first.');
      return;
    }
    if (!assignmentForm.assignedUserIds.length) {
      Alert.alert('Missing users', 'Select at least one user.');
      return;
    }
    await saveAssignmentMutation.mutateAsync({
      moduleType: assignmentForm.moduleType,
      assignmentKey: assignmentForm.assignmentKey,
      nodeId: assignmentForm.nodeId,
      assignedUserIds: assignmentForm.assignedUserIds
    });
  };

  const filteredAssignments = React.useMemo(
    () =>
      assignments.filter((assignment) => {
        const moduleOk = assignmentModuleFilter === 'ALL' || assignment.moduleType === assignmentModuleFilter;
        const nodeOk = !assignmentNodeFilter || assignment.nodeId === assignmentNodeFilter;
        return moduleOk && nodeOk;
      }),
    [assignmentModuleFilter, assignmentNodeFilter, assignments]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Admin Console</Text>
      <Text style={styles.subtitle}>Locations, admin users and super-admin master lists.</Text>

      <View style={styles.segmentRow}>
        <TouchableOpacity style={[styles.segmentBtn, panel === 'locations' && styles.segmentBtnActive]} onPress={() => setPanel('locations')}><Text style={[styles.segmentText, panel === 'locations' && styles.segmentTextActive]}>Locations</Text></TouchableOpacity>
        {role !== 'USER' ? <TouchableOpacity style={[styles.segmentBtn, panel === 'admin' && styles.segmentBtnActive]} onPress={() => setPanel('admin')}><Text style={[styles.segmentText, panel === 'admin' && styles.segmentTextActive]}>Admin</Text></TouchableOpacity> : null}
        {role === 'SUPER_ADMIN' ? <TouchableOpacity style={[styles.segmentBtn, panel === 'super' && styles.segmentBtnActive]} onPress={() => setPanel('super')}><Text style={[styles.segmentText, panel === 'super' && styles.segmentTextActive]}>Super Admin</Text></TouchableOpacity> : null}
      </View>

      {panel === 'locations' ? (
        <>
          <View style={styles.sectionCard}>
            <Text style={styles.sectionCardTitle}>Rural Path Tree</Text>
            <TreeView nodes={ruralTreeNodes.map((node) => ({ id: node.id, parentId: node.parentId, title: `${node.name_hi} / ${node.name_en}`, subtitle: `${(levelToLabel[node.level] ?? node.level) as string} • ${node.address}`, badge: (levelToCode[node.level] ?? node.level) as string, tag: node.branch }))} emptyText="No rural hierarchy nodes found." />
          </View>
          <View style={styles.sectionCard}>
            <Text style={styles.sectionCardTitle}>Urban Path Tree</Text>
            <TreeView nodes={urbanTreeNodes.map((node) => ({ id: node.id, parentId: node.parentId, title: `${node.name_hi} / ${node.name_en}`, subtitle: `${(levelToLabel[node.level] ?? node.level) as string} • ${node.address}`, badge: (levelToCode[node.level] ?? node.level) as string, tag: node.branch }))} emptyText="No urban hierarchy nodes found." />
          </View>

          {!showLocationForm ? (
            <DottedAddCard label="Location Node Form" onPress={() => setShowLocationForm(true)} />
          ) : (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Create Location Node</Text>
              <FieldLabel text="Name (Hindi)" />
              <TextInput style={styles.input} value={locationForm.name_hi} onChangeText={(v) => setLocationForm((p) => ({ ...p, name_hi: v }))} />
              <FieldLabel text="Name (English)" />
              <TextInput style={styles.input} value={locationForm.name_en} onChangeText={(v) => setLocationForm((p) => ({ ...p, name_en: v }))} />
              <FieldLabel text="Level" />
              <View style={styles.pickerWrap}><Picker selectedValue={locationForm.level} onValueChange={(v) => setLocationForm((p) => ({ ...p, level: v }))}>{LEVEL_META.map((item) => <Picker.Item key={item.key} label={`${item.code} • ${item.label}`} value={item.key} />)}</Picker></View>
              <FieldLabel text="Branch" />
              <View style={styles.pickerWrap}><Picker selectedValue={locationForm.branch} onValueChange={(v) => setLocationForm((p) => ({ ...p, branch: v }))}><Picker.Item label="Rural" value="rural" /><Picker.Item label="Urban" value="urban" /></Picker></View>
              <TreeSelect
                label="Parent Node"
                placeholder="Select parent node"
                options={nodeSelectOptions}
                value={locationForm.parentId}
                onChange={(next) => setLocationForm((prev) => ({ ...prev, parentId: next }))}
                rootLabel="No Parent (root)"
              />
              <FieldLabel text="Village / Mohalla" />
              <TextInput style={styles.input} value={locationForm.villageOrMohalla} onChangeText={(v) => setLocationForm((p) => ({ ...p, villageOrMohalla: v }))} />
              <FieldLabel text="Tehsil" />
              <TextInput style={styles.input} value={locationForm.tehsil} onChangeText={(v) => setLocationForm((p) => ({ ...p, tehsil: v }))} />
              <FieldLabel text="District" />
              <TextInput style={styles.input} value={locationForm.district} onChangeText={(v) => setLocationForm((p) => ({ ...p, district: v }))} />
              <FieldLabel text="State" />
              <TextInput style={styles.input} value={locationForm.state} onChangeText={(v) => setLocationForm((p) => ({ ...p, state: v }))} />
              <FieldLabel text="Country" />
              <TextInput style={styles.input} value={locationForm.country} onChangeText={(v) => setLocationForm((p) => ({ ...p, country: v }))} />
              <FieldLabel text="Pincode" />
              <TextInput style={styles.input} value={locationForm.pincode} onChangeText={(v) => setLocationForm((p) => ({ ...p, pincode: v }))} keyboardType="numeric" />
              <View style={styles.row}><View style={styles.halfInput}><FieldLabel text="Latitude" /><TextInput style={styles.input} value={locationForm.lat} onChangeText={(v) => setLocationForm((p) => ({ ...p, lat: v }))} keyboardType="numeric" /></View><View style={styles.halfInput}><FieldLabel text="Longitude" /><TextInput style={styles.input} value={locationForm.long} onChangeText={(v) => setLocationForm((p) => ({ ...p, long: v }))} keyboardType="numeric" /></View></View>
              <View style={styles.row}><TouchableOpacity style={[styles.secondaryButton, styles.halfInput]} onPress={useParentCoordinates}><Text style={styles.secondaryButtonText}>Use Parent Coordinates</Text></TouchableOpacity></View>
              <View style={styles.actionsRow}><TouchableOpacity style={[styles.actionButton, styles.cancelBtn]} onPress={() => setShowLocationForm(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[styles.actionButton, styles.saveBtn]} onPress={() => void submitLocation()}><Text style={styles.saveText}>Create Location</Text></TouchableOpacity></View>
            </View>
          )}
        </>
      ) : null}

      {panel === 'admin' && role !== 'USER' ? (
        <>
          <View style={styles.segmentRow}>
            <TouchableOpacity style={[styles.segmentBtn, adminTab === 'users' && styles.segmentBtnActive]} onPress={() => setAdminTab('users')}>
              <Text style={[styles.segmentText, adminTab === 'users' && styles.segmentTextActive]}>Users</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.segmentBtn, adminTab === 'assignments' && styles.segmentBtnActive]} onPress={() => setAdminTab('assignments')}>
              <Text style={[styles.segmentText, adminTab === 'assignments' && styles.segmentTextActive]}>Assignments</Text>
            </TouchableOpacity>
          </View>

          {adminTab === 'users' ? (
            <>
              {!showUserForm ? (
                <DottedAddCard
                  label="Admin/User Form"
                  onPress={() => {
                    setEditingUserId(null);
                    setUserForm({ name: '', phone: '', password: '', role: 'USER', assignedNodeId: nodes[0]?.id ?? '', isFullTime: false });
                    setShowUserForm(true);
                  }}
                />
              ) : (
                <View style={styles.formCard}>
                  <Text style={styles.formTitle}>{editingUserId ? 'Edit User' : 'Create User'}</Text>
                  <FieldLabel text="Name" />
                  <TextInput style={styles.input} value={userForm.name} onChangeText={(v) => setUserForm((p) => ({ ...p, name: v }))} />
                  <FieldLabel text="Phone" />
                  <TextInput style={styles.input} value={userForm.phone} onChangeText={(v) => setUserForm((p) => ({ ...p, phone: v }))} keyboardType="phone-pad" />
                  <FieldLabel text={editingUserId ? 'Password (optional)' : 'Password'} />
                  <TextInput style={styles.input} value={userForm.password} onChangeText={(v) => setUserForm((p) => ({ ...p, password: v }))} secureTextEntry />
                  {role === 'SUPER_ADMIN' ? <><FieldLabel text="Role" /><View style={styles.pickerWrap}><Picker selectedValue={userForm.role} onValueChange={(v) => setUserForm((p) => ({ ...p, role: v }))}><Picker.Item label="Admin" value="ADMIN" /><Picker.Item label="User" value="USER" /></Picker></View></> : null}
                  <FieldLabel text="Full-time User" />
                  <View style={styles.pickerWrap}>
                    <Picker selectedValue={userForm.isFullTime ? 'yes' : 'no'} onValueChange={(v) => setUserForm((p) => ({ ...p, isFullTime: v === 'yes' }))}>
                      <Picker.Item label="No" value="no" />
                      <Picker.Item label="Yes" value="yes" />
                    </Picker>
                  </View>
                  <TreeSelect
                    label="Assigned Node"
                    placeholder="Select assigned node"
                    options={nodeSelectOptions}
                    value={userForm.assignedNodeId || null}
                    onChange={(next) => setUserForm((prev) => ({ ...prev, assignedNodeId: next ?? '' }))}
                  />
                  <View style={styles.actionsRow}><TouchableOpacity style={[styles.actionButton, styles.cancelBtn]} onPress={() => {
                    setShowUserForm(false);
                    setEditingUserId(null);
                    setUserForm({ name: '', phone: '', password: '', role: 'USER', assignedNodeId: nodes[0]?.id ?? '', isFullTime: false });
                  }}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[styles.actionButton, styles.saveBtn]} onPress={() => void submitUser()}><Text style={styles.saveText}>{editingUserId ? 'Update User' : 'Create User'}</Text></TouchableOpacity></View>
                </View>
              )}

              <Text style={styles.sectionTitle}>Users Table</Text>
              {users.map((user) => (
                <View key={user.id} style={styles.userRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{user.name} ({user.role})</Text>
                    <Text style={styles.userSub}>{user.phone} • Node: {user.assignedNodeId} • {user.isFullTime ? 'Full-time' : 'Part-time'}</Text>
                  </View>
                  <View style={styles.rowActionsWrap}>
                    <TableRowActions
                      onEdit={() => {
                        setUserForm({
                          name: user.name,
                          phone: user.phone,
                          password: '',
                          role: user.role === 'ADMIN' ? 'ADMIN' : 'USER',
                          assignedNodeId: user.assignedNodeId,
                          isFullTime: Boolean(user.isFullTime)
                        });
                        setEditingUserId(user.id);
                        setShowUserForm(true);
                      }}
                      onDetails={() => Alert.alert('User Details', `Name: ${user.name}\nRole: ${user.role}\nPhone: ${user.phone}\nNode: ${user.assignedNodeId}`)}
                    />
                    <TouchableOpacity style={[styles.statusBtn, user.isActive ? styles.activeBtn : styles.inactiveBtn]} onPress={() => void updateUserStatusMutation.mutateAsync({ id: user.id, isActive: !user.isActive })}>
                      <Text style={styles.statusBtnText}>{user.isActive ? 'Deactivate' : 'Activate'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          ) : (
            <>
              {!showAssignmentForm ? (
                <DottedAddCard
                  label="Module Assignment Form"
                  onPress={() => {
                    setShowAssignmentForm(true);
                    setAssignmentForm((prev) => ({ ...prev, assignmentKey: '', nodeId: role === 'ADMIN' ? currentAssignedNodeId : null }));
                  }}
                />
              ) : (
                <View style={styles.formCard}>
                  <Text style={styles.formTitle}>Assign Users to Module</Text>
                  <FieldLabel text="Module" />
                  <View style={styles.pickerWrap}>
                    <Picker
                      selectedValue={assignmentForm.moduleType}
                      onValueChange={(value) => setAssignmentForm((prev) => ({ ...prev, moduleType: value, assignmentKey: '' }))}
                    >
                      <Picker.Item label="Project" value="Project" />
                      <Picker.Item label="Ayam" value="Ayam" />
                      <Picker.Item label="Sensitive" value="Sensitive" />
                      <Picker.Item label="Activities" value="Activities" />
                      <Picker.Item label="Dharm Raksha" value="DharmRaksha" />
                      <Picker.Item label="FullTime Work" value="FullTime" />
                    </Picker>
                  </View>
                  <FieldLabel text="Category / Key" />
                  <View style={styles.pickerWrap}>
                    <Picker
                      selectedValue={assignmentForm.assignmentKey}
                      onValueChange={(value) => setAssignmentForm((prev) => ({ ...prev, assignmentKey: value }))}
                    >
                      {assignmentKeyOptions.map((value) => (
                        <Picker.Item key={value} label={value} value={value} />
                      ))}
                    </Picker>
                  </View>
                  <TreeSelect
                    label={role === 'ADMIN' ? 'Location Node' : 'Location Node (optional)'}
                    placeholder="Select node for location-specific assignment"
                    options={nodeSelectOptions}
                    value={assignmentForm.nodeId}
                    onChange={(next) => setAssignmentForm((prev) => ({ ...prev, nodeId: next }))}
                    rootLabel={role === 'SUPER_ADMIN' ? 'All locations' : undefined}
                  />
                  <FieldLabel text="Assign To Users" />
                  <View style={styles.chipWrap}>
                    {users
                      .filter((item) => item.role === 'USER' && item.isActive)
                      .map((user) => {
                        const selected = assignmentForm.assignedUserIds.includes(user.id);
                        return (
                          <TouchableOpacity
                            key={user.id}
                            style={[styles.chip, selected && styles.chipActive]}
                            onPress={() =>
                              setAssignmentForm((prev) => ({
                                ...prev,
                                assignedUserIds: selected ? prev.assignedUserIds.filter((id) => id !== user.id) : [...prev.assignedUserIds, user.id]
                              }))
                            }
                          >
                            <Text style={[styles.chipText, selected && styles.chipTextActive]}>{user.name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                  </View>
                  <View style={styles.actionsRow}>
                    <TouchableOpacity style={[styles.actionButton, styles.cancelBtn]} onPress={() => setShowAssignmentForm(false)}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, styles.saveBtn]} onPress={() => void submitAssignment()}>
                      <Text style={styles.saveText}>Save Assignment</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <Text style={styles.sectionTitle}>Module Assignments</Text>
              <View style={styles.filterBar}>
                <View style={styles.filterPill}>
                  <Picker selectedValue={assignmentModuleFilter} onValueChange={(value) => setAssignmentModuleFilter(value)}>
                    <Picker.Item label="All Modules" value="ALL" />
                    <Picker.Item label="Project" value="Project" />
                    <Picker.Item label="Ayam" value="Ayam" />
                    <Picker.Item label="Sensitive" value="Sensitive" />
                    <Picker.Item label="Activities" value="Activities" />
                    <Picker.Item label="Dharm Raksha" value="DharmRaksha" />
                    <Picker.Item label="FullTime" value="FullTime" />
                  </Picker>
                </View>
                <View style={styles.filterPill}>
                  <Picker selectedValue={assignmentNodeFilter ?? ''} onValueChange={(value) => setAssignmentNodeFilter(value || null)}>
                    <Picker.Item label="All Nodes" value="" />
                    {nodes.map((node) => (
                      <Picker.Item key={node.id} label={`${(levelToCode[node.level] ?? node.level) as string} • ${node.name_en}`} value={node.id} />
                    ))}
                  </Picker>
                </View>
              </View>
              {filteredAssignments.map((assignment) => (
                <View key={assignment.id} style={styles.userRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{assignment.moduleType} • {assignment.assignmentKey}</Text>
                    <Text style={styles.userSub}>Node: {assignment.nodeId ?? 'All'} • Users: {assignment.assignedUserIds.length}</Text>
                  </View>
                  <View style={styles.rowActionsWrap}>
                    <TableRowActions
                      onEdit={() => {
                        setAssignmentForm({
                          moduleType: assignment.moduleType,
                          assignmentKey: assignment.assignmentKey,
                          nodeId: assignment.nodeId ?? null,
                          assignedUserIds: assignment.assignedUserIds
                        });
                        setShowAssignmentForm(true);
                      }}
                      onDetails={() => Alert.alert('Assignment Details', `Module: ${assignment.moduleType}\nKey: ${assignment.assignmentKey}\nNode: ${assignment.nodeId ?? 'All'}\nUsers: ${assignment.assignedUserIds.join(', ')}`)}
                    />
                    <TouchableOpacity
                      style={[styles.statusBtn, styles.inactiveBtn]}
                      onPress={() => void deleteAssignmentMutation.mutateAsync(assignment.id)}
                    >
                      <Text style={styles.statusBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {!filteredAssignments.length ? <Text style={styles.userSub}>No assignments found for selected filters.</Text> : null}
            </>
          )}
        </>
      ) : null}

      {panel === 'super' && role === 'SUPER_ADMIN' ? (
        <>
          {!showMasterForm ? (
            <DottedAddCard label="Master List Form" onPress={() => setShowMasterForm(true)} />
          ) : (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Create Master List Item</Text>
              <FieldLabel text="List Type" />
              <View style={styles.pickerWrap}><Picker selectedValue={masterForm.listType} onValueChange={(v) => setMasterForm((p) => ({ ...p, listType: v }))}><Picker.Item label="ConversionFrom" value="ConversionFrom" /><Picker.Item label="ConversionTo" value="ConversionTo" /><Picker.Item label="ProjectCategories" value="ProjectCategories" /><Picker.Item label="MatraShaktiType" value="MatraShaktiType" /><Picker.Item label="VidhiAayamTeam" value="VidhiAayamTeam" /></Picker></View>
              <FieldLabel text="Name (Hindi)" />
              <TextInput style={styles.input} value={masterForm.name_hi} onChangeText={(v) => setMasterForm((p) => ({ ...p, name_hi: v }))} />
              <FieldLabel text="Name (English)" />
              <TextInput style={styles.input} value={masterForm.name_en} onChangeText={(v) => setMasterForm((p) => ({ ...p, name_en: v }))} />
              <View style={styles.actionsRow}><TouchableOpacity style={[styles.actionButton, styles.cancelBtn]} onPress={() => setShowMasterForm(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[styles.actionButton, styles.saveBtn]} onPress={() => void submitMaster()}><Text style={styles.saveText}>Create Item</Text></TouchableOpacity></View>
            </View>
          )}

          <Text style={styles.sectionTitle}>Master Lists</Text>
          {masterLists.map((item) => (
            <View key={item.id} style={styles.userRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{item.name_hi} / {item.name_en}</Text>
                <Text style={styles.userSub}>{item.listType}</Text>
              </View>
              <View style={styles.rowActionsWrap}>
                <TableRowActions
                  onEdit={() => {
                    setMasterForm({
                      listType: item.listType,
                      name_hi: item.name_hi,
                      name_en: item.name_en
                    });
                    setShowMasterForm(true);
                  }}
                  onDetails={() => Alert.alert('Master List Details', `Type: ${item.listType}\nHindi: ${item.name_hi}\nEnglish: ${item.name_en}`)}
                />
                <TouchableOpacity style={[styles.statusBtn, styles.inactiveBtn]} onPress={() => void deleteMasterMutation.mutateAsync(item.id)}>
                  <Text style={styles.statusBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.secondary, marginBottom: 4 },
  subtitle: { color: Colors.textSecondary, marginBottom: 12 },
  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  segmentBtn: { flex: 1, borderWidth: 1, borderColor: '#d9dde7', borderRadius: 10, paddingVertical: 9, alignItems: 'center', backgroundColor: '#fff' },
  segmentBtnActive: { backgroundColor: '#edf3ff', borderColor: '#c6d7ff' },
  segmentText: { color: Colors.textSecondary, fontWeight: '700' },
  segmentTextActive: { color: Colors.secondary },
  sectionCard: { marginTop: 10, backgroundColor: '#f7f8fb', borderRadius: 14, borderWidth: 1, borderColor: '#ebeef4', padding: 10 },
  sectionCardTitle: { fontSize: 15, fontWeight: '800', color: Colors.secondary, marginBottom: 6 },
  formCard: { borderRadius: 14, borderWidth: 1, borderColor: '#e7e9ef', backgroundColor: Colors.card, padding: 12, marginTop: 12 },
  formTitle: { fontWeight: '800', color: Colors.secondary, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#dddddd', borderRadius: 10, padding: 10, backgroundColor: '#fff', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 8 },
  halfInput: { flex: 1 },
  pickerWrap: { borderWidth: 1, borderColor: '#dddddd', borderRadius: 10, overflow: 'hidden', backgroundColor: '#fff', marginBottom: 10 },
  secondaryButton: { borderWidth: 1, borderColor: Colors.secondary, borderRadius: 10, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f8ff', marginBottom: 10 },
  secondaryButtonText: { color: Colors.secondary, fontWeight: '700', fontSize: 12 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionButton: { flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#eef1f6' },
  saveBtn: { backgroundColor: Colors.primary },
  cancelText: { color: Colors.secondary, fontWeight: '700' },
  saveText: { color: '#fff', fontWeight: '700' },
  sectionTitle: { marginTop: 14, marginBottom: 8, fontWeight: '700', fontSize: 16, color: Colors.secondary },
  filterBar: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filterPill: { flex: 1, borderWidth: 1, borderColor: '#dde2ee', borderRadius: 10, overflow: 'hidden', backgroundColor: '#fff' },
  userRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8e8ee', borderRadius: 10, padding: 10, marginBottom: 8 },
  userName: { color: Colors.textPrimary, fontWeight: '700' },
  userSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#d9deea', backgroundColor: '#fff' },
  chipActive: { borderColor: '#b8cdfc', backgroundColor: '#edf3ff' },
  chipText: { fontSize: 12, color: Colors.textSecondary },
  chipTextActive: { color: Colors.secondary, fontWeight: '700' },
  rowActionsWrap: { gap: 6, alignItems: 'flex-end' },
  statusBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  activeBtn: { backgroundColor: '#ffe8e8' },
  inactiveBtn: { backgroundColor: '#edf3ff' },
  statusBtnText: { color: Colors.secondary, fontWeight: '700', fontSize: 12 }
});
