import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { karyakariniClient } from '../../api/client';
import { AppBottomNav } from '../../core/components/AppBottomNav';
import { ProfileMenu } from '../../core/components/ProfileMenu';
import { useProfile } from '../../core/context/ProfileContext';
import { theme } from '../../theme';
import { MemberDialog } from '../../services/karyakarini-module/components/MemberDialog';
import { TreeView, type TreeLevelState } from '../../services/karyakarini-module/components/TreeView';
import { VersionSelector } from '../../services/karyakarini-module/components/VersionSelector';
import type {
  KaryakariniAssignableNode,
  KaryakariniAssignableUser,
  KaryakariniAttachment,
  KaryakariniGuestMember,
  KaryakariniMeeting,
  KaryakariniMeetingDetails,
  KaryakariniMember,
  KaryakariniNode,
  KaryakariniPagination,
  KaryakariniTask,
  KaryakariniVersion,
} from '../../services/karyakarini-module/types';

const isAdminRole = (role?: string | null) =>
  ['admin', 'superadmin', 'templeadmin'].includes(
    String(role || '')
      .toLowerCase()
      .replace(/[^a-z]/g, '')
  );

const defaultPagination: KaryakariniPagination = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
};

const NODE_LEVEL_OPTIONS = [
  { label: 'Rashtriya', value: 'rashtriya' },
  { label: 'Prant', value: 'prant' },
  { label: 'Sambhag', value: 'sambhag' },
  { label: 'Vibhag', value: 'vibhag' },
  { label: 'Jila', value: 'jila' },
  { label: 'Khand', value: 'khand' },
  { label: 'Nagar', value: 'nagar' },
  { label: 'Mandal Basti', value: 'mandal_basti' },
  { label: 'Nagar Mohalla', value: 'nagar_mohalla' },
];

const NODE_LEVEL_ORDER = NODE_LEVEL_OPTIONS.map((option) => option.value);
const DEFAULT_PAD_OPTIONS = ['संयोजक', 'सह संयोजक', 'प्रमुख', 'आयाम', 'Other'];
const CATEGORY_SUBCATEGORY_OPTIONS: { category: string; subcategories: string[] }[] = [
  {
    category: 'संस्कृति प्रमुख',
    subcategories: [
      'साधु संत,महंत',
      'मठ/मन्दिर के ट्रस्टी',
      'पुजारी पुरोहित',
      'भगत,बड़वा,',
      'तडवी पटेल',
      'कथाकार प्रवचनकार',
      'तांत्रिक,मांत्रिक, ज्योतिष',
      'भजनमण्डली, सुन्दरकाण्ड,',
      'धार्मिक संगठन',
    ],
  },
  {
    category: 'निधी प्रमुख',
    subcategories: ['व्यवसायी', 'उद्योगपति', 'कर्मचारी', 'कृषक', 'CA'],
  },
  {
    category: 'विधी प्रमुख',
    subcategories: ['फौजदारी', 'दिवानी', 'राजस्व', 'नोटरी', 'सुचना का अधिकार'],
  },
  {
    category: 'प्रलेखन प्रमुख',
    subcategories: ['परियोजना प्रलेखन प्रमुख'],
  },
  {
    category: 'परियोजना प्रमुख',
    subcategories: ['चिन्हित परियोजना सुची', 'क्रियान्वित परियोजना , प्रमुख, टोली'],
  },
  {
    category: 'मातृशक्ति T-8',
    subcategories: [
      'सामाजिक क्षेत्र',
      'धार्मिक क्षेत्र',
      'शैक्षणिक क्षैत्र',
      'राजनैतिक क्षेत्र',
      'धार्मिक संस्था नवपंथ',
      'प्रवचन, कथाकार',
      'शासकीय सेवा',
      'परावर्तित महीला',
    ],
  },
  {
    category: 'वंशावली प्रमुख',
    subcategories: ['वंशावली लेखक सुची'],
  },
  {
    category: 'पुर्णकालिक',
    subcategories: ['सुची', 'क्षेत्र', 'परियोजना'],
  },
];

const getAllowedNodeLevels = (targetLevel?: string | null, relation: 'child' | 'parent' = 'child') => {
  const normalized = String(targetLevel || '').trim().toLowerCase();
  const targetIndex = NODE_LEVEL_ORDER.indexOf(normalized);
  if (targetIndex < 0) return NODE_LEVEL_OPTIONS;

  if (relation === 'child') {
    return NODE_LEVEL_OPTIONS.filter((option) => NODE_LEVEL_ORDER.indexOf(option.value) > targetIndex);
  }
  return NODE_LEVEL_OPTIONS.filter((option) => NODE_LEVEL_ORDER.indexOf(option.value) < targetIndex);
};

const fullUserName = (entry: KaryakariniAssignableUser) =>
  [entry.first_name, entry.father_name].filter(Boolean).join(' ').trim();

const parseLabelList = (value?: string | string[] | null) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean))];
  }
  const raw = String(value || '').trim();
  if (!raw) return [] as string[];
  return [...new Set(raw.split(',').map((entry) => entry.trim()).filter(Boolean))];
};

const deriveCategoriesFromSubcategories = (subcategories: string[]) => {
  const normalized = new Set(subcategories.map((entry) => String(entry || '').trim()).filter(Boolean));
  if (!normalized.size) return [] as string[];
  const categories = new Set<string>();
  CATEGORY_SUBCATEGORY_OPTIONS.forEach((entry) => {
    if (entry.subcategories.some((sub) => normalized.has(sub))) {
      categories.add(entry.category);
    }
  });
  return [...categories];
};

type KaryakariniTab = 'tree' | 'meetings' | 'tasks' | 'roles';
type TaskCascadeOption = {
  key: string;
  label: string;
  nodeId: number;
  pathParts: string[];
  hasChildren: boolean;
};
type TaskCascadeColumn = {
  depth: number;
  title: string;
  options: TaskCascadeOption[];
  selectedNodeId: number | null;
};

const toDateInput = (value?: string | null) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

const summarizeAssignedUser = (task: KaryakariniTask) =>
  [task.assigned_first_name, task.assigned_father_name].filter(Boolean).join(' ').trim() || '-';

const summarizeTaskHierarchy = (task: KaryakariniTask) => {
  const levels = [task.hierarchy_l1, task.hierarchy_l2, task.hierarchy_l3, task.hierarchy_l4, task.hierarchy_l5]
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
  const sublevels = Array.isArray(task.hierarchy_l5_sublevels)
    ? task.hierarchy_l5_sublevels.map((entry) => String(entry || '').trim()).filter(Boolean)
    : [];
  if (sublevels.length) {
    levels.push(sublevels.join(' / '));
  }
  return levels.join(' > ');
};

type TransferAttendee = {
  key: string;
  attendeeType: 'member' | 'guest';
  id: number;
  name: string;
  subtitle?: string;
  avatar?: string | null;
};

const getInitials = (name: string) =>
  String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

