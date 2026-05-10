import React from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DottedAddCard } from '@/components/DottedAddCard';
import { FormDialog } from '@/components/FormDialog';
import { TreeSelect } from '@/components/TreeSelect';
import { UserPhotoPicker } from '@/components/UserPhotoPicker';
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
const levelOrder = Object.fromEntries(LEVEL_META.map((item, index) => [item.key, index]));
const AYAM_SUB_CATEGORIES = ['Pralekhan', 'Vanshavali', 'Nidhi', 'Sanskriti', 'MatraShakti', 'VidhiAayam'];
const FieldLabel = ({ text }: { text: string }) => <Text style={styles.label}>{text}</Text>;
const levelColor: Record<string, string> = {
  PRANT: '#5b8def',
  SAMBHAG: '#5f85f7',
  VIBHAG: '#4b9ce2',
  DISTRICT: '#4bb7ae',
  KHAND: '#55b467',
  MANDAL: '#8db950',
  GRAM: '#e3a33d',
  NAGAR: '#9e77e6',
  BASTI: '#d17ed3',
  MOHALLA: '#d27676'
};
const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'U';

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
  const [selectedLocationNodeId, setSelectedLocationNodeId] = React.useState<string | null>(null);
  const [locationSearch, setLocationSearch] = React.useState('');
  const [locationLevelFilter, setLocationLevelFilter] = React.useState<'ALL' | string>('ALL');
  const [locationViewMode, setLocationViewMode] = React.useState<'descendants' | 'children'>('descendants');

  const [locationForm, setLocationForm] = React.useState(initialLocationForm);
  const [userForm, setUserForm] = React.useState({ name: '', phone: '', password: '', photoUrl: '', role: 'USER' as 'ADMIN' | 'USER', assignedNodeId: '', isFullTime: false });
  const [masterForm, setMasterForm] = React.useState({ listType: 'ConversionFrom' as 'ConversionFrom' | 'ConversionTo' | 'ProjectCategories' | 'MatraShaktiType' | 'VidhiAayamTeam', name_hi: '', name_en: '' });
  const [assignmentForm, setAssignmentForm] = React.useState({
    moduleType: 'Project' as 'Sensitive' | 'Activities' | 'Project' | 'Ayam' | 'DharmRaksha' | 'FullTime',
    assignmentKey: '',
    nodeId: null as string | null,
    assignedUserIds: [] as string[]
  });
  const [assignmentModuleFilter, setAssignmentModuleFilter] = React.useState<'ALL' | 'Sensitive' | 'Activities' | 'Project' | 'Ayam' | 'DharmRaksha' | 'FullTime'>('ALL');
  const [assignmentNodeFilter, setAssignmentNodeFilter] = React.useState<string | null>(null);
  const [showUserFilters, setShowUserFilters] = React.useState(false);
  const [showAssignmentFilters, setShowAssignmentFilters] = React.useState(false);
  const [userRoleFilter, setUserRoleFilter] = React.useState<'ALL' | 'SUPER_ADMIN' | 'ADMIN' | 'USER'>('ALL');
  const [userStatusFilter, setUserStatusFilter] = React.useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [userSearch, setUserSearch] = React.useState('');

  React.useEffect(() => {
    if (route.name === 'Admin') {
      setPanel(role === 'SUPER_ADMIN' ? 'super' : 'admin');
      return;
    }
    setPanel('locations');
  }, [route.name, role]);

  const { data: nodes = [] } = useQuery({ queryKey: ['hierarchy-nodes'], queryFn: getHierarchyNodes });
  const { data: users = [] } = useQuery({ queryKey: ['admin-users'], queryFn: getUsers, enabled: role !== 'USER' });
  const { data: assignmentScopedUsers = [] } = useQuery({
    queryKey: ['assignment-users', assignmentForm.nodeId ?? 'all'],
    queryFn: () => getUsers(assignmentForm.nodeId ? { assignedNodeId: assignmentForm.nodeId } : undefined),
    enabled: role !== 'USER'
  });
  const { data: masterLists = [] } = useQuery({ queryKey: ['master-lists'], queryFn: getMasterLists, enabled: role !== 'USER' });
  const { data: assignments = [] } = useQuery({ queryKey: ['module-assignments'], queryFn: getAssignments, enabled: role !== 'USER' });

  React.useEffect(() => {
    if (!userForm.assignedNodeId && nodes.length) {
      setUserForm((prev) => ({ ...prev, assignedNodeId: nodes[0].id }));
    }
  }, [nodes, userForm.assignedNodeId]);

  React.useEffect(() => {
    if (!selectedLocationNodeId && nodes.length) {
      const root = nodes.find((node) => !node.parentId) ?? nodes[0];
      setSelectedLocationNodeId(root.id);
    }
  }, [nodes, selectedLocationNodeId]);

  React.useEffect(() => {
    const candidateUserIds = assignmentScopedUsers.filter((item) => item.role === 'USER' && item.isActive).map((item) => item.id);
    setAssignmentForm((prev) => {
      const selectedFromCandidates = prev.assignedUserIds.filter((id) => candidateUserIds.includes(id));
      if (selectedFromCandidates.length) {
        return selectedFromCandidates.length === prev.assignedUserIds.length ? prev : { ...prev, assignedUserIds: selectedFromCandidates };
      }
      const firstUserId = candidateUserIds[0];
      if (!firstUserId) {
        return prev.assignedUserIds.length ? { ...prev, assignedUserIds: [] } : prev;
      }
      return { ...prev, assignedUserIds: [firstUserId] };
    });
  }, [assignmentScopedUsers]);

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
      void queryClient.invalidateQueries({ queryKey: ['assignment-users'] });
      setUserForm({ name: '', phone: '', password: '', photoUrl: '', role: 'USER', assignedNodeId: nodes[0]?.id ?? '', isFullTime: false });
      setEditingUserId(null);
      setShowUserForm(false);
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name: string; phone: string; password?: string; photoUrl?: string; role: 'ADMIN' | 'USER'; assignedNodeId: string; isFullTime?: boolean } }) =>
      updateUser(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['assignment-users'] });
      setUserForm({ name: '', phone: '', password: '', photoUrl: '', role: 'USER', assignedNodeId: nodes[0]?.id ?? '', isFullTime: false });
      setEditingUserId(null);
      setShowUserForm(false);
    }
  });

  const updateUserStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateUserStatus(id, isActive),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['assignment-users'] });
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
  const selectedLocationNode = nodes.find((node) => node.id === selectedLocationNodeId);
  const locationBreadcrumb = React.useMemo(() => {
    const list: typeof nodes = [];
    let current = selectedLocationNode ?? null;
    while (current) {
      list.unshift(current);
      current = current.parentId ? nodes.find((node) => node.id === current?.parentId) ?? null : null;
    }
    return list;
  }, [nodes, selectedLocationNode]);
  const locationRows = React.useMemo(() => {
    if (!selectedLocationNode) {
      return [];
    }
    if (locationViewMode === 'children') {
      return nodes
        .filter((node) => node.parentId === selectedLocationNode.id)
        .map((node) => ({ ...node, _depth: 1 }));
    }
    const result: Array<(typeof nodes)[number] & { _depth: number }> = [];
    const queue: Array<{ id: string; depth: number }> = [{ id: selectedLocationNode.id, depth: 0 }];
    while (queue.length) {
      const current = queue.shift();
      if (!current) continue;
      const children = nodes.filter((node) => node.parentId === current.id);
      children.forEach((child) => {
        result.push({ ...child, _depth: current.depth + 1 });
        queue.push({ id: child.id, depth: current.depth + 1 });
      });
    }
    return result;
  }, [locationViewMode, nodes, selectedLocationNode]);
  const filteredLocationRows = React.useMemo(() => {
    const q = locationSearch.trim().toLowerCase();
    return locationRows.filter((node) => {
      const selectedLevelOrder = locationLevelFilter === 'ALL' ? null : levelOrder[locationLevelFilter];
      const nodeLevelOrder = levelOrder[node.level];
      const levelOk =
        locationLevelFilter === 'ALL' ||
        (selectedLevelOrder !== null && selectedLevelOrder !== undefined && nodeLevelOrder !== undefined
          ? nodeLevelOrder >= selectedLevelOrder
          : node.level === locationLevelFilter);
      const searchOk = !q || `${node.name_hi} ${node.name_en} ${node.address}`.toLowerCase().includes(q);
      return levelOk && searchOk;
    });
  }, [locationLevelFilter, locationRows, locationSearch]);
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
        photoUrl: userForm.photoUrl || undefined,
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

  const filteredUsers = React.useMemo(
    () =>
      users.filter((user) => {
        const roleOk = userRoleFilter === 'ALL' || user.role === userRoleFilter;
        const statusOk = userStatusFilter === 'ALL' || (userStatusFilter === 'ACTIVE' ? user.isActive : !user.isActive);
        const q = userSearch.trim().toLowerCase();
        const searchOk = !q || `${user.name} ${user.phone} ${user.assignedNodeId}`.toLowerCase().includes(q);
        return roleOk && statusOk && searchOk;
      }),
    [userRoleFilter, userSearch, userStatusFilter, users]
  );
  const assignmentSelectableUsers = React.useMemo(
    () => assignmentScopedUsers.filter((item) => item.role === 'USER' && item.isActive),
    [assignmentScopedUsers]
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
          <DottedAddCard label="Location Node Form" onPress={() => setShowLocationForm(true)} />
          <View style={styles.sectionCard}>
            <Text style={styles.sectionCardTitle}>Hierarchy Browser</Text>
            <Text style={styles.userSub}>Navigate by breadcrumb and child table for quick understanding.</Text>
            <View style={styles.breadcrumbRow}>
              {locationBreadcrumb.map((node, idx) => (
                <TouchableOpacity key={node.id} onPress={() => setSelectedLocationNodeId(node.id)} style={styles.breadcrumbChip}>
                  <Text style={styles.breadcrumbText}>{node.name_en}</Text>
                  {idx < locationBreadcrumb.length - 1 ? <Text style={styles.breadcrumbSep}>›</Text> : null}
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.filterBar}>
              <TextInput
                style={[styles.input, styles.filterInput]}
                placeholder="Search child location..."
                value={locationSearch}
                onChangeText={setLocationSearch}
              />
              <View style={styles.filterPill}>
                <Picker selectedValue={locationLevelFilter} onValueChange={(value) => setLocationLevelFilter(value)}>
                  <Picker.Item label="All Levels" value="ALL" />
                  {LEVEL_META.map((item) => (
                    <Picker.Item key={item.key} label={`${item.code} • ${item.label}`} value={item.key} />
                  ))}
                </Picker>
              </View>
            </View>
            <View style={styles.locationActionsRow}>
              <TouchableOpacity
                style={[styles.statusBtn, locationViewMode === 'descendants' ? styles.activeBtn : styles.inactiveBtn]}
                onPress={() => setLocationViewMode('descendants')}
              >
                <Text style={styles.statusBtnText}>All Descendants</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statusBtn, locationViewMode === 'children' ? styles.activeBtn : styles.inactiveBtn]}
                onPress={() => setLocationViewMode('children')}
              >
                <Text style={styles.statusBtnText}>Direct Children</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statusBtn, styles.inactiveBtn]}
                onPress={() => {
                  if (selectedLocationNode?.parentId) {
                    setSelectedLocationNodeId(selectedLocationNode.parentId);
                  }
                }}
                disabled={!selectedLocationNode?.parentId}
              >
                <Text style={styles.statusBtnText}>Up One Level</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statusBtn, styles.activeBtn]}
                onPress={() => {
                  setLocationForm((prev) => ({ ...prev, parentId: selectedLocationNode?.id ?? null }));
                  setShowLocationForm(true);
                }}
              >
                <Text style={styles.statusBtnText}>Create Child</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={[styles.tableRow, styles.headerRow]}>
                  <Text style={[styles.cell, styles.wLocName, styles.headerText]}>Location</Text>
                  <Text style={[styles.cell, styles.wLocLevel, styles.headerText]}>Level</Text>
                  <Text style={[styles.cell, styles.wLocBranch, styles.headerText]}>Branch</Text>
                  <Text style={[styles.cell, styles.wLocAddress, styles.headerText]}>Address</Text>
                  <Text style={[styles.cell, styles.wLocAction, styles.headerText]}>Action</Text>
                </View>
                {filteredLocationRows.map((node) => (
                  <View key={node.id} style={styles.tableRow}>
                    <Text style={[styles.cell, styles.wLocName]}>
                      {' '.repeat(Math.max((node._depth ?? 1) - 1, 0) * 2)}
                      {node.name_hi} / {node.name_en}
                    </Text>
                    <View style={[styles.cell, styles.wLocLevel]}>
                      <View style={[styles.levelBadge, { backgroundColor: levelColor[node.level] ?? '#94a3b8' }]}>
                        <Text style={styles.levelBadgeText}>{(levelToCode[node.level] ?? node.level) as string}</Text>
                      </View>
                    </View>
                    <Text style={[styles.cell, styles.wLocBranch]}>{node.branch}</Text>
                    <Text style={[styles.cell, styles.wLocAddress]} numberOfLines={2}>{node.address}</Text>
                    <View style={[styles.cell, styles.wLocAction]}>
                      <TouchableOpacity style={styles.openBtn} onPress={() => setSelectedLocationNodeId(node.id)}>
                        <Text style={styles.openBtnText}>Open</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
            {!filteredLocationRows.length ? <Text style={styles.userSub}>No child nodes under selected location.</Text> : null}
          </View>
          <FormDialog
            visible={showLocationForm}
            title="Create Location Node"
            submitLabel="Create Location"
            onClose={() => setShowLocationForm(false)}
            onSubmit={() => void submitLocation()}
          >
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
          </FormDialog>
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
              <DottedAddCard
                label="Admin/User Form"
                onPress={() => {
                  setEditingUserId(null);
                  setUserForm({ name: '', phone: '', password: '', photoUrl: '', role: 'USER', assignedNodeId: nodes[0]?.id ?? '', isFullTime: false });
                  setShowUserForm(true);
                }}
              />
              <FormDialog
                visible={showUserForm}
                title={editingUserId ? 'Edit User' : 'Create User'}
                submitLabel={editingUserId ? 'Update User' : 'Create User'}
                onClose={() => {
                  setShowUserForm(false);
                  setEditingUserId(null);
                  setUserForm({ name: '', phone: '', password: '', photoUrl: '', role: 'USER', assignedNodeId: nodes[0]?.id ?? '', isFullTime: false });
                }}
                onSubmit={() => void submitUser()}
              >
                <FieldLabel text="Name" />
                <TextInput style={styles.input} value={userForm.name} onChangeText={(v) => setUserForm((p) => ({ ...p, name: v }))} />
                <FieldLabel text="Phone" />
                <TextInput style={styles.input} value={userForm.phone} onChangeText={(v) => setUserForm((p) => ({ ...p, phone: v }))} keyboardType="phone-pad" />
                <UserPhotoPicker value={userForm.photoUrl || undefined} onChange={(url) => setUserForm((p) => ({ ...p, photoUrl: url ?? '' }))} />
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
              </FormDialog>

              <Text style={styles.sectionTitle}>Users Table</Text>
              <TouchableOpacity style={styles.filterToggle} onPress={() => setShowUserFilters((prev) => !prev)}>
                <Text style={styles.filterToggleText}>{showUserFilters ? 'Hide Filters' : 'Show Filters'}</Text>
              </TouchableOpacity>
              {showUserFilters ? (
                <View style={styles.filterBar}>
                  <TextInput
                    style={[styles.input, styles.filterInput]}
                    placeholder="Search name/phone/node"
                    value={userSearch}
                    onChangeText={setUserSearch}
                  />
                  <View style={styles.filterPill}>
                    <Picker selectedValue={userRoleFilter} onValueChange={(v) => setUserRoleFilter(v)}>
                      <Picker.Item label="All Roles" value="ALL" />
                      <Picker.Item label="Super Admin" value="SUPER_ADMIN" />
                      <Picker.Item label="Admin" value="ADMIN" />
                      <Picker.Item label="User" value="USER" />
                    </Picker>
                  </View>
                  <View style={styles.filterPill}>
                    <Picker selectedValue={userStatusFilter} onValueChange={(v) => setUserStatusFilter(v)}>
                      <Picker.Item label="All Status" value="ALL" />
                      <Picker.Item label="Active" value="ACTIVE" />
                      <Picker.Item label="Inactive" value="INACTIVE" />
                    </Picker>
                  </View>
                </View>
              ) : null}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={[styles.tableRow, styles.headerRow]}>
                    <Text style={[styles.cell, styles.wPhoto, styles.headerText]}>Photo</Text>
                    <Text style={[styles.cell, styles.wName, styles.headerText]}>Name</Text>
                    <Text style={[styles.cell, styles.wRole, styles.headerText]}>Role</Text>
                    <Text style={[styles.cell, styles.wPhone, styles.headerText]}>Phone</Text>
                    <Text style={[styles.cell, styles.wNode, styles.headerText]}>Node</Text>
                    <Text style={[styles.cell, styles.wNode, styles.headerText]}>NodName</Text>
                    <Text style={[styles.cell, styles.wType, styles.headerText]}>Type</Text>
                    <Text style={[styles.cell, styles.wStatus, styles.headerText]}>Status</Text>
                    <Text style={[styles.cell, styles.wActions, styles.headerText]}>Actions</Text>
                  </View>
                  {filteredUsers.map((user) => (
                    <View key={user.id} style={styles.tableRow}>
                      <View style={[styles.cell, styles.wPhoto]}>
                        {user.photoUrl ? (
                          <Image source={{ uri: user.photoUrl }} style={styles.userPhoto} />
                        ) : (
                          <View style={styles.userPhotoFallback}>
                            <Text style={styles.userPhotoFallbackText}>{initials(user.name)}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.cell, styles.wName]}>{user.name}</Text>
                      <Text style={[styles.cell, styles.wRole]}>{user.role}</Text>
                      <Text style={[styles.cell, styles.wPhone]}>{user.phone}</Text>
                      <Text style={[styles.cell, styles.wNode]}>{user.assignedNodeId}</Text>
                      <Text style={[styles.cell, styles.wNode]}>{nodes.find((n) => n.id === user.assignedNodeId)?.name_hi ?? 'N/A'}</Text>
                      <Text style={[styles.cell, styles.wType]}>{user.isFullTime ? 'Full-time' : 'Part-time'}</Text>
                      <Text style={[styles.cell, styles.wStatus]}>{user.isActive ? 'Active' : 'Inactive'}</Text>
                      <View style={[styles.cell, styles.wActions, styles.rowActionsWrap]}>
                        <TableRowActions
                          onEdit={() => {
                            setUserForm({
                              name: user.name,
                              phone: user.phone,
                              password: '',
                              photoUrl: user.photoUrl ?? '',
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
                </View>
              </ScrollView>
              {!filteredUsers.length ? <Text style={styles.userSub}>No users found for selected filters.</Text> : null}
            </>
          ) : (
            <>
              <DottedAddCard
                label="Module Assignment Form"
                onPress={() => {
                  setShowAssignmentForm(true);
                  setAssignmentForm((prev) => ({ ...prev, assignmentKey: '', nodeId: role === 'ADMIN' ? currentAssignedNodeId : null }));
                }}
              />
              <FormDialog
                visible={showAssignmentForm}
                title="Assign Users to Module"
                submitLabel="Save Assignment"
                onClose={() => setShowAssignmentForm(false)}
                onSubmit={() => void submitAssignment()}
              >
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
                <View style={styles.selectableUserList}>
                  <View style={styles.selectableUserHeader}>
                    <Text style={[styles.selectableUserHeaderText, styles.colUser]}>User</Text>
                    <Text style={[styles.selectableUserHeaderText, styles.colPhone]}>Phone</Text>
                    <Text style={[styles.selectableUserHeaderText, styles.colNode]}>Node</Text>
                    <Text style={[styles.selectableUserHeaderText, styles.colMark]}>Select</Text>
                  </View>
                  {assignmentSelectableUsers.map((user) => {
                    const selected = assignmentForm.assignedUserIds.includes(user.id);
                    return (
                      <TouchableOpacity
                        key={user.id}
                        style={[styles.selectableUserRow, selected && styles.selectableUserRowActive]}
                        onPress={() =>
                          setAssignmentForm((prev) => ({
                            ...prev,
                            assignedUserIds: selected ? prev.assignedUserIds.filter((id) => id !== user.id) : [...prev.assignedUserIds, user.id]
                          }))
                        }
                      >
                        <Text style={[styles.selectableUserText, styles.colUser]} numberOfLines={1}>{user.name}</Text>
                        <Text style={[styles.selectableUserText, styles.colPhone]}>{user.phone}</Text>
                        <Text style={[styles.selectableUserText, styles.colNode]} numberOfLines={1}>
                          {(levelToCode[nodes.find((n) => n.id === user.assignedNodeId)?.level ?? ''] ?? 'NA') as string}
                        </Text>
                        <View style={[styles.selectMarker, selected && styles.selectMarkerActive]}>
                          <Text style={[styles.selectMarkerText, selected && styles.selectMarkerTextActive]}>{selected ? '✓' : ''}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  {!assignmentSelectableUsers.length ? <Text style={styles.userSub}>No active users found for selected node.</Text> : null}
                </View>
              </FormDialog>

              <Text style={styles.sectionTitle}>Module Assignments</Text>
              <TouchableOpacity style={styles.filterToggle} onPress={() => setShowAssignmentFilters((prev) => !prev)}>
                <Text style={styles.filterToggleText}>{showAssignmentFilters ? 'Hide Filters' : 'Show Filters'}</Text>
              </TouchableOpacity>
              {showAssignmentFilters ? (
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
              ) : null}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={[styles.tableRow, styles.headerRow]}>
                    <Text style={[styles.cell, styles.wModule, styles.headerText]}>Module</Text>
                    <Text style={[styles.cell, styles.wKey, styles.headerText]}>Key</Text>
                    <Text style={[styles.cell, styles.wNode, styles.headerText]}>Node</Text>
                    <Text style={[styles.cell, styles.wCount, styles.headerText]}>Users</Text>
                    <Text style={[styles.cell, styles.wActions, styles.headerText]}>Actions</Text>
                  </View>
                  {filteredAssignments.map((assignment) => (
                    <View key={assignment.id} style={styles.tableRow}>
                      <Text style={[styles.cell, styles.wModule]}>{assignment.moduleType}</Text>
                      <Text style={[styles.cell, styles.wKey]}>{assignment.assignmentKey}</Text>
                      <Text style={[styles.cell, styles.wNode]}>{assignment.nodeId ?? 'All'}</Text>
                      <Text style={[styles.cell, styles.wCount]}>{assignment.assignedUserIds.length}</Text>
                      <View style={[styles.cell, styles.wActions, styles.rowActionsWrap]}>
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
                </View>
              </ScrollView>
              {!filteredAssignments.length ? <Text style={styles.userSub}>No assignments found for selected filters.</Text> : null}
            </>
          )}
        </>
      ) : null}

      {panel === 'super' && role === 'SUPER_ADMIN' ? (
        <>
          <DottedAddCard label="Master List Form" onPress={() => setShowMasterForm(true)} />
          <FormDialog
            visible={showMasterForm}
            title="Create Master List Item"
            submitLabel="Create Item"
            onClose={() => setShowMasterForm(false)}
            onSubmit={() => void submitMaster()}
          >
            <FieldLabel text="List Type" />
            <View style={styles.pickerWrap}><Picker selectedValue={masterForm.listType} onValueChange={(v) => setMasterForm((p) => ({ ...p, listType: v }))}><Picker.Item label="ConversionFrom" value="ConversionFrom" /><Picker.Item label="ConversionTo" value="ConversionTo" /><Picker.Item label="ProjectCategories" value="ProjectCategories" /><Picker.Item label="MatraShaktiType" value="MatraShaktiType" /><Picker.Item label="VidhiAayamTeam" value="VidhiAayamTeam" /></Picker></View>
            <FieldLabel text="Name (Hindi)" />
            <TextInput style={styles.input} value={masterForm.name_hi} onChangeText={(v) => setMasterForm((p) => ({ ...p, name_hi: v }))} />
            <FieldLabel text="Name (English)" />
            <TextInput style={styles.input} value={masterForm.name_en} onChangeText={(v) => setMasterForm((p) => ({ ...p, name_en: v }))} />
          </FormDialog>

          <Text style={styles.sectionTitle}>Master Lists</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={[styles.tableRow, styles.headerRow]}>
                <Text style={[styles.cell, styles.wListType, styles.headerText]}>List Type</Text>
                <Text style={[styles.cell, styles.wLang, styles.headerText]}>Hindi</Text>
                <Text style={[styles.cell, styles.wLang, styles.headerText]}>English</Text>
                <Text style={[styles.cell, styles.wActions, styles.headerText]}>Actions</Text>
              </View>
              {masterLists.map((item) => (
                <View key={item.id} style={styles.tableRow}>
                  <Text style={[styles.cell, styles.wListType]}>{item.listType}</Text>
                  <Text style={[styles.cell, styles.wLang]}>{item.name_hi}</Text>
                  <Text style={[styles.cell, styles.wLang]}>{item.name_en}</Text>
                  <View style={[styles.cell, styles.wActions, styles.rowActionsWrap]}>
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
            </View>
          </ScrollView>
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
  breadcrumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  breadcrumbChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#edf3ff', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  breadcrumbText: { color: Colors.secondary, fontSize: 12, fontWeight: '700' },
  breadcrumbSep: { marginLeft: 6, color: '#8ba0d0', fontWeight: '700' },
  locationActionsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
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
  filterToggle: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: '#eef3ff', marginBottom: 8 },
  filterToggleText: { color: Colors.secondary, fontSize: 12, fontWeight: '700' },
  filterBar: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filterInput: { flex: 1, marginBottom: 0 },
  filterPill: { flex: 1, borderWidth: 1, borderColor: '#dde2ee', borderRadius: 10, overflow: 'hidden', backgroundColor: '#fff' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
  headerRow: { backgroundColor: '#f5f7fb' },
  headerText: { fontWeight: '700', color: Colors.secondary },
  cell: { padding: 10, color: Colors.textPrimary, fontSize: 12 },
  wPhoto: { width: 82 },
  wName: { width: 150 },
  wRole: { width: 110 },
  wPhone: { width: 130 },
  wNode: { width: 150 },
  wType: { width: 110 },
  wStatus: { width: 100 },
  wActions: { width: 180 },
  wModule: { width: 140 },
  wKey: { width: 170 },
  wCount: { width: 80 },
  wListType: { width: 170 },
  wLang: { width: 180 },
  wLocName: { width: 220 },
  wLocLevel: { width: 110 },
  wLocBranch: { width: 90 },
  wLocAddress: { width: 260 },
  wLocAction: { width: 90 },
  levelBadge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  levelBadgeText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  openBtn: { backgroundColor: '#edf3ff', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, alignSelf: 'flex-start' },
  openBtnText: { color: Colors.secondary, fontWeight: '700', fontSize: 12 },
  userPhoto: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#d9deea' },
  userPhotoFallback: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#d9deea', backgroundColor: '#eef3ff', alignItems: 'center', justifyContent: 'center' },
  userPhotoFallbackText: { color: Colors.secondary, fontWeight: '700', fontSize: 11 },
  userSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#d9deea', backgroundColor: '#fff' },
  chipActive: { borderColor: '#b8cdfc', backgroundColor: '#edf3ff' },
  chipText: { fontSize: 12, color: Colors.textSecondary },
  chipTextActive: { color: Colors.secondary, fontWeight: '700' },
  selectableUserList: { borderWidth: 1, borderColor: '#dde2ee', borderRadius: 10, overflow: 'hidden', backgroundColor: '#fff', marginBottom: 10 },
  selectableUserHeader: { flexDirection: 'row', backgroundColor: '#f5f7fb', borderBottomWidth: 1, borderBottomColor: '#e9edf5', paddingVertical: 8 },
  selectableUserHeaderText: { fontSize: 11, fontWeight: '700', color: Colors.secondary, paddingHorizontal: 8 },
  selectableUserRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f0f2f7', paddingVertical: 10 },
  selectableUserRowActive: { backgroundColor: '#edf3ff' },
  selectableUserText: { fontSize: 12, color: Colors.textPrimary, paddingHorizontal: 8 },
  colUser: { flex: 1.45 },
  colPhone: { flex: 1.05 },
  colNode: { flex: 0.65 },
  colMark: { width: 52, textAlign: 'center' },
  selectMarker: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: '#c5cedf', alignItems: 'center', justifyContent: 'center', marginRight: 14, backgroundColor: '#fff' },
  selectMarkerActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  selectMarkerText: { fontSize: 12, fontWeight: '700', color: 'transparent' },
  selectMarkerTextActive: { color: '#fff' },
  rowActionsWrap: { gap: 6, alignItems: 'flex-end' },
  statusBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  activeBtn: { backgroundColor: '#ffe8e8' },
  inactiveBtn: { backgroundColor: '#edf3ff' },
  statusBtnText: { color: Colors.secondary, fontWeight: '700', fontSize: 12 }
});