export default function KaryakariniModuleScreen() {
  const { user, logout } = useProfile();
  const canAddMembers = isAdminRole((user as any)?.role);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<KaryakariniVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<KaryakariniTab>('tree');
  const [levels, setLevels] = useState<TreeLevelState[]>([]);
  const [assignableNodes, setAssignableNodes] = useState<KaryakariniAssignableNode[]>([]);
  const [assignableNodesLoading, setAssignableNodesLoading] = useState(false);

  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [meetingRows, setMeetingRows] = useState<KaryakariniMeeting[]>([]);
  const [meetingPagination, setMeetingPagination] = useState<KaryakariniPagination>(defaultPagination);

  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskRows, setTaskRows] = useState<KaryakariniTask[]>([]);
  const [taskPagination, setTaskPagination] = useState<KaryakariniPagination>(defaultPagination);

  const [membersVisible, setMembersVisible] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersNode, setMembersNode] = useState<KaryakariniNode | null>(null);
  const [members, setMembers] = useState<KaryakariniMember[]>([]);
  const [membersPagination, setMembersPagination] = useState<KaryakariniPagination>(defaultPagination);
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<KaryakariniMember | null>(null);
  const [savingMemberEdit, setSavingMemberEdit] = useState(false);
  const [editMemberForm, setEditMemberForm] = useState({
    name: '',
    fatherOrHusbandName: '',
    mobileNumber: '',
    pad: '',
    category: '',
    subcategory: '',
    userRole: 'user',
    state: '',
    district: '',
    tehsil: '',
    village: '',
    pincode: '',
    avatar: '',
  });

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addTargetNode, setAddTargetNode] = useState<KaryakariniNode | null>(null);
  const [addingMember, setAddingMember] = useState(false);
  const [memberModalTab, setMemberModalTab] = useState<'create' | 'assign'>('create');
  const [padPickerVisible, setPadPickerVisible] = useState(false);
  const [padbharTransferVisible, setPadbharTransferVisible] = useState(false);
  const [padbharTransferMode, setPadbharTransferMode] = useState<'create' | 'assign' | 'edit' | 'task'>('create');
  const [transferExpandedCategories, setTransferExpandedCategories] = useState<string[]>([]);
  const [transferDraftSubcategories, setTransferDraftSubcategories] = useState<string[]>([]);
  const [padOptions, setPadOptions] = useState<string[]>([]);
  const [loadingPads, setLoadingPads] = useState(false);
  const [uploadingMemberPhoto, setUploadingMemberPhoto] = useState(false);
  const [pincodeLookupLoading, setPincodeLookupLoading] = useState(false);
  const [pincodeLookupMessage, setPincodeLookupMessage] = useState<string | null>(null);
  const [lastAutoFilledPincode, setLastAutoFilledPincode] = useState('');
  const [padOptionsError, setPadOptionsError] = useState<string | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [searchResults, setSearchResults] = useState<KaryakariniAssignableUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<KaryakariniAssignableUser | null>(null);

  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [addingNode, setAddingNode] = useState(false);
  const [nodeForm, setNodeForm] = useState({
    name: '',
    level: 'jila',
    relation: 'child' as 'child' | 'parent',
  });
  const [memberForm, setMemberForm] = useState({
    mobileNumber: '',
    name: '',
    password: '',
    fatherOrHusbandName: '',
    pad: DEFAULT_PAD_OPTIONS[0],
    category: '',
    subcategory: '',
    userRole: 'user',
    state: '',
    district: '',
    tehsil: '',
    village: '',
    pincode: '',
    avatar: '',
  });
  const [assignForm, setAssignForm] = useState({
    pad: DEFAULT_PAD_OPTIONS[0],
    category: '',
    subcategory: '',
    userRole: 'user',
  });

  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [creatingMeeting, setCreatingMeeting] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<number | null>(null);
  const [meetingMembers, setMeetingMembers] = useState<KaryakariniMember[]>([]);
  const [meetingGuests, setMeetingGuests] = useState<KaryakariniGuestMember[]>([]);
  const [showAttendanceTransferModal, setShowAttendanceTransferModal] = useState(false);
  const [attendanceBrowseNodeId, setAttendanceBrowseNodeId] = useState('');
  const [meetingParticipantPreview, setMeetingParticipantPreview] = useState<TransferAttendee[]>([]);
  const [showInvitationTransferModal, setShowInvitationTransferModal] = useState(false);
  const [invitationBrowseNodeId, setInvitationBrowseNodeId] = useState('');
  const [meetingInvitePreview, setMeetingInvitePreview] = useState<TransferAttendee[]>([]);
  const [meetingGuestQuery, setMeetingGuestQuery] = useState('');
  const [meetingGuestSearching, setMeetingGuestSearching] = useState(false);
  const [meetingUploadingAttachment, setMeetingUploadingAttachment] = useState(false);
  const [meetingDetailLoading, setMeetingDetailLoading] = useState(false);
  const [showMeetingAttachmentModal, setShowMeetingAttachmentModal] = useState(false);
  const [meetingAttachmentTitle, setMeetingAttachmentTitle] = useState('');
  const [meetingAttachmentItems, setMeetingAttachmentItems] = useState<KaryakariniAttachment[]>([]);
  const [meetingForm, setMeetingForm] = useState({
    title: '',
    description: '',
    meetingDate: toDateInput(),
    nodeId: '',
    attendeeUserIds: [] as number[],
    invitedUserIds: [] as number[],
    guestIds: [] as number[],
    newGuestName: '',
    newGuestMobile: '',
    newGuestEmail: '',
    attachmentInput: '',
    attachments: [] as KaryakariniAttachment[],
  });

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskMembers, setTaskMembers] = useState<KaryakariniMember[]>([]);
  const [taskUploadingAttachment, setTaskUploadingAttachment] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    taskDate: toDateInput(),
    dueDate: '',
    status: 'open',
    hierarchyL1: '',
    hierarchyL2: '',
    hierarchyL3: '',
    hierarchyL4: '',
    hierarchyL5: '',
    hierarchyL5Sublevels: '',
    category: '',
    subcategory: '',
    nodeId: '',
    assignedUserId: '',
    attachmentInput: '',
    attachments: [] as KaryakariniAttachment[],
  });
  const [taskHierarchyFilterL1, setTaskHierarchyFilterL1] = useState('');

  const [scopeRows, setScopeRows] = useState<{ node_id: number; node_level: string; node_name: string }[]>([]);
  const [selectedRoleLevel, setSelectedRoleLevel] = useState('');
  const [selectedRoleNodeId, setSelectedRoleNodeId] = useState('');
  const [roleMembers, setRoleMembers] = useState<KaryakariniMember[]>([]);
  const [selectedRoleUserId, setSelectedRoleUserId] = useState('');
  const [assigningRole, setAssigningRole] = useState(false);
  const [loadingRoleMembers, setLoadingRoleMembers] = useState(false);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);

  const canManageActivities = assignableNodes.length > 0;
  const currentAttendanceNodeId = attendanceBrowseNodeId || meetingForm.nodeId;
  const currentInvitationNodeId = invitationBrowseNodeId || meetingForm.nodeId;
  const currentUserRole = String((user as any)?.role || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  const taskSelectedNode = useMemo(
    () => assignableNodes.find((node) => String(node.id) === String(taskForm.nodeId)) || null,
    [assignableNodes, taskForm.nodeId]
  );
  const taskSelectedPathLabel = useMemo(() => {
    const path = String(taskSelectedNode?.hierarchy_path || '').trim();
    if (path) return path;
    return taskSelectedNode?.name || 'Select node';
  }, [taskSelectedNode]);
  const scopeRootNodeIds = useMemo(() => {
    const assignableSet = new Set(assignableNodes.map((entry) => Number(entry.id)).filter((id) => id > 0));
    return new Set(
      assignableNodes
        .filter((entry) => !assignableSet.has(Number(entry.parent_id || 0)))
        .map((entry) => Number(entry.id))
        .filter((id) => id > 0)
    );
  }, [assignableNodes]);
  const selectedTaskNodeIsScopeRoot = useMemo(
    () => currentUserRole !== 'superadmin' && scopeRootNodeIds.has(Number(taskForm.nodeId || 0)),
    [currentUserRole, scopeRootNodeIds, taskForm.nodeId]
  );
  const taskCascadeColumns = useMemo<TaskCascadeColumn[]>(() => {
    const parsedNodes = assignableNodes
      .map((node) => {
        const path = String(node.hierarchy_path || '').trim();
        const parts = path ? path.split(/\s*>\s*/).filter(Boolean) : [String(node.name || '').trim()].filter(Boolean);
        const depth = parts.length;
        return {
          nodeId: Number(node.id),
          nodeName: String(node.name || '').trim(),
          level: String(node.level || '').trim(),
          parts,
          depth,
        };
      })
      .filter((node) => node.nodeId > 0 && node.parts.length > 0)
      .sort((a, b) => a.parts.join(' > ').localeCompare(b.parts.join(' > ')));

    if (!parsedNodes.length) return [];

    const selectedNode = parsedNodes.find((node) => String(node.nodeId) === String(taskForm.nodeId)) || null;
    const selectedParts = selectedNode?.parts || [];
    const columns: TaskCascadeColumn[] = [];
    let activePrefix: string[] = [];
    let depth = 1;

    while (depth <= 12) {
      const optionsMap = new Map<string, TaskCascadeOption>();
      parsedNodes.forEach((node) => {
        if (node.depth < depth) return;
        const prefix = node.parts.slice(0, depth - 1);
        if (prefix.join(' > ') !== activePrefix.join(' > ')) return;
        const label = node.parts[depth - 1];
        if (!label) return;

        const exact = parsedNodes.find(
          (candidate) => candidate.depth === depth && candidate.parts.slice(0, depth).join(' > ') === [...prefix, label].join(' > ')
        );
        const mappedNode = exact || node;
        const key = [...prefix, label].join(' > ');
        if (optionsMap.has(key)) return;
        const hasChildren = parsedNodes.some(
          (candidate) =>
            candidate.depth > depth && candidate.parts.slice(0, depth).join(' > ') === [...prefix, label].join(' > ')
        );
        optionsMap.set(key, {
          key,
          label,
          nodeId: mappedNode.nodeId,
          pathParts: mappedNode.parts.slice(0, depth),
          hasChildren,
        });
      });

      const options = [...optionsMap.values()].sort((a, b) => a.label.localeCompare(b.label));
      if (!options.length) break;

      const selectedOption =
        options.find((option) => option.label === selectedParts[depth - 1]) ||
        options.find((option) => String(option.nodeId) === String(taskForm.nodeId)) ||
        null;

      columns.push({
        depth,
        title: depth === 1 ? 'Root' : `Level ${depth}`,
        options,
        selectedNodeId: selectedOption?.nodeId || null,
      });

      if (!selectedOption) break;
      activePrefix = selectedOption.pathParts;
      depth += 1;
    }

    return columns;
  }, [assignableNodes, taskForm.nodeId]);
  const taskHierarchyFilterOptions = useMemo(
    () =>
      [...new Set(taskRows.map((row) => String(row.hierarchy_l1 || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b)),
    [taskRows]
  );
  const filteredTaskRows = useMemo(
    () =>
      taskHierarchyFilterL1
        ? taskRows.filter((row) => String(row.hierarchy_l1 || '').trim() === taskHierarchyFilterL1)
        : taskRows,
    [taskHierarchyFilterL1, taskRows]
  );
  const addFormSelectedSubcategories = useMemo(
    () => parseLabelList(memberModalTab === 'assign' ? assignForm.subcategory : memberForm.subcategory),
    [assignForm.subcategory, memberForm.subcategory, memberModalTab]
  );
  const addFormSelectedCategories = useMemo(
    () => parseLabelList(memberModalTab === 'assign' ? assignForm.category : memberForm.category),
    [assignForm.category, memberForm.category, memberModalTab]
  );
  const editSelectedSubcategories = useMemo(() => parseLabelList(editMemberForm.subcategory), [editMemberForm.subcategory]);
  const editSelectedCategories = useMemo(() => parseLabelList(editMemberForm.category), [editMemberForm.category]);
  const taskSelectedSubcategories = useMemo(() => parseLabelList(taskForm.subcategory), [taskForm.subcategory]);
  const taskSelectedCategories = useMemo(() => parseLabelList(taskForm.category), [taskForm.category]);

  const roleLevelOptions = useMemo(() => {
    const availableLevels = new Set(
      assignableNodes
        .map((node) => String(node.level || '').trim().toLowerCase())
        .filter((level) => NODE_LEVEL_ORDER.includes(level))
    );
    return NODE_LEVEL_OPTIONS.filter((option) => availableLevels.has(option.value));
  }, [assignableNodes]);

  const roleNodesByLevel = useMemo(
    () => assignableNodes.filter((node) => String(node.level || '').toLowerCase() === selectedRoleLevel),
    [assignableNodes, selectedRoleLevel]
  );

  const selectedRoleNode = useMemo(
    () => assignableNodes.find((node) => String(node.id) === selectedRoleNodeId) || null,
    [assignableNodes, selectedRoleNodeId]
  );

  const descendantRoleNodes = useMemo(() => {
    if (!selectedRoleNode?.hierarchy_path) return [];
    const selectedPath = String(selectedRoleNode.hierarchy_path);
    return assignableNodes
      .filter((node) => {
        const path = String(node.hierarchy_path || '');
        return path.startsWith(`${selectedPath} > `);
      })
      .sort((a, b) => String(a.hierarchy_path || '').localeCompare(String(b.hierarchy_path || '')));
  }, [assignableNodes, selectedRoleNode]);

  const meetingMemberTransferItems = useMemo<TransferAttendee[]>(
    () =>
      meetingMembers
        .map((member) => {
          const userId = Number(member.user_id || 0);
          if (!userId) return null;
          const fullName = [member.first_name, member.father_name].filter(Boolean).join(' ').trim() || `User #${userId}`;
          const branchLabel = [member.node_level, member.node_name].filter(Boolean).join('-');
          return {
            key: `member-${userId}`,
            attendeeType: 'member' as const,
            id: userId,
            name: fullName,
            subtitle: branchLabel || member.mobile_number || member.gotra || member.village || '',
            avatar: member.avatar || null,
          };
        })
        .filter(Boolean) as TransferAttendee[],
    [meetingMembers]
  );

  const meetingGuestTransferItems = useMemo<TransferAttendee[]>(
    () =>
      meetingGuests.map((guest) => ({
        key: `guest-${guest.id}`,
        attendeeType: 'guest' as const,
        id: Number(guest.id),
        name: guest.name || `Guest #${guest.id}`,
        subtitle: guest.mobile || guest.email || '',
        avatar: null,
      })),
    [meetingGuests]
  );

  const meetingSelectedKeySet = useMemo(() => {
    const keys = [
      ...meetingForm.attendeeUserIds.map((id) => `member-${id}`),
      ...meetingForm.guestIds.map((id) => `guest-${id}`),
    ];
    return new Set(keys);
  }, [meetingForm.attendeeUserIds, meetingForm.guestIds]);

  const meetingTransferAvailableItems = useMemo(
    () => [...meetingMemberTransferItems, ...meetingGuestTransferItems].filter((item) => !meetingSelectedKeySet.has(item.key)),
    [meetingGuestTransferItems, meetingMemberTransferItems, meetingSelectedKeySet]
  );

  const meetingTransferSelectedItems = useMemo(() => {
    const selectedFromLists = [...meetingMemberTransferItems, ...meetingGuestTransferItems].filter((item) => meetingSelectedKeySet.has(item.key));
    const selectedMap = new Map(selectedFromLists.map((item) => [item.key, item]));
    const fallback = meetingParticipantPreview.filter((item) => meetingSelectedKeySet.has(item.key) && !selectedMap.has(item.key));
    return [...selectedFromLists, ...fallback];
  }, [meetingGuestTransferItems, meetingMemberTransferItems, meetingParticipantPreview, meetingSelectedKeySet]);

  const meetingInviteSelectedKeySet = useMemo(
    () => new Set(meetingForm.invitedUserIds.map((id) => `member-${id}`)),
    [meetingForm.invitedUserIds]
  );

  const meetingInviteAvailableItems = useMemo(
    () => meetingMemberTransferItems.filter((item) => !meetingInviteSelectedKeySet.has(item.key)),
    [meetingInviteSelectedKeySet, meetingMemberTransferItems]
  );

  const meetingInviteSelectedItems = useMemo(() => {
    const selectedFromList = meetingMemberTransferItems.filter((item) => meetingInviteSelectedKeySet.has(item.key));
    const selectedMap = new Map(selectedFromList.map((item) => [item.key, item]));
    const fallback = meetingInvitePreview.filter((item) => meetingInviteSelectedKeySet.has(item.key) && !selectedMap.has(item.key));
    return [...selectedFromList, ...fallback];
  }, [meetingInvitePreview, meetingInviteSelectedKeySet, meetingMemberTransferItems]);

  const selectedPathNodes = useMemo(() => {
    const nodes: KaryakariniNode[] = [];
    levels.forEach((level) => {
      const selected = level.nodes.find((node) => node.id === level.selectedNodeId);
      if (selected) nodes.push(selected);
    });
    return nodes;
  }, [levels]);

  const breadcrumb = useMemo(() => {
    if (!selectedPathNodes.length) return 'Rashtriya';
    return selectedPathNodes.map((node) => node.name).join(' > ');
  }, [selectedPathNodes]);

  const allowedNodeLevelOptions = useMemo(
    () => getAllowedNodeLevels(addTargetNode?.level, nodeForm.relation),
    [addTargetNode?.level, nodeForm.relation]
  );

  const fetchNodes = useCallback(
    async (versionId: number, parentId: number | null) => {
      const response = await karyakariniClient.get('/karyakarini/tree', {
        params: {
          versionId,
          parentId: parentId || undefined,
        },
      });
      return (response?.data?.data?.nodes || []) as KaryakariniNode[];
    },
    []
  );

  const loadPadOptions = useCallback(async (versionId: number) => {
    try {
      setLoadingPads(true);
      setPadOptionsError(null);
      const response = await karyakariniClient.get('/karyakarini/pads', {
        params: { versionId },
      });
      const rawRows = response?.data?.data?.pads || [];
      const rows = [...new Set((Array.isArray(rawRows) ? rawRows : [])
        .map((entry: any) => (typeof entry === 'string' ? entry : entry?.pad || null))
        .filter((entry: string | null) => Boolean(entry && String(entry).trim()))
        .map((entry: string) => String(entry).trim())
        .concat(DEFAULT_PAD_OPTIONS))];
      setPadOptions(rows);
      if (rows.length > 0) {
        setMemberForm((prev) => ({
          ...prev,
          pad: prev.pad || rows[0],
        }));
      } else {
        setPadOptionsError('No pads found for selected version');
      }
    } catch (err: any) {
      setPadOptions(DEFAULT_PAD_OPTIONS);
      setPadOptionsError(err?.response?.data?.message || 'Failed to load pad options');
    } finally {
      setLoadingPads(false);
    }
  }, []);

  const loadAssignableNodes = useCallback(async (versionId: number) => {
    try {
      setAssignableNodesLoading(true);
      const response = await karyakariniClient.get('/karyakarini/nodes/assignable', {
        params: { versionId },
      });
      const rows = (response?.data?.data?.nodes || []) as KaryakariniAssignableNode[];
      setAssignableNodes(rows);
      return rows;
    } catch (err: any) {
      setAssignableNodes([]);
      console.warn('Failed to load assignable nodes:', err?.response?.data?.message || err?.message);
      return [] as KaryakariniAssignableNode[];
    } finally {
      setAssignableNodesLoading(false);
    }
  }, []);

  const resolveDefaultSelectionPathIds = useCallback(
    async (_versionId: number, scopedNodes: KaryakariniAssignableNode[]) => {
      if (!scopedNodes.length) return [] as number[];
      if (currentUserRole === 'superadmin') return [] as number[];
      return [] as number[];
    },
    [currentUserRole]
  );

  const loadScopes = useCallback(async (versionId: number) => {
    const currentUserId = Number((user as any)?.id || 0);
    if (!currentUserId) {
      setScopeRows([]);
      return;
    }
    try {
      const response = await karyakariniClient.get('/karyakarini/scopes', {
        params: {
          versionId,
          userId: currentUserId,
        },
      });
      const rows = (response?.data?.data?.scopes || []) as { node_id: number; node_level: string; node_name: string }[];
      setScopeRows(rows);
    } catch {
      setScopeRows([]);
    }
  }, [user]);

  const loadNotificationCount = useCallback(async (versionId: number) => {
    try {
      const response = await karyakariniClient.get('/karyakarini/my/notifications/unread-count', {
        params: { versionId },
      });
      setNotificationUnreadCount(Number(response?.data?.data?.total || 0));
    } catch {
      setNotificationUnreadCount(0);
    }
  }, []);

  const loadMeetings = useCallback(
    async (versionId: number, page = 1) => {
      try {
        setMeetingsLoading(true);
        const response = await karyakariniClient.get('/karyakarini/meetings', {
          params: {
            versionId,
            page,
            limit: 20,
          },
        });
        setMeetingRows((response?.data?.data?.meetings || []) as KaryakariniMeeting[]);
        setMeetingPagination({
          ...defaultPagination,
          ...(response?.data?.data?.pagination || {}),
        });
      } catch (err: any) {
        setMeetingRows([]);
        setMeetingPagination(defaultPagination);
        Alert.alert('Error', err?.response?.data?.message || 'Failed to load meetings');
      } finally {
        setMeetingsLoading(false);
      }
    },
    []
  );

  const loadTasks = useCallback(
    async (versionId: number, page = 1) => {
      try {
        setTasksLoading(true);
        const response = await karyakariniClient.get('/karyakarini/tasks', {
          params: {
            versionId,
            page,
            limit: 20,
          },
        });
        setTaskRows((response?.data?.data?.tasks || []) as KaryakariniTask[]);
        setTaskPagination({
          ...defaultPagination,
          ...(response?.data?.data?.pagination || {}),
        });
      } catch (err: any) {
        setTaskRows([]);
        setTaskPagination(defaultPagination);
        Alert.alert('Error', err?.response?.data?.message || 'Failed to load tasks');
      } finally {
        setTasksLoading(false);
      }
    },
    []
  );

  const loadNodeMembersForForm = useCallback(async (nodeId: number, versionId: number, forType: 'meeting' | 'task') => {
    try {
      const response = await karyakariniClient.get('/karyakarini/nodes/members', {
        params: {
          nodeId,
          versionId,
        },
      });
      const rows = (response?.data?.data?.members || []) as KaryakariniMember[];
      if (forType === 'meeting') setMeetingMembers(rows);
      else setTaskMembers(rows);
    } catch (err: any) {
      if (forType === 'meeting') setMeetingMembers([]);
      else setTaskMembers([]);
      Alert.alert('Error', err?.response?.data?.message || 'Failed to load node members');
    }
  }, []);

  const loadGuestsForNode = useCallback(async (nodeId: number, versionId: number, query = '') => {
    try {
      setMeetingGuestSearching(true);
      const response = await karyakariniClient.get('/karyakarini/guests/search', {
        params: {
          nodeId,
          versionId,
          q: query || undefined,
          limit: 50,
        },
      });
      setMeetingGuests((response?.data?.data?.guests || []) as KaryakariniGuestMember[]);
    } catch (err: any) {
      setMeetingGuests([]);
      Alert.alert('Error', err?.response?.data?.message || 'Failed to load guest members');
    } finally {
      setMeetingGuestSearching(false);
    }
  }, []);

  const pickAndUploadAttachment = useCallback(async (category: 'meeting' | 'task') => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission', 'Media library permission is required');
      return null;
    }

    const picker = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });

    if (picker.canceled || !picker.assets?.[0]) return null;
    const asset = picker.assets[0];
    const fileName = asset.fileName || `${category}-${Date.now()}`;
    const mimeType = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');

    const form = new FormData();
    form.append('folder', 'karyakarini');
    form.append('category', category);
    form.append(
      'file',
      {
        uri: asset.uri,
        name: fileName,
        type: mimeType,
      } as any
    );

    const response = await karyakariniClient.post('/karyakarini/upload/attachment', form, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    const payload = response?.data?.data || {};
    return {
      url: String(payload.url || ''),
      type: String(payload.fileType || mimeType || ''),
      name: String(payload.fileName || fileName),
    } as KaryakariniAttachment;
  }, []);

  const uploadMemberPhotoFromSource = useCallback(
    async (source: 'camera' | 'gallery') => {
      try {
        if (source === 'camera') {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('Permission', 'Camera permission is required');
            return;
          }
        } else {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('Permission', 'Media library permission is required');
            return;
          }
        }

        const pickerResult =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
                allowsEditing: true,
              })
            : await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
                allowsEditing: true,
              });

        if (pickerResult.canceled || !pickerResult.assets?.[0]) return;
        const asset = pickerResult.assets[0];
        const fileName = asset.fileName || `member-photo-${Date.now()}.jpg`;
        const mimeType = asset.mimeType || 'image/jpeg';

        const form = new FormData();
        form.append('folder', 'karyakarini');
        form.append('category', 'member-profile');
        form.append(
          'file',
          {
            uri: asset.uri,
            name: fileName,
            type: mimeType,
          } as any
        );

        setUploadingMemberPhoto(true);
        const response = await karyakariniClient.post('/karyakarini/upload/attachment', form, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        const payload = response?.data?.data || {};
        const avatarUrl = String(payload.url || '').trim();
        if (!avatarUrl) {
          Alert.alert('Error', 'Failed to upload member photo');
          return;
        }
        setMemberForm((prev) => ({ ...prev, avatar: avatarUrl }));
      } catch (err: any) {
        Alert.alert('Error', err?.response?.data?.message || 'Failed to upload member photo');
      } finally {
        setUploadingMemberPhoto(false);
      }
    },
    []
  );

  const loadTree = useCallback(
    async (
      versionId: number,
      preserveSelectionIds: number[] = [],
      scopedNodesOverride?: KaryakariniAssignableNode[]
    ) => {
      const scopedNodes = scopedNodesOverride || [];
      const isScopedTree = currentUserRole !== 'superadmin' && scopedNodes.length > 0;

      let rootNodes: KaryakariniNode[] = [];
      if (isScopedTree) {
        const scopedSet = new Set(scopedNodes.map((node) => Number(node.id)).filter((id) => id > 0));
        const scopeRoots = scopedNodes.filter((node) => !scopedSet.has(Number(node.parent_id || 0)));
        const scopeRootSet = new Set(scopeRoots.map((node) => Number(node.id)).filter((id) => id > 0));
        const initialNodes = scopeRoots.length ? scopeRoots : scopedNodes;
        const childCountByParent = new Map<number, number>();
        scopedNodes.forEach((node) => {
          const parentId = Number(node.parent_id || 0);
          childCountByParent.set(parentId, Number(childCountByParent.get(parentId) || 0) + 1);
        });
        rootNodes = initialNodes
          .map((node) => ({
            id: Number(node.id),
            name: node.name,
            level: node.level,
            parent_id: node.parent_id ?? null,
            version_id: node.version_id,
            child_count: Number(childCountByParent.get(Number(node.id)) || 0),
            can_assign_member: !scopeRootSet.has(Number(node.id)),
          }))
          .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      }

      if (!rootNodes.length) {
        rootNodes = await fetchNodes(versionId, null);
      }
      const rebuilt: TreeLevelState[] = [{ parentNode: null, nodes: rootNodes, selectedNodeId: null }];

      let activeParent: KaryakariniNode | null = null;
      for (let index = 0; index < preserveSelectionIds.length; index += 1) {
        const levelIndex = rebuilt.length - 1;
        const selectedId = preserveSelectionIds[index];
        const selectedNode = rebuilt[levelIndex].nodes.find((node) => node.id === selectedId) || null;
        if (!selectedNode) break;

        rebuilt[levelIndex] = {
          ...rebuilt[levelIndex],
          selectedNodeId: selectedNode.id,
        };
        activeParent = selectedNode;
        const children = await fetchNodes(versionId, selectedNode.id);
        if (!children.length) break;

        rebuilt.push({
          parentNode: activeParent,
          nodes: children,
          selectedNodeId: null,
        });
      }

      setLevels(rebuilt);
    },
    [currentUserRole, fetchNodes]
  );

  const loadVersionsAndTree = useCallback(
    async (preferredVersionId?: number | null, preserveSelectionIds: number[] = []) => {
      setError(null);
      const versionsRes = await karyakariniClient.get('/karyakarini/versions');
      const rows = (versionsRes?.data?.data?.versions || []) as KaryakariniVersion[];
      setVersions(rows);

      const fallback = rows.find((v) => v.is_current) || rows[0] || null;
      const targetVersionId = preferredVersionId || fallback?.id || null;
      if (!targetVersionId) {
        setLevels([]);
        setSelectedVersionId(null);
        setNotificationUnreadCount(0);
        return;
      }

      setSelectedVersionId(targetVersionId);
      const [scopedNodes] = await Promise.all([
        loadAssignableNodes(targetVersionId),
        loadPadOptions(targetVersionId),
        loadScopes(targetVersionId),
        loadMeetings(targetVersionId, 1),
        loadTasks(targetVersionId, 1),
        loadNotificationCount(targetVersionId),
      ]);
      const initialPathIds = preserveSelectionIds.length
        ? preserveSelectionIds
        : await resolveDefaultSelectionPathIds(targetVersionId, scopedNodes);
      await loadTree(targetVersionId, initialPathIds, scopedNodes);
    },
    [loadAssignableNodes, loadMeetings, loadNotificationCount, loadPadOptions, loadScopes, loadTasks, loadTree, resolveDefaultSelectionPathIds]
  );

  const loadMembers = useCallback(
    async (node: KaryakariniNode, page = 1) => {
      if (!selectedVersionId) return;
      try {
        setMembersLoading(true);
        const response = await karyakariniClient.get('/karyakarini/members', {
          params: {
            nodeId: node.id,
            versionId: selectedVersionId,
            page,
            limit: 10,
          },
        });

        setMembers((response?.data?.data?.members || []) as KaryakariniMember[]);
        setMembersPagination({
          ...defaultPagination,
          ...(response?.data?.data?.pagination || {}),
        });
      } catch (err: any) {
        setMembers([]);
        setMembersPagination(defaultPagination);
        Alert.alert('Error', err?.response?.data?.message || 'Failed to load members');
      } finally {
        setMembersLoading(false);
      }
    },
    [selectedVersionId]
  );

  useEffect(() => {
    const boot = async () => {
      try {
        setLoading(true);
        await loadVersionsAndTree();
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || 'Failed to load karyakarini data');
      } finally {
        setLoading(false);
      }
    };
    void boot();
  }, [loadVersionsAndTree]);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const selectedIds = selectedPathNodes.map((node) => node.id);
      await loadVersionsAndTree(selectedVersionId, selectedIds);
      if (membersVisible && membersNode) {
        await loadMembers(membersNode, membersPagination.page || 1);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  }, [
    loadMembers,
    loadVersionsAndTree,
    membersNode,
    membersPagination.page,
    membersVisible,
    selectedPathNodes,
    selectedVersionId,
  ]);

  const handleSelectVersion = useCallback(
    async (versionId: number) => {
      try {
        setLoading(true);
        setSelectedVersionId(versionId);
        const [scopedNodes] = await Promise.all([
          loadAssignableNodes(versionId),
          loadPadOptions(versionId),
          loadScopes(versionId),
          loadMeetings(versionId, 1),
          loadTasks(versionId, 1),
          loadNotificationCount(versionId),
        ]);
        const initialPathIds = await resolveDefaultSelectionPathIds(versionId, scopedNodes);
        await loadTree(versionId, initialPathIds, scopedNodes);
      } catch (err: any) {
        Alert.alert('Error', err?.response?.data?.message || 'Failed to switch version');
      } finally {
        setLoading(false);
      }
    },
    [loadAssignableNodes, loadMeetings, loadNotificationCount, loadPadOptions, loadScopes, loadTasks, loadTree, resolveDefaultSelectionPathIds]
  );

  useEffect(() => {
    if (!roleLevelOptions.length) {
      setSelectedRoleLevel('');
      return;
    }
    if (roleLevelOptions.some((entry) => entry.value === selectedRoleLevel)) return;
    setSelectedRoleLevel(roleLevelOptions[0].value);
  }, [roleLevelOptions, selectedRoleLevel]);

  useEffect(() => {
    if (!roleNodesByLevel.length) {
      setSelectedRoleNodeId('');
      return;
    }
    if (roleNodesByLevel.some((node) => String(node.id) === selectedRoleNodeId)) return;
    setSelectedRoleNodeId(String(roleNodesByLevel[0].id));
  }, [roleNodesByLevel, selectedRoleNodeId]);

  useEffect(() => {
    const loadRoleMembers = async () => {
      if (!selectedVersionId || !selectedRoleNodeId) {
        setRoleMembers([]);
        setSelectedRoleUserId('');
        return;
      }
      try {
        setLoadingRoleMembers(true);
        const response = await karyakariniClient.get('/karyakarini/nodes/members', {
          params: {
            nodeId: Number(selectedRoleNodeId),
            versionId: selectedVersionId,
          },
        });
        const rows = (response?.data?.data?.members || []) as KaryakariniMember[];
        setRoleMembers(rows);
        setSelectedRoleUserId((prev) => {
          if (rows.some((member) => String(member.user_id || '') === prev)) return prev;
          const firstUserId = rows.find((member) => Number(member.user_id || 0) > 0)?.user_id;
          return firstUserId ? String(firstUserId) : '';
        });
      } catch {
        setRoleMembers([]);
        setSelectedRoleUserId('');
      } finally {
        setLoadingRoleMembers(false);
      }
    };
    void loadRoleMembers();
  }, [selectedRoleNodeId, selectedVersionId]);

  const handleSelectNode = useCallback(
    async (levelIndex: number, node: KaryakariniNode) => {
      if (!selectedVersionId) return;

      const trimmed = levels.slice(0, levelIndex + 1).map((level, idx) =>
        idx === levelIndex ? { ...level, selectedNodeId: node.id } : level
      );
      setLevels(trimmed);

      try {
        const children = await fetchNodes(selectedVersionId, node.id);
        if (!children.length) return;
        setLevels([
          ...trimmed,
          {
            parentNode: node,
            nodes: children,
            selectedNodeId: null,
          },
        ]);
      } catch (err: any) {
        Alert.alert('Error', err?.response?.data?.message || 'Failed to load child nodes');
      }
    },
    [fetchNodes, levels, selectedVersionId]
  );

  const handleOpenMembers = useCallback(
    async (node: KaryakariniNode) => {
      setMembersVisible(true);
      setMembersNode(node);
      await loadMembers(node, 1);
    },
    [loadMembers]
  );

  const handleOpenEditMember = useCallback((member: KaryakariniMember) => {
    const categoryValues = parseLabelList(member.categories && member.categories.length ? member.categories : member.category || '');
    const subcategoryValues = parseLabelList(
      member.subcategories && member.subcategories.length ? member.subcategories : member.subcategory || ''
    );
    setEditingMember(member);
    setEditMemberForm({
      name: String(member.first_name || '').trim(),
      fatherOrHusbandName: String(member.father_name || '').trim(),
      mobileNumber: String(member.mobile_number || '').trim(),
      pad: String(member.pad || '').trim(),
      category: categoryValues.join(', '),
      subcategory: subcategoryValues.join(', '),
      userRole: String(member.user_role || 'user').trim().toLowerCase() === 'admin' ? 'admin' : 'user',
      state: String(member.state || '').trim(),
      district: String(member.district || '').trim(),
      tehsil: String(member.tehsil || '').trim(),
      village: String(member.address_village || member.village || '').trim(),
      pincode: String(member.pincode || '').trim(),
      avatar: String(member.avatar || '').trim(),
    });
    setShowEditMemberModal(true);
  }, []);

  const handleSubmitMemberEdit = useCallback(async () => {
    if (!editingMember || !selectedVersionId) return;
    if (!editMemberForm.pad.trim()) {
      Alert.alert('Required', 'Pad is required');
      return;
    }
    if (!editMemberForm.category.trim() || !editMemberForm.subcategory.trim()) {
      Alert.alert('Required', 'Category and subcategory are required');
      return;
    }

    try {
      setSavingMemberEdit(true);
      const categories = parseLabelList(editMemberForm.category);
      const subcategories = parseLabelList(editMemberForm.subcategory);
      await karyakariniClient.put(`/karyakarini/member/${editingMember.id}`, {
        versionId: selectedVersionId,
        name: editMemberForm.name.trim() || null,
        fatherOrHusbandName: editMemberForm.fatherOrHusbandName.trim() || null,
        mobileNumber: editMemberForm.mobileNumber.trim() || null,
        pad: editMemberForm.pad.trim(),
        category: categories[0] || null,
        subcategory: subcategories[0] || null,
        categories,
        subcategories,
        userRole: editMemberForm.userRole === 'admin' ? 'admin' : 'user',
        state: editMemberForm.state.trim() || null,
        district: editMemberForm.district.trim() || null,
        tehsil: editMemberForm.tehsil.trim() || null,
        village: editMemberForm.village.trim() || null,
        pincode: editMemberForm.pincode.trim() || null,
        avatar: editMemberForm.avatar.trim() || null,
      });
      setShowEditMemberModal(false);
      if (membersNode) {
        await loadMembers(membersNode, membersPagination.page || 1);
      }
      Alert.alert('Success', 'Member updated successfully');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to update member');
    } finally {
      setSavingMemberEdit(false);
    }
  }, [editMemberForm, editingMember, loadMembers, membersNode, membersPagination.page, selectedVersionId]);

  const handleOpenAddMember = useCallback((node: KaryakariniNode) => {
    setAddTargetNode(node);
    setMemberModalTab('create');
    setSelectedUser(null);
    setUserSearchQuery('');
    setSearchResults([]);
    setMemberForm({
      mobileNumber: '',
      name: '',
      password: '',
      fatherOrHusbandName: '',
      pad: padOptions[0] || DEFAULT_PAD_OPTIONS[0],
      category: CATEGORY_SUBCATEGORY_OPTIONS[0]?.category || '',
      subcategory: CATEGORY_SUBCATEGORY_OPTIONS[0]?.subcategories?.[0] || '',
      userRole: 'user',
      state: '',
      district: '',
      tehsil: '',
      village: '',
      pincode: '',
      avatar: '',
    });
    setAssignForm({
      pad: padOptions[0] || DEFAULT_PAD_OPTIONS[0],
      category: CATEGORY_SUBCATEGORY_OPTIONS[0]?.category || '',
      subcategory: CATEGORY_SUBCATEGORY_OPTIONS[0]?.subcategories?.[0] || '',
      userRole: 'user',
    });
    setPincodeLookupMessage(null);
    setLastAutoFilledPincode('');
    if (selectedVersionId) {
      void loadPadOptions(selectedVersionId);
    }
    setShowAddMemberModal(true);
  }, [loadPadOptions, padOptions, selectedVersionId]);

  const handleOpenAddNode = useCallback((node: KaryakariniNode) => {
    const childOptions = getAllowedNodeLevels(node.level, 'child');
    setAddTargetNode(node);
    setNodeForm({
      name: '',
      level: childOptions[0]?.value || 'jila',
      relation: 'child',
    });
    setShowAddNodeModal(true);
  }, []);

  useEffect(() => {
    if (!showAddNodeModal) return;
    if (!addTargetNode) return;

    const options = getAllowedNodeLevels(addTargetNode.level, nodeForm.relation);
    if (!options.length) return;
    if (options.some((option) => option.value === nodeForm.level)) return;

    setNodeForm((prev) => ({
      ...prev,
      level: options[0].value,
    }));
  }, [addTargetNode, nodeForm.level, nodeForm.relation, showAddNodeModal]);

  const handleSearchUsers = useCallback(async () => {
    const q = userSearchQuery.trim();
    if (q.length < 3) {
      Alert.alert('Search', 'Enter at least 3 characters of mobile number or email');
      return;
    }
    try {
      setSearchingUsers(true);
      const response = await karyakariniClient.get('/karyakarini/members/search-users', {
        params: { q, limit: 12 },
      });
      setSearchResults((response?.data?.data?.users || []) as KaryakariniAssignableUser[]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to search users');
      setSearchResults([]);
    } finally {
      setSearchingUsers(false);
    }
  }, [userSearchQuery]);

  const handlePickUser = useCallback((picked: KaryakariniAssignableUser) => {
    setSelectedUser(picked);
  }, []);

  const lookupAddressByPincode = useCallback(async (pincode: string) => {
    const normalized = String(pincode || '').replace(/\D/g, '').slice(0, 6);
    if (normalized.length !== 6) return;

    try {
      setPincodeLookupLoading(true);
      setPincodeLookupMessage(null);
      const response = await fetch(`https://api.postalpincode.in/pincode/${normalized}`);
      const payload = (await response.json()) as any[];
      const first = Array.isArray(payload) ? payload[0] : null;
      const offices = Array.isArray(first?.PostOffice) ? first.PostOffice : [];
      const topOffice = offices[0] || null;
      if (!topOffice || String(first?.Status || '').toLowerCase() !== 'success') {
        setPincodeLookupMessage('Could not auto-fill address from pincode');
        setLastAutoFilledPincode(normalized);
        return;
      }

      const state = String(topOffice.State || '').trim();
      const district = String(topOffice.District || '').trim();
      const tehsil = String(topOffice.Block || topOffice.Taluk || topOffice.Division || '').trim();
      const village = String(topOffice.Name || '').trim();
      setMemberForm((prev) => {
        const currentPin = String(prev.pincode || '').replace(/\D/g, '').slice(0, 6);
        if (currentPin !== normalized) return prev;
        return {
          ...prev,
          state: prev.state.trim() || state,
          district: prev.district.trim() || district,
          tehsil: prev.tehsil.trim() || tehsil,
          village: prev.village.trim() || village,
        };
      });
      setPincodeLookupMessage('Address auto-filled from pincode');
      setLastAutoFilledPincode(normalized);
    } catch {
      setPincodeLookupMessage('Could not auto-fill address from pincode');
      setLastAutoFilledPincode(normalized);
    } finally {
      setPincodeLookupLoading(false);
    }
  }, []);

  const handleMemberPincodeChange = useCallback(
    (value: string) => {
      const normalized = String(value || '').replace(/\D/g, '').slice(0, 6);
      setMemberForm((prev) => ({ ...prev, pincode: normalized }));
      if (normalized.length < 6) {
        setPincodeLookupMessage(null);
        setLastAutoFilledPincode('');
        return;
      }
      if (normalized === lastAutoFilledPincode || pincodeLookupLoading) return;
      void lookupAddressByPincode(normalized);
    },
    [lastAutoFilledPincode, lookupAddressByPincode, pincodeLookupLoading]
  );

  const handleOpenPadbharTransfer = useCallback((mode?: 'create' | 'assign' | 'edit' | 'task') => {
    const resolvedMode = mode || (memberModalTab === 'assign' ? 'assign' : 'create');
    const initial = parseLabelList(
      resolvedMode === 'assign'
        ? assignForm.subcategory
        : resolvedMode === 'edit'
          ? editMemberForm.subcategory
          : resolvedMode === 'task'
            ? taskForm.subcategory
            : memberForm.subcategory
    );
    setPadbharTransferMode(resolvedMode);
    setTransferDraftSubcategories(initial);
    setTransferExpandedCategories(CATEGORY_SUBCATEGORY_OPTIONS.map((entry) => entry.category));
    setPadbharTransferVisible(true);
  }, [assignForm.subcategory, editMemberForm.subcategory, memberForm.subcategory, memberModalTab, taskForm.subcategory]);

  const toggleTransferCategory = useCallback((category: string) => {
    setTransferExpandedCategories((prev) =>
      prev.includes(category) ? prev.filter((entry) => entry !== category) : [...prev, category]
    );
  }, []);

  const handleTransferAddSubcategory = useCallback((subcategory: string) => {
    setTransferDraftSubcategories((prev) => {
      const next = String(subcategory || '').trim();
      if (!next) return prev;
      if (prev.includes(next)) return prev;
      return [...prev, next];
    });
  }, []);

  const handleTransferRemoveSubcategory = useCallback((subcategory: string) => {
    setTransferDraftSubcategories((prev) => prev.filter((entry) => entry !== subcategory));
  }, []);

  const handleApplyPadbharTransfer = useCallback(() => {
    const nextSubcategories = [...new Set(transferDraftSubcategories.map((entry) => String(entry || '').trim()).filter(Boolean))];
    const nextCategories = deriveCategoriesFromSubcategories(nextSubcategories);
    if (padbharTransferMode === 'assign') {
      setAssignForm((prev) => ({
        ...prev,
        category: nextCategories.join(', '),
        subcategory: nextSubcategories.join(', '),
      }));
    } else if (padbharTransferMode === 'edit') {
      setEditMemberForm((prev) => ({
        ...prev,
        category: nextCategories.join(', '),
        subcategory: nextSubcategories.join(', '),
      }));
    } else if (padbharTransferMode === 'task') {
      setTaskForm((prev) => ({
        ...prev,
        category: nextCategories.join(', '),
        subcategory: nextSubcategories.join(', '),
      }));
    } else {
      setMemberForm((prev) => ({
        ...prev,
        category: nextCategories.join(', '),
        subcategory: nextSubcategories.join(', '),
      }));
    }
    setPadbharTransferVisible(false);
  }, [padbharTransferMode, transferDraftSubcategories]);

  const handleSubmitNode = useCallback(async () => {
    if (!addTargetNode || !selectedVersionId) return;
    if (!nodeForm.name.trim()) {
      Alert.alert('Required', 'Node name is required');
      return;
    }
    if (!allowedNodeLevelOptions.length) {
      Alert.alert('Invalid', 'No valid level available for selected relation');
      return;
    }

    try {
      setAddingNode(true);
      const createResponse = await karyakariniClient.post('/karyakarini/nodes', {
        name: nodeForm.name.trim(),
        level: nodeForm.level,
        parentId: nodeForm.relation === 'child' ? addTargetNode.id : addTargetNode.parent_id ?? null,
        versionId: selectedVersionId,
      });

      const createdNodeId = Number(createResponse?.data?.data?.id || 0);
      if (nodeForm.relation === 'parent' && createdNodeId > 0) {
        await karyakariniClient.put(`/karyakarini/nodes/${addTargetNode.id}`, {
          versionId: selectedVersionId,
          parentId: createdNodeId,
        });
      }

      setShowAddNodeModal(false);
      await loadTree(selectedVersionId, [], assignableNodes);
      Alert.alert('Success', 'Node added successfully');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to add node');
    } finally {
      setAddingNode(false);
    }
  }, [addTargetNode, allowedNodeLevelOptions.length, assignableNodes, loadTree, nodeForm.level, nodeForm.name, nodeForm.relation, selectedVersionId]);

  const handleSubmitMember = useCallback(async () => {
    if (!addTargetNode || !selectedVersionId) return;

    try {
      setAddingMember(true);
      let response: any;
      if (memberModalTab === 'assign') {
        if (!selectedUser?.id) {
          Alert.alert('Required', 'Search and select an existing user');
          return;
        }
        if (!assignForm.pad.trim()) {
          Alert.alert('Required', 'Pad is required');
          return;
        }
        if (!assignForm.category.trim() || !assignForm.subcategory.trim()) {
          Alert.alert('Required', 'Category and subcategory are required');
          return;
        }
        const assignCategories = parseLabelList(assignForm.category);
        const assignSubcategories = parseLabelList(assignForm.subcategory);
        response = await karyakariniClient.post('/karyakarini/member', {
          nodeId: addTargetNode.id,
          versionId: selectedVersionId,
          userId: selectedUser.id,
          pad: assignForm.pad.trim(),
          category: assignCategories[0] || null,
          subcategory: assignSubcategories[0] || null,
          categories: assignCategories,
          subcategories: assignSubcategories,
          userRole: assignForm.userRole === 'admin' ? 'admin' : 'user',
        });
      } else {
        if (!memberForm.mobileNumber.trim() || !memberForm.name.trim()) {
          Alert.alert('Required', 'Mobile and name are required');
          return;
        }
        if (!memberForm.pad.trim()) {
          Alert.alert('Required', 'Pad is required');
          return;
        }
        if (!memberForm.category.trim() || !memberForm.subcategory.trim()) {
          Alert.alert('Required', 'Category and subcategory are required');
          return;
        }
        const createCategories = parseLabelList(memberForm.category);
        const createSubcategories = parseLabelList(memberForm.subcategory);
        response = await karyakariniClient.post('/karyakarini/member', {
          nodeId: addTargetNode.id,
          versionId: selectedVersionId,
          mobileNumber: memberForm.mobileNumber.trim(),
          name: memberForm.name.trim(),
          password: memberForm.password.trim() || undefined,
          fatherOrHusbandName: memberForm.fatherOrHusbandName.trim() || null,
          pad: memberForm.pad.trim(),
          category: createCategories[0] || null,
          subcategory: createSubcategories[0] || null,
          categories: createCategories,
          subcategories: createSubcategories,
          userRole: memberForm.userRole === 'admin' ? 'admin' : 'user',
          state: memberForm.state.trim(),
          district: memberForm.district.trim(),
          tehsil: memberForm.tehsil.trim(),
          village: memberForm.village.trim(),
          pincode: memberForm.pincode.trim(),
          avatar: memberForm.avatar.trim() || null,
        });
      }

      setShowAddMemberModal(false);
      const created = response?.data?.data || null;
      if (created?.createdUser) {
        const loginId = created.mobileNumber || created.email || memberForm.mobileNumber.trim();
        const loginPassword = created.loginPassword || memberForm.password.trim() || 'welcome';
        Alert.alert('Success', `Member added. New user login:\nID: ${loginId}\nPassword: ${loginPassword}`);
      } else {
        Alert.alert('Success', memberModalTab === 'assign' ? 'Member assigned successfully' : 'Member added successfully');
      }

      const selectedIds = selectedPathNodes.map((node) => node.id);
      await loadTree(selectedVersionId, selectedIds, assignableNodes);
      if (membersVisible && membersNode?.id === addTargetNode.id) {
        await loadMembers(addTargetNode, membersPagination.page || 1);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  }, [
    addTargetNode,
    loadMembers,
    loadTree,
    memberForm.avatar,
    memberForm.fatherOrHusbandName,
    memberForm.mobileNumber,
    memberForm.name,
    memberForm.password,
    memberForm.pad,
    memberForm.category,
    memberForm.subcategory,
    memberForm.userRole,
    memberForm.state,
    memberForm.district,
    memberForm.tehsil,
    memberForm.village,
    memberForm.pincode,
    assignForm.pad,
    assignForm.category,
    assignForm.subcategory,
    assignForm.userRole,
    assignableNodes,
    memberModalTab,
    selectedUser,
    membersNode?.id,
    membersPagination.page,
    membersVisible,
    selectedPathNodes,
    selectedVersionId,
  ]);

  const handleOpenMeetingModal = useCallback(async () => {
    if (!selectedVersionId) return;
    if (!assignableNodes.length) {
      Alert.alert('Access', 'No assignable node scope found for this user');
      return;
    }
    const defaultNodeId = String(assignableNodes[0]?.id || '');
    setEditingMeetingId(null);
    setMeetingParticipantPreview([]);
    setMeetingForm({
      title: '',
      description: '',
      meetingDate: toDateInput(),
      nodeId: defaultNodeId,
      attendeeUserIds: [],
      invitedUserIds: [],
      guestIds: [],
      newGuestName: '',
      newGuestMobile: '',
      newGuestEmail: '',
      attachmentInput: '',
      attachments: [],
    });
    setMeetingMembers([]);
    setMeetingGuests([]);
    setMeetingGuestQuery('');
    setAttendanceBrowseNodeId(defaultNodeId);
    setInvitationBrowseNodeId(defaultNodeId);
    setMeetingInvitePreview([]);
    setShowAttendanceTransferModal(false);
    setShowInvitationTransferModal(false);
    if (defaultNodeId) {
      await loadNodeMembersForForm(Number(defaultNodeId), selectedVersionId, 'meeting');
      await loadGuestsForNode(Number(defaultNodeId), selectedVersionId, '');
    }
    setShowMeetingModal(true);
  }, [assignableNodes, loadGuestsForNode, loadNodeMembersForForm, selectedVersionId]);

  const fetchMeetingDetails = useCallback(
    async (meetingId: number) => {
      if (!selectedVersionId) return null;
      const response = await karyakariniClient.get(`/karyakarini/meetings/${meetingId}`, {
        params: {
          versionId: selectedVersionId,
        },
      });
      return (response?.data?.data?.meeting || null) as KaryakariniMeetingDetails | null;
    },
    [selectedVersionId]
  );

  const handleOpenMeetingEdit = useCallback(
    async (meetingId: number) => {
      if (!selectedVersionId) return;
      try {
        setMeetingDetailLoading(true);
        const details = await fetchMeetingDetails(meetingId);
        if (!details) {
          Alert.alert('Error', 'Meeting details not found');
          return;
        }
        const nodeId = String(details.node_id || '');
        setEditingMeetingId(meetingId);
        setMeetingGuestQuery('');
        setAttendanceBrowseNodeId(nodeId);
        setInvitationBrowseNodeId(nodeId);
        setShowAttendanceTransferModal(false);
        setShowInvitationTransferModal(false);
        setMeetingParticipantPreview(
          Array.isArray(details.attendees)
            ? details.attendees
              .map((attendee) => {
                const isGuest = attendee.attendee_type === 'guest';
                const mappedId = Number(isGuest ? attendee.guest_member_id : attendee.user_id);
                if (!mappedId) return null;
                const fullName = [attendee.first_name, attendee.father_name].filter(Boolean).join(' ').trim();
                const branchLabel = [attendee.node_level, attendee.node_name].filter(Boolean).join('-');
                return {
                  key: `${isGuest ? 'guest' : 'member'}-${mappedId}`,
                  attendeeType: isGuest ? 'guest' : 'member',
                  id: mappedId,
                  name: fullName || `Member #${mappedId}`,
                  subtitle: branchLabel || attendee.mobile_number || attendee.email || '',
                  avatar: attendee.avatar || null,
                };
              })
              .filter(Boolean) as TransferAttendee[]
            : []
        );
        setMeetingInvitePreview(
          Array.isArray(details.invites)
            ? details.invites
              .map((invite) => {
                const invitedUserId = Number(invite.invited_user_id || 0);
                if (!invitedUserId) return null;
                const fullName = [invite.invited_first_name, invite.invited_father_name].filter(Boolean).join(' ').trim();
                const branchLabel = [invite.invited_node_level, invite.invited_node_name].filter(Boolean).join('-');
                return {
                  key: `member-${invitedUserId}`,
                  attendeeType: 'member' as const,
                  id: invitedUserId,
                  name: fullName || `User #${invitedUserId}`,
                  subtitle: branchLabel || invite.invited_mobile || invite.invited_email || '',
                  avatar: null,
                };
              })
              .filter(Boolean) as TransferAttendee[]
            : []
        );
        setMeetingForm({
          title: details.title || '',
          description: details.description || '',
          meetingDate: toDateInput(details.meeting_date),
          nodeId,
          attendeeUserIds: Array.isArray(details.attendeeUserIds)
            ? details.attendeeUserIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
            : [],
          invitedUserIds: Array.isArray(details.invitedUserIds)
            ? details.invitedUserIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
            : [],
          guestIds: Array.isArray(details.guestIds)
            ? details.guestIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
            : [],
          newGuestName: '',
          newGuestMobile: '',
          newGuestEmail: '',
          attachmentInput: '',
          attachments: Array.isArray(details.attachments) ? details.attachments : [],
        });
        if (nodeId) {
          await loadNodeMembersForForm(Number(nodeId), selectedVersionId, 'meeting');
          await loadGuestsForNode(Number(nodeId), selectedVersionId, '');
        }
        setShowMeetingModal(true);
      } catch (err: any) {
        Alert.alert('Error', err?.response?.data?.message || 'Failed to load meeting details');
      } finally {
        setMeetingDetailLoading(false);
      }
    },
    [fetchMeetingDetails, loadGuestsForNode, loadNodeMembersForForm, selectedVersionId]
  );

  const handleViewMeetingAttachments = useCallback(
    async (meetingId: number, meetingTitle?: string) => {
      try {
        setMeetingDetailLoading(true);
        const details = await fetchMeetingDetails(meetingId);
        if (!details) {
          Alert.alert('Error', 'Meeting details not found');
          return;
        }
        setMeetingAttachmentTitle(meetingTitle || details.title || 'Meeting Attachments');
        setMeetingAttachmentItems(Array.isArray(details.attachments) ? details.attachments : []);
        setShowMeetingAttachmentModal(true);
      } catch (err: any) {
        Alert.alert('Error', err?.response?.data?.message || 'Failed to load attachments');
      } finally {
        setMeetingDetailLoading(false);
      }
    },
    [fetchMeetingDetails]
  );

  const handleAddTransferAttendee = useCallback((item: TransferAttendee) => {
    setMeetingForm((prev) => {
      if (item.attendeeType === 'member') {
        if (prev.attendeeUserIds.includes(item.id)) return prev;
        return {
          ...prev,
          attendeeUserIds: [...prev.attendeeUserIds, item.id],
        };
      }
      if (prev.guestIds.includes(item.id)) return prev;
      return {
        ...prev,
        guestIds: [...prev.guestIds, item.id],
      };
    });
    setMeetingParticipantPreview((prev) => {
      if (prev.some((entry) => entry.key === item.key)) return prev;
      return [...prev, item];
    });
  }, []);

  const handleRemoveTransferAttendee = useCallback((item: TransferAttendee) => {
    setMeetingForm((prev) => ({
      ...prev,
      attendeeUserIds: item.attendeeType === 'member' ? prev.attendeeUserIds.filter((id) => id !== item.id) : prev.attendeeUserIds,
      guestIds: item.attendeeType === 'guest' ? prev.guestIds.filter((id) => id !== item.id) : prev.guestIds,
    }));
    setMeetingParticipantPreview((prev) => prev.filter((entry) => entry.key !== item.key));
  }, []);

  const handleAddInviteMember = useCallback((item: TransferAttendee) => {
    if (item.attendeeType !== 'member') return;
    setMeetingForm((prev) => {
      if (prev.invitedUserIds.includes(item.id)) return prev;
      return {
        ...prev,
        invitedUserIds: [...prev.invitedUserIds, item.id],
      };
    });
    setMeetingInvitePreview((prev) => {
      if (prev.some((entry) => entry.key === item.key)) return prev;
      return [...prev, item];
    });
  }, []);

  const handleRemoveInviteMember = useCallback((item: TransferAttendee) => {
    if (item.attendeeType !== 'member') return;
    setMeetingForm((prev) => ({
      ...prev,
      invitedUserIds: prev.invitedUserIds.filter((id) => id !== item.id),
    }));
    setMeetingInvitePreview((prev) => prev.filter((entry) => entry.key !== item.key));
  }, []);

  const handleChangeMeetingNode = useCallback(
    async (nextNodeId: string) => {
      if (!selectedVersionId) return;
      setMeetingForm((prev) => ({
        ...prev,
        nodeId: nextNodeId,
        attendeeUserIds: [],
        invitedUserIds: [],
        guestIds: [],
      }));
      setMeetingParticipantPreview([]);
      setMeetingInvitePreview([]);
      setAttendanceBrowseNodeId(nextNodeId);
      setInvitationBrowseNodeId(nextNodeId);
      setMeetingGuestQuery('');
      if (nextNodeId) {
        await loadNodeMembersForForm(Number(nextNodeId), selectedVersionId, 'meeting');
        await loadGuestsForNode(Number(nextNodeId), selectedVersionId, '');
      } else {
        setMeetingMembers([]);
        setMeetingGuests([]);
      }
    },
    [loadGuestsForNode, loadNodeMembersForForm, selectedVersionId]
  );

  const handleChangeAttendanceBrowseNode = useCallback(
    async (nextNodeId: string) => {
      if (!selectedVersionId) return;
      setAttendanceBrowseNodeId(nextNodeId);
      setMeetingGuestQuery('');
      if (nextNodeId) {
        await loadNodeMembersForForm(Number(nextNodeId), selectedVersionId, 'meeting');
        await loadGuestsForNode(Number(nextNodeId), selectedVersionId, '');
      } else {
        setMeetingMembers([]);
        setMeetingGuests([]);
      }
    },
    [loadGuestsForNode, loadNodeMembersForForm, selectedVersionId]
  );

  const handleChangeInvitationBrowseNode = useCallback(
    async (nextNodeId: string) => {
      if (!selectedVersionId) return;
      setInvitationBrowseNodeId(nextNodeId);
      if (nextNodeId) {
        await loadNodeMembersForForm(Number(nextNodeId), selectedVersionId, 'meeting');
      } else {
        setMeetingMembers([]);
      }
    },
    [loadNodeMembersForForm, selectedVersionId]
  );

  const handleOpenTaskModal = useCallback(async () => {
    if (!selectedVersionId) return;
    if (!assignableNodes.length) {
      Alert.alert('Access', 'No assignable node scope found for this user');
      return;
    }
    const defaultNodeId = String(assignableNodes[0]?.id || '');
    setTaskForm({
      title: '',
      description: '',
      taskDate: toDateInput(),
      dueDate: '',
      status: 'open',
      hierarchyL1: '',
      hierarchyL2: '',
      hierarchyL3: '',
      hierarchyL4: '',
      hierarchyL5: '',
      hierarchyL5Sublevels: '',
      category: '',
      subcategory: '',
      nodeId: defaultNodeId,
      assignedUserId: '',
      attachmentInput: '',
      attachments: [],
    });
    setTaskMembers([]);
    if (defaultNodeId) {
      await loadNodeMembersForForm(Number(defaultNodeId), selectedVersionId, 'task');
    }
    setShowTaskModal(true);
  }, [assignableNodes, loadNodeMembersForForm, selectedVersionId]);

  const handleTaskCascadeSelect = useCallback(
    async (nodeId: number) => {
      if (!selectedVersionId || !nodeId) return;
      const nodeValue = String(nodeId);
      setTaskForm((prev) => ({ ...prev, nodeId: nodeValue, assignedUserId: '' }));
      await loadNodeMembersForForm(nodeId, selectedVersionId, 'task');
    },
    [loadNodeMembersForForm, selectedVersionId]
  );

  const addMeetingAttachmentByUrl = useCallback(() => {
    const url = meetingForm.attachmentInput.trim();
    if (!url) return;
    setMeetingForm((prev) => ({
      ...prev,
      attachmentInput: '',
      attachments: [...prev.attachments, { url, type: 'document', name: url.split('/').pop() || 'attachment' }],
    }));
  }, [meetingForm.attachmentInput]);

  const addTaskAttachmentByUrl = useCallback(() => {
    const url = taskForm.attachmentInput.trim();
    if (!url) return;
    setTaskForm((prev) => ({
      ...prev,
      attachmentInput: '',
      attachments: [...prev.attachments, { url, type: 'document', name: url.split('/').pop() || 'attachment' }],
    }));
  }, [taskForm.attachmentInput]);

  const handleUploadMeetingAttachment = useCallback(async () => {
    try {
      setMeetingUploadingAttachment(true);
      const uploaded = await pickAndUploadAttachment('meeting');
      if (!uploaded?.url) return;
      setMeetingForm((prev) => ({
        ...prev,
        attachments: [...prev.attachments, uploaded],
      }));
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'Failed to upload attachment');
    } finally {
      setMeetingUploadingAttachment(false);
    }
  }, [pickAndUploadAttachment]);

  const handleUploadTaskAttachment = useCallback(async () => {
    try {
      setTaskUploadingAttachment(true);
      const uploaded = await pickAndUploadAttachment('task');
      if (!uploaded?.url) return;
      setTaskForm((prev) => ({
        ...prev,
        attachments: [...prev.attachments, uploaded],
      }));
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'Failed to upload attachment');
    } finally {
      setTaskUploadingAttachment(false);
    }
  }, [pickAndUploadAttachment]);

  const handleCreateMeetingGuest = useCallback(async () => {
    if (!selectedVersionId) return;
    const nodeId = Number(currentAttendanceNodeId || 0);
    if (!nodeId) {
      Alert.alert('Required', 'Select node first');
      return;
    }
    if (!meetingForm.newGuestName.trim()) {
      Alert.alert('Required', 'Guest name is required');
      return;
    }

    try {
      const response = await karyakariniClient.post('/karyakarini/guests', {
        nodeId,
        versionId: selectedVersionId,
        name: meetingForm.newGuestName.trim(),
        mobile: meetingForm.newGuestMobile.trim() || null,
        email: meetingForm.newGuestEmail.trim() || null,
      });
      const guestId = Number(response?.data?.data?.guest?.id || 0);
      const guestName = meetingForm.newGuestName.trim();
      const guestMeta = meetingForm.newGuestMobile.trim() || meetingForm.newGuestEmail.trim() || '';
      const guestNode = assignableNodes.find((entry) => String(entry.id) === String(nodeId));
      const branchLabel = [guestNode?.level, guestNode?.name].filter(Boolean).join('-');
      setMeetingForm((prev) => ({
        ...prev,
        newGuestName: '',
        newGuestMobile: '',
        newGuestEmail: '',
        guestIds: guestId > 0 ? [...new Set([...prev.guestIds, guestId])] : prev.guestIds,
      }));
      if (guestId > 0) {
        setMeetingParticipantPreview((prev) => [
          ...prev.filter((entry) => entry.key !== `guest-${guestId}`),
          {
            key: `guest-${guestId}`,
            attendeeType: 'guest',
            id: guestId,
            name: guestName || `Guest #${guestId}`,
            subtitle: branchLabel || guestMeta,
            avatar: null,
          },
        ]);
      }
      await loadGuestsForNode(nodeId, selectedVersionId, '');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create guest');
    }
  }, [
    currentAttendanceNodeId,
    assignableNodes,
    loadGuestsForNode,
    meetingForm.newGuestEmail,
    meetingForm.newGuestMobile,
    meetingForm.newGuestName,
    selectedVersionId,
  ]);

  const handleSearchMeetingGuests = useCallback(async () => {
    if (!selectedVersionId) return;
    const nodeId = Number(currentAttendanceNodeId || 0);
    if (!nodeId) return;
    await loadGuestsForNode(nodeId, selectedVersionId, meetingGuestQuery.trim());
  }, [currentAttendanceNodeId, loadGuestsForNode, meetingGuestQuery, selectedVersionId]);

  const handleSubmitMeeting = useCallback(async () => {
    if (!selectedVersionId) return;
    const nodeId = Number(meetingForm.nodeId || 0);
    if (!nodeId || !meetingForm.title.trim()) {
      Alert.alert('Required', 'Meeting title and node are required');
      return;
    }

    try {
      setCreatingMeeting(true);
      const payload = {
        versionId: selectedVersionId,
        nodeId,
        title: meetingForm.title.trim(),
        description: meetingForm.description.trim() || null,
        meetingDate: meetingForm.meetingDate,
        attendeeUserIds: meetingForm.attendeeUserIds,
        invitedUserIds: meetingForm.invitedUserIds,
        guestIds: meetingForm.guestIds,
        attachments: meetingForm.attachments,
      };
      if (editingMeetingId) {
        await karyakariniClient.put(`/karyakarini/meetings/${editingMeetingId}`, payload);
      } else {
        await karyakariniClient.post('/karyakarini/meetings', payload);
      }
      setShowMeetingModal(false);
      setEditingMeetingId(null);
      setAttendanceBrowseNodeId('');
      setInvitationBrowseNodeId('');
      setMeetingParticipantPreview([]);
      setMeetingInvitePreview([]);
      await loadMeetings(selectedVersionId, 1);
      Alert.alert('Success', editingMeetingId ? 'Meeting updated successfully' : 'Meeting created successfully');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || `Failed to ${editingMeetingId ? 'update' : 'create'} meeting`);
    } finally {
      setCreatingMeeting(false);
    }
  }, [editingMeetingId, loadMeetings, meetingForm, selectedVersionId]);

  const handleSubmitTask = useCallback(async () => {
    if (!selectedVersionId) return;
    const nodeId = Number(taskForm.nodeId || 0);
    if (!nodeId || !taskForm.title.trim()) {
      Alert.alert('Required', 'Task title and node are required');
      return;
    }
    if (currentUserRole !== 'superadmin' && scopeRootNodeIds.has(nodeId)) {
      Alert.alert('Restricted', 'You can create tasks only for child nodes below your assigned level');
      return;
    }
    const taskCategories = parseLabelList(taskForm.category);
    const taskSubcategories = parseLabelList(taskForm.subcategory);
    if (!taskSubcategories.length) {
      Alert.alert('Required', 'Task subcategory selection is required');
      return;
    }

    try {
      setCreatingTask(true);
      await karyakariniClient.post('/karyakarini/tasks', {
        versionId: selectedVersionId,
        nodeId,
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || null,
        taskDate: taskForm.taskDate,
        dueDate: taskForm.dueDate.trim() || null,
        status: taskForm.status,
        category: taskCategories[0] || null,
        subcategory: taskSubcategories[0] || null,
        categories: taskCategories,
        subcategories: taskSubcategories,
        assignedUserId: taskForm.assignedUserId ? Number(taskForm.assignedUserId) : null,
        attachments: taskForm.attachments,
      });
      setShowTaskModal(false);
      await loadTasks(selectedVersionId, 1);
      Alert.alert('Success', 'Task created successfully');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create task');
    } finally {
      setCreatingTask(false);
    }
  }, [currentUserRole, loadTasks, scopeRootNodeIds, selectedVersionId, taskForm]);

  const handleAssignRole = useCallback(async () => {
    if (!selectedVersionId) return;
    const nodeId = Number(selectedRoleNodeId || 0);
    const targetUserId = Number(selectedRoleUserId || 0);
    if (!nodeId || !targetUserId) {
      Alert.alert('Required', 'Select node level, node, and member to assign admin role');
      return;
    }

    try {
      setAssigningRole(true);
      await karyakariniClient.post('/karyakarini/scopes', {
        userId: targetUserId,
        nodeId,
        versionId: selectedVersionId,
        isActive: true,
      });
      Alert.alert('Success', 'Admin role assigned successfully. User should login again to see Admin tab.');
      await loadScopes(selectedVersionId);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to assign admin role');
    } finally {
      setAssigningRole(false);
    }
  }, [loadScopes, selectedRoleNodeId, selectedRoleUserId, selectedVersionId]);

  const handleOpenAttachmentUrl = useCallback(async (url?: string | null) => {
    const safeUrl = String(url || '').trim();
    if (!safeUrl) return;
    try {
      const supported = await Linking.canOpenURL(safeUrl);
      if (!supported) {
        Alert.alert('Attachment', 'Cannot open this attachment URL');
        return;
      }
      await Linking.openURL(safeUrl);
    } catch {
      Alert.alert('Attachment', 'Failed to open attachment');
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.replace('/auth/login' as any);
    } catch {
      Alert.alert('Error', 'Failed to logout');
    }
  }, [logout]);

  const handleOpenNotifications = useCallback(() => {
    router.push('/karyakarini-notifications' as any);
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.helper}>Loading Karyakarini...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.push('/admin' as any)}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Image source={require('../../../assets/images/logo.png')} style={styles.headerLogo} resizeMode="contain" />
          <Text style={styles.headerBrand}>Emeelan</Text>
        </View>
        {user ? (
          <ProfileMenu
            user={user as any}
            onLogout={handleLogout}
            notificationCount={notificationUnreadCount}
            onPressNotifications={handleOpenNotifications}
          />
        ) : null}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
      >
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* <VersionSelector
          versions={versions}
          selectedVersionId={selectedVersionId}
          onChange={(id) => void handleSelectVersion(id)}
          loading={loading}
        /> */}

        <View style={styles.tabSwitchRow}>
          <TouchableOpacity
            style={[styles.tabSwitchBtn, activeTab === 'tree' && styles.tabSwitchBtnActive]}
            onPress={() => setActiveTab('tree')}
          >
            <Text style={[styles.tabSwitchText, activeTab === 'tree' && styles.tabSwitchTextActive]}>Team</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabSwitchBtn, activeTab === 'tasks' && styles.tabSwitchBtnActive]}
            onPress={() => setActiveTab('tasks')}
          >
            <Text style={[styles.tabSwitchText, activeTab === 'tasks' && styles.tabSwitchTextActive]}>Tasks</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'tree' ? (
          <TreeView
            levels={levels}
            breadcrumb={breadcrumb}
            onSelectNode={(levelIndex, node) => void handleSelectNode(levelIndex, node)}
            onOpenMembers={(node) => void handleOpenMembers(node)}
            onAddMember={handleOpenAddMember}
            onAddNode={handleOpenAddNode}
            canAddMembers={canAddMembers}
          />
        ) : null}

        {activeTab === 'meetings' ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Meetings</Text>
              <TouchableOpacity
                style={styles.primaryAction}
                onPress={() => void handleOpenMeetingModal()}
                disabled={!canManageActivities || assignableNodesLoading}
              >
                <Text style={styles.primaryActionText}>Create Meeting</Text>
              </TouchableOpacity>
            </View>
            {!canManageActivities ? <Text style={styles.modalSub}>No node scope assigned for this user</Text> : null}
            {taskHierarchyFilterOptions.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>Filter by L1</Text>
                <View style={styles.optionRow}>
                  <TouchableOpacity
                    style={[styles.optionChip, !taskHierarchyFilterL1 && styles.optionChipActive]}
                    onPress={() => setTaskHierarchyFilterL1('')}
                  >
                    <Text style={[styles.optionChipText, !taskHierarchyFilterL1 && styles.optionChipTextActive]}>All</Text>
                  </TouchableOpacity>
                  {taskHierarchyFilterOptions.map((entry) => (
                    <TouchableOpacity
                      key={`task-filter-l1-${entry}`}
                      style={[styles.optionChip, taskHierarchyFilterL1 === entry && styles.optionChipActive]}
                      onPress={() => setTaskHierarchyFilterL1(entry)}
                    >
                      <Text style={[styles.optionChipText, taskHierarchyFilterL1 === entry && styles.optionChipTextActive]}>{entry}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableWrap}>
              <View>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.colDate]}>Date</Text>
                  <Text style={[styles.tableHeaderCell, styles.colTitle]}>Title</Text>
                  <Text style={[styles.tableHeaderCell, styles.colNode]}>Node</Text>
                  <Text style={[styles.tableHeaderCell, styles.colCount]}>Attendees</Text>
                  <Text style={[styles.tableHeaderCell, styles.colCount]}>Attachments</Text>
                  <Text style={[styles.tableHeaderCell, styles.colAction]}>Action</Text>
                </View>
                {meetingsLoading ? (
                  <View style={styles.tableEmpty}>
                    <Text style={styles.helper}>Loading meetings...</Text>
                  </View>
                ) : meetingRows.length === 0 ? (
                  <View style={styles.tableEmpty}>
                    <Text style={styles.helper}>No meetings found</Text>
                  </View>
                ) : (
                  meetingRows.map((row) => (
                    <View key={`meeting-${row.id}`} style={styles.tableRow}>
                      <Text style={[styles.tableCell, styles.colDate]}>{row.meeting_date || '-'}</Text>
                      <Text style={[styles.tableCell, styles.colTitle]} numberOfLines={2}>{row.title}</Text>
                      <Text style={[styles.tableCell, styles.colNode]} numberOfLines={2}>{row.hierarchy_path || row.node_name || '-'}</Text>
                      <Text style={[styles.tableCell, styles.colCount]}>{Number(row.attendee_count || 0)}</Text>
                      <View style={[styles.tableCell, styles.colCount]}>
                        {Number(row.attachment_count || 0) > 0 ? (
                          <TouchableOpacity onPress={() => void handleViewMeetingAttachments(Number(row.id), row.title)} disabled={meetingDetailLoading}>
                            <Text style={styles.linkText}>📎 {Number(row.attachment_count || 0)}</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.tableCellTextCompact}>0</Text>
                        )}
                      </View>
                      <View style={[styles.tableCell, styles.colAction]}>
                        <TouchableOpacity
                          style={styles.rowActionBtn}
                          onPress={() => void handleOpenMeetingEdit(Number(row.id))}
                          disabled={meetingDetailLoading}
                        >
                          <Text style={styles.rowActionText}>Edit</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
            <Text style={styles.tableMeta}>
              Page {meetingPagination.page} / {Math.max(1, meetingPagination.totalPages || 1)} • Total {meetingPagination.total}
            </Text>
          </View>
        ) : null}

        {activeTab === 'tasks' ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Tasks</Text>
              <TouchableOpacity
                style={styles.primaryAction}
                onPress={() => void handleOpenTaskModal()}
                disabled={!canManageActivities || assignableNodesLoading}
              >
                <Text style={styles.primaryActionText}>Create Task</Text>
              </TouchableOpacity>
            </View>
            {!canManageActivities ? <Text style={styles.modalSub}>No node scope assigned for this user</Text> : null}
            <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableWrap}>
              <View>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.colDate]}>Date</Text>
                  <Text style={[styles.tableHeaderCell, styles.colTitle]}>Title</Text>
                  <Text style={[styles.tableHeaderCell, styles.colNode]}>Node</Text>
                  <Text style={[styles.tableHeaderCell, styles.colAssignee]}>Assignee</Text>
                  <Text style={[styles.tableHeaderCell, styles.colStatus]}>Status</Text>
                </View>
                {tasksLoading ? (
                  <View style={styles.tableEmpty}>
                    <Text style={styles.helper}>Loading tasks...</Text>
                  </View>
                ) : filteredTaskRows.length === 0 ? (
                  <View style={styles.tableEmpty}>
                    <Text style={styles.helper}>No tasks found</Text>
                  </View>
                ) : (
                  filteredTaskRows.map((row) => (
                    <View key={`task-${row.id}`} style={styles.tableRow}>
                      <Text style={[styles.tableCell, styles.colDate]}>{row.task_date || '-'}</Text>
                      <View style={[styles.tableCell, styles.colTitle]}>
                        <Text style={styles.tableCellTextCompact} numberOfLines={2}>{row.title}</Text>
                        {summarizeTaskHierarchy(row) ? (
                          <Text style={styles.tableCellSubText} numberOfLines={1}>
                            {summarizeTaskHierarchy(row)}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[styles.tableCell, styles.colNode]} numberOfLines={2}>{row.hierarchy_path || row.node_name || '-'}</Text>
                      <Text style={[styles.tableCell, styles.colAssignee]} numberOfLines={2}>{summarizeAssignedUser(row)}</Text>
                      <Text style={[styles.tableCell, styles.colStatus]}>{String(row.status || 'open')}</Text>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
            <Text style={styles.tableMeta}>
              Page {taskPagination.page} / {Math.max(1, taskPagination.totalPages || 1)} • Total {taskPagination.total}
            </Text>
          </View>
        ) : null}

        {activeTab === 'roles' ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Role Assignment</Text>
            </View>
            {!canManageActivities ? (
              <Text style={styles.modalSub}>No node scope assigned for this user</Text>
            ) : roleLevelOptions.length === 0 ? (
              <Text style={styles.modalSub}>No lower node levels available for role assignment</Text>
            ) : (
              <>
                <Text style={styles.sectionLabel}>Node Level</Text>
                <View style={styles.optionRow}>
                  {roleLevelOptions.map((level) => (
                    <TouchableOpacity
                      key={`role-level-${level.value}`}
                      style={[styles.optionChip, selectedRoleLevel === level.value && styles.optionChipActive]}
                      onPress={() => setSelectedRoleLevel(level.value)}
                    >
                      <Text style={[styles.optionChipText, selectedRoleLevel === level.value && styles.optionChipTextActive]}>
                        {level.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.sectionLabel}>Node</Text>
                <View style={styles.optionRow}>
                  {roleNodesByLevel.map((node) => (
                    <TouchableOpacity
                      key={`role-node-${node.id}`}
                      style={[styles.optionChip, selectedRoleNodeId === String(node.id) && styles.optionChipActive]}
                      onPress={() => setSelectedRoleNodeId(String(node.id))}
                    >
                      <Text style={[styles.optionChipText, selectedRoleNodeId === String(node.id) && styles.optionChipTextActive]}>
                        {node.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.sectionLabel}>Select Member</Text>
                <View style={styles.selectList}>
                  {loadingRoleMembers ? <Text style={styles.modalSub}>Loading members...</Text> : null}
                  {!loadingRoleMembers &&
                    roleMembers
                      .filter((member) => Number(member.user_id || 0) > 0)
                      .map((member) => {
                        const userId = Number(member.user_id || 0);
                        const selected = selectedRoleUserId === String(userId);
                        return (
                          <TouchableOpacity
                            key={`role-member-${member.id}`}
                            style={[styles.selectItem, selected && styles.selectItemActive]}
                            onPress={() => setSelectedRoleUserId(String(userId))}
                          >
                            <Text style={[styles.selectItemText, selected && styles.selectItemTextActive]}>
                              {[member.first_name, member.father_name].filter(Boolean).join(' ') || `User #${userId}`}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                  {!loadingRoleMembers && roleMembers.filter((member) => Number(member.user_id || 0) > 0).length === 0 ? (
                    <Text style={styles.modalSub}>No members found for selected node</Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={[styles.primaryAction, (assigningRole || !selectedRoleUserId || !selectedRoleNodeId) && styles.saveBtnDisabled]}
                  onPress={() => void handleAssignRole()}
                  disabled={assigningRole || !selectedRoleUserId || !selectedRoleNodeId}
                >
                  <Text style={styles.primaryActionText}>{assigningRole ? 'Assigning...' : 'Assign Admin Role'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : null}
      </ScrollView>

      <MemberDialog
        visible={membersVisible}
        loading={membersLoading}
        node={membersNode}
        members={members}
        pagination={membersPagination}
        onClose={() => setMembersVisible(false)}
        onChangePage={(page) => membersNode && void loadMembers(membersNode, page)}
        onEditMember={handleOpenEditMember}
      />

      <Modal
        visible={showEditMemberModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditMemberModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.memberModalCard]}>
            <Text style={styles.modalTitle}>Edit Member</Text>
            <Text style={styles.modalSub}>{editingMember?.hierarchy_path || editingMember?.node_name || 'Member details'}</Text>

            <ScrollView style={styles.memberModalScroll} contentContainerStyle={styles.memberModalScrollContent}>
              <TextInput
                style={styles.input}
                value={editMemberForm.name}
                onChangeText={(value) => setEditMemberForm((prev) => ({ ...prev, name: value }))}
                placeholder="Name"
              />
              <TextInput
                style={styles.input}
                value={editMemberForm.fatherOrHusbandName}
                onChangeText={(value) => setEditMemberForm((prev) => ({ ...prev, fatherOrHusbandName: value }))}
                placeholder="Father/Husband name"
              />
              <TextInput
                style={styles.input}
                value={editMemberForm.mobileNumber}
                onChangeText={(value) => setEditMemberForm((prev) => ({ ...prev, mobileNumber: value }))}
                placeholder="Mobile number"
                keyboardType="phone-pad"
              />
              <TextInput
                style={styles.input}
                value={editMemberForm.pad}
                onChangeText={(value) => setEditMemberForm((prev) => ({ ...prev, pad: value }))}
                placeholder="Pad *"
              />
              <Text style={styles.sectionLabel}>User Role</Text>
              <View style={styles.optionRow}>
                {(['user', 'admin'] as const).map((role) => (
                  <TouchableOpacity
                    key={`edit-role-${role}`}
                    style={[styles.optionChip, editMemberForm.userRole === role && styles.optionChipActive]}
                    onPress={() => setEditMemberForm((prev) => ({ ...prev, userRole: role }))}
                  >
                    <Text style={[styles.optionChipText, editMemberForm.userRole === role && styles.optionChipTextActive]}>
                      {role === 'admin' ? 'Admin' : 'User'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.input} onPress={() => void handleOpenPadbharTransfer('edit')}>
                <Text style={editSelectedSubcategories.length ? styles.inputText : styles.inputPlaceholder}>
                  {editSelectedSubcategories.length ? `${editSelectedSubcategories.length} subcategories selected` : 'Assign Padbhar *'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditMemberForm((prev) => ({ ...prev, category: '', subcategory: '' }))}>
                <Text style={styles.clearLink}>Clear category/subcategory</Text>
              </TouchableOpacity>
              {editSelectedCategories.length ? <Text style={styles.helper}>Categories: {editSelectedCategories.join(', ')}</Text> : null}
              {editSelectedSubcategories.length ? (
                <Text style={styles.helper}>Subcategories: {editSelectedSubcategories.join(', ')}</Text>
              ) : null}
              <TextInput
                style={styles.input}
                value={editMemberForm.state}
                onChangeText={(value) => setEditMemberForm((prev) => ({ ...prev, state: value }))}
                placeholder="State"
              />
              <TextInput
                style={styles.input}
                value={editMemberForm.district}
                onChangeText={(value) => setEditMemberForm((prev) => ({ ...prev, district: value }))}
                placeholder="District"
              />
              <TextInput
                style={styles.input}
                value={editMemberForm.tehsil}
                onChangeText={(value) => setEditMemberForm((prev) => ({ ...prev, tehsil: value }))}
                placeholder="Tehsil"
              />
              <TextInput
                style={styles.input}
                value={editMemberForm.village}
                onChangeText={(value) => setEditMemberForm((prev) => ({ ...prev, village: value }))}
                placeholder="Village"
              />
              <TextInput
                style={styles.input}
                value={editMemberForm.pincode}
                onChangeText={(value) => setEditMemberForm((prev) => ({ ...prev, pincode: value }))}
                placeholder="Pincode"
                keyboardType="number-pad"
              />
            </ScrollView>

            <View style={[styles.modalActions, styles.memberModalStickyActions]}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEditMemberModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, savingMemberEdit && styles.saveBtnDisabled]}
                disabled={savingMemberEdit}
                onPress={() => void handleSubmitMemberEdit()}
              >
                <Text style={styles.saveText}>{savingMemberEdit ? 'Saving...' : 'Save Changes'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAddMemberModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddMemberModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.memberModalCard]}>
            <Text style={styles.modalTitle}>Add Member</Text>
            <Text style={styles.modalSub}>{addTargetNode?.name || 'Selected Node'}</Text>

            <View style={styles.memberModalStickyTabs}>
              <View style={styles.modalTabRow}>
                <TouchableOpacity
                  style={[styles.modalTabBtn, memberModalTab === 'create' && styles.modalTabBtnActive]}
                  onPress={() => setMemberModalTab('create')}
                >
                  <Text style={[styles.modalTabText, memberModalTab === 'create' && styles.modalTabTextActive]}>
                    Create Member
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalTabBtn, memberModalTab === 'assign' && styles.modalTabBtnActive]}
                  onPress={() => setMemberModalTab('assign')}
                >
                  <Text style={[styles.modalTabText, memberModalTab === 'assign' && styles.modalTabTextActive]}>
                    Existing User
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView
              style={styles.memberModalScroll}
              contentContainerStyle={styles.memberModalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >

            {memberModalTab === 'create' ? (
              <>
                <View style={styles.twoColRow}>
                  <TextInput
                    style={[styles.input, styles.twoColField]}
                    value={memberForm.mobileNumber}
                    onChangeText={(value) => setMemberForm((prev) => ({ ...prev, mobileNumber: value }))}
                    keyboardType="phone-pad"
                    placeholder="Mobile Number *"
                  />
                  <TextInput
                    style={[styles.input, styles.twoColField]}
                    value={memberForm.name}
                    onChangeText={(value) => setMemberForm((prev) => ({ ...prev, name: value }))}
                    placeholder="Name *"
                  />
                </View>

                <View style={styles.twoColRow}>
                  <TextInput
                    style={[styles.input, styles.twoColField]}
                    value={memberForm.password}
                    onChangeText={(value) => setMemberForm((prev) => ({ ...prev, password: value }))}
                    placeholder="Login password (optional)"
                    autoCapitalize="none"
                    secureTextEntry
                  />
                  <TextInput
                    style={[styles.input, styles.twoColField]}
                    value={memberForm.fatherOrHusbandName}
                    onChangeText={(value) => setMemberForm((prev) => ({ ...prev, fatherOrHusbandName: value }))}
                    placeholder="Father/Husband Name"
                  />
                </View>

                <Text style={styles.sectionLabel}>Member Photo</Text>
                {memberForm.avatar ? (
                  <Image source={{ uri: memberForm.avatar }} style={styles.memberPhotoPreview} />
                ) : null}
                <View style={styles.photoActionsRow}>
                  <TouchableOpacity
                    style={[styles.secondaryAction, styles.photoActionBtn, uploadingMemberPhoto && styles.saveBtnDisabled]}
                    onPress={() => void uploadMemberPhotoFromSource('camera')}
                    disabled={uploadingMemberPhoto}
                  >
                    <Text style={styles.secondaryActionText}>{uploadingMemberPhoto ? 'Uploading...' : 'Take Photo'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.secondaryAction, styles.photoActionBtn, uploadingMemberPhoto && styles.saveBtnDisabled]}
                    onPress={() => void uploadMemberPhotoFromSource('gallery')}
                    disabled={uploadingMemberPhoto}
                  >
                    <Text style={styles.secondaryActionText}>{uploadingMemberPhoto ? 'Uploading...' : 'Upload Photo'}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.twoColRow}>
                  <TouchableOpacity
                    style={[styles.input, styles.twoColField]}
                    onPress={() => {
                      if (selectedVersionId && padOptions.length === 0 && !loadingPads) {
                        void loadPadOptions(selectedVersionId);
                      }
                      setPadPickerVisible(true);
                    }}
                    disabled={loadingPads}
                  >
                    <Text style={memberForm.pad ? styles.inputText : styles.inputPlaceholder}>
                      {memberForm.pad || (loadingPads ? 'Loading pad options...' : 'Select pad')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.input, styles.twoColField]} onPress={() => void handleOpenPadbharTransfer()}>
                    <Text style={addFormSelectedSubcategories.length ? styles.inputText : styles.inputPlaceholder}>
                      {addFormSelectedSubcategories.length ? `${addFormSelectedSubcategories.length} subcategories selected` : 'Assign Padbhar *'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.sectionLabel}>User Role</Text>
                <View style={styles.optionRow}>
                  {(['user', 'admin'] as const).map((role) => (
                    <TouchableOpacity
                      key={`create-role-${role}`}
                      style={[styles.optionChip, memberForm.userRole === role && styles.optionChipActive]}
                      onPress={() => setMemberForm((prev) => ({ ...prev, userRole: role }))}
                    >
                      <Text style={[styles.optionChipText, memberForm.userRole === role && styles.optionChipTextActive]}>
                        {role === 'admin' ? 'Admin' : 'User'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {padOptionsError ? <Text style={styles.errorInline}>{padOptionsError}</Text> : null}
                <TouchableOpacity onPress={() => setMemberForm((prev) => ({ ...prev, category: '', subcategory: '' }))}>
                  <Text style={styles.clearLink}>Clear category/subcategory</Text>
                </TouchableOpacity>
                {addFormSelectedCategories.length ? (
                  <Text style={styles.helper}>Categories: {addFormSelectedCategories.join(', ')}</Text>
                ) : null}
                {addFormSelectedSubcategories.length ? (
                  <Text style={styles.helper}>Subcategories: {addFormSelectedSubcategories.join(', ')}</Text>
                ) : null}

                <Text style={styles.sectionLabel}>Address (Optional)</Text>
                <View style={styles.twoColRow}>
                  <TextInput
                    style={[styles.input, styles.twoColField]}
                    value={memberForm.state}
                    onChangeText={(value) => setMemberForm((prev) => ({ ...prev, state: value }))}
                    placeholder="State"
                  />
                  <TextInput
                    style={[styles.input, styles.twoColField]}
                    value={memberForm.district}
                    onChangeText={(value) => setMemberForm((prev) => ({ ...prev, district: value }))}
                    placeholder="District"
                  />
                </View>
                <View style={styles.twoColRow}>
                  <TextInput
                    style={[styles.input, styles.twoColField]}
                    value={memberForm.tehsil}
                    onChangeText={(value) => setMemberForm((prev) => ({ ...prev, tehsil: value }))}
                    placeholder="Tehsil"
                  />
                  <TextInput
                    style={[styles.input, styles.twoColField]}
                    value={memberForm.village}
                    onChangeText={(value) => setMemberForm((prev) => ({ ...prev, village: value }))}
                    placeholder="Village"
                  />
                </View>
                <View style={styles.twoColRow}>
                  <TextInput
                    style={[styles.input, styles.twoColField]}
                    value={memberForm.pincode}
                    onChangeText={handleMemberPincodeChange}
                    placeholder="Pincode (auto-fill)"
                    keyboardType="number-pad"
                  />
                  <View style={styles.twoColField} />
                </View>
                {pincodeLookupLoading ? <Text style={styles.helper}>Fetching address from pincode...</Text> : null}
                {pincodeLookupMessage ? <Text style={styles.helper}>{pincodeLookupMessage}</Text> : null}
              </>
            ) : (
              <>
                <Text style={styles.sectionLabel}>Search existing user by mobile/email</Text>
                <View style={styles.searchRow}>
                  <TextInput
                    style={[styles.input, styles.searchInput]}
                    value={userSearchQuery}
                    onChangeText={setUserSearchQuery}
                    placeholder="Enter mobile or email"
                    keyboardType="default"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={[styles.searchBtn, searchingUsers && styles.saveBtnDisabled]}
                    onPress={() => void handleSearchUsers()}
                    disabled={searchingUsers}
                  >
                    <Text style={styles.searchBtnText}>{searchingUsers ? '...' : 'Search'}</Text>
                  </TouchableOpacity>
                </View>

                {selectedUser ? (
                  <View style={styles.selectedUserBox}>
                    <Text style={styles.selectedUserTitle}>Selected User</Text>
                    <Text style={styles.selectedUserText}>{fullUserName(selectedUser) || 'Unnamed User'}</Text>
                    <Text style={styles.selectedUserText}>{selectedUser.phone || selectedUser.email || '-'}</Text>
                    <TouchableOpacity onPress={() => setSelectedUser(null)}>
                      <Text style={styles.clearLink}>Clear selection</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {searchResults.length > 0 ? (
                  <View style={styles.searchResultsWrap}>
                    {searchResults.map((entry) => (
                      <TouchableOpacity key={`user-${entry.id}`} style={styles.searchResultItem} onPress={() => handlePickUser(entry)}>
                        <Text style={styles.searchResultName}>{fullUserName(entry) || `User #${entry.id}`}</Text>
                        <Text style={styles.searchResultMeta}>{entry.phone || entry.email || '-'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}

                <View style={styles.twoColRow}>
                  <TouchableOpacity
                    style={[styles.input, styles.twoColField]}
                    onPress={() => {
                      if (selectedVersionId && padOptions.length === 0 && !loadingPads) {
                        void loadPadOptions(selectedVersionId);
                      }
                      setPadPickerVisible(true);
                    }}
                    disabled={loadingPads}
                  >
                    <Text style={assignForm.pad ? styles.inputText : styles.inputPlaceholder}>
                      {assignForm.pad || (loadingPads ? 'Loading pad options...' : 'Select pad')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.input, styles.twoColField]} onPress={() => void handleOpenPadbharTransfer()}>
                    <Text style={addFormSelectedSubcategories.length ? styles.inputText : styles.inputPlaceholder}>
                      {addFormSelectedSubcategories.length ? `${addFormSelectedSubcategories.length} subcategories selected` : 'Assign Padbhar *'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.sectionLabel}>User Role</Text>
                <View style={styles.optionRow}>
                  {(['user', 'admin'] as const).map((role) => (
                    <TouchableOpacity
                      key={`assign-role-${role}`}
                      style={[styles.optionChip, assignForm.userRole === role && styles.optionChipActive]}
                      onPress={() => setAssignForm((prev) => ({ ...prev, userRole: role }))}
                    >
                      <Text style={[styles.optionChipText, assignForm.userRole === role && styles.optionChipTextActive]}>
                        {role === 'admin' ? 'Admin' : 'User'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {padOptionsError ? <Text style={styles.errorInline}>{padOptionsError}</Text> : null}
                <TouchableOpacity onPress={() => setAssignForm((prev) => ({ ...prev, category: '', subcategory: '' }))}>
                  <Text style={styles.clearLink}>Clear category/subcategory</Text>
                </TouchableOpacity>
                {addFormSelectedCategories.length ? (
                  <Text style={styles.helper}>Categories: {addFormSelectedCategories.join(', ')}</Text>
                ) : null}
                {addFormSelectedSubcategories.length ? (
                  <Text style={styles.helper}>Subcategories: {addFormSelectedSubcategories.join(', ')}</Text>
                ) : null}
              </>
            )}

            </ScrollView>

            <View style={[styles.modalActions, styles.memberModalStickyActions]}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddMemberModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, addingMember && styles.saveBtnDisabled]}
                disabled={addingMember}
                onPress={() => void handleSubmitMember()}
              >
                <Text style={styles.saveText}>{addingMember ? 'Saving...' : memberModalTab === 'assign' ? 'Assign Member' : 'Create Member'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAddNodeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddNodeModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Node</Text>
            <Text style={styles.modalSub}>{addTargetNode?.name || 'Selected Node'}</Text>

            <TextInput
              style={styles.input}
              value={nodeForm.name}
              onChangeText={(value) => setNodeForm((prev) => ({ ...prev, name: value }))}
              placeholder="Node name *"
            />

            <Text style={styles.sectionLabel}>Create this as</Text>
            <View style={styles.optionRow}>
              <TouchableOpacity
                style={[styles.optionChip, nodeForm.relation === 'child' && styles.optionChipActive]}
                onPress={() => setNodeForm((prev) => ({ ...prev, relation: 'child' }))}
              >
                <Text style={[styles.optionChipText, nodeForm.relation === 'child' && styles.optionChipTextActive]}>
                  Child of selected node
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionChip, nodeForm.relation === 'parent' && styles.optionChipActive]}
                onPress={() => setNodeForm((prev) => ({ ...prev, relation: 'parent' }))}
              >
                <Text style={[styles.optionChipText, nodeForm.relation === 'parent' && styles.optionChipTextActive]}>
                  Parent of selected node
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>Node level</Text>
            <View style={styles.optionRow}>
              {allowedNodeLevelOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.optionChip, nodeForm.level === option.value && styles.optionChipActive]}
                  onPress={() => setNodeForm((prev) => ({ ...prev, level: option.value }))}
                >
                  <Text style={[styles.optionChipText, nodeForm.level === option.value && styles.optionChipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {allowedNodeLevelOptions.length === 0 ? (
              <Text style={styles.modalSub}>No levels available for this relation</Text>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddNodeModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, (addingNode || allowedNodeLevelOptions.length === 0) && styles.saveBtnDisabled]}
                disabled={addingNode || allowedNodeLevelOptions.length === 0}
                onPress={() => void handleSubmitNode()}
              >
                <Text style={styles.saveText}>{addingNode ? 'Saving...' : 'Create Node'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMeetingModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowMeetingModal(false);
          setEditingMeetingId(null);
          setAttendanceBrowseNodeId('');
          setInvitationBrowseNodeId('');
          setMeetingParticipantPreview([]);
          setMeetingInvitePreview([]);
          setShowAttendanceTransferModal(false);
          setShowInvitationTransferModal(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView style={styles.modalCard} contentContainerStyle={styles.modalCardContent}>
            <Text style={styles.modalTitle}>{editingMeetingId ? 'Edit Meeting' : 'Create Meeting'}</Text>
            <TextInput
              style={styles.input}
              value={meetingForm.title}
              onChangeText={(value) => setMeetingForm((prev) => ({ ...prev, title: value }))}
              placeholder="Meeting title *"
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              multiline
              value={meetingForm.description}
              onChangeText={(value) => setMeetingForm((prev) => ({ ...prev, description: value }))}
              placeholder="Description"
            />
            <TextInput
              style={styles.input}
              value={meetingForm.meetingDate}
              onChangeText={(value) => setMeetingForm((prev) => ({ ...prev, meetingDate: value }))}
              placeholder="Meeting date (YYYY-MM-DD)"
            />
            <Text style={styles.sectionLabel}>Node</Text>
            <View style={styles.optionRow}>
              {assignableNodes.map((node) => (
                <TouchableOpacity
                  key={`meeting-node-${node.id}`}
                  style={[styles.optionChip, meetingForm.nodeId === String(node.id) && styles.optionChipActive]}
                  onPress={() => void handleChangeMeetingNode(String(node.id))}
                >
                  <Text style={[styles.optionChipText, meetingForm.nodeId === String(node.id) && styles.optionChipTextActive]}>
                    {node.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Attendance ({meetingTransferSelectedItems.length})</Text>
              <TouchableOpacity style={styles.rowActionBtn} onPress={() => setShowAttendanceTransferModal(true)}>
                <Text style={styles.rowActionText}>Manage</Text>
              </TouchableOpacity>
            </View>
            {meetingTransferSelectedItems.length > 0 ? (
              <View style={styles.avatarSummaryRow}>
                {meetingTransferSelectedItems.slice(0, 8).map((item) => (
                  <View key={`preview-${item.key}`} style={styles.avatarBadge}>
                    <Text style={styles.avatarBadgeText}>{getInitials(item.name)}</Text>
                  </View>
                ))}
                {meetingTransferSelectedItems.length > 8 ? (
                  <View style={[styles.avatarBadge, styles.avatarBadgeMore]}>
                    <Text style={styles.avatarBadgeText}>+{meetingTransferSelectedItems.length - 8}</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <Text style={styles.modalSub}>No attendees selected yet</Text>
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Invited Members ({meetingInviteSelectedItems.length})</Text>
              <TouchableOpacity style={styles.rowActionBtn} onPress={() => setShowInvitationTransferModal(true)}>
                <Text style={styles.rowActionText}>Manage</Text>
              </TouchableOpacity>
            </View>
            {meetingInviteSelectedItems.length > 0 ? (
              <View style={styles.avatarSummaryRow}>
                {meetingInviteSelectedItems.slice(0, 8).map((item) => (
                  <View key={`invite-preview-${item.key}`} style={[styles.avatarBadge, styles.avatarBadgeInvite]}>
                    <Text style={styles.avatarBadgeText}>{getInitials(item.name)}</Text>
                  </View>
                ))}
                {meetingInviteSelectedItems.length > 8 ? (
                  <View style={[styles.avatarBadge, styles.avatarBadgeMore]}>
                    <Text style={styles.avatarBadgeText}>+{meetingInviteSelectedItems.length - 8}</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <Text style={styles.modalSub}>No invited members selected yet</Text>
            )}

            <Text style={styles.sectionLabel}>Attachments</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={[styles.input, styles.searchInput]}
                value={meetingForm.attachmentInput}
                onChangeText={(value) => setMeetingForm((prev) => ({ ...prev, attachmentInput: value }))}
                placeholder="Document URL"
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.searchBtn} onPress={addMeetingAttachmentByUrl}>
                <Text style={styles.searchBtnText}>Add URL</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.secondaryAction, meetingUploadingAttachment && styles.saveBtnDisabled]}
              disabled={meetingUploadingAttachment}
              onPress={() => void handleUploadMeetingAttachment()}
            >
              <Text style={styles.secondaryActionText}>{meetingUploadingAttachment ? 'Uploading...' : 'Upload Photo/Video'}</Text>
            </TouchableOpacity>
            <View style={styles.attachmentList}>
              {meetingForm.attachments.map((item, idx) => (
                <View key={`meeting-attachment-${idx}`} style={styles.attachmentItem}>
                  <Text style={styles.attachmentText} numberOfLines={1}>{item.name || item.url}</Text>
                  <TouchableOpacity
                    onPress={() =>
                      setMeetingForm((prev) => ({
                        ...prev,
                        attachments: prev.attachments.filter((_, i) => i !== idx),
                      }))
                    }
                  >
                    <Text style={styles.removeText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowMeetingModal(false);
                  setEditingMeetingId(null);
                  setAttendanceBrowseNodeId('');
                  setInvitationBrowseNodeId('');
                  setMeetingParticipantPreview([]);
                  setMeetingInvitePreview([]);
                  setShowAttendanceTransferModal(false);
                  setShowInvitationTransferModal(false);
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, creatingMeeting && styles.saveBtnDisabled]} disabled={creatingMeeting} onPress={() => void handleSubmitMeeting()}>
                <Text style={styles.saveText}>
                  {creatingMeeting ? 'Saving...' : editingMeetingId ? 'Update Meeting' : 'Create Meeting'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showAttendanceTransferModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAttendanceTransferModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Manage Attendance</Text>
            <Text style={styles.sectionLabel}>Node</Text>
            <View style={styles.optionRow}>
              {assignableNodes.map((node) => (
                <TouchableOpacity
                  key={`transfer-node-${node.id}`}
                  style={[styles.optionChip, currentAttendanceNodeId === String(node.id) && styles.optionChipActive]}
                  onPress={() => void handleChangeAttendanceBrowseNode(String(node.id))}
                >
                  <Text style={[styles.optionChipText, currentAttendanceNodeId === String(node.id) && styles.optionChipTextActive]}>
                    {node.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Search guest</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={[styles.input, styles.searchInput]}
                value={meetingGuestQuery}
                onChangeText={setMeetingGuestQuery}
                placeholder="Mobile or email"
              />
              <TouchableOpacity style={styles.searchBtn} onPress={() => void handleSearchMeetingGuests()} disabled={meetingGuestSearching}>
                <Text style={styles.searchBtnText}>{meetingGuestSearching ? '...' : 'Search'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>Create guest</Text>
            <TextInput
              style={styles.input}
              value={meetingForm.newGuestName}
              onChangeText={(value) => setMeetingForm((prev) => ({ ...prev, newGuestName: value }))}
              placeholder="Guest name"
            />
            <View style={styles.searchRow}>
              <TextInput
                style={[styles.input, styles.searchInput]}
                value={meetingForm.newGuestMobile}
                onChangeText={(value) => setMeetingForm((prev) => ({ ...prev, newGuestMobile: value }))}
                placeholder="Guest mobile"
                keyboardType="phone-pad"
              />
              <TextInput
                style={[styles.input, styles.searchInput]}
                value={meetingForm.newGuestEmail}
                onChangeText={(value) => setMeetingForm((prev) => ({ ...prev, newGuestEmail: value }))}
                placeholder="Guest email"
                autoCapitalize="none"
              />
            </View>
            <TouchableOpacity style={styles.secondaryAction} onPress={() => void handleCreateMeetingGuest()}>
              <Text style={styles.secondaryActionText}>Create and select guest</Text>
            </TouchableOpacity>

            <View style={styles.transferRow}>
              <View style={styles.transferColumn}>
                <Text style={styles.transferTitle}>Available</Text>
                <ScrollView style={styles.transferList}>
                  {meetingTransferAvailableItems.map((item) => (
                    <TouchableOpacity key={`available-${item.key}`} style={styles.transferItem} onPress={() => handleAddTransferAttendee(item)}>
                      <Text style={styles.transferItemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.transferItemMeta} numberOfLines={1}>
                        {item.subtitle || item.attendeeType}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {meetingTransferAvailableItems.length === 0 ? <Text style={styles.modalSub}>No available attendees</Text> : null}
                </ScrollView>
              </View>

              <View style={styles.transferColumn}>
                <Text style={styles.transferTitle}>Selected</Text>
                <ScrollView style={styles.transferList}>
                  {meetingTransferSelectedItems.map((item) => (
                    <TouchableOpacity key={`selected-${item.key}`} style={styles.transferItemSelected} onPress={() => handleRemoveTransferAttendee(item)}>
                      <Text style={styles.transferItemName} numberOfLines={1}>
                        {item.subtitle ? `${item.name} (${item.subtitle})` : item.name}
                      </Text>
                      <Text style={styles.transferItemMeta} numberOfLines={1}>
                        {item.subtitle || item.attendeeType}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {meetingTransferSelectedItems.length === 0 ? <Text style={styles.modalSub}>No selected attendees</Text> : null}
                </ScrollView>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowAttendanceTransferModal(false)}>
              <Text style={styles.closeText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMeetingAttachmentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMeetingAttachmentModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{meetingAttachmentTitle || 'Meeting Attachments'}</Text>
            <ScrollView style={styles.attachmentPreviewList}>
              {meetingAttachmentItems.map((item, idx) => (
                <View key={`meeting-preview-attachment-${idx}`} style={styles.attachmentPreviewItem}>
                  {String(item.type || '').toLowerCase().startsWith('image') && item.url ? (
                    <Image source={{ uri: item.url }} style={styles.attachmentThumb} resizeMode="cover" />
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attachmentText} numberOfLines={1}>
                      {item.name || item.url}
                    </Text>
                    <Text style={styles.modalSub}>{item.type || 'attachment'}</Text>
                  </View>
                  <TouchableOpacity style={styles.rowActionBtn} onPress={() => void handleOpenAttachmentUrl(item.url)}>
                    <Text style={styles.rowActionText}>Open</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {meetingAttachmentItems.length === 0 ? <Text style={styles.modalSub}>No attachments found</Text> : null}
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowMeetingAttachmentModal(false)}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showInvitationTransferModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInvitationTransferModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Manage Invited Members</Text>
            <Text style={styles.sectionLabel}>Node</Text>
            <View style={styles.optionRow}>
              {assignableNodes.map((node) => (
                <TouchableOpacity
                  key={`invite-node-${node.id}`}
                  style={[styles.optionChip, currentInvitationNodeId === String(node.id) && styles.optionChipActive]}
                  onPress={() => void handleChangeInvitationBrowseNode(String(node.id))}
                >
                  <Text style={[styles.optionChipText, currentInvitationNodeId === String(node.id) && styles.optionChipTextActive]}>
                    {node.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.transferRow}>
              <View style={styles.transferColumn}>
                <Text style={styles.transferTitle}>Available Members</Text>
                <ScrollView style={styles.transferList}>
                  {meetingInviteAvailableItems.map((item) => (
                    <TouchableOpacity key={`invite-available-${item.key}`} style={styles.transferItem} onPress={() => handleAddInviteMember(item)}>
                      <Text style={styles.transferItemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.transferItemMeta} numberOfLines={1}>
                        {item.subtitle || 'member'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {meetingInviteAvailableItems.length === 0 ? <Text style={styles.modalSub}>No available members</Text> : null}
                </ScrollView>
              </View>

              <View style={styles.transferColumn}>
                <Text style={styles.transferTitle}>Invited Members</Text>
                <ScrollView style={styles.transferList}>
                  {meetingInviteSelectedItems.map((item) => (
                    <TouchableOpacity key={`invite-selected-${item.key}`} style={styles.transferItemSelected} onPress={() => handleRemoveInviteMember(item)}>
                      <Text style={styles.transferItemName} numberOfLines={1}>
                        {item.subtitle ? `${item.name} (${item.subtitle})` : item.name}
                      </Text>
                      <Text style={styles.transferItemMeta} numberOfLines={1}>
                        {item.subtitle || 'member'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {meetingInviteSelectedItems.length === 0 ? <Text style={styles.modalSub}>No invited members</Text> : null}
                </ScrollView>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowInvitationTransferModal(false)}>
              <Text style={styles.closeText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showTaskModal} transparent animationType="slide" onRequestClose={() => setShowTaskModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.memberModalCard]}>
            <View style={styles.memberModalStickyTabs}>
              <Text style={styles.modalTitle}>Create Task</Text>
            </View>

            <ScrollView style={styles.memberModalScroll} contentContainerStyle={styles.memberModalScrollContent}>
              <TextInput
                style={styles.input}
                value={taskForm.title}
                onChangeText={(value) => setTaskForm((prev) => ({ ...prev, title: value }))}
                placeholder="Task title *"
              />
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                value={taskForm.description}
                onChangeText={(value) => setTaskForm((prev) => ({ ...prev, description: value }))}
                placeholder="Description"
              />
              <View style={styles.twoColRow}>
                <TextInput
                  style={[styles.input, styles.twoColField]}
                  value={taskForm.taskDate}
                  onChangeText={(value) => setTaskForm((prev) => ({ ...prev, taskDate: value }))}
                  placeholder="Task date (YYYY-MM-DD)"
                />
                <TextInput
                  style={[styles.input, styles.twoColField]}
                  value={taskForm.dueDate}
                  onChangeText={(value) => setTaskForm((prev) => ({ ...prev, dueDate: value }))}
                  placeholder="Due date (optional)"
                />
              </View>

              <Text style={styles.sectionLabel}>Task Categories</Text>
              <TouchableOpacity style={styles.input} onPress={() => void handleOpenPadbharTransfer('task')}>
                <Text style={taskSelectedSubcategories.length ? styles.inputText : styles.inputPlaceholder}>
                  {taskSelectedSubcategories.length ? `${taskSelectedSubcategories.length} subcategories selected` : 'Select task subcategories *'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setTaskForm((prev) => ({ ...prev, category: '', subcategory: '' }))}>
                <Text style={styles.clearLink}>Clear categories</Text>
              </TouchableOpacity>
              {taskSelectedCategories.length ? <Text style={styles.helper}>Categories: {taskSelectedCategories.join(', ')}</Text> : null}
              {taskSelectedSubcategories.length ? <Text style={styles.helper}>Subcategories: {taskSelectedSubcategories.join(', ')}</Text> : null}

              <Text style={styles.sectionLabel}>Node</Text>
              <Text style={styles.modalSub}>{taskSelectedPathLabel}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.taskCascaderRow}>
                  {taskCascadeColumns.map((column) => (
                    <View key={`task-cascade-${column.depth}`} style={styles.taskCascaderColumn}>
                      <Text style={styles.taskCascaderTitle}>{column.title}</Text>
                      <ScrollView style={styles.taskCascaderList} nestedScrollEnabled>
                        {column.options.map((option) => {
                          const selected = String(column.selectedNodeId || '') === String(option.nodeId);
                          return (
                            <TouchableOpacity
                              key={`task-cascade-option-${column.depth}-${option.key}`}
                              style={[styles.taskCascaderItem, selected && styles.taskCascaderItemSelected]}
                              onPress={() => void handleTaskCascadeSelect(option.nodeId)}
                            >
                              <Text style={[styles.taskCascaderItemText, selected && styles.taskCascaderItemTextSelected]} numberOfLines={1}>
                                {option.label}
                              </Text>
                            {option.hasChildren ? (
                              <Text style={[styles.taskCascaderArrow, selected && styles.taskCascaderArrowSelected]}>›</Text>
                            ) : null}
                            </TouchableOpacity>
                          );
                        })}
                        {column.options.length === 0 ? <Text style={styles.modalSub}>No nodes</Text> : null}
                      </ScrollView>
                    </View>
                  ))}
                </View>
              </ScrollView>
              {selectedTaskNodeIsScopeRoot ? (
                <Text style={styles.errorInline}>Warning: You cannot create task at assigned level. Select a child node below.</Text>
              ) : null}

              <Text style={styles.sectionLabel}>Status</Text>
              <View style={styles.optionRow}>
                {['open', 'in_progress', 'completed'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[styles.optionChip, taskForm.status === status && styles.optionChipActive]}
                    onPress={() => setTaskForm((prev) => ({ ...prev, status }))}
                  >
                    <Text style={[styles.optionChipText, taskForm.status === status && styles.optionChipTextActive]}>{status}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Assign member</Text>
              <View style={styles.selectList}>
                {taskMembers.map((member) => {
                  const userId = Number(member.user_id || 0);
                  if (!userId) return null;
                  const selected = taskForm.assignedUserId === String(userId);
                  return (
                    <TouchableOpacity
                      key={`task-member-${member.id}`}
                      style={[styles.selectItem, selected && styles.selectItemActive]}
                      onPress={() => setTaskForm((prev) => ({ ...prev, assignedUserId: selected ? '' : String(userId) }))}
                    >
                      <Text style={[styles.selectItemText, selected && styles.selectItemTextActive]}>
                        {[member.first_name, member.father_name].filter(Boolean).join(' ') || `User #${userId}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                {taskMembers.length === 0 ? <Text style={styles.modalSub}>No node members found</Text> : null}
              </View>

              <Text style={styles.sectionLabel}>Attachments</Text>
              <View style={styles.searchRow}>
                <TextInput
                  style={[styles.input, styles.searchInput]}
                  value={taskForm.attachmentInput}
                  onChangeText={(value) => setTaskForm((prev) => ({ ...prev, attachmentInput: value }))}
                  placeholder="Document URL"
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.searchBtn} onPress={addTaskAttachmentByUrl}>
                  <Text style={styles.searchBtnText}>Add URL</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.secondaryAction, taskUploadingAttachment && styles.saveBtnDisabled]}
                disabled={taskUploadingAttachment}
                onPress={() => void handleUploadTaskAttachment()}
              >
                <Text style={styles.secondaryActionText}>{taskUploadingAttachment ? 'Uploading...' : 'Upload Photo/Video'}</Text>
              </TouchableOpacity>
              <View style={styles.attachmentList}>
                {taskForm.attachments.map((item, idx) => (
                  <View key={`task-attachment-${idx}`} style={styles.attachmentItem}>
                    <Text style={styles.attachmentText} numberOfLines={1}>{item.name || item.url}</Text>
                    <TouchableOpacity
                      onPress={() =>
                        setTaskForm((prev) => ({
                          ...prev,
                          attachments: prev.attachments.filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={[styles.modalActions, styles.memberModalStickyActions]}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowTaskModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, creatingTask && styles.saveBtnDisabled]} disabled={creatingTask} onPress={() => void handleSubmitTask()}>
                <Text style={styles.saveText}>{creatingTask ? 'Saving...' : 'Create Task'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={padPickerVisible} transparent animationType="fade" onRequestClose={() => setPadPickerVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Pad</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {padOptions.map((pad) => (
                <TouchableOpacity
                  key={pad}
                  style={styles.padOption}
                  onPress={() => {
                    if (memberModalTab === 'assign') {
                      setAssignForm((prev) => ({ ...prev, pad }));
                    } else {
                      setMemberForm((prev) => ({ ...prev, pad }));
                    }
                    setPadPickerVisible(false);
                  }}
                >
                  <Text style={styles.padOptionText}>{pad}</Text>
                </TouchableOpacity>
              ))}
              {padOptions.length === 0 ? <Text style={styles.modalSub}>No pad options found</Text> : null}
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setPadPickerVisible(false)}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={padbharTransferVisible} transparent animationType="slide" onRequestClose={() => setPadbharTransferVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.memberModalCard]}>
            <Text style={styles.modalTitle}>{padbharTransferMode === 'task' ? 'Select Task Subcategories' : 'Assign Padbhar'}</Text>
            <Text style={styles.modalSub}>Transfer subcategories from left to right</Text>
            <View style={styles.transferContainer}>
              <View style={styles.transferPanel}>
                <Text style={styles.transferTitle}>Available</Text>
                <ScrollView style={styles.transferScroll}>
                  {CATEGORY_SUBCATEGORY_OPTIONS.map((entry) => {
                    const expanded = transferExpandedCategories.includes(entry.category);
                    return (
                      <View key={`transfer-cat-${entry.category}`} style={styles.transferCategoryBlock}>
                        <TouchableOpacity style={styles.transferCategoryHeader} onPress={() => toggleTransferCategory(entry.category)}>
                          <Text style={styles.transferCategoryTitle}>{entry.category}</Text>
                          <Text style={styles.transferCategoryToggle}>{expanded ? '−' : '+'}</Text>
                        </TouchableOpacity>
                        {expanded ? (
                          <View style={styles.transferSubList}>
                            {entry.subcategories.map((subcategory) => {
                              const alreadySelected = transferDraftSubcategories.includes(subcategory);
                              return (
                                <TouchableOpacity
                                  key={`transfer-sub-${entry.category}-${subcategory}`}
                                  style={[styles.transferSubItem, alreadySelected && styles.transferSubItemSelected]}
                                  onPress={() => handleTransferAddSubcategory(subcategory)}
                                >
                                  <Text style={[styles.transferSubText, alreadySelected && styles.transferSubTextSelected]}>{subcategory}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.transferPanel}>
                <Text style={styles.transferTitle}>Selected</Text>
                <ScrollView style={styles.transferScroll}>
                  {transferDraftSubcategories.map((subcategory) => (
                    <TouchableOpacity
                      key={`transfer-selected-${subcategory}`}
                      style={styles.transferSelectedItem}
                      onPress={() => handleTransferRemoveSubcategory(subcategory)}
                    >
                      <Text style={styles.transferSelectedText}>{subcategory}</Text>
                    </TouchableOpacity>
                  ))}
                  {transferDraftSubcategories.length === 0 ? <Text style={styles.modalSub}>No subcategories selected</Text> : null}
                </ScrollView>
              </View>
            </View>
            <Text style={styles.helper}>
              Categories auto-derived: {deriveCategoriesFromSubcategories(transferDraftSubcategories).join(', ') || 'None'}
            </Text>
            <View style={[styles.modalActions, styles.memberModalStickyActions]}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPadbharTransferVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={() => handleApplyPadbharTransfer()}>
                <Text style={styles.saveText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  helper: {
    color: theme.colors.text.secondary,
    fontSize: 13,
  },
  topHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surface,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceContainerHigh,
  },
  backBtnText: {
    color: theme.colors.text.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  headerLogo: {
    width: 34,
    height: 34,
  },
  headerBrand: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  content: {
    padding: 12,
    gap: 14,
    paddingBottom: 24,
  },
  tabSwitchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabSwitchBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  tabSwitchBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  tabSwitchText: {
    color: theme.colors.text.secondary,
    fontWeight: '700',
    fontSize: 12,
  },
  tabSwitchTextActive: {
    color: theme.colors.primary,
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    padding: 10,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    color: theme.colors.text.primary,
    fontWeight: '700',
  },
  primaryAction: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryAction: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  secondaryActionText: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  photoActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoActionBtn: {
    flexGrow: 1,
    flexBasis: '48%',
    minWidth: 140,
  },
  memberPhotoPreview: {
    width: 86,
    height: 86,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surfaceContainerHigh,
  },
  tableWrap: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceContainerHigh,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tableHeaderCell: {
    paddingHorizontal: 8,
    paddingVertical: 9,
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  tableCell: {
    paddingHorizontal: 8,
    paddingVertical: 9,
    fontSize: 12,
    color: theme.colors.text.primary,
  },
  tableEmpty: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  tableMeta: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    fontWeight: '600',
  },
  colDate: {
    width: 110,
  },
  colTitle: {
    width: 220,
  },
  colNode: {
    width: 230,
  },
  colCount: {
    width: 110,
  },
  colAction: {
    width: 110,
  },
  colAssignee: {
    width: 170,
  },
  colStatus: {
    width: 130,
  },
  tableCellTextCompact: {
    color: theme.colors.text.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  tableCellSubText: {
    color: theme.colors.text.secondary,
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  linkText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  rowActionBtn: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  rowActionText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  errorBox: {
    borderWidth: 1,
    borderColor: theme.colors.error,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    padding: 10,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 12,
    fontWeight: '600',
  },
  errorInline: {
    color: theme.colors.error,
    fontSize: 11,
    marginTop: -4,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    maxHeight: '92%',
  },
  memberModalCard: {
    maxHeight: '95%',
    width: '96%',
    alignSelf: 'center',
  },
  modalCardContent: {
    gap: 10,
  },
  memberModalStickyTabs: {
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surface,
  },
  memberModalScroll: {
    maxHeight: '86%',
  },
  memberModalScrollContent: {
    gap: 10,
    paddingBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  modalSub: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  inputText: {
    color: theme.colors.text.primary,
    fontSize: 14,
  },
  inputPlaceholder: {
    color: theme.colors.text.secondary,
    fontSize: 14,
  },
  sectionLabel: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    fontWeight: '700',
  },
  modalTabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalTabBtn: {
    flexGrow: 1,
    flexBasis: '48%',
    minWidth: 140,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  modalTabBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  modalTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text.secondary,
  },
  modalTabTextActive: {
    color: theme.colors.primary,
  },
  twoColRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  twoColField: {
    flexGrow: 1,
    flexBasis: '48%',
    minWidth: 140,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
  },
  searchBtn: {
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  selectedUserBox: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 10,
    gap: 3,
    backgroundColor: theme.colors.surfaceContainerHigh,
  },
  selectedUserTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text.secondary,
  },
  selectedUserText: {
    fontSize: 13,
    color: theme.colors.text.primary,
    fontWeight: '600',
  },
  clearLink: {
    marginTop: 2,
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  searchResultsWrap: {
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 10,
    maxHeight: 140,
  },
  searchResultItem: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  searchResultName: {
    fontSize: 13,
    color: theme.colors.text.primary,
    fontWeight: '700',
  },
  searchResultMeta: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  taskCascaderRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  taskCascaderColumn: {
    width: 170,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.background,
    overflow: 'hidden',
  },
  taskCascaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text.primary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  taskCascaderList: {
    maxHeight: 190,
  },
  taskCascaderItem: {
    minHeight: 38,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  taskCascaderItemSelected: {
    backgroundColor: theme.colors.primarySoft,
  },
  taskCascaderItemText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.text.primary,
    fontWeight: '500',
  },
  taskCascaderItemTextSelected: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  taskCascaderArrow: {
    marginLeft: 6,
    color: theme.colors.text.disabled,
    fontSize: 16,
    lineHeight: 16,
  },
  taskCascaderArrowSelected: {
    color: theme.colors.primary,
  },
  selectList: {
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 10,
    maxHeight: 140,
  },
  selectItem: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  selectItemActive: {
    backgroundColor: theme.colors.primarySoft,
  },
  selectItemText: {
    color: theme.colors.text.primary,
    fontWeight: '600',
    fontSize: 12,
  },
  selectItemTextActive: {
    color: theme.colors.primary,
  },
  optionChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
  },
  optionChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  optionChipText: {
    color: theme.colors.text.secondary,
    fontWeight: '700',
    fontSize: 12,
  },
  optionChipTextActive: {
    color: theme.colors.primary,
  },
  modalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  memberModalStickyActions: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surface,
  },
  cancelBtn: {
    flexGrow: 1,
    flexBasis: '48%',
    minWidth: 140,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  cancelText: {
    color: theme.colors.text.secondary,
    fontWeight: '700',
  },
  saveBtn: {
    flexGrow: 1,
    flexBasis: '48%',
    minWidth: 140,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: '#fff',
    fontWeight: '700',
  },
  padOption: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 8,
  },
  padOptionText: {
    color: theme.colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  closeBtn: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 9,
  },
  closeText: {
    color: theme.colors.text.secondary,
    fontWeight: '700',
  },
  avatarSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  avatarBadge: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadgeMore: {
    backgroundColor: theme.colors.surfaceContainerHigh,
    borderColor: theme.colors.border,
  },
  avatarBadgeInvite: {
    backgroundColor: '#e6f2ff',
    borderColor: theme.colors.secondary,
  },
  avatarBadgeText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  transferRow: {
    flexDirection: 'row',
    gap: 8,
  },
  transferColumn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 10,
    padding: 8,
    gap: 8,
  },
  transferContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  transferPanel: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 10,
    padding: 8,
    gap: 8,
    backgroundColor: theme.colors.background,
  },
  transferScroll: {
    maxHeight: 260,
  },
  transferCategoryBlock: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 8,
    overflow: 'hidden',
  },
  transferCategoryHeader: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: theme.colors.surfaceContainerHigh,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  transferCategoryTitle: {
    color: theme.colors.text.primary,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  transferCategoryToggle: {
    color: theme.colors.text.secondary,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  transferSubList: {
    padding: 8,
    gap: 6,
  },
  transferSubItem: {
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  transferSubItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  transferSubText: {
    color: theme.colors.text.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  transferSubTextSelected: {
    color: theme.colors.primary,
  },
  transferSelectedItem: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    marginBottom: 6,
    backgroundColor: theme.colors.primarySoft,
  },
  transferSelectedText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  transferTitle: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    fontWeight: '700',
  },
  transferList: {
    maxHeight: 190,
  },
  transferItem: {
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    marginBottom: 6,
  },
  transferItemSelected: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    marginBottom: 6,
  },
  transferItemName: {
    color: theme.colors.text.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  transferItemMeta: {
    color: theme.colors.text.secondary,
    fontSize: 11,
  },
  attachmentList: {
    maxHeight: 120,
  },
  attachmentItem: {
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  attachmentText: {
    flex: 1,
    color: theme.colors.text.primary,
    fontSize: 12,
  },
  removeText: {
    color: theme.colors.error,
    fontWeight: '700',
    fontSize: 11,
  },
  attachmentPreviewList: {
    maxHeight: 340,
  },
  attachmentPreviewItem: {
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  attachmentThumb: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceContainerHigh,
  },
});
