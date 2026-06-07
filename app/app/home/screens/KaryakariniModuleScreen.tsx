import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { karyakariniClient } from '../../api/client';
import { AppBottomNav } from '../../core/components/AppBottomNav';
import { ProfileMenu } from '../../core/components/ProfileMenu';
import { ScreenHeader } from '../../core/components/ScreenHeader';
import { PageHeaderCard } from '../../core/components/PageHeaderCard';
import { StandardModal } from '../../core/components/StandardModal';
import { useProfile } from '../../core/context/ProfileContext';
import { theme } from '../../theme';
import { MemberDialog } from '../../services/karyakarini-module/components/MemberDialog';
import { TreeView, type TreeLevelState } from '../../services/karyakarini-module/components/TreeView';
import { VersionSelector } from '../../services/karyakarini-module/components/VersionSelector';
import type {
  KaryakariniAssignableNode,
  KaryakariniAssignableUser,
  KaryakariniAttachment,
  KaryakariniCategoryActivity,
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

const ACTIVITY_OPTIONS = ['धर्मरक्षा सूत्र', 'धर्मरक्षा दिवस', 'भारतमाता पूजन', 'संत यात्रा', 'शिक्षण', 'धर्म रक्षा सूत्र बंधन', 'धर्म'];
const ACTIVITY_OTHER_LABEL = 'अन्य';

const NODE_LEVEL_OPTIONS = [
  { label: 'राष्ट्रीय', value: 'rashtriya' },
  { label: 'प्रान्त', value: 'prant' },
  { label: 'संभाग', value: 'sambhag' },
  { label: 'विभाग', value: 'vibhag' },
  { label: 'जिला', value: 'jila' },
  { label: 'खंड', value: 'khand' },
  { label: 'मंडल', value: 'mandal' },
  { label: 'नगर', value: 'nagar' },
  { label: 'ग्राम', value: 'gram' },
  { label: 'बस्ती', value: 'basti' },
  { label: 'मोहल्ला', value: 'mohalla' },
];

const NODE_LEVEL_ORDER = NODE_LEVEL_OPTIONS.map((option) => option.value);
const NODE_LEVEL_LABEL_MAP: Record<string, string> = Object.fromEntries(
  NODE_LEVEL_OPTIONS.map((entry) => [entry.value, entry.label])
);
NODE_LEVEL_LABEL_MAP.mandal_basti = 'बस्ती';
NODE_LEVEL_LABEL_MAP.nagar_mohalla = 'मोहल्ला';
const NODE_CHILD_LEVELS: Record<string, string[]> = {
  rashtriya: ['prant'],
  prant: ['sambhag'],
  sambhag: ['vibhag'],
  vibhag: ['jila'],
  jila: ['khand'],
  khand: ['mandal', 'nagar'],
  mandal: ['gram'],
  nagar: ['basti'],
  gram: [],
  basti: ['mohalla'],
  mohalla: [],
};
const NODE_PARENT_LEVEL: Record<string, string> = Object.entries(NODE_CHILD_LEVELS).reduce(
  (acc, [parent, children]) => {
    children.forEach((child) => {
      acc[child] = parent;
    });
    return acc;
  },
  {} as Record<string, string>
);
const DEFAULT_PAD_OPTIONS = ['संयोजक', 'सह संयोजक', 'प्रमुख', 'आयाम', 'अन्य'];
const formatNodeLevelLabel = (level?: string | null) => {
  const normalized = String(level || '').trim().toLowerCase();
  return NODE_LEVEL_LABEL_MAP[normalized] || String(level || '').trim();
};
const CATEGORY_SUBCATEGORY_OPTIONS: { category: string; subcategories: string[] }[] = [
  {
    category: 'संस्कृति प्रमुख',
    subcategories: [
      'साधु संत',
      'महंत',
      'मठ/मन्दिर के ट्रस्टी',
      'पुजारी पुरोहित',
      'भगत',
      'बड़वा',
      'तडवी पटेल',
      'कथाकार प्रवचनकार',
      'तांत्रिक',
      'मांत्रिक',
      'ज्योतिष',
      'भजनमण्डली',
      'सुन्दरकाण्ड',
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
    subcategories: ['चिन्हित परियोजना सुची', 'क्रियान्वित परियोजना', 'प्रमुख', 'टोली'],
  },
  {
    category: 'मातृशक्ति T-8',
    subcategories: [
      'सामाजिक क्षेत्र',
      'धार्मिक क्षेत्र',
      'शैक्षणिक क्षैत्र',
      'राजनैतिक क्षेत्र',
      'धार्मिक संस्था नवपंथ',
      'प्रवचन',
      'कथाकार',
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
  if (!normalized || !NODE_LEVEL_ORDER.includes(normalized)) return NODE_LEVEL_OPTIONS;
  if (relation === 'child') {
    const directChildren = new Set(NODE_CHILD_LEVELS[normalized] || []);
    return NODE_LEVEL_OPTIONS.filter((option) => directChildren.has(option.value));
  }

  const parent = NODE_PARENT_LEVEL[normalized];
  if (!parent) return [];
  return NODE_LEVEL_OPTIONS.filter((option) => option.value === parent);
};

const fullUserName = (entry: KaryakariniAssignableUser) =>
  [entry.first_name, entry.father_name].filter(Boolean).join(' ').trim();

const sanitizeInputValue = (value?: string | null) => {
  const raw = String(value ?? '').trim();
  const normalized = raw.toLowerCase();
  if (!raw || normalized === 'null' || normalized === 'undefined' || normalized === 'nan') return '';
  return raw;
};

const NOT_AVAILABLE = 'उपलब्ध नहीं';

const displayValue = (value?: string | null) => sanitizeInputValue(value) || NOT_AVAILABLE;

const appendPickerAssetToFormData = async (
  formData: FormData,
  asset: ImagePicker.ImagePickerAsset,
  fallbackName: string,
  fallbackType: string
) => {
  const webFile = (asset as any)?.file;
  const isBlobLike = Boolean(
    webFile &&
    (typeof webFile.arrayBuffer === 'function' || typeof webFile.stream === 'function')
  );

  if (isBlobLike) {
    formData.append('file', webFile, String(webFile.name || fallbackName));
    return;
  }

  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    formData.append('file', blob as any, fallbackName);
    return;
  }

  formData.append(
    'file',
    {
      uri: asset.uri,
      name: fallbackName,
      type: fallbackType,
    } as any
  );
};

const formatAssignableUserPosition = (entry?: Partial<KaryakariniAssignableUser> | null) => {
  const position = String(entry?.position || '').trim();
  const level = formatNodeLevelLabel(entry?.node_level);
  const nodeName = String(entry?.node_name || '').trim();
  const levelNode = [level, nodeName].filter(Boolean).join('-');
  return [position && position !== '-' ? position : '', levelNode].filter(Boolean).join(' • ');
};

const formatMemberPosition = (member?: Partial<KaryakariniMember> | null) => {
  const pad = String(member?.pad || '').trim();
  const level = formatNodeLevelLabel(member?.node_level);
  const nodeName = String(member?.node_name || '').trim();
  const levelNode = [level, nodeName].filter(Boolean).join('-');
  return [pad, levelNode].filter(Boolean).join(' • ');
};

const parseLabelList = (value?: string | string[] | null) => {
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .map((entry) => sanitizeInputValue(String(entry || '')))
          .filter(Boolean)
      ),
    ];
  }
  const raw = sanitizeInputValue(String(value || ''));
  if (!raw) return [] as string[];
  return [...new Set(raw.split(',').map((entry) => sanitizeInputValue(entry)).filter(Boolean))];
};

type KaryakariniTab = 'tree' | 'members' | 'meetings' | 'tasks' | 'activities' | 'roles' | 'jangarna';

interface JangarnaLevel {
  levelCode: string;
  levelName: string;
  levelOrder: number | null;
  total: number;
  men: number;
  women: number;
  children: number;
  baccha: number;
  bacchi: number;
  hindu: number;
  isai: number;
  muslim: number;
  other: number;
}

const GENDER_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'male', label: 'पुरुष' },
  { value: 'female', label: 'महिला' },
  { value: 'baccha', label: 'बच्चा' },
  { value: 'bacchi', label: 'बच्ची' },
];

const RELIGION_OPTIONS: { value: string; label: string }[] = [
  { value: 'hindu', label: 'हिंदू' },
  { value: 'isai', label: 'ईसाई' },
  { value: 'muslim', label: 'मुस्लिम' },
  { value: 'other', label: 'अन्य' },
];

interface SingleCascaderPickerProps {
  levels: TreeLevelState[];
  onSelectLevelNode: (levelIndex: number, node: KaryakariniNode) => void | Promise<void>;
  title: string;
  placeholder: string;
  selectedValue: string | null;
  allNodes?: { id: number | string; name: string; hierarchy_path?: string }[];
  onClear?: () => void;
  compact?: boolean;
}

const SingleCascaderPicker: React.FC<SingleCascaderPickerProps> = ({
  levels,
  onSelectLevelNode,
  title,
  placeholder,
  selectedValue,
  allNodes,
  onClear,
  compact = false,
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  // Compute selected path label
  const selectedPathLabel = useMemo(() => {
    const parts = levels
      .map((lvl) => lvl.nodes.find((n) => n.id === lvl.selectedNodeId)?.name)
      .filter(Boolean);
    if (parts.length > 0) return parts.join(' / ');
    if (selectedValue) {
      if (allNodes) {
        const found = allNodes.find((n) => String(n.id) === String(selectedValue));
        if (found) {
          if (found.hierarchy_path) return String(found.hierarchy_path).replace(/ > /g, ' / ');
          return found.name;
        }
      }
      for (const lvl of levels) {
        const found = lvl.nodes.find((n) => String(n.id) === String(selectedValue));
        if (found) return found.name;
      }
    }
    return null;
  }, [levels, selectedValue, allNodes]);

  return (
    <View style={{ marginBottom: compact ? 0 : 12 }}>
      <TouchableOpacity
        style={{
          borderWidth: 1,
          borderColor: theme.colors.border || '#CBD5E1',
          borderRadius: 8,
          backgroundColor: compact ? theme.colors.background : '#FFF',
          paddingHorizontal: compact ? 8 : 12,
          paddingVertical: compact ? 6 : 10,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          minHeight: compact ? 34 : 40,
        }}
        onPress={() => setModalVisible(true)}
      >
        <Text
          style={{
            fontSize: compact ? 12 : 14,
            color: selectedPathLabel ? theme.colors.text.primary : '#94A3B8',
            flex: 1,
            marginRight: compact ? 4 : 8,
          }}
          numberOfLines={1}
        >
          {selectedPathLabel || placeholder}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {selectedPathLabel && onClear ? (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onClear();
              }}
              style={{ padding: 2 }}
            >
              <MaterialIcons name="close" size={compact ? 14 : 16} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          ) : null}
          <MaterialIcons name="arrow-drop-down" size={compact ? 16 : 20} color={theme.colors.text.secondary} />
        </View>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
          }}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <TouchableOpacity
            style={{
              backgroundColor: '#FFF',
              borderRadius: 12,
              width: '100%',
              maxWidth: 450,
              maxHeight: '80%',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 10,
              elevation: 5,
              overflow: 'hidden',
            }}
            activeOpacity={1}
            onPress={() => {}}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#F1F5F9',
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text.primary }}>
                {title}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 4 }}>
                <MaterialIcons name="close" size={20} color={theme.colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {/* Selected Path Preview */}
            {selectedPathLabel ? (
              <View style={{ backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                <Text style={{ fontSize: 12, color: theme.colors.primary, fontWeight: '600' }} numberOfLines={1}>
                  चयनित: {selectedPathLabel}
                </Text>
              </View>
            ) : null}

            {/* Side-by-Side Cascading Columns Container */}
            <View style={{ height: 320, backgroundColor: '#FFF' }}>
              {levels.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                  <Text style={{ color: '#94A3B8', fontSize: 13 }}>कोई नोड डेटा उपलब्ध नहीं है</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 8 }}>
                  {levels.map((level, levelIndex) => {
                    const levelLabel = formatNodeLevelLabel(level.nodes[0]?.level || 'नोड कार्यक्षेत्र');
                    return (
                      <View
                        key={`column-${levelIndex}`}
                        style={{
                          width: 140,
                          borderRightWidth: levelIndex < levels.length - 1 ? 1 : 0,
                          borderRightColor: '#F1F5F9',
                          paddingHorizontal: 6,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: '700',
                            color: '#94A3B8',
                            marginBottom: 8,
                            paddingHorizontal: 4,
                            textTransform: 'uppercase',
                          }}
                        >
                          {levelLabel}
                        </Text>
                        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                          {level.nodes.map((node) => {
                            const isSelected = level.selectedNodeId === node.id;
                            return (
                              <TouchableOpacity
                                key={node.id}
                                style={{
                                  paddingVertical: 8,
                                  paddingHorizontal: 8,
                                  borderRadius: 6,
                                  backgroundColor: isSelected ? '#FDEAE1' : 'transparent',
                                  marginBottom: 4,
                                  flexDirection: 'row',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                }}
                                onPress={() => {
                                  void onSelectLevelNode(levelIndex, node);
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 12,
                                    color: isSelected ? theme.colors.primary : theme.colors.text.primary,
                                    fontWeight: isSelected ? '700' : '400',
                                    flex: 1,
                                    marginRight: 4,
                                  }}
                                  numberOfLines={2}
                                >
                                  {node.name}
                                </Text>
                                <MaterialIcons
                                  name="chevron-right"
                                  size={14}
                                  color={isSelected ? theme.colors.primary : '#94A3B8'}
                                />
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* Footer Select Button */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderTopWidth: 1,
                borderTopColor: '#F1F5F9',
                gap: 8,
              }}
            >
              <TouchableOpacity
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  borderRadius: 6,
                  backgroundColor: '#F1F5F9',
                }}
                onPress={() => setModalVisible(false)}
              >
                <Text style={{ fontSize: 13, color: theme.colors.text.primary }}>रद्द करें</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  borderRadius: 6,
                  backgroundColor: theme.colors.primary,
                }}
                onPress={() => setModalVisible(false)}
              >
                <Text style={{ fontSize: 13, color: '#FFF', fontWeight: '600' }}>चयन करें</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};


const toDateInput = (value?: string | null) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

const summarizeAssignedUser = (task: KaryakariniTask) =>
  [task.assigned_first_name, task.assigned_father_name].filter(Boolean).join(' ').trim() || NOT_AVAILABLE;

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

const memberName = (member: KaryakariniMember) =>
  [member.first_name, member.father_name].filter(Boolean).join(' ').trim();

const memberPeriod = (member: KaryakariniMember) =>
  member.period ||
  [member.start_date || null, member.end_date || null].filter(Boolean).join(' to ') ||
  '';

export default function KaryakariniModuleScreen() {
  const { user, logout } = useProfile();
  const canAddMembers = isAdminRole((user as any)?.role);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<KaryakariniVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
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
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activityRows, setActivityRows] = useState<KaryakariniCategoryActivity[]>([]);
  const [activityPagination, setActivityPagination] = useState<KaryakariniPagination>(defaultPagination);
  const [activityFilterCategory, setActivityFilterCategory] = useState('');
  const [activityFilterSubcategory, setActivityFilterSubcategory] = useState('');
  const [activityBrowseNodeId, setActivityBrowseNodeId] = useState('');
  const [taskFilterCategory, setTaskFilterCategory] = useState('');
  const [taskFilterSubcategory, setTaskFilterSubcategory] = useState('');
  const [taskFilterNodeLevel, setTaskFilterNodeLevel] = useState('');
  const [taskBrowseNodeId, setTaskBrowseNodeId] = useState('');
  const [taskBrowseLevels, setTaskBrowseLevels] = useState<TreeLevelState[]>([]);
  const [selectedActivityDetails, setSelectedActivityDetails] = useState<KaryakariniCategoryActivity | null>(null);

  const [membersVisible, setMembersVisible] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersNode, setMembersNode] = useState<KaryakariniNode | null>(null);
  const [members, setMembers] = useState<KaryakariniMember[]>([]);
  const [membersPagination, setMembersPagination] = useState<KaryakariniPagination>(defaultPagination);
  const [pillsModalVisible, setPillsModalVisible] = useState(false);
  const [pillsModalMember, setPillsModalMember] = useState<KaryakariniMember | null>(null);
  const [memberBrowseNodeId, setMemberBrowseNodeId] = useState('');
  const [memberFilterNodeLevel, setMemberFilterNodeLevel] = useState('');
  const [memberFilterCategory, setMemberFilterCategory] = useState('');
  const [memberFilterSubcategory, setMemberFilterSubcategory] = useState('');
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<KaryakariniMember | null>(null);
  const [savingMemberEdit, setSavingMemberEdit] = useState(false);
  const [editMemberForm, setEditMemberForm] = useState({
    name: '',
    fatherOrHusbandName: '',
    mobileNumber: '',
    password: '',
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

  const [searchPickerVisible, setSearchPickerVisible] = useState(false);
  const [searchPickerTitle, setSearchPickerTitle] = useState('');
  const [searchPickerSearchText, setSearchPickerSearchText] = useState('');
  const [searchPickerOptions, setSearchPickerOptions] = useState<{ label: string; value: any }[]>([]);
  const [onSearchPickerSelect, setOnSearchPickerSelect] = useState<(value: any) => void>(() => () => {});

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addTargetNode, setAddTargetNode] = useState<KaryakariniNode | null>(null);
  const [addingMember, setAddingMember] = useState(false);
  const [memberModalTab, setMemberModalTab] = useState<'create' | 'assign'>('create');
  const [padPickerVisible, setPadPickerVisible] = useState(false);
  const [padbharTransferVisible, setPadbharTransferVisible] = useState(false);
  const [padbharTransferMode, setPadbharTransferMode] = useState<'create' | 'assign' | 'edit' | 'task' | 'activity'>('create');
  const [transferExpandedCategories, setTransferExpandedCategories] = useState<string[]>([]);
  const [transferDraftSubcategories, setTransferDraftSubcategories] = useState<string[]>([]);
  const [categoryTree, setCategoryTree] = useState<{ category: string; subcategories: string[] }[]>(
    CATEGORY_SUBCATEGORY_OPTIONS
  );
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
    avatar: '',
  });
  const [showOtherInfo, setShowOtherInfo] = useState(true);
  const [otherInfoForm, setOtherInfoForm] = useState<{ genderType: string | null; religion: string | null }>({
    genderType: null,
    religion: null,
  });

  const [jangarnaData, setJangarnaData] = useState<JangarnaLevel[]>([]);
  const [jangarnaLoading, setJangarnaLoading] = useState(false);
  const [jangarnaLevelFilter, setJangarnaLevelFilter] = useState<string>('all');

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
  const [meetingInviteSearchQuery, setMeetingInviteSearchQuery] = useState('');
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
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTaskAssignees, setEditingTaskAssignees] = useState<any[]>([]);
  const [taskMembers, setTaskMembers] = useState<KaryakariniMember[]>([]);
  const [taskUploadingAttachment, setTaskUploadingAttachment] = useState(false);
  const [showAssigneesModal, setShowAssigneesModal] = useState(false);
  const [selectedTaskForAssignees, setSelectedTaskForAssignees] = useState<KaryakariniTask | null>(null);
  const [showTaskAttachmentModal, setShowTaskAttachmentModal] = useState(false);
  const [taskAttachmentTitle, setTaskAttachmentTitle] = useState('');
  const [taskAttachmentItems, setTaskAttachmentItems] = useState<KaryakariniAttachment[]>([]);
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
    assignedUserIds: [] as number[],
    attachmentInput: '',
    attachments: [] as KaryakariniAttachment[],
  });
  const [taskLevels, setTaskLevels] = useState<TreeLevelState[]>([]);
  const [taskMemberSearchQuery, setTaskMemberSearchQuery] = useState('');
  const [taskMemberSearchResults, setTaskMemberSearchResults] = useState<KaryakariniAssignableUser[]>([]);
  const [taskMemberSearching, setTaskMemberSearching] = useState(false);
  const [taskHierarchyFilterL1, setTaskHierarchyFilterL1] = useState('');

  const [showActivityModal, setShowActivityModal] = useState(false);
  const [submittingActivity, setSubmittingActivity] = useState(false);
  const [activityLevels, setActivityLevels] = useState<TreeLevelState[]>([]);
  const [meetingLevels, setMeetingLevels] = useState<TreeLevelState[]>([]);
  const [attendanceLevels, setAttendanceLevels] = useState<TreeLevelState[]>([]);
  const [invitationLevels, setInvitationLevels] = useState<TreeLevelState[]>([]);
  const [activityForm, setActivityForm] = useState({
    title: '',
    titleOther: false,
    description: '',
    category: '',
    subcategory: '',
    nodeId: '',
    includePopulation: false,
    maleCount: '',
    femaleCount: '',
    childrenCount: '',
    attachmentInput: '',
    attachments: [] as KaryakariniAttachment[],
  });
  const [uploadingActivityAttachment, setUploadingActivityAttachment] = useState(false);

  const [scopeRows, setScopeRows] = useState<{ node_id: number; node_level: string; node_name: string }[]>([]);
  const [selectedRoleLevel, setSelectedRoleLevel] = useState('');
  const [selectedRoleNodeId, setSelectedRoleNodeId] = useState('');
  const [roleLevels, setRoleLevels] = useState<TreeLevelState[]>([]);
  const roleBreadcrumb = useMemo(() => {
    const nodes = roleLevels
      .map((level) => {
        if (!level.selectedNodeId) return null;
        return level.nodes.find((n) => n.id === level.selectedNodeId);
      })
      .filter(Boolean) as KaryakariniNode[];
    return nodes.length > 0 ? nodes.map((n) => n.name).join(' > ') : 'मूल';
  }, [roleLevels]);
  const [memberLevels, setMemberLevels] = useState<TreeLevelState[]>([]);
  const memberBreadcrumb = useMemo(() => {
    const nodes = memberLevels
      .map((level) => {
        if (!level.selectedNodeId) return null;
        return level.nodes.find((n) => n.id === level.selectedNodeId);
      })
      .filter(Boolean) as KaryakariniNode[];
    return nodes.length > 0 ? nodes.map((n) => n.name).join(' > ') : 'मूल';
  }, [memberLevels]);
  const [activityBrowseLevels, setActivityBrowseLevels] = useState<TreeLevelState[]>([]);
  const activityBrowseBreadcrumb = useMemo(() => {
    const nodes = activityBrowseLevels
      .map((level) => {
        if (!level.selectedNodeId) return null;
        return level.nodes.find((n) => n.id === level.selectedNodeId);
      })
      .filter(Boolean) as KaryakariniNode[];
    return nodes.length > 0 ? nodes.map((n) => n.name).join(' > ') : 'मूल';
  }, [activityBrowseLevels]);
  const taskBrowseBreadcrumb = useMemo(() => {
    const nodes = taskBrowseLevels
      .map((level) => {
        if (!level.selectedNodeId) return null;
        return level.nodes.find((n) => n.id === level.selectedNodeId);
      })
      .filter(Boolean) as KaryakariniNode[];
    return nodes.length > 0 ? nodes.map((n) => n.name).join(' > ') : 'मूल';
  }, [taskBrowseLevels]);
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
    return taskSelectedNode?.name || 'नोड चुनें';
  }, [taskSelectedNode]);
  const activitySelectedNode = useMemo(
    () => assignableNodes.find((node) => String(node.id) === String(activityForm.nodeId)) || null,
    [assignableNodes, activityForm.nodeId]
  );
  const activitySelectedPathLabel = useMemo(() => {
    const path = String(activitySelectedNode?.hierarchy_path || '').trim();
    if (path) return path;
    return activitySelectedNode?.name || 'नोड चुनें';
  }, [activitySelectedNode]);
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

  const taskHierarchyFilterOptions = useMemo(
    () =>
      [...new Set(taskRows.map((row) => String(row.hierarchy_l1 || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b)),
    [taskRows]
  );
  const filteredTaskRows = useMemo(() => {
    const list = taskHierarchyFilterL1
      ? taskRows.filter((row) => String(row.hierarchy_l1 || '').trim() === taskHierarchyFilterL1)
      : taskRows;

    const map = new Map<string, KaryakariniTask>();
    list.forEach((row) => {
      const key = `${row.title?.trim()}###${row.task_date}###${row.node_id}`;
      const assigneeObj = row.assigned_user_id ? {
        id: Number(row.assigned_user_id),
        name: row.assigned_first_name || `उपयोगकर्ता #${row.assigned_user_id}`,
        father_name: row.assigned_father_name || '',
        mobile_number: row.assigned_mobile_number || '',
      } : null;

      if (!map.has(key)) {
        map.set(key, {
          ...row,
          assignees: assigneeObj ? [assigneeObj] : [],
        });
      } else {
        const existing = map.get(key)!;
        if (assigneeObj && !existing.assignees?.some((a) => a.id === assigneeObj.id)) {
          existing.assignees = [...(existing.assignees || []), assigneeObj];
        }
      }
    });

    return Array.from(map.values());
  }, [taskHierarchyFilterL1, taskRows]);
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
  const activitySelectedSubcategories = useMemo(() => parseLabelList(activityForm.subcategory), [activityForm.subcategory]);
  const activitySelectedCategories = useMemo(() => parseLabelList(activityForm.category), [activityForm.category]);

  const filteredMembersForTab = useMemo(() => {
    const normalizedLevel = memberFilterNodeLevel.trim().toLowerCase();
    const normalizedCategory = memberFilterCategory.trim().toLowerCase();
    const normalizedSubcategory = memberFilterSubcategory.trim().toLowerCase();
    return members.filter((member) => {
      const levelValue = String(member.node_level || '').trim().toLowerCase();
      const levelLabel = formatNodeLevelLabel(member.node_level).toLowerCase();
      const categoryList = parseLabelList(
        member.categories && member.categories.length ? member.categories : member.category || ''
      ).map((entry) => entry.toLowerCase());
      const subcategoryList = parseLabelList(
        member.subcategories && member.subcategories.length ? member.subcategories : member.subcategory || ''
      ).map((entry) => entry.toLowerCase());
      const matchesLevel = !normalizedLevel || levelValue.includes(normalizedLevel) || levelLabel.includes(normalizedLevel);
      const matchesCategory = !normalizedCategory || categoryList.some((entry) => entry.includes(normalizedCategory));
      const matchesSubcategory = !normalizedSubcategory || subcategoryList.some((entry) => entry.includes(normalizedSubcategory));
      return matchesLevel && matchesCategory && matchesSubcategory;
    });
  }, [memberFilterCategory, memberFilterNodeLevel, memberFilterSubcategory, members]);

  const groupedMembersForTab = useMemo(() => {
    const locationMap = new Map<
      string,
      { key: string; locationName: string; path: string; rows: KaryakariniMember[] }
    >();

    filteredMembersForTab.forEach((member) => {
      const nodeId = Number(member.node_id || 0);
      const path = String(member.hierarchy_path || member.node_name || `Node #${nodeId}`).trim() || `Node #${nodeId}`;
      const locationName = String(member.node_name || path.split(' > ').slice(-1)[0] || `Node #${nodeId}`).trim();
      const key = `${nodeId}::${path}`;
      if (!locationMap.has(key)) {
        locationMap.set(key, { key, locationName, path, rows: [] });
      }
      locationMap.get(key)?.rows.push(member);
    });

    return Array.from(locationMap.values())
      .map((location) => {
        const padMap = new Map<string, KaryakariniMember[]>();
        location.rows.forEach((member) => {
          const pad = String(member.pad || '').trim() || 'Unassigned';
          if (!padMap.has(pad)) padMap.set(pad, []);
          padMap.get(pad)?.push(member);
        });
        return {
          ...location,
          padGroups: Array.from(padMap.entries())
            .map(([pad, rows]) => ({ pad, rows }))
            .sort((a, b) => a.pad.localeCompare(b.pad)),
        };
      })
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [filteredMembersForTab]);

  const meetingMemberTransferItems = useMemo<TransferAttendee[]>(
    () =>
      meetingMembers
        .map((member) => {
          const userId = Number(member.user_id || 0);
          if (!userId) return null;
          const fullName = [member.first_name, member.father_name].filter(Boolean).join(' ').trim() || `उपयोगकर्ता #${userId}`;
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

  const meetingTransferAvailableItems = useMemo(() => {
    const available = [...meetingMemberTransferItems, ...meetingGuestTransferItems].filter(
      (item) => !meetingSelectedKeySet.has(item.key)
    );
    if (!meetingGuestQuery.trim()) return available;
    const q = meetingGuestQuery.trim().toLowerCase();
    return available.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        String(item.id).includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q))
    );
  }, [meetingGuestTransferItems, meetingMemberTransferItems, meetingSelectedKeySet, meetingGuestQuery]);

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

  const meetingInviteAvailableItems = useMemo(() => {
    const available = meetingMemberTransferItems.filter((item) => !meetingInviteSelectedKeySet.has(item.key));
    if (!meetingInviteSearchQuery.trim()) return available;
    const q = meetingInviteSearchQuery.trim().toLowerCase();
    return available.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        String(item.id).includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q))
    );
  }, [meetingInviteSelectedKeySet, meetingMemberTransferItems, meetingInviteSearchQuery]);

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
    if (!selectedPathNodes.length) return 'प्रान्त';
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

  // Filter refs to break dependency loops causing full-page reloads
  const activityFilterCategoryRef = useRef(activityFilterCategory);
  const activityFilterSubcategoryRef = useRef(activityFilterSubcategory);
  const activityBrowseNodeIdRef = useRef(activityBrowseNodeId);
  const taskFilterCategoryRef = useRef(taskFilterCategory);
  const taskFilterSubcategoryRef = useRef(taskFilterSubcategory);
  const taskBrowseNodeIdRef = useRef(taskBrowseNodeId);
  const taskFilterNodeLevelRef = useRef(taskFilterNodeLevel);

  useEffect(() => {
    activityFilterCategoryRef.current = activityFilterCategory;
  }, [activityFilterCategory]);

  useEffect(() => {
    activityFilterSubcategoryRef.current = activityFilterSubcategory;
  }, [activityFilterSubcategory]);

  useEffect(() => {
    activityBrowseNodeIdRef.current = activityBrowseNodeId;
  }, [activityBrowseNodeId]);

  useEffect(() => {
    taskFilterCategoryRef.current = taskFilterCategory;
  }, [taskFilterCategory]);

  useEffect(() => {
    taskFilterSubcategoryRef.current = taskFilterSubcategory;
  }, [taskFilterSubcategory]);

  useEffect(() => {
    taskBrowseNodeIdRef.current = taskBrowseNodeId;
  }, [taskBrowseNodeId]);

  useEffect(() => {
    taskFilterNodeLevelRef.current = taskFilterNodeLevel;
  }, [taskFilterNodeLevel]);

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
        Alert.alert('त्रुटि', err?.response?.data?.message || 'बैठकें लोड करने में विफल');
      } finally {
        setMeetingsLoading(false);
      }
    },
    []
  );

  const loadTasks = useCallback(
    async (
      versionId: number,
      page = 1,
      nodeIdOverride?: string,
      categoryOverride?: string,
      subcategoryOverride?: string,
      nodeLevelOverride?: string
    ) => {
      try {
        setTasksLoading(true);
        const targetNodeId = nodeIdOverride !== undefined ? nodeIdOverride : taskBrowseNodeIdRef.current;
        const targetCategory = categoryOverride !== undefined ? categoryOverride : taskFilterCategoryRef.current;
        const targetSubcategory = subcategoryOverride !== undefined ? subcategoryOverride : taskFilterSubcategoryRef.current;
        const targetNodeLevel = nodeLevelOverride !== undefined ? nodeLevelOverride : taskFilterNodeLevelRef.current;

        const response = await karyakariniClient.get('/karyakarini/tasks', {
          params: {
            versionId,
            page,
            limit: 20,
            category: targetCategory ? targetCategory.trim() || undefined : undefined,
            subcategory: targetSubcategory ? targetSubcategory.trim() || undefined : undefined,
            nodeLevel: targetNodeLevel ? targetNodeLevel.trim() || undefined : undefined,
            nodeId: targetNodeId ? Number(targetNodeId) : undefined,
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
        Alert.alert('त्रुटि', err?.response?.data?.message || 'कार्य लोड करने में विफल');
      } finally {
        setTasksLoading(false);
      }
    },
    []
  );

  const loadCategoryActivities = useCallback(
    async (
      versionId: number,
      page = 1,
      nodeIdOverride?: string,
      categoryOverride?: string,
      subcategoryOverride?: string
    ) => {
      try {
        setActivitiesLoading(true);
        const targetNodeId = nodeIdOverride !== undefined ? nodeIdOverride : activityBrowseNodeIdRef.current;
        const targetCategory = categoryOverride !== undefined ? categoryOverride : activityFilterCategoryRef.current;
        const targetSubcategory = subcategoryOverride !== undefined ? subcategoryOverride : activityFilterSubcategoryRef.current;

        const response = await karyakariniClient.get('/karyakarini/category-activities', {
          params: {
            versionId,
            page,
            limit: 20,
            category: targetCategory ? targetCategory.trim() || undefined : undefined,
            subcategory: targetSubcategory ? targetSubcategory.trim() || undefined : undefined,
            nodeId: targetNodeId ? Number(targetNodeId) : undefined,
          },
        });
        setActivityRows((response?.data?.data?.activities || []) as KaryakariniCategoryActivity[]);
        setActivityPagination({
          ...defaultPagination,
          ...(response?.data?.data?.pagination || {}),
        });
      } catch (err: any) {
        setActivityRows([]);
        setActivityPagination(defaultPagination);
        Alert.alert('त्रुटि', err?.response?.data?.message || 'आयाम कार्यक्रम लोड करने में विफल');
      } finally {
        setActivitiesLoading(false);
      }
    },
    []
  );

  // Automatically trigger search on Activities filter changes
  useEffect(() => {
    if (selectedVersionId) {
      void loadCategoryActivities(
        selectedVersionId,
        1,
        activityBrowseNodeId,
        activityFilterCategory,
        activityFilterSubcategory
      );
    }
  }, [selectedVersionId, activityBrowseNodeId, activityFilterCategory, activityFilterSubcategory, loadCategoryActivities]);

  // Automatically trigger search on Tasks filter changes
  useEffect(() => {
    if (selectedVersionId) {
      void loadTasks(
        selectedVersionId,
        1,
        taskBrowseNodeId,
        taskFilterCategory,
        taskFilterSubcategory,
        taskFilterNodeLevel
      );
    }
  }, [selectedVersionId, taskBrowseNodeId, taskFilterCategory, taskFilterSubcategory, taskFilterNodeLevel, loadTasks]);

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
      Alert.alert('त्रुटि', err?.response?.data?.message || 'नोड कार्यकर्ता लोड करने में विफल');
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
      Alert.alert('त्रुटि', err?.response?.data?.message || 'अतिथि कार्यकर्ता लोड करने में विफल');
    } finally {
      setMeetingGuestSearching(false);
    }
  }, []);

  const pickAndUploadAttachment = useCallback(async (category: 'meeting' | 'task') => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('अनुमति', 'मीडिया लाइब्रेरी की अनुमति आवश्यक है');
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
    await appendPickerAssetToFormData(form, asset, fileName, mimeType);

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

  const pickAndUploadActivityAttachment = useCallback(async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
        type: [
          'image/*',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
        ],
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
      const fileSize = Number(asset.size || 0);
      if (fileSize > 30 * 1024 * 1024) {
        Alert.alert('फाइल बहुत बड़ी है', 'कृपया अधिकतम 30MB तक की फाइल अपलोड करें।');
        return;
      }

      const formData = new FormData();
      formData.append('folder', 'karyakarini');
      formData.append('category', 'category-activity');
      const assetFile = (asset as any)?.file;
      if (assetFile) {
        formData.append('file', assetFile);
      } else if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        formData.append('file', blob as any, asset.name || `activity-${Date.now()}`);
      } else {
        formData.append(
          'file',
          {
            uri: asset.uri,
            name: asset.name || `activity-${Date.now()}`,
            type: asset.mimeType || 'application/octet-stream',
          } as any
        );
      }
      setUploadingActivityAttachment(true);
      const response = await karyakariniClient.post('/karyakarini/upload/attachment', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const payload = response?.data?.data || {};
      const url = String(payload.url || '').trim();
      if (!url) return;
      setActivityForm((prev) => ({
        ...prev,
        attachments: [
          ...prev.attachments,
          { url, type: String(payload.fileType || '').trim() || undefined, name: String(payload.fileName || '').trim() || undefined },
        ],
      }));
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || 'संलग्नक अपलोड करने में विफल');
    } finally {
      setUploadingActivityAttachment(false);
    }
  }, []);

  const uploadMemberPhotoFromSource = useCallback(
    async (source: 'camera' | 'gallery', target: 'create' | 'edit' | 'assign' = 'create') => {
      try {
        if (source === 'camera') {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('अनुमति', 'कैमरा अनुमति आवश्यक है');
            return;
          }
        } else {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('अनुमति', 'मीडिया लाइब्रेरी की अनुमति आवश्यक है');
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
        await appendPickerAssetToFormData(form, asset, fileName, mimeType);

        setUploadingMemberPhoto(true);
        const response = await karyakariniClient.post('/karyakarini/upload/attachment', form, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        const payload = response?.data?.data || {};
        const avatarUrl = String(payload.url || '').trim();
        if (!avatarUrl) {
          Alert.alert('त्रुटि', 'कार्यकर्ता फोटो अपलोड करने में विफल');
          return;
        }
        if (target === 'edit') {
          setEditMemberForm((prev) => ({ ...prev, avatar: avatarUrl }));
        } else if (target === 'assign') {
          setAssignForm((prev) => ({ ...prev, avatar: avatarUrl }));
        } else {
          setMemberForm((prev) => ({ ...prev, avatar: avatarUrl }));
        }
      } catch (err: any) {
        Alert.alert('त्रुटि', err?.response?.data?.message || 'कार्यकर्ता फोटो अपलोड करने में विफल');
      } finally {
        setUploadingMemberPhoto(false);
      }
    },
    []
  );

  const fetchStartingRootNodes = useCallback(
    async (versionId: number) => {
      const roots = await fetchNodes(versionId, null);
      const rashtriyaRoots = roots.filter(
        (node) => String(node.level || '').trim().toLowerCase() === 'rashtriya'
      );
      if (!rashtriyaRoots.length) return roots;
      const childArrays = await Promise.all(
        rashtriyaRoots.map((root) => fetchNodes(versionId, root.id))
      );
      const prantNodes = childArrays.flat();
      return prantNodes.length ? prantNodes : roots;
    },
    [fetchNodes]
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
        rootNodes = await fetchStartingRootNodes(versionId);
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
    [currentUserRole, fetchNodes, fetchStartingRootNodes]
  );

  const loadRestrictedTrees = useCallback(
    async (versionId: number, scopedNodesList: KaryakariniAssignableNode[]) => {
      const isScopedTree = currentUserRole !== 'superadmin' && scopedNodesList.length > 0;
      let roleRootNodes: KaryakariniNode[] = [];
      let memberRootNodes: KaryakariniNode[] = [];

      if (isScopedTree) {
        const scopedSet = new Set(scopedNodesList.map((node) => Number(node.id)).filter((id) => id > 0));
        const scopeRoots = scopedNodesList.filter((node) => !scopedSet.has(Number(node.parent_id || 0)));
        const scopeRootSet = new Set(scopeRoots.map((node) => Number(node.id)).filter((id) => id > 0));
        const childRoots = scopedNodesList.filter((node) => scopeRootSet.has(Number(node.parent_id || 0)));
        const roleInitialNodes = childRoots.length ? childRoots : scopeRoots;
        const memberInitialNodes = scopeRoots.length ? scopeRoots : childRoots;

        const childCountByParent = new Map<number, number>();
        scopedNodesList.forEach((node) => {
          const parentId = Number(node.parent_id || 0);
          childCountByParent.set(parentId, Number(childCountByParent.get(parentId) || 0) + 1);
        });

        const mapNode = (node: KaryakariniAssignableNode): KaryakariniNode => ({
          id: Number(node.id),
          name: node.name,
          level: node.level,
          parent_id: node.parent_id ?? null,
          version_id: node.version_id,
          can_assign_member: (node as any).can_assign_member,
          can_manage_hierarchy: (node as any).can_manage_hierarchy,
          members_count: (node as any).members_count || 0,
          has_children: (childCountByParent.get(Number(node.id)) || 0) > 0,
        });

        roleRootNodes = roleInitialNodes.map(mapNode);
        memberRootNodes = memberInitialNodes.map(mapNode);
      } else {
        const rootNodes = await fetchStartingRootNodes(versionId);
        roleRootNodes = rootNodes;
        memberRootNodes = rootNodes;
      }

      setRoleLevels([{ parentNode: null, nodes: roleRootNodes, selectedNodeId: null }]);
      setMemberLevels([{ parentNode: null, nodes: memberRootNodes, selectedNodeId: null }]);
      setActivityLevels([{ parentNode: null, nodes: memberRootNodes, selectedNodeId: null }]);
      setActivityBrowseLevels([{ parentNode: null, nodes: memberRootNodes, selectedNodeId: null }]);
      setTaskBrowseLevels([{ parentNode: null, nodes: memberRootNodes, selectedNodeId: null }]);
      setSelectedRoleNodeId('');
      setRoleMembers([]);
      setMemberBrowseNodeId('');
      setActivityBrowseNodeId('');
      setTaskBrowseNodeId('');
      setMembersNode(null);
    },
    [currentUserRole, fetchNodes, fetchStartingRootNodes]
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
        loadCategoryActivities(targetVersionId, 1),
        loadNotificationCount(targetVersionId),
      ]);
      const initialPathIds = preserveSelectionIds.length
        ? preserveSelectionIds
        : await resolveDefaultSelectionPathIds(targetVersionId, scopedNodes);
      await loadTree(targetVersionId, initialPathIds, scopedNodes);
      await loadRestrictedTrees(targetVersionId, scopedNodes);
    },
    [
      loadAssignableNodes,
      loadCategoryActivities,
      loadMeetings,
      loadNotificationCount,
      loadPadOptions,
      loadScopes,
      loadTasks,
      loadTree,
      resolveDefaultSelectionPathIds,
    ]
  );

  const loadMembers = useCallback(
    async (
      node: KaryakariniNode | null,
      page = 1,
      versionOverride?: number | null,
      categoryOverride?: string,
      subcategoryOverride?: string
    ) => {
      const targetVersionId = versionOverride !== undefined ? versionOverride : selectedVersionId;
      if (!targetVersionId) return;
      try {
        setMembersLoading(true);
        const targetCategory = categoryOverride !== undefined ? categoryOverride : memberFilterCategory;
        const targetSubcategory = subcategoryOverride !== undefined ? subcategoryOverride : memberFilterSubcategory;

        const response = await karyakariniClient.get('/karyakarini/members', {
          params: {
            nodeId: node ? node.id : undefined,
            versionId: targetVersionId,
            page,
            limit: 10,
            category: targetCategory ? targetCategory.trim() : undefined,
            subcategory: targetSubcategory ? targetSubcategory.trim() : undefined,
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
        Alert.alert('त्रुटि', err?.response?.data?.message || 'कार्यकर्ता लोड करने में विफल');
      } finally {
        setMembersLoading(false);
      }
    },
    [selectedVersionId, memberFilterCategory, memberFilterSubcategory]
  );

  const loadMembersForScopeNodes = useCallback(
    async (nodes: KaryakariniNode[]) => {
      if (!selectedVersionId) return;
      const uniqueNodes = [...new Map(nodes.filter((node) => Number(node.id || 0) > 0).map((node) => [Number(node.id), node])).values()];
      if (!uniqueNodes.length) {
        setMembers([]);
        setMembersPagination(defaultPagination);
        return;
      }

      try {
        setMembersLoading(true);
        const responses = await Promise.all(
          uniqueNodes.map(async (node) => {
            try {
              const response = await karyakariniClient.get('/karyakarini/members', {
                params: {
                  nodeId: node.id,
                  versionId: selectedVersionId,
                  page: 1,
                  limit: 200,
                },
              });
              return (response?.data?.data?.members || []) as KaryakariniMember[];
            } catch {
              return [] as KaryakariniMember[];
            }
          })
        );

        const membersMap = new Map<number, KaryakariniMember>();
        responses.flat().forEach((member) => {
          membersMap.set(Number(member.id), member);
        });
        const mergedRows = Array.from(membersMap.values()).sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
        setMembers(mergedRows);
        setMembersPagination({
          page: 1,
          limit: Math.max(1, mergedRows.length),
          total: mergedRows.length,
          totalPages: 1,
        });
      } catch (err: any) {
        setMembers([]);
        setMembersPagination(defaultPagination);
        Alert.alert('त्रुटि', err?.response?.data?.message || 'कार्यकर्ता लोड करने में विफल');
      } finally {
        setMembersLoading(false);
      }
    },
    [selectedVersionId]
  );

  const handleRoleNodeSelect = useCallback(
    async (levelIndex: number, node: KaryakariniNode) => {
      if (!selectedVersionId) return;
      const trimmed = roleLevels.slice(0, levelIndex + 1).map((level, idx) =>
        idx === levelIndex ? { ...level, selectedNodeId: node.id } : level
      );
      setRoleLevels(trimmed);
      setSelectedRoleNodeId(String(node.id));

      try {
        setLoadingRoleMembers(true);
        const [children, membersRes] = await Promise.all([
          fetchNodes(selectedVersionId, node.id),
          karyakariniClient.get('/karyakarini/nodes/members', {
            params: { nodeId: node.id, versionId: selectedVersionId },
          }),
        ]);
        if (children.length > 0) {
          setRoleLevels([
            ...trimmed,
            { parentNode: node, nodes: children, selectedNodeId: null },
          ]);
        }
        const rows = (membersRes?.data?.data?.members || []) as KaryakariniMember[];
        setRoleMembers(rows);
        setSelectedRoleUserId((prev) => {
          if (rows.some((member) => String(member.user_id || '') === prev)) return prev;
          const firstUserId = rows.find((member) => Number(member.user_id || 0) > 0)?.user_id;
          return firstUserId ? String(firstUserId) : '';
        });
      } catch (err: any) {
        Alert.alert('त्रुटि', err?.response?.data?.message || 'डेटा लोड करने में विफल');
        setRoleMembers([]);
        setSelectedRoleUserId('');
      } finally {
        setLoadingRoleMembers(false);
      }
    },
    [fetchNodes, roleLevels, selectedVersionId]
  );

  const handleMemberNodeSelect = useCallback(
    async (levelIndex: number, node: KaryakariniNode) => {
      if (!selectedVersionId) return;
      const trimmed = memberLevels.slice(0, levelIndex + 1).map((level, idx) =>
        idx === levelIndex ? { ...level, selectedNodeId: node.id } : level
      );
      setMemberLevels(trimmed);
      setMemberBrowseNodeId(String(node.id));
      setMembersNode(node);

      // Trigger member load without awaiting
      void loadMembers(node, 1);

      try {
        const children = await fetchNodes(selectedVersionId, node.id);
        if (children.length > 0) {
          setMemberLevels([
            ...trimmed,
            { parentNode: node, nodes: children, selectedNodeId: null },
          ]);
        }
      } catch (err: any) {
        Alert.alert('त्रुटि', err?.response?.data?.message || 'चाइल्ड नोड लोड करने में विफल');
      }
    },
    [fetchNodes, memberLevels, selectedVersionId, loadMembers]
  );

  const handleActivityNodeSelect = useCallback(
    async (levelIndex: number, node: KaryakariniNode) => {
      if (!selectedVersionId) return;
      const trimmed = activityBrowseLevels.slice(0, levelIndex + 1).map((level, idx) =>
        idx === levelIndex ? { ...level, selectedNodeId: node.id } : level
      );
      setActivityBrowseLevels(trimmed);
      setActivityBrowseNodeId(String(node.id));

      // Trigger activity load
      void loadCategoryActivities(selectedVersionId, 1, String(node.id));

      try {
        const children = await fetchNodes(selectedVersionId, node.id);
        if (children.length > 0) {
          setActivityBrowseLevels([
            ...trimmed,
            { parentNode: node, nodes: children, selectedNodeId: null },
          ]);
        }
      } catch (err: any) {
        Alert.alert('त्रुटि', err?.response?.data?.message || 'चाइल्ड नोड लोड करने में विफल');
      }
    },
    [fetchNodes, activityBrowseLevels, selectedVersionId, loadCategoryActivities]
  );

  const handleTaskNodeSelect = useCallback(
    async (levelIndex: number, node: KaryakariniNode) => {
      if (!selectedVersionId) return;
      const trimmed = taskBrowseLevels.slice(0, levelIndex + 1).map((level, idx) =>
        idx === levelIndex ? { ...level, selectedNodeId: node.id } : level
      );
      setTaskBrowseLevels(trimmed);
      setTaskBrowseNodeId(String(node.id));

      // Trigger task load
      void loadTasks(selectedVersionId, 1, String(node.id));

      try {
        const children = await fetchNodes(selectedVersionId, node.id);
        if (children.length > 0) {
          setTaskBrowseLevels([
            ...trimmed,
            { parentNode: node, nodes: children, selectedNodeId: null },
          ]);
        }
      } catch (err: any) {
        Alert.alert('त्रुटि', err?.response?.data?.message || 'चाइल्ड नोड लोड करने में विफल');
      }
    },
    [fetchNodes, taskBrowseLevels, selectedVersionId, loadTasks]
  );

  useEffect(() => {
    const boot = async () => {
      try {
        setLoading(true);
        await loadVersionsAndTree();
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || 'कार्यकारिणी डेटा लोड करने में विफल');
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
      const scopeMemberNodes = memberLevels[0]?.nodes || [];
      if (activeTab === 'members') {
        if (currentUserRole !== 'superadmin' && !memberBrowseNodeId && scopeMemberNodes.length > 0) {
          await loadMembersForScopeNodes(scopeMemberNodes);
        } else if (membersNode) {
          await loadMembers(membersNode, membersPagination.page || 1);
        }
      }
      if (membersVisible && membersNode) {
        await loadMembers(membersNode, membersPagination.page || 1);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'रीफ्रेश करने में विफल');
    } finally {
      setRefreshing(false);
    }
  }, [
    currentUserRole,
    loadMembers,
    loadMembersForScopeNodes,
    loadVersionsAndTree,
    memberBrowseNodeId,
    memberLevels,
    membersNode,
    membersPagination.page,
    membersVisible,
    activeTab,
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
        Alert.alert('त्रुटि', err?.response?.data?.message || 'संस्करण बदलने में विफल');
      } finally {
        setLoading(false);
      }
    },
    [loadAssignableNodes, loadMeetings, loadNotificationCount, loadPadOptions, loadScopes, loadTasks, loadTree, resolveDefaultSelectionPathIds]
  );

  useEffect(() => {
    if (activeTab !== 'members') return;
    const scopeMemberNodes = memberLevels[0]?.nodes || [];
    if (currentUserRole !== 'superadmin' && !memberBrowseNodeId && scopeMemberNodes.length > 0) {
      setMembersNode(scopeMemberNodes[0]);
      void loadMembersForScopeNodes(scopeMemberNodes);
      return;
    }

    if (memberBrowseNodeId && membersNode && String(membersNode.id) === memberBrowseNodeId) {
      void loadMembers(membersNode, membersPagination.page || 1);
      return;
    }

    const fallbackNode =
      membersNode ||
      selectedPathNodes[selectedPathNodes.length - 1] ||
      memberLevels[memberLevels.length - 1]?.nodes.find((node) => node.id === memberLevels[memberLevels.length - 1]?.selectedNodeId) ||
      memberLevels[0]?.nodes?.[0] ||
      null;
    if (!fallbackNode) return;

    setMembersNode(fallbackNode);
    setMemberBrowseNodeId(String(fallbackNode.id));
    void loadMembers(fallbackNode, 1);
  }, [
    activeTab,
    currentUserRole,
    loadMembers,
    loadMembersForScopeNodes,
    memberBrowseNodeId,
    memberLevels,
    membersNode,
    membersPagination.page,
    selectedPathNodes,
  ]);

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
        Alert.alert('त्रुटि', err?.response?.data?.message || 'चाइल्ड नोड लोड करने में विफल');
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
      name: sanitizeInputValue(member.first_name),
      fatherOrHusbandName: sanitizeInputValue(member.father_name),
      mobileNumber: sanitizeInputValue(member.mobile_number),
      password: '',
      pad: sanitizeInputValue(member.pad),
      category: categoryValues.join(', '),
      subcategory: subcategoryValues.join(', '),
      userRole: String(member.user_role || 'user').trim().toLowerCase() === 'admin' ? 'admin' : 'user',
      state: sanitizeInputValue(member.state),
      district: sanitizeInputValue(member.district),
      tehsil: sanitizeInputValue(member.tehsil),
      village: sanitizeInputValue(member.address_village || member.village),
      pincode: sanitizeInputValue(member.pincode),
      avatar: sanitizeInputValue(member.avatar),
    });
    setOtherInfoForm({ genderType: null, religion: null });
    setShowOtherInfo(true);
    if (member.user_id) {
      void (async () => {
        try {
          const res = await karyakariniClient.get(`/karyakarini/users/${member.user_id}/other-info`);
          const info = res?.data?.data?.otherInfo;
          if (info) {
            setOtherInfoForm({
              genderType: info.gender_type || null,
              religion: info.religion || null,
            });
          }
        } catch {
          // ignore prefill errors
        }
      })();
    }
    setShowEditMemberModal(true);
  }, []);

  const handleSubmitMemberEdit = useCallback(async () => {
    if (!editingMember || !selectedVersionId) return;
    if (!editMemberForm.pad.trim()) {
      Alert.alert('आवश्यक', 'दायित्व आवश्यक है');
      return;
    }
    if (!editMemberForm.category.trim() || !editMemberForm.subcategory.trim()) {
      Alert.alert('आवश्यक', 'आयाम और टोली आवश्यक हैं');
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
        password: editMemberForm.password.trim() || null,
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
      if (editingMember.user_id && (otherInfoForm.genderType || otherInfoForm.religion)) {
        try {
          await karyakariniClient.put(`/karyakarini/users/${editingMember.user_id}/other-info`, {
            genderType: otherInfoForm.genderType,
            religion: otherInfoForm.religion,
          });
        } catch {
          // non-blocking
        }
      }
      setShowEditMemberModal(false);
      if (membersNode) {
        await loadMembers(membersNode, membersPagination.page || 1);
      }
      Alert.alert('सफल', 'कार्यकर्ता सफलतापूर्वक अपडेट हो गया');
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || 'कार्यकर्ता अपडेट करने में विफल');
    } finally {
      setSavingMemberEdit(false);
    }
  }, [editMemberForm, editingMember, loadMembers, membersNode, membersPagination.page, selectedVersionId, otherInfoForm.genderType, otherInfoForm.religion]);

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
    setAssignForm({
      pad: '',
      category: '',
      subcategory: '',
      userRole: 'user',
      avatar: '',
    });
    setOtherInfoForm({ genderType: null, religion: null });
    setShowOtherInfo(true);
    setPincodeLookupMessage(null);
    setLastAutoFilledPincode('');
    if (selectedVersionId) {
      void loadPadOptions(selectedVersionId);
    }
    setShowAddMemberModal(true);
  }, [loadPadOptions, selectedVersionId]);

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
      Alert.alert('खोज', 'मोबाइल नंबर या ईमेल के कम से कम 3 अक्षर दर्ज करें');
      return;
    }
    try {
      setSearchingUsers(true);
      const response = await karyakariniClient.get('/karyakarini/members/search-users', {
        params: { q, limit: 12 },
      });
      setSearchResults((response?.data?.data?.users || []) as KaryakariniAssignableUser[]);
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || 'उपयोगकर्ता खोजने में विफल');
      setSearchResults([]);
    } finally {
      setSearchingUsers(false);
    }
  }, [userSearchQuery]);

  const handlePickUser = useCallback((picked: KaryakariniAssignableUser) => {
    setSelectedUser(picked);
    const pickedAvatar = String(picked.avatar || '').trim();
    setAssignForm((prev) => ({ ...prev, avatar: pickedAvatar }));
    setOtherInfoForm({ genderType: null, religion: null });
    if (picked?.id) {
      void (async () => {
        try {
          const res = await karyakariniClient.get(`/karyakarini/users/${picked.id}/other-info`);
          const info = res?.data?.data?.otherInfo;
          if (info) {
            setOtherInfoForm({
              genderType: info.gender_type || null,
              religion: info.religion || null,
            });
          }
        } catch {
          // ignore prefill errors
        }
      })();
    }
  }, []);

  const loadCategoryTree = useCallback(async () => {
    try {
      const res = await karyakariniClient.get('/karyakarini/master/categories');
      const cats = res?.data?.data?.categories;
      if (Array.isArray(cats) && cats.length) {
        setCategoryTree(
          cats.map((c: any) => ({
            category: String(c.category || '').trim(),
            subcategories: Array.isArray(c.subcategories)
              ? c.subcategories.map((s: any) => String(s || '').trim()).filter(Boolean)
              : [],
          }))
        );
      }
    } catch {
      // keep existing/default tree on failure
    }
  }, []);

  useEffect(() => {
    void loadCategoryTree();
  }, [loadCategoryTree]);

  const subToCategory = useMemo(() => {
    const map = new Map<string, string>();
    categoryTree.forEach((entry) => {
      entry.subcategories.forEach((sub) => {
        const key = String(sub || '').trim().toLowerCase();
        if (key && !map.has(key)) map.set(key, entry.category);
      });
    });
    return map;
  }, [categoryTree]);

  const deriveCats = useCallback(
    (subcategories: string[]) => {
      const result: string[] = [];
      subcategories.forEach((sub) => {
        const cat = subToCategory.get(String(sub || '').trim().toLowerCase());
        if (cat && !result.includes(cat)) result.push(cat);
      });
      return result;
    },
    [subToCategory]
  );

  const loadJangarna = useCallback(async (versionId: number) => {
    try {
      setJangarnaLoading(true);
      const res = await karyakariniClient.get('/karyakarini/jangarna', { params: { versionId } });
      const levels = res?.data?.data?.levels || [];
      setJangarnaData(Array.isArray(levels) ? levels : []);
    } catch {
      setJangarnaData([]);
    } finally {
      setJangarnaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'jangarna') return;
    if (!selectedVersionId) return;
    void loadJangarna(selectedVersionId);
  }, [activeTab, selectedVersionId, loadJangarna]);

  const renderOtherInfoSection = () => (
    <View style={styles.otherInfoBlock}>
      <TouchableOpacity style={styles.otherInfoToggle} onPress={() => setShowOtherInfo((prev) => !prev)}>
        <Text style={styles.otherInfoToggleText}>अन्य जानकारी</Text>
        <MaterialIcons
          name={showOtherInfo ? 'expand-less' : 'expand-more'}
          size={20}
          color={theme.colors.primary}
        />
      </TouchableOpacity>
      {showOtherInfo ? (
        <View style={styles.otherInfoBody}>
          <Text style={styles.fieldLabel}>लिंग / प्रकार</Text>
          <View style={styles.optionRow}>
            {GENDER_TYPE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={`gender-${opt.value}`}
                style={[styles.optionChip, otherInfoForm.genderType === opt.value && styles.optionChipActive]}
                onPress={() =>
                  setOtherInfoForm((prev) => ({
                    ...prev,
                    genderType: prev.genderType === opt.value ? null : opt.value,
                  }))
                }
              >
                <Text style={[styles.optionChipText, otherInfoForm.genderType === opt.value && styles.optionChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>धर्म</Text>
          <View style={styles.optionRow}>
            {RELIGION_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={`religion-${opt.value}`}
                style={[styles.optionChip, otherInfoForm.religion === opt.value && styles.optionChipActive]}
                onPress={() =>
                  setOtherInfoForm((prev) => ({
                    ...prev,
                    religion: prev.religion === opt.value ? null : opt.value,
                  }))
                }
              >
                <Text style={[styles.optionChipText, otherInfoForm.religion === opt.value && styles.optionChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );

  const lookupAddressByPincode = useCallback(async (pincode: string, mode: 'create' | 'edit' = 'create') => {
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
      if (mode === 'edit') {
        setEditMemberForm((prev) => {
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
      } else {
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
      }
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
      void lookupAddressByPincode(normalized, 'create');
    },
    [lastAutoFilledPincode, lookupAddressByPincode, pincodeLookupLoading]
  );

  const handleEditMemberPincodeChange = useCallback(
    (value: string) => {
      const normalized = String(value || '').replace(/\D/g, '').slice(0, 6);
      setEditMemberForm((prev) => ({ ...prev, pincode: normalized }));
      if (normalized.length < 6) {
        setPincodeLookupMessage(null);
        setLastAutoFilledPincode('');
        return;
      }
      if (normalized === lastAutoFilledPincode || pincodeLookupLoading) return;
      void lookupAddressByPincode(normalized, 'edit');
    },
    [lastAutoFilledPincode, lookupAddressByPincode, pincodeLookupLoading]
  );

  const handleOpenPadbharTransfer = useCallback((mode?: 'create' | 'assign' | 'edit' | 'task' | 'activity') => {
    const resolvedMode = mode || (memberModalTab === 'assign' ? 'assign' : 'create');
    const initial = parseLabelList(
      resolvedMode === 'assign'
        ? assignForm.subcategory
        : resolvedMode === 'edit'
          ? editMemberForm.subcategory
          : resolvedMode === 'task'
            ? taskForm.subcategory
            : resolvedMode === 'activity'
              ? activityForm.subcategory
              : memberForm.subcategory
    );
    setPadbharTransferMode(resolvedMode);
    setTransferDraftSubcategories(initial);
    setTransferExpandedCategories([]);
    setPadbharTransferVisible(true);
  }, [activityForm.subcategory, assignForm.subcategory, editMemberForm.subcategory, memberForm.subcategory, memberModalTab, taskForm.subcategory]);

  const toggleTransferCategory = useCallback((category: string) => {
    setTransferExpandedCategories((prev) =>
      prev.includes(category) ? prev.filter((entry) => entry !== category) : [...prev, category]
    );
  }, []);

  const handleTransferRemoveSubcategory = useCallback((subcategory: string) => {
    setTransferDraftSubcategories((prev) => prev.filter((entry) => entry !== subcategory));
  }, []);

  const handleApplyPadbharTransfer = useCallback(() => {
    const nextSubcategories = [...new Set(transferDraftSubcategories.map((entry) => String(entry || '').trim()).filter(Boolean))];
    const nextCategories = deriveCats(nextSubcategories);
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
    } else if (padbharTransferMode === 'activity') {
      setActivityForm((prev) => ({
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
  }, [padbharTransferMode, transferDraftSubcategories, deriveCats]);

  const handleTransferToggleSubcategory = useCallback((subcategory: string) => {
    setTransferDraftSubcategories((prev) => {
      const next = String(subcategory || '').trim();
      if (!next) return prev;
      return prev.includes(next) ? prev.filter((entry) => entry !== next) : [...prev, next];
    });
  }, []);

  const handleSubmitNode = useCallback(async () => {
    if (!addTargetNode || !selectedVersionId) return;
    if (!nodeForm.name.trim()) {
      Alert.alert('आवश्यक', 'नोड नाम आवश्यक है');
      return;
    }
    if (!allowedNodeLevelOptions.length) {
      Alert.alert('अमान्य', 'चुने गए संबंध के लिए कोई मान्य कार्यक्षेत्र उपलब्ध नहीं है');
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
      Alert.alert('सफल', 'नोड सफलतापूर्वक जोड़ दिया गया');
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || 'नोड जोड़ने में विफल');
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
          Alert.alert('आवश्यक', 'मौजूदा उपयोगकर्ता खोजें और चुनें');
          return;
        }
        if (!assignForm.pad.trim()) {
          Alert.alert('आवश्यक', 'दायित्व आवश्यक है');
          return;
        }
        if (!assignForm.category.trim() || !assignForm.subcategory.trim()) {
          Alert.alert('आवश्यक', 'आयाम और टोली आवश्यक हैं');
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
          avatar: assignForm.avatar.trim() || String(selectedUser.avatar || '').trim() || null,
          otherInfo: { genderType: otherInfoForm.genderType, religion: otherInfoForm.religion },
        });
      } else {
        if (!memberForm.mobileNumber.trim() || !memberForm.name.trim()) {
          Alert.alert('आवश्यक', 'मोबाइल और नाम आवश्यक हैं');
          return;
        }
        if (!memberForm.pad.trim()) {
          Alert.alert('आवश्यक', 'दायित्व आवश्यक है');
          return;
        }
        if (!memberForm.category.trim() || !memberForm.subcategory.trim()) {
          Alert.alert('आवश्यक', 'आयाम और टोली आवश्यक हैं');
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
          otherInfo: { genderType: otherInfoForm.genderType, religion: otherInfoForm.religion },
        });
      }

      setShowAddMemberModal(false);
      const created = response?.data?.data || null;
      if (created?.createdUser) {
        const loginId = created.mobileNumber || created.email || memberForm.mobileNumber.trim();
        const loginPassword = created.loginPassword || memberForm.password.trim() || 'welcome';
      Alert.alert('सफल', `कार्यकर्ता जोड़ दिया गया। नए उपयोगकर्ता का लॉगिन:\nआईडी: ${loginId}\nपासवर्ड: ${loginPassword}`);
      } else {
        Alert.alert('सफल', memberModalTab === 'assign' ? 'कार्यकर्ता सफलतापूर्वक आवंटित हुआ' : 'कार्यकर्ता सफलतापूर्वक जोड़ दिया गया');
      }

      const selectedIds = selectedPathNodes.map((node) => node.id);
      await loadTree(selectedVersionId, selectedIds, assignableNodes);
      if (membersVisible && membersNode?.id === addTargetNode.id) {
        await loadMembers(addTargetNode, membersPagination.page || 1);
      }
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || 'कार्यकर्ता जोड़ने में विफल');
    } finally {
      setAddingMember(false);
    }
  }, [
    addTargetNode,
    loadMembers,
    loadTree,
    otherInfoForm.genderType,
    otherInfoForm.religion,
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
    assignForm.avatar,
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
      Alert.alert('प्रवेश', 'इस उपयोगकर्ता के लिए कोई आवंटित नोड दायरा नहीं मिला');
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
    setMeetingInviteSearchQuery('');
    setAttendanceBrowseNodeId(defaultNodeId);
    setInvitationBrowseNodeId(defaultNodeId);
    setMeetingInvitePreview([]);
    setShowAttendanceTransferModal(false);
    setShowInvitationTransferModal(false);
    setMeetingLevels(levels.length > 0 ? [{ ...levels[0], selectedNodeId: null }] : []);
    setAttendanceLevels(levels.length > 0 ? [{ ...levels[0], selectedNodeId: null }] : []);
    setInvitationLevels(levels.length > 0 ? [{ ...levels[0], selectedNodeId: null }] : []);
    if (defaultNodeId) {
      await loadNodeMembersForForm(Number(defaultNodeId), selectedVersionId, 'meeting');
      await loadGuestsForNode(Number(defaultNodeId), selectedVersionId, '');
    }
    setShowMeetingModal(true);
  }, [assignableNodes, loadGuestsForNode, loadNodeMembersForForm, selectedVersionId, levels]);

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
          Alert.alert('त्रुटि', 'बैठक विवरण नहीं मिला');
          return;
        }
        const nodeId = String(details.node_id || '');
        setEditingMeetingId(meetingId);
        setMeetingGuestQuery('');
        setMeetingInviteSearchQuery('');
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
                  name: fullName || `उपयोगकर्ता #${invitedUserId}`,
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
        setMeetingLevels(levels.length > 0 ? [{ ...levels[0], selectedNodeId: null }] : []);
        setAttendanceLevels(levels.length > 0 ? [{ ...levels[0], selectedNodeId: null }] : []);
        setInvitationLevels(levels.length > 0 ? [{ ...levels[0], selectedNodeId: null }] : []);
        if (nodeId) {
          await loadNodeMembersForForm(Number(nodeId), selectedVersionId, 'meeting');
          await loadGuestsForNode(Number(nodeId), selectedVersionId, '');
        }
        setShowMeetingModal(true);
      } catch (err: any) {
        Alert.alert('त्रुटि', err?.response?.data?.message || 'बैठक विवरण लोड करने में विफल');
      } finally {
        setMeetingDetailLoading(false);
      }
    },
    [fetchMeetingDetails, loadGuestsForNode, loadNodeMembersForForm, selectedVersionId, levels]
  );

  const handleViewMeetingAttachments = useCallback(
    async (meetingId: number, meetingTitle?: string) => {
      try {
        setMeetingDetailLoading(true);
        const details = await fetchMeetingDetails(meetingId);
        if (!details) {
          Alert.alert('त्रुटि', 'बैठक विवरण नहीं मिला');
          return;
        }
        setMeetingAttachmentTitle(meetingTitle || details.title || 'Meeting Attachments');
        setMeetingAttachmentItems(Array.isArray(details.attachments) ? details.attachments : []);
        setShowMeetingAttachmentModal(true);
      } catch (err: any) {
        Alert.alert('त्रुटि', err?.response?.data?.message || 'संलग्नक लोड करने में विफल');
      } finally {
        setMeetingDetailLoading(false);
      }
    },
    [fetchMeetingDetails]
  );

  const handleViewTaskAttachments = useCallback(
    (taskId: number, taskTitle?: string) => {
      const task = taskRows.find((t) => Number(t.id) === taskId);
      if (!task) return;
      setTaskAttachmentTitle(taskTitle || task.title || 'Task Attachments');
      setTaskAttachmentItems(Array.isArray(task.attachments) ? task.attachments : []);
      setShowTaskAttachmentModal(true);
    },
    [taskRows]
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
      setMeetingInviteSearchQuery('');
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
      setMeetingInviteSearchQuery('');
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
      Alert.alert('प्रवेश', 'इस उपयोगकर्ता के लिए कोई आवंटित नोड दायरा नहीं मिला');
      return;
    }
    const defaultNodeId = String(assignableNodes[0]?.id || '');
    setEditingTaskId(null);
    setEditingTaskAssignees([]);
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
      assignedUserIds: [],
      attachmentInput: '',
      attachments: [],
    });
    setTaskMembers([]);
    if (defaultNodeId) {
      await loadNodeMembersForForm(Number(defaultNodeId), selectedVersionId, 'task');
    }
    setTaskLevels(levels.length > 0 ? [{ ...levels[0], selectedNodeId: null }] : []);
    setTaskMemberSearchQuery('');
    setTaskMemberSearchResults([]);
    setShowTaskModal(true);
  }, [assignableNodes, levels, loadNodeMembersForForm, selectedVersionId]);

  const handleOpenTaskEdit = useCallback(async (taskRow: any) => {
    if (!selectedVersionId) return;
    setEditingTaskId(taskRow.id);
    const assignedIds = taskRow.assignees ? taskRow.assignees.map((a: any) => Number(a.id)).filter(Boolean) : (taskRow.assigned_user_id ? [Number(taskRow.assigned_user_id)] : []);
    const cat = Array.isArray(taskRow.task_categories) && taskRow.task_categories.length > 0 ? taskRow.task_categories[0] : '';
    const sub = Array.isArray(taskRow.task_subcategories) && taskRow.task_subcategories.length > 0 ? taskRow.task_subcategories[0] : '';
    setEditingTaskAssignees(taskRow.assignees || []);
    setTaskForm({
      title: taskRow.title || '',
      description: taskRow.description || '',
      taskDate: taskRow.task_date || toDateInput(),
      dueDate: taskRow.due_date || '',
      status: taskRow.status || 'open',
      hierarchyL1: taskRow.hierarchy_l1 || '',
      hierarchyL2: taskRow.hierarchy_l2 || '',
      hierarchyL3: taskRow.hierarchy_l3 || '',
      hierarchyL4: taskRow.hierarchy_l4 || '',
      hierarchyL5: taskRow.hierarchy_l5 || '',
      hierarchyL5Sublevels: '',
      category: cat,
      subcategory: sub,
      nodeId: String(taskRow.node_id || ''),
      assignedUserId: assignedIds.length > 0 ? String(assignedIds[0]) : '',
      assignedUserIds: assignedIds,
      attachmentInput: '',
      attachments: Array.isArray(taskRow.attachments) ? [...taskRow.attachments] : [],
    });

    const nodeId = Number(taskRow.node_id || 0);
    if (nodeId > 0) {
      await loadNodeMembersForForm(nodeId, selectedVersionId, 'task');
    }
    setTaskLevels(levels.length > 0 ? [{ ...levels[0], selectedNodeId: null }] : []);
    setTaskMemberSearchQuery('');
    setTaskMemberSearchResults([]);
    setShowTaskModal(true);
  }, [selectedVersionId, levels, loadNodeMembersForForm]);

  const handleTaskSelectNode = useCallback(
    async (levelIndex: number, node: KaryakariniNode) => {
      if (!selectedVersionId) return;

      const trimmed = taskLevels.slice(0, levelIndex + 1).map((level, idx) =>
        idx === levelIndex ? { ...level, selectedNodeId: node.id } : level
      );
      setTaskLevels(trimmed);
      setTaskForm((prev) => ({ ...prev, nodeId: String(node.id), assignedUserId: '', assignedUserIds: [] }));
      setTaskMemberSearchResults([]);
      await loadNodeMembersForForm(node.id, selectedVersionId, 'task');

      try {
        const children = await fetchNodes(selectedVersionId, node.id);
        if (!children.length) return;
        setTaskLevels([
          ...trimmed,
          {
            parentNode: node,
            nodes: children,
            selectedNodeId: null,
          },
        ]);
      } catch (err: any) {
        Alert.alert('त्रुटि', err?.response?.data?.message || 'चाइल्ड नोड लोड करने में विफल');
      }
    },
    [fetchNodes, loadNodeMembersForForm, selectedVersionId, taskLevels]
  );

  const handleOpenCreateActivity = useCallback(() => {
    setActivityForm({
      title: '',
      titleOther: false,
      description: '',
      category: '',
      subcategory: '',
      nodeId: '',
      includePopulation: false,
      maleCount: '',
      femaleCount: '',
      childrenCount: '',
      attachmentInput: '',
      attachments: [] as KaryakariniAttachment[],
    });
    setActivityLevels(levels.length > 0 ? [{ ...levels[0], selectedNodeId: null }] : []);
    setShowActivityModal(true);
  }, [levels]);

  const handleActivitySelectNode = useCallback(
    async (levelIndex: number, node: KaryakariniNode) => {
      if (!selectedVersionId) return;

      const trimmed = activityLevels.slice(0, levelIndex + 1).map((level, idx) =>
        idx === levelIndex ? { ...level, selectedNodeId: node.id } : level
      );
      setActivityLevels(trimmed);
      setActivityForm((prev) => ({ ...prev, nodeId: String(node.id) }));

      try {
        const children = await fetchNodes(selectedVersionId, node.id);
        if (!children.length) return;
        setActivityLevels([
          ...trimmed,
          {
            parentNode: node,
            nodes: children,
            selectedNodeId: null,
          },
        ]);
      } catch (err: any) {
        Alert.alert('त्रुटि', err?.response?.data?.message || 'चाइल्ड नोड लोड करने में विफल');
      }
    },
    [fetchNodes, selectedVersionId, activityLevels]
  );

  const handleMeetingSelectNode = useCallback(
    async (levelIndex: number, node: KaryakariniNode) => {
      if (!selectedVersionId) return;
      const trimmed = meetingLevels.slice(0, levelIndex + 1).map((level, idx) =>
        idx === levelIndex ? { ...level, selectedNodeId: node.id } : level
      );
      setMeetingLevels(trimmed);
      setAttendanceLevels(trimmed);
      setInvitationLevels(trimmed);
      setMeetingForm((prev) => ({ ...prev, nodeId: String(node.id) }));
      void handleChangeMeetingNode(String(node.id));

      try {
        const children = await fetchNodes(selectedVersionId, node.id);
        if (!children.length) return;
        const nextLevels = [
          ...trimmed,
          { parentNode: node, nodes: children, selectedNodeId: null },
        ];
        setMeetingLevels(nextLevels);
        setAttendanceLevels(nextLevels);
        setInvitationLevels(nextLevels);
      } catch (err: any) {
        Alert.alert('त्रुटि', err?.response?.data?.message || 'चाइल्ड नोड लोड करने में विफल');
      }
    },
    [fetchNodes, selectedVersionId, meetingLevels, handleChangeMeetingNode]
  );

  const handleAttendanceSelectNode = useCallback(
    async (levelIndex: number, node: KaryakariniNode) => {
      if (!selectedVersionId) return;
      const trimmed = attendanceLevels.slice(0, levelIndex + 1).map((level, idx) =>
        idx === levelIndex ? { ...level, selectedNodeId: node.id } : level
      );
      setAttendanceLevels(trimmed);
      void handleChangeAttendanceBrowseNode(String(node.id));

      try {
        const children = await fetchNodes(selectedVersionId, node.id);
        if (!children.length) return;
        setAttendanceLevels([
          ...trimmed,
          { parentNode: node, nodes: children, selectedNodeId: null },
        ]);
      } catch (err: any) {
        Alert.alert('त्रुटि', err?.response?.data?.message || 'चाइल्ड नोड लोड करने में विफल');
      }
    },
    [fetchNodes, selectedVersionId, attendanceLevels, handleChangeAttendanceBrowseNode]
  );

  const handleInvitationSelectNode = useCallback(
    async (levelIndex: number, node: KaryakariniNode) => {
      if (!selectedVersionId) return;
      const trimmed = invitationLevels.slice(0, levelIndex + 1).map((level, idx) =>
        idx === levelIndex ? { ...level, selectedNodeId: node.id } : level
      );
      setInvitationLevels(trimmed);
      void handleChangeInvitationBrowseNode(String(node.id));

      try {
        const children = await fetchNodes(selectedVersionId, node.id);
        if (!children.length) return;
        setInvitationLevels([
          ...trimmed,
          { parentNode: node, nodes: children, selectedNodeId: null },
        ]);
      } catch (err: any) {
        Alert.alert('त्रुटि', err?.response?.data?.message || 'चाइल्ड नोड लोड करने में विफल');
      }
    },
    [fetchNodes, selectedVersionId, invitationLevels, handleChangeInvitationBrowseNode]
  );


  const handleSubmitActivity = useCallback(async () => {
    if (!selectedVersionId) return;
    const safeNodeId = Number(activityForm.nodeId || 0);
    const safeTitle = String(activityForm.title || '').trim();
    const safeSubcategory = String(activityForm.subcategory || '').trim();
    if (safeNodeId <= 0 || !safeTitle || !safeSubcategory) {
      Alert.alert('सत्यापन', 'कृपया हाइरार्की में नोड चुनें और शीर्षक व टोली भरें।');
      return;
    }

    try {
      setSubmittingActivity(true);
      await karyakariniClient.post('/karyakarini/my/category-activities', {
        versionId: selectedVersionId,
        nodeId: safeNodeId,
        category: activityForm.category ? activityForm.category.trim() : null,
        subcategory: safeSubcategory,
        title: safeTitle,
        description: activityForm.description ? activityForm.description.trim() : null,
        attachments: activityForm.attachments,
        maleCount: activityForm.includePopulation ? Number(activityForm.maleCount) || 0 : 0,
        femaleCount: activityForm.includePopulation ? Number(activityForm.femaleCount) || 0 : 0,
        childrenCount: activityForm.includePopulation ? Number(activityForm.childrenCount) || 0 : 0,
      });

      Alert.alert('सफल', 'कार्यक्रम सफलतापूर्वक जमा हो गई।');
      setShowActivityModal(false);
      await loadCategoryActivities(1);
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || 'कार्यक्रम जमा करने में विफल।');
    } finally {
      setSubmittingActivity(false);
    }
  }, [activityForm, loadCategoryActivities, selectedVersionId]);

  const handleSearchTaskMembers = useCallback(async (queryOverride?: string) => {
    const q = (queryOverride !== undefined ? queryOverride : taskMemberSearchQuery).trim();
    if (q.length < 3) return;
    const nodeId = Number(taskForm.nodeId || 0);
    if (!selectedVersionId || nodeId <= 0) {
      setTaskMemberSearchResults([]);
      return;
    }
    try {
      setTaskMemberSearching(true);
      const response = await karyakariniClient.get('/karyakarini/members/search-users', {
        params: {
          q,
          limit: 20,
          versionId: selectedVersionId,
          nodeId,
        },
      });
      setTaskMemberSearchResults((response?.data?.data?.users || []) as KaryakariniAssignableUser[]);
    } catch (err: any) {
      console.warn('Search task members error:', err?.message);
      setTaskMemberSearchResults([]);
    } finally {
      setTaskMemberSearching(false);
    }
  }, [selectedVersionId, taskForm.nodeId, taskMemberSearchQuery]);

  useEffect(() => {
    const q = taskMemberSearchQuery.trim();
    if (q.length < 3) {
      setTaskMemberSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void handleSearchTaskMembers(q);
    }, 350);
    return () => clearTimeout(timer);
  }, [taskMemberSearchQuery, handleSearchTaskMembers]);

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

  const addActivityAttachmentByUrl = useCallback(() => {
    const url = activityForm.attachmentInput.trim();
    if (!url) return;
    setActivityForm((prev) => ({
      ...prev,
      attachmentInput: '',
      attachments: [...prev.attachments, { url, type: 'document', name: url.split('/').pop() || 'attachment' }],
    }));
  }, [activityForm.attachmentInput]);

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
      Alert.alert('त्रुटि', err?.response?.data?.message || err?.message || 'संलग्नक अपलोड करने में विफल');
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
      Alert.alert('त्रुटि', err?.response?.data?.message || err?.message || 'संलग्नक अपलोड करने में विफल');
    } finally {
      setTaskUploadingAttachment(false);
    }
  }, [pickAndUploadAttachment]);

  const handleCreateMeetingGuest = useCallback(async () => {
    if (!selectedVersionId) return;
    const nodeId = Number(currentAttendanceNodeId || 0);
    if (!nodeId) {
      Alert.alert('आवश्यक', 'पहले नोड चुनें');
      return;
    }
    if (!meetingForm.newGuestName.trim()) {
      Alert.alert('आवश्यक', 'अतिथि नाम आवश्यक है');
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
      Alert.alert('त्रुटि', err?.response?.data?.message || 'अतिथि बनाने में विफल');
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
      Alert.alert('आवश्यक', 'बैठक शीर्षक और नोड आवश्यक हैं');
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
      Alert.alert('सफल', editingMeetingId ? 'बैठक सफलतापूर्वक अपडेट हुई' : 'बैठक सफलतापूर्वक बनाई गई');
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || `बैठक ${editingMeetingId ? 'अपडेट' : 'बनाने'} में विफल`);
    } finally {
      setCreatingMeeting(false);
    }
  }, [editingMeetingId, loadMeetings, meetingForm, selectedVersionId]);

  const handleSubmitTask = useCallback(async () => {
    if (!selectedVersionId) return;
    const nodeId = Number(taskForm.nodeId || 0);
    const isAdminAssignMode = !editingTaskId && ['admin', 'superadmin', 'templeadmin'].includes(currentUserRole);

    if (!nodeId || (!isAdminAssignMode && !taskForm.title.trim())) {
      Alert.alert('आवश्यक', isAdminAssignMode ? 'नोड आवश्यक है' : 'कार्य शीर्षक और नोड आवश्यक हैं');
      return;
    }
    if (currentUserRole !== 'superadmin' && scopeRootNodeIds.has(nodeId)) {
      Alert.alert('प्रतिबंधित', 'आप अपने आवंटित कार्यक्षेत्र से नीचे के चाइल्ड नोड के लिए ही कार्य बना सकते हैं');
      return;
    }
    const taskCategories = parseLabelList(taskForm.category);
    const taskSubcategories = parseLabelList(taskForm.subcategory);
    if (!taskSubcategories.length) {
      Alert.alert('आवश्यक', 'कार्य टोली चयन आवश्यक है');
      return;
    }
    if (isAdminAssignMode && taskForm.assignedUserIds.length === 0) {
      Alert.alert('आवश्यक', 'आवंटन के लिए कम से कम एक उपयोगकर्ता चुनें');
      return;
    }

    try {
      setCreatingTask(true);
      if (isAdminAssignMode) {
        await karyakariniClient.post('/karyakarini/task-assignments', {
          versionId: selectedVersionId,
          nodeId,
          category: taskCategories[0] || null,
          subcategory: taskSubcategories[0] || null,
          categories: taskCategories,
          subcategories: taskSubcategories,
          assignedUserId: taskForm.assignedUserIds[0] || null,
          assignedUserIds: taskForm.assignedUserIds,
        });
        setShowTaskModal(false);
        await loadTasks(selectedVersionId, 1);
        Alert.alert('सफल', 'कार्य उपयोगकर्ता सफलतापूर्वक आवंटित हुए');
        return;
      }

      const payload = {
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
        assignedUserId: taskForm.assignedUserIds.length > 0 ? taskForm.assignedUserIds[0] : (taskForm.assignedUserId ? Number(taskForm.assignedUserId) : null),
        assignedUserIds: taskForm.assignedUserIds,
        attachments: taskForm.attachments,
      };

      if (editingTaskId) {
        await karyakariniClient.put(`/karyakarini/tasks/${editingTaskId}`, payload);
      } else {
        await karyakariniClient.post('/karyakarini/tasks', payload);
      }
      setShowTaskModal(false);
      await loadTasks(selectedVersionId, 1);
      Alert.alert('सफल', editingTaskId ? 'कार्य सफलतापूर्वक अपडेट हुआ' : 'कार्य सफलतापूर्वक बनाया गया');
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || `कार्य ${editingTaskId ? 'अपडेट' : 'बनाने'} में विफल`);
    } finally {
      setCreatingTask(false);
    }
  }, [currentUserRole, editingTaskId, loadTasks, scopeRootNodeIds, selectedVersionId, taskForm]);

  const handleAssignRole = useCallback(async () => {
    if (!selectedVersionId) return;
    const nodeId = Number(selectedRoleNodeId || 0);
    const targetUserId = Number(selectedRoleUserId || 0);
    if (!nodeId || !targetUserId) {
      Alert.alert('आवश्यक', 'एडमिन भूमिका देने के लिए नोड कार्यक्षेत्र, नोड और कार्यकर्ता चुनें');
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
      Alert.alert('सफल', 'एडमिन भूमिका सफलतापूर्वक आवंटित हुई। एडमिन टैब देखने के लिए उपयोगकर्ता पुनः लॉगिन करे।');
      await loadScopes(selectedVersionId);
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || 'एडमिन भूमिका आवंटित करने में विफल');
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
      Alert.alert('संलग्नक', 'यह संलग्नक URL नहीं खोला जा सकता');
        return;
      }
      await Linking.openURL(safeUrl);
    } catch {
      Alert.alert('संलग्नक', 'संलग्नक खोलने में विफल');
    }
  }, []);

  const handleDownloadAttachment = useCallback(async (url?: string | null, fileName?: string | null) => {
    const safeUrl = String(url || '').trim();
    if (!safeUrl) return;
    try {
      if (Platform.OS === 'web') {
        try {
          const response = await fetch(safeUrl);
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = fileName || safeUrl.split('/').pop() || 'download';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(blobUrl);
        } catch {
          const a = document.createElement('a');
          a.href = safeUrl;
          a.download = fileName || safeUrl.split('/').pop() || 'download';
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } else {
        const safeFileName = (fileName || safeUrl.split('/').pop() || 'file').replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const fileUri = `${(FileSystem as any).documentDirectory}${safeFileName}`;
        const downloadResult = await (FileSystem as any).downloadAsync(safeUrl, fileUri);
        if (downloadResult.status === 200) {
          Alert.alert('डाउनलोड पूर्ण', `फाइल यहाँ सहेजी गई: ${downloadResult.uri}`);
        } else {
          Alert.alert('त्रुटि', 'फाइल डाउनलोड करने में विफल');
          Linking.openURL(safeUrl).catch(() => { });
        }
      }
    } catch {
      Alert.alert('त्रुटि', 'फाइल डाउनलोड नहीं हुई। लिंक सीधे खोला जा रहा है।');
      Linking.openURL(safeUrl).catch(() => { });
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.replace('/auth/login' as any);
    } catch {
      Alert.alert('त्रुटि', 'लॉगआउट करने में विफल');
    }
  }, [logout]);

  const isTaskAssignMode = !editingTaskId && ['admin', 'superadmin', 'templeadmin'].includes(currentUserRole);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.helper}>कार्यकारिणी लोड हो रही है...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        user={user}
        onLogout={handleLogout}
        notificationCount={notificationUnreadCount}
      />

      <PageHeaderCard
        title="कार्यकारिणी प्रशासन"
        subtitle="हाइरार्की और कार्यक्रमों का प्रबंधन"
        icon={<MaterialIcons name="admin-panel-settings" size={24} color={theme.colors.primary} />}
      />

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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled={true}
          contentContainerStyle={{ paddingHorizontal: 4 }}
          style={{ marginBottom: 16 }}
        >
          <View style={styles.tabSwitchRow}>
            <TouchableOpacity
              style={[styles.tabSwitchBtn, activeTab === 'tree' && styles.tabSwitchBtnActive]}
              onPress={() => setActiveTab('tree')}
            >
              <Text style={[styles.tabSwitchText, activeTab === 'tree' && styles.tabSwitchTextActive]}>कार्यक्षेत्र</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabSwitchBtn, activeTab === 'members' && styles.tabSwitchBtnActive]}
              onPress={() => setActiveTab('members')}
            >
              <Text style={[styles.tabSwitchText, activeTab === 'members' && styles.tabSwitchTextActive]}>कार्यकर्ता</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabSwitchBtn, activeTab === 'meetings' && styles.tabSwitchBtnActive]}
              onPress={() => setActiveTab('meetings')}
            >
              <Text style={[styles.tabSwitchText, activeTab === 'meetings' && styles.tabSwitchTextActive]}>बैठकें</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabSwitchBtn, activeTab === 'tasks' && styles.tabSwitchBtnActive]}
              onPress={() => setActiveTab('tasks')}
            >
              <Text style={[styles.tabSwitchText, activeTab === 'tasks' && styles.tabSwitchTextActive]}>कार्य</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabSwitchBtn, activeTab === 'activities' && styles.tabSwitchBtnActive]}
              onPress={() => setActiveTab('activities')}
            >
              <Text style={[styles.tabSwitchText, activeTab === 'activities' && styles.tabSwitchTextActive]}>कार्यक्रम</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabSwitchBtn, activeTab === 'jangarna' && styles.tabSwitchBtnActive]}
              onPress={() => setActiveTab('jangarna')}
            >
              <Text style={[styles.tabSwitchText, activeTab === 'jangarna' && styles.tabSwitchTextActive]}>जनगणना</Text>
            </TouchableOpacity>
            {/* <TouchableOpacity
              style={[styles.tabSwitchBtn, activeTab === 'roles' && styles.tabSwitchBtnActive]}
              onPress={() => setActiveTab('roles')}
            >
              <Text style={[styles.tabSwitchText, activeTab === 'roles' && styles.tabSwitchTextActive]}>भूमिकाएँ</Text>
            </TouchableOpacity> */}
          </View>
        </ScrollView>

        {activeTab === 'tree' ? (
          <TreeView
            levels={levels}
            breadcrumb={breadcrumb}
            onSelectNode={(levelIndex, node) => void handleSelectNode(levelIndex, node)}
            onOpenMembers={(node) => void handleOpenMembers(node)}
            onAddMember={handleOpenAddMember}
            canAddMembers={canAddMembers}
          />
        ) : null}

        {activeTab === 'meetings' ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>बैठकें</Text>
              <TouchableOpacity
                style={styles.primaryAction}
                onPress={() => void handleOpenMeetingModal()}
                disabled={!canManageActivities || assignableNodesLoading}
              >
                <Text style={styles.primaryActionText}>बैठक बनाएं</Text>
              </TouchableOpacity>
            </View>
            {!canManageActivities ? <Text style={styles.modalSub}>इस उपयोगकर्ता को कोई नोड दायरा आवंटित नहीं है</Text> : null}
            {taskHierarchyFilterOptions.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>कार्यक्षेत्र 1 के अनुसार फ़िल्टर</Text>
                <View style={styles.optionRow}>
                  <TouchableOpacity
                    style={[styles.optionChip, !taskHierarchyFilterL1 && styles.optionChipActive]}
                    onPress={() => setTaskHierarchyFilterL1('')}
                  >
                    <Text style={[styles.optionChipText, !taskHierarchyFilterL1 && styles.optionChipTextActive]}>सभी</Text>
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
                  <Text style={[styles.tableHeaderCell, styles.colDate]}>दिनांक</Text>
                  <Text style={[styles.tableHeaderCell, styles.colTitle]}>शीर्षक</Text>
                  <Text style={[styles.tableHeaderCell, styles.colNode]}>नोड</Text>
                  <Text style={[styles.tableHeaderCell, styles.colCount]}>उपस्थित</Text>
                  <Text style={[styles.tableHeaderCell, styles.colCount]}>संलग्नक</Text>
                  <Text style={[styles.tableHeaderCell, styles.colAction]}>कार्य</Text>
                </View>
                {meetingsLoading ? (
                  <View style={styles.tableEmpty}>
                    <Text style={styles.helper}>बैठकें लोड हो रही हैं...</Text>
                  </View>
                ) : meetingRows.length === 0 ? (
                  <View style={styles.tableEmpty}>
                    <Text style={styles.helper}>कोई बैठक नहीं मिली</Text>
                  </View>
                ) : (
                  meetingRows.map((row, index) => (
                    <View key={`meeting-${row.id}`} style={[styles.tableRow, index % 2 === 1 && styles.tableRowEven]}>
                      <Text style={[styles.tableCell, styles.colDate]}>{displayValue(row.meeting_date)}</Text>
                      <Text style={[styles.tableCell, styles.colTitle]} numberOfLines={2}>{row.title}</Text>
                      <Text style={[styles.tableCell, styles.colNode]} numberOfLines={2}>{displayValue(row.hierarchy_path || row.node_name)}</Text>
                      <View style={[styles.tableCell, styles.colCount, { alignItems: 'center' }]}>
                        <Text style={styles.tableCellTextCompact}>{Number(row.attendee_count || 0)}</Text>
                      </View>
                      <View style={[styles.tableCell, styles.colCount, { alignItems: 'center' }]}>
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
                          <Text style={styles.rowActionText}>संपादित करें</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
            <Text style={styles.tableMeta}>
              पृष्ठ {meetingPagination.page} / {Math.max(1, meetingPagination.totalPages || 1)} • कुल {meetingPagination.total}
            </Text>
          </View>
        ) : null}

        {activeTab === 'tasks' ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>कार्य</Text>
              <TouchableOpacity
                style={styles.primaryAction}
                onPress={() => void handleOpenTaskModal()}
                disabled={!canManageActivities || assignableNodesLoading}
              >
                <Text style={styles.primaryActionText}>कार्य बनाएं</Text>
              </TouchableOpacity>
            </View>
            {!canManageActivities ? <Text style={styles.modalSub}>इस उपयोगकर्ता को कोई नोड दायरा आवंटित नहीं है</Text> : null}

            <View style={styles.filterGrid}>
              {/* कार्यक्षेत्र Cascading Selector */}
              <View style={[styles.filterCol, { flex: 2, minWidth: 200 }]}>
                <Text style={styles.sectionLabel}>कार्यक्षेत्र</Text>
                <SingleCascaderPicker
                  levels={taskBrowseLevels}
                  onSelectLevelNode={(levelIndex, node) => void handleTaskNodeSelect(levelIndex, node)}
                  title="कार्यक्षेत्र चुनें"
                  placeholder="राज्य / जिला / तहसील / गांव चुनें"
                  selectedValue={
                    taskBrowseLevels[taskBrowseLevels.length - 1]?.selectedNodeId
                      ? String(taskBrowseLevels[taskBrowseLevels.length - 1]?.selectedNodeId)
                      : null
                  }
                  compact={true}
                  allNodes={assignableNodes}
                  onClear={() => {
                    if (taskBrowseLevels.length > 0) {
                      const rootNodes = taskBrowseLevels[0]?.nodes || [];
                      setTaskBrowseLevels([{ parentNode: null, nodes: rootNodes, selectedNodeId: null }]);
                      setTaskBrowseNodeId('');
                      if (selectedVersionId) {
                        void loadTasks(selectedVersionId, 1, '', undefined, undefined);
                      }
                    }
                  }}
                />
              </View>

              {/* आयाम Dropdown Selector */}
              <View style={styles.filterCol}>
                <Text style={styles.sectionLabel}>आयाम</Text>
                <TouchableOpacity
                  style={[styles.inputCompact, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minWidth: 100 }]}
                  onPress={() => {
                    const options = categoryTree.map(item => ({ label: item.category, value: item.category }));
                    setSearchPickerTitle('आयाम चुनें');
                    setSearchPickerOptions(options);
                    setSearchPickerSearchText('');
                    setOnSearchPickerSelect(() => (val: string) => {
                      setTaskFilterCategory(val);
                      setTaskFilterSubcategory('');
                    });
                    setSearchPickerVisible(true);
                  }}
                >
                  <Text style={{ fontSize: 12, color: taskFilterCategory ? theme.colors.text.primary : '#94A3B8', marginRight: 4 }}>
                    {taskFilterCategory || 'आयाम चुनें'}
                  </Text>
                  <MaterialIcons name="arrow-drop-down" size={16} color={theme.colors.text.secondary} />
                </TouchableOpacity>
              </View>

              {/* टोली Dropdown Selector */}
              <View style={styles.filterCol}>
                <Text style={styles.sectionLabel}>टोली</Text>
                <TouchableOpacity
                  style={[styles.inputCompact, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minWidth: 100 }]}
                  onPress={() => {
                    let subList: string[] = [];
                    if (taskFilterCategory) {
                      subList = categoryTree.find(item => item.category === taskFilterCategory)?.subcategories || [];
                    } else {
                      subList = Array.from(new Set(categoryTree.flatMap(item => item.subcategories)));
                    }
                    const options = subList.map(sub => ({ label: sub, value: sub }));
                    setSearchPickerTitle('टोली चुनें');
                    setSearchPickerOptions(options);
                    setSearchPickerSearchText('');
                    setOnSearchPickerSelect(() => (val: string) => {
                      setTaskFilterSubcategory(val);
                    });
                    setSearchPickerVisible(true);
                  }}
                >
                  <Text style={{ fontSize: 12, color: taskFilterSubcategory ? theme.colors.text.primary : '#94A3B8', marginRight: 4 }}>
                    {taskFilterSubcategory || 'टोली चुनें'}
                  </Text>
                  <MaterialIcons name="arrow-drop-down" size={16} color={theme.colors.text.secondary} />
                </TouchableOpacity>
              </View>

              {(taskFilterCategory || taskFilterSubcategory || taskBrowseNodeId) ? (
                <TouchableOpacity
                  style={[styles.filterApplyBtn, { backgroundColor: '#EF4444', marginRight: 8 }]}
                  onPress={() => {
                    setTaskFilterCategory('');
                    setTaskFilterSubcategory('');
                    if (taskBrowseLevels.length > 0) {
                      const rootNodes = taskBrowseLevels[0]?.nodes || [];
                      setTaskBrowseLevels([{ parentNode: null, nodes: rootNodes, selectedNodeId: null }]);
                    }
                    setTaskBrowseNodeId('');
                    if (selectedVersionId) {
                      void loadTasks(selectedVersionId, 1, '', '', '');
                    }
                  }}
                >
                  <MaterialIcons name="clear" size={18} color="#fff" />
                  <Text style={styles.filterApplyText}>साफ़ करें</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {taskHierarchyFilterOptions.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>कार्यक्षेत्र 1 के अनुसार फ़िल्टर</Text>
                <View style={styles.optionRow}>
                  <TouchableOpacity
                    style={[styles.optionChip, !taskHierarchyFilterL1 && styles.optionChipActive]}
                    onPress={() => setTaskHierarchyFilterL1('')}
                  >
                    <Text style={[styles.optionChipText, !taskHierarchyFilterL1 && styles.optionChipTextActive]}>सभी</Text>
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
                  <Text style={[styles.tableHeaderCell, styles.colDate]}>दिनांक</Text>
                  <Text style={[styles.tableHeaderCell, styles.colTitle]}>शीर्षक</Text>
                  <Text style={[styles.tableHeaderCell, styles.colNode]}>नोड</Text>
                  <Text style={[styles.tableHeaderCell, styles.colCat]}>आयाम</Text>
                  <Text style={[styles.tableHeaderCell, styles.colSubcat]}>टोली</Text>
                  <Text style={[styles.tableHeaderCell, styles.colAssignee]}>असाइनी</Text>
                  <Text style={[styles.tableHeaderCell, styles.colStatus]}>स्थिति</Text>
                  <Text style={[styles.tableHeaderCell, styles.colCount]}>संलग्नक</Text>
                  <Text style={[styles.tableHeaderCell, styles.colAction]}>कार्य</Text>
                </View>
                {tasksLoading ? (
                  <View style={styles.tableEmpty}>
                    <Text style={styles.helper}>कार्य लोड हो रहे हैं...</Text>
                  </View>
                ) : filteredTaskRows.length === 0 ? (
                  <View style={styles.tableEmpty}>
                    <Text style={styles.helper}>कोई कार्य नहीं मिला</Text>
                  </View>
                ) : (
                  filteredTaskRows.map((row, index) => (
                    <View key={`task-${row.id}`} style={[styles.tableRow, index % 2 === 1 && styles.tableRowEven]}>
                      <Text style={[styles.tableCell, styles.colDate]}>{displayValue(row.task_date)}</Text>
                      <View style={[styles.tableCell, styles.colTitle]}>
                        <Text style={styles.tableCellTextCompact} numberOfLines={2}>{row.title}</Text>
                        {summarizeTaskHierarchy(row) ? (
                          <Text style={styles.tableCellSubText} numberOfLines={1}>
                            {summarizeTaskHierarchy(row)}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[styles.tableCell, styles.colNode]} numberOfLines={2}>{displayValue(row.hierarchy_path || row.node_name)}</Text>
                      <View style={[styles.tableCell, styles.colCat, { justifyContent: 'center' }]}>
                        <View style={styles.tabPillsWrap}>
                          {(row.task_categories || []).slice(0, 2).map((entry) => (
                            <View key={`task-cat-${row.id}-${entry}`} style={styles.tabPill}>
                              <Text style={styles.tabPillText} numberOfLines={1}>{entry}</Text>
                            </View>
                          ))}
                          {(row.task_categories || []).length > 2 ? (
                            <View style={[styles.tabPill, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}>
                              <Text style={[styles.tabPillText, { color: '#FFF' }]}>+{(row.task_categories || []).length - 2} और</Text>
                            </View>
                          ) : null}
                          {(row.task_categories || []).length === 0 ? <Text style={styles.tabPillEmptyText}>{NOT_AVAILABLE}</Text> : null}
                        </View>
                      </View>
                      <View style={[styles.tableCell, styles.colSubcat, { justifyContent: 'center' }]}>
                        <View style={styles.tabPillsWrap}>
                          {(row.task_subcategories || []).slice(0, 2).map((entry) => (
                            <View key={`task-sub-${row.id}-${entry}`} style={styles.tabPill}>
                              <Text style={styles.tabPillText} numberOfLines={1}>{entry}</Text>
                            </View>
                          ))}
                          {(row.task_subcategories || []).length > 2 ? (
                            <View style={[styles.tabPill, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}>
                              <Text style={[styles.tabPillText, { color: '#FFF' }]}>+{(row.task_subcategories || []).length - 2} और</Text>
                            </View>
                          ) : null}
                          {(row.task_subcategories || []).length === 0 ? <Text style={styles.tabPillEmptyText}>{NOT_AVAILABLE}</Text> : null}
                        </View>
                      </View>
                      <View style={[styles.tableCell, styles.colAssignee, { justifyContent: 'center' }]}>
                        {row.assignees && row.assignees.length > 0 ? (
                          <TouchableOpacity
                            onPress={() => {
                              setSelectedTaskForAssignees(row);
                              setShowAssigneesModal(true);
                            }}
                          >
                            <Text style={styles.linkText} numberOfLines={2}>
                              👥 {summarizeAssignedUser(row)}
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.tableCellTextCompact} numberOfLines={2}>
                            {summarizeAssignedUser(row)}
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.tableCell, styles.colStatus]}>{String(row.status || 'open')}</Text>
                      <View style={[styles.tableCell, styles.colCount, { alignItems: 'center' }]}>
                        {Array.isArray(row.attachments) && row.attachments.length > 0 ? (
                          <TouchableOpacity onPress={() => handleViewTaskAttachments(Number(row.id), row.title)}>
                            <Text style={styles.linkText}>📎 {row.attachments.length}</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.tableCellTextCompact}>0</Text>
                        )}
                      </View>
                      <View style={[styles.tableCell, styles.colAction]}>
                        <TouchableOpacity
                          style={styles.rowActionBtn}
                          onPress={() => void handleOpenTaskEdit(row)}
                        >
                          <Text style={styles.rowActionText}>संपादित करें</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
            <Text style={styles.tableMeta}>
              पृष्ठ {taskPagination.page} / {Math.max(1, taskPagination.totalPages || 1)} • कुल {taskPagination.total}
            </Text>
            <View style={[styles.optionRow, { justifyContent: 'flex-end', marginTop: 10 }]}>
              <TouchableOpacity
                style={[styles.rowActionBtn, tasksLoading || taskPagination.page <= 1 ? styles.saveBtnDisabled : null]}
                disabled={tasksLoading || taskPagination.page <= 1}
                onPress={() => selectedVersionId && void loadTasks(selectedVersionId, Math.max(1, (taskPagination.page || 1) - 1))}
              >
                <Text style={styles.rowActionText}>पिछला</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rowActionBtn, tasksLoading || taskPagination.page >= Math.max(1, taskPagination.totalPages || 1) ? styles.saveBtnDisabled : null]}
                disabled={tasksLoading || taskPagination.page >= Math.max(1, taskPagination.totalPages || 1)}
                onPress={() => selectedVersionId && void loadTasks(selectedVersionId, (taskPagination.page || 1) + 1)}
              >
                <Text style={styles.rowActionText}>अगला</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {activeTab === 'members' ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>कार्यकर्ता</Text>
            </View>
            {!canManageActivities ? <Text style={styles.modalSub}>इस उपयोगकर्ता को कोई नोड दायरा आवंटित नहीं है</Text> : null}
            <View style={styles.filterGrid}>
              {/* पाथ कार्यक्षेत्र Cascading Selector */}
              <View style={[styles.filterCol, { flex: 2, minWidth: 200 }]}>
                <Text style={styles.sectionLabel}>कार्यक्षेत्र</Text>
                <SingleCascaderPicker
                  levels={memberLevels}
                  onSelectLevelNode={(levelIndex, node) => void handleMemberNodeSelect(levelIndex, node)}
                  title="कार्यक्षेत्र चुनें"
                  placeholder="राज्य / जिला / तहसील / गांव चुनें"
                  selectedValue={
                    memberLevels[memberLevels.length - 1]?.selectedNodeId
                      ? String(memberLevels[memberLevels.length - 1]?.selectedNodeId)
                      : null
                  }
                  compact={true}
                  allNodes={assignableNodes}
                  onClear={() => {
                    if (memberLevels.length > 0) {
                      const rootNodes = memberLevels[0]?.nodes || [];
                      setMemberLevels([{ parentNode: null, nodes: rootNodes, selectedNodeId: null }]);
                      const firstNode = rootNodes[0] || null;
                      setMembersNode(firstNode);
                      setMemberBrowseNodeId(firstNode ? String(firstNode.id) : '');
                      if (firstNode) {
                        void loadMembers(firstNode, 1, null, memberFilterCategory, memberFilterSubcategory);
                      }
                    }
                  }}
                />
              </View>

              {/* आयाम Dropdown Selector */}
              <View style={styles.filterCol}>
                <Text style={styles.sectionLabel}>आयाम</Text>
                <TouchableOpacity
                  style={[styles.inputCompact, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minWidth: 100 }]}
                  onPress={() => {
                    const options = categoryTree.map(item => ({ label: item.category, value: item.category }));
                    setSearchPickerTitle('आयाम चुनें');
                    setSearchPickerOptions(options);
                    setSearchPickerSearchText('');
                    setOnSearchPickerSelect(() => (val: string) => {
                      setMemberFilterCategory(val);
                      setMemberFilterSubcategory('');
                    });
                    setSearchPickerVisible(true);
                  }}
                >
                  <Text style={{ fontSize: 12, color: memberFilterCategory ? theme.colors.text.primary : '#94A3B8', marginRight: 4 }}>
                    {memberFilterCategory || 'आयाम चुनें'}
                  </Text>
                  <MaterialIcons name="arrow-drop-down" size={16} color={theme.colors.text.secondary} />
                </TouchableOpacity>
              </View>

              {/* टोली Dropdown Selector */}
              <View style={styles.filterCol}>
                <Text style={styles.sectionLabel}>टोली</Text>
                <TouchableOpacity
                  style={[styles.inputCompact, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minWidth: 100 }]}
                  onPress={() => {
                    let subList: string[] = [];
                    if (memberFilterCategory) {
                      subList = categoryTree.find(item => item.category === memberFilterCategory)?.subcategories || [];
                    } else {
                      subList = Array.from(new Set(categoryTree.flatMap(item => item.subcategories)));
                    }
                    const options = subList.map(sub => ({ label: sub, value: sub }));
                    setSearchPickerTitle('टोली चुनें');
                    setSearchPickerOptions(options);
                    setSearchPickerSearchText('');
                    setOnSearchPickerSelect(() => (val: string) => {
                      setMemberFilterSubcategory(val);
                    });
                    setSearchPickerVisible(true);
                  }}
                >
                  <Text style={{ fontSize: 12, color: memberFilterSubcategory ? theme.colors.text.primary : '#94A3B8', marginRight: 4 }}>
                    {memberFilterSubcategory || 'टोली चुनें'}
                  </Text>
                  <MaterialIcons name="arrow-drop-down" size={16} color={theme.colors.text.secondary} />
                </TouchableOpacity>
              </View>

              {/* साफ करें Button */}
              <TouchableOpacity
                style={styles.filterApplyBtn}
                onPress={() => {
                  setMemberFilterCategory('');
                  setMemberFilterSubcategory('');
                  if (memberLevels.length > 0) {
                    const rootNodes = memberLevels[0]?.nodes || [];
                    setMemberLevels([{ parentNode: null, nodes: rootNodes, selectedNodeId: null }]);
                  }
                  setMemberBrowseNodeId('');
                  setMembersNode(null);
                  const scopeMemberNodes = memberLevels[0]?.nodes || [];
                  void loadMembersForScopeNodes(scopeMemberNodes);
                }}
              >
                <MaterialIcons name="close" size={18} color="#fff" />
                <Text style={styles.filterApplyText}>साफ करें</Text>
              </TouchableOpacity>
            </View>

            {membersLoading ? (
              <View style={styles.tableEmpty}>
                <Text style={styles.helper}>कार्यकर्ता लोड हो रहे हैं...</Text>
              </View>
            ) : groupedMembersForTab.length === 0 ? (
              <View style={styles.tableEmpty}>
                <Text style={styles.helper}>चुने गए फ़िल्टर के लिए कोई कार्यकर्ता नहीं मिला</Text>
              </View>
            ) : (
              groupedMembersForTab.map((group) => (
                <View key={`member-group-${group.key}`} style={[styles.card, { marginTop: 10 }]}>
                  <Text style={styles.cardTitle}>{group.locationName}</Text>
                  <Text style={styles.cardMeta}>{group.path}</Text>
                  {group.padGroups.map((padGroup) => (
                    <View key={`pad-group-${group.key}-${padGroup.pad}`} style={{ marginTop: 8, gap: 8 }}>
                      <Text style={[styles.sectionLabel, { color: theme.colors.primary }]}>{padGroup.pad}</Text>
                      <View style={styles.memberTableContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator style={styles.memberTableDataWrap}>
                          <View>
                            <View style={styles.memberTableHeaderRow}>
                              <Text style={[styles.memberTableHeaderCell, styles.memberColPhoto]}>फोटो</Text>
                              <Text style={[styles.memberTableHeaderCell, styles.memberColName]}>नाम</Text>
                              <Text style={[styles.memberTableHeaderCell, styles.memberColLevel]}>कार्यक्षेत्र</Text>
                              <Text style={[styles.memberTableHeaderCell, styles.memberColCategory]}>आयाम</Text>
                              <Text style={[styles.memberTableHeaderCell, styles.memberColSubcategory]}>टोली</Text>
                              <Text style={[styles.memberTableHeaderCell, styles.memberColMobile]}>मोबाइल</Text>
                              <Text style={[styles.memberTableHeaderCell, styles.memberColGotra]}>गोत्र</Text>
                              <Text style={[styles.memberTableHeaderCell, styles.memberColVillage]}>गांव</Text>
                              <Text style={[styles.memberTableHeaderCell, styles.memberColPeriod]}>अवधि</Text>
                              <Text style={[styles.memberTableHeaderCell, styles.memberColPath]}>पाथ</Text>
                            </View>
                            {padGroup.rows.map((member, index) => {
                              const categoriesList = parseLabelList(
                                member.categories && member.categories.length ? member.categories : member.category || ''
                              );
                              const subcategoriesList = parseLabelList(
                                member.subcategories && member.subcategories.length ? member.subcategories : member.subcategory || ''
                              );
                              return (
                                <View key={`member-table-row-${member.id}`} style={[styles.memberTableRow, index % 2 === 1 && styles.memberTableRowEven]}>
                                  <View style={[styles.memberTableCell, styles.memberColPhoto, styles.memberPhotoCell]}>
                                    {sanitizeInputValue(member.avatar) ? (
                                      <Image source={{ uri: sanitizeInputValue(member.avatar) }} style={styles.memberTableAvatar} />
                                    ) : (
                                      <View style={styles.memberTableAvatarFallback}>
                                        <Text style={styles.memberTableAvatarFallbackText}>{getInitials(memberName(member))}</Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text style={[styles.memberTableCell, styles.memberColName]} numberOfLines={2}>{displayValue(memberName(member))}</Text>
                                  <Text style={[styles.memberTableCell, styles.memberColLevel]} numberOfLines={2}>{displayValue(formatNodeLevelLabel(member.node_level))}</Text>
                                  <View style={[styles.memberTableCell, styles.memberColCategory, { justifyContent: 'center' }]}>
                                    <View style={styles.tabPillsWrap}>
                                      {categoriesList.slice(0, 2).map((entry) => (
                                        <View key={`cat-${member.id}-${entry}`} style={styles.tabPill}>
                                          <Text style={styles.tabPillText} numberOfLines={1}>{entry}</Text>
                                        </View>
                                      ))}
                                      {categoriesList.length > 2 ? (
                                        <TouchableOpacity
                                          style={[styles.tabPill, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}
                                          onPress={() => {
                                            setPillsModalMember(member);
                                            setPillsModalVisible(true);
                                          }}
                                        >
                                          <Text style={[styles.tabPillText, { color: '#FFF' }]}>+{categoriesList.length - 2} और</Text>
                                        </TouchableOpacity>
                                      ) : null}
                                      {categoriesList.length === 0 ? <Text style={styles.tabPillEmptyText}>{NOT_AVAILABLE}</Text> : null}
                                    </View>
                                  </View>
                                  <View style={[styles.memberTableCell, styles.memberColSubcategory, { justifyContent: 'center' }]}>
                                    <View style={styles.tabPillsWrap}>
                                      {subcategoriesList.slice(0, 2).map((entry) => (
                                        <View key={`sub-${member.id}-${entry}`} style={styles.tabPill}>
                                          <Text style={styles.tabPillText} numberOfLines={1}>{entry}</Text>
                                        </View>
                                      ))}
                                      {subcategoriesList.length > 2 ? (
                                        <TouchableOpacity
                                          style={[styles.tabPill, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}
                                          onPress={() => {
                                            setPillsModalMember(member);
                                            setPillsModalVisible(true);
                                          }}
                                        >
                                          <Text style={[styles.tabPillText, { color: '#FFF' }]}>+{subcategoriesList.length - 2} और</Text>
                                        </TouchableOpacity>
                                      ) : null}
                                      {subcategoriesList.length === 0 ? <Text style={styles.tabPillEmptyText}>{NOT_AVAILABLE}</Text> : null}
                                    </View>
                                  </View>
                                  <Text style={[styles.memberTableCell, styles.memberColMobile]} numberOfLines={2}>{displayValue(member.mobile_number)}</Text>
                                  <Text style={[styles.memberTableCell, styles.memberColGotra]} numberOfLines={2}>{displayValue(member.gotra)}</Text>
                                  <Text style={[styles.memberTableCell, styles.memberColVillage]} numberOfLines={2}>{displayValue(member.village)}</Text>
                                  <Text style={[styles.memberTableCell, styles.memberColPeriod]} numberOfLines={2}>{displayValue(memberPeriod(member))}</Text>
                                  <Text style={[styles.memberTableCell, styles.memberColPath]} numberOfLines={2}>{displayValue(member.hierarchy_path)}</Text>
                                </View>
                              );
                            })}
                          </View>
                        </ScrollView>
                        <View style={styles.memberStickyEditColumn}>
                          <View style={styles.memberStickyEditHeader}>
                            <Text style={styles.memberStickyEditHeaderText}>संपादित</Text>
                          </View>
                          {padGroup.rows.map((member, index) => (
                            <View key={`member-edit-cell-${member.id}`} style={[styles.memberStickyEditCell, index % 2 === 1 && styles.memberTableRowEven]}>
                              <TouchableOpacity style={styles.rowActionBtn} onPress={() => handleOpenEditMember(member)}>
                                <Text style={styles.rowActionText}>संपादित करें</Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              ))
            )}
            <Text style={styles.tableMeta}>
              पृष्ठ {membersPagination.page} / {Math.max(1, membersPagination.totalPages || 1)} • कुल {membersPagination.total}
            </Text>
            <View style={[styles.optionRow, { justifyContent: 'flex-end' }]}>
              <TouchableOpacity
                style={[styles.rowActionBtn, membersLoading || membersPagination.page <= 1 ? styles.saveBtnDisabled : null]}
                disabled={membersLoading || membersPagination.page <= 1 || !membersNode}
                onPress={() => membersNode && void loadMembers(membersNode, Math.max(1, (membersPagination.page || 1) - 1))}
              >
                <Text style={styles.rowActionText}>पिछला</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rowActionBtn, membersLoading || membersPagination.page >= Math.max(1, membersPagination.totalPages || 1) ? styles.saveBtnDisabled : null]}
                disabled={membersLoading || membersPagination.page >= Math.max(1, membersPagination.totalPages || 1) || !membersNode}
                onPress={() => membersNode && void loadMembers(membersNode, (membersPagination.page || 1) + 1)}
              >
                <Text style={styles.rowActionText}>अगला</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {activeTab === 'activities' ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>कार्यक्रम</Text>
              <TouchableOpacity
                style={styles.primaryAction}
                onPress={() => handleOpenCreateActivity()}
                disabled={!canManageActivities || assignableNodesLoading}
              >
                <Text style={styles.primaryActionText}>कार्यक्रम बनाएं</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filterGrid}>
              {/* कार्यक्षेत्र Cascading Selector */}
              <View style={[styles.filterCol, { flex: 2, minWidth: 200 }]}>
                <Text style={styles.sectionLabel}>कार्यक्षेत्र</Text>
                <SingleCascaderPicker
                  levels={activityBrowseLevels}
                  onSelectLevelNode={(levelIndex, node) => void handleActivityNodeSelect(levelIndex, node)}
                  title="कार्यक्षेत्र चुनें"
                  placeholder="राज्य / जिला / तहसील / गांव चुनें"
                  selectedValue={
                    activityBrowseLevels[activityBrowseLevels.length - 1]?.selectedNodeId
                      ? String(activityBrowseLevels[activityBrowseLevels.length - 1]?.selectedNodeId)
                      : null
                  }
                  compact={true}
                  allNodes={assignableNodes}
                  onClear={() => {
                    if (activityBrowseLevels.length > 0) {
                      const rootNodes = activityBrowseLevels[0]?.nodes || [];
                      setActivityBrowseLevels([{ parentNode: null, nodes: rootNodes, selectedNodeId: null }]);
                      setActivityBrowseNodeId('');
                      if (selectedVersionId) {
                        void loadCategoryActivities(selectedVersionId, 1, '', undefined, undefined);
                      }
                    }
                  }}
                />
              </View>

              {/* आयाम Dropdown Selector */}
              <View style={styles.filterCol}>
                <Text style={styles.sectionLabel}>आयाम</Text>
                <TouchableOpacity
                  style={[styles.inputCompact, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minWidth: 100 }]}
                  onPress={() => {
                    const options = categoryTree.map(item => ({ label: item.category, value: item.category }));
                    setSearchPickerTitle('आयाम चुनें');
                    setSearchPickerOptions(options);
                    setSearchPickerSearchText('');
                    setOnSearchPickerSelect(() => (val: string) => {
                      setActivityFilterCategory(val);
                      setActivityFilterSubcategory('');
                    });
                    setSearchPickerVisible(true);
                  }}
                >
                  <Text style={{ fontSize: 12, color: activityFilterCategory ? theme.colors.text.primary : '#94A3B8', marginRight: 4 }}>
                    {activityFilterCategory || 'आयाम चुनें'}
                  </Text>
                  <MaterialIcons name="arrow-drop-down" size={16} color={theme.colors.text.secondary} />
                </TouchableOpacity>
              </View>

              {/* टोली Dropdown Selector */}
              <View style={styles.filterCol}>
                <Text style={styles.sectionLabel}>टोली</Text>
                <TouchableOpacity
                  style={[styles.inputCompact, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minWidth: 100 }]}
                  onPress={() => {
                    let subList: string[] = [];
                    if (activityFilterCategory) {
                      subList = categoryTree.find(item => item.category === activityFilterCategory)?.subcategories || [];
                    } else {
                      subList = Array.from(new Set(categoryTree.flatMap(item => item.subcategories)));
                    }
                    const options = subList.map(sub => ({ label: sub, value: sub }));
                    setSearchPickerTitle('टोली चुनें');
                    setSearchPickerOptions(options);
                    setSearchPickerSearchText('');
                    setOnSearchPickerSelect(() => (val: string) => {
                      setActivityFilterSubcategory(val);
                    });
                    setSearchPickerVisible(true);
                  }}
                >
                  <Text style={{ fontSize: 12, color: activityFilterSubcategory ? theme.colors.text.primary : '#94A3B8', marginRight: 4 }}>
                    {activityFilterSubcategory || 'टोली चुनें'}
                  </Text>
                  <MaterialIcons name="arrow-drop-down" size={16} color={theme.colors.text.secondary} />
                </TouchableOpacity>
              </View>

              {(activityFilterCategory || activityFilterSubcategory || activityBrowseNodeId) ? (
                <TouchableOpacity
                  style={[styles.filterApplyBtn, { backgroundColor: '#EF4444', marginRight: 8 }]}
                  onPress={() => {
                    setActivityFilterCategory('');
                    setActivityFilterSubcategory('');
                    if (activityBrowseLevels.length > 0) {
                      const rootNodes = activityBrowseLevels[0]?.nodes || [];
                      setActivityBrowseLevels([{ parentNode: null, nodes: rootNodes, selectedNodeId: null }]);
                    }
                    setActivityBrowseNodeId('');
                    if (selectedVersionId) {
                      void loadCategoryActivities(selectedVersionId, 1, '', '', '');
                    }
                  }}
                >
                  <MaterialIcons name="clear" size={18} color="#fff" />
                  <Text style={styles.filterApplyText}>साफ़ करें</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableWrap}>
              <View>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.colDate]}>दिनांक</Text>
                  <Text style={[styles.tableHeaderCell, styles.colTitle]}>शीर्षक</Text>
                  <Text style={[styles.tableHeaderCell, styles.colNode]}>नोड</Text>
                  <Text style={[styles.tableHeaderCell, styles.colCat]}>आयाम</Text>
                  <Text style={[styles.tableHeaderCell, styles.colSubcat]}>टोली</Text>
                  <Text style={[styles.tableHeaderCell, styles.colBy]}>द्वारा</Text>
                  <Text style={[styles.tableHeaderCell, styles.colAction]}>कार्य</Text>
                </View>
                {activitiesLoading ? (
                  <View style={styles.tableEmpty}>
                    <Text style={styles.helper}>कार्यक्रम लोड हो रहे हैं...</Text>
                  </View>
                ) : activityRows.length === 0 ? (
                  <View style={styles.tableEmpty}>
                    <Text style={styles.helper}>कोई कार्यक्रम नहीं मिला</Text>
                  </View>
                ) : (
                  activityRows.map((row, index) => (
                    <View key={`activity-${row.id}`} style={[styles.tableRow, index % 2 === 1 && styles.tableRowEven]}>
                      <Text style={[styles.tableCell, styles.colDate]}>{displayValue(String(row.created_at || '').slice(0, 10))}</Text>
                      <View style={[styles.tableCell, styles.colTitle]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 2 }}>
                          <Text style={[styles.tableCellTextCompact, { flexShrink: 0 }]}>शीर्षक:</Text>
                          {String(row.title || '').trim() ? (
                            <View style={{ backgroundColor: theme.colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1, maxWidth: '100%' }}>
                              <MaterialIcons name="event-available" size={12} color="#fff" />
                              <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff', flexShrink: 1 }} numberOfLines={2}>{row.title}</Text>
                            </View>
                          ) : (
                            <Text style={[styles.tableCellTextCompact, { flexShrink: 1 }]} numberOfLines={2}>{displayValue(row.title)}</Text>
                          )}
                        </View>
                        {row.description ? <Text style={styles.tableCellSubText} numberOfLines={2}>{row.description}</Text> : null}
                        {(row.male_count || row.female_count || row.children_count) ? (
                          <Text style={[styles.tableCellSubText, { color: theme.colors.primary, fontWeight: '600', marginTop: 4 }]}>
                            👥 कुल जनसंख्या: {(Number(row.male_count || 0) + Number(row.female_count || 0) + Number(row.children_count || 0))} (पु: {row.male_count || 0}, म: {row.female_count || 0}, ब: {row.children_count || 0})
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[styles.tableCell, styles.colNode]} numberOfLines={2}>{displayValue(row.hierarchy_path || row.node_name)}</Text>
                      <View style={[styles.tableCell, styles.colCat, { justifyContent: 'center' }]}>
                        <View style={styles.tabPillsWrap}>
                          {row.category ? (
                            <View style={styles.tabPill}>
                              <Text style={styles.tabPillText} numberOfLines={1}>{row.category}</Text>
                            </View>
                          ) : (
                            <Text style={styles.tabPillEmptyText}>{NOT_AVAILABLE}</Text>
                          )}
                        </View>
                      </View>
                      <View style={[styles.tableCell, styles.colSubcat, { justifyContent: 'center' }]}>
                        <View style={styles.tabPillsWrap}>
                          {row.subcategory ? (
                            <View style={styles.tabPill}>
                              <Text style={styles.tabPillText} numberOfLines={1}>{row.subcategory}</Text>
                            </View>
                          ) : (
                            <Text style={styles.tabPillEmptyText}>{NOT_AVAILABLE}</Text>
                          )}
                        </View>
                      </View>
                      <View style={[styles.tableCell, styles.colBy, styles.byCellWrap]}>
                        {sanitizeInputValue(row.submitted_by_avatar) ? (
                          <Image source={{ uri: sanitizeInputValue(row.submitted_by_avatar) }} style={styles.byAvatar} />
                        ) : (
                          <View style={styles.byAvatarFallback}>
                            <Text style={styles.byAvatarFallbackText}>{getInitials(row.submitted_by_name || '')}</Text>
                          </View>
                        )}
                        <Text style={styles.tableCellTextCompact} numberOfLines={2}>{displayValue(row.submitted_by_name)}</Text>
                      </View>
                      <View style={[styles.tableCell, styles.colAction]}>
                        <TouchableOpacity style={styles.rowActionBtn} onPress={() => setSelectedActivityDetails(row)}>
                          <Text style={styles.rowActionText}>देखें</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
            <Text style={styles.tableMeta}>
              पृष्ठ {activityPagination.page} / {Math.max(1, activityPagination.totalPages || 1)} • कुल {activityPagination.total}
            </Text>
          </View>
        ) : null}

        {activeTab === 'jangarna' ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>जनगणना</Text>
              <TouchableOpacity
                style={styles.primaryAction}
                onPress={() => selectedVersionId && void loadJangarna(selectedVersionId)}
                disabled={jangarnaLoading || !selectedVersionId}
              >
                <MaterialIcons name="refresh" size={18} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>रिफ्रेश</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
            >
              <TouchableOpacity
                style={[styles.optionChip, jangarnaLevelFilter === 'all' && styles.optionChipActive]}
                onPress={() => setJangarnaLevelFilter('all')}
              >
                <Text style={[styles.optionChipText, jangarnaLevelFilter === 'all' && styles.optionChipTextActive]}>
                  सभी स्तर
                </Text>
              </TouchableOpacity>
              {jangarnaData.map((lvl) => (
                <TouchableOpacity
                  key={`jfilter-${lvl.levelCode}`}
                  style={[styles.optionChip, jangarnaLevelFilter === lvl.levelCode && styles.optionChipActive]}
                  onPress={() => setJangarnaLevelFilter(lvl.levelCode)}
                >
                  <Text style={[styles.optionChipText, jangarnaLevelFilter === lvl.levelCode && styles.optionChipTextActive]}>
                    {lvl.levelName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {jangarnaLoading ? (
              <Text style={styles.helper}>लोड हो रहा है...</Text>
            ) : jangarnaData.length === 0 ? (
              <Text style={styles.helper}>कोई जनगणना डेटा उपलब्ध नहीं है।</Text>
            ) : (
              (() => {
                const jFiltered = jangarnaData.filter((lvl) => jangarnaLevelFilter === 'all' || lvl.levelCode === jangarnaLevelFilter);
                const jSum = (key: keyof JangarnaLevel) => jFiltered.reduce((s, l) => s + Number((l[key] as number) || 0), 0);
                return (
                  <>
                    <View style={[styles.jangarnaCard, styles.jangarnaSummaryCard]}>
                      <View style={styles.jangarnaCardHeader}>
                        <Text style={styles.jangarnaLevelName}>कुल (सभी {jFiltered.length} स्तर)</Text>
                        <View style={[styles.jangarnaTotalBadge, { backgroundColor: theme.colors.primary }]}>
                          <Text style={[styles.jangarnaTotalText, { color: '#FFFFFF' }]}>कुल सदस्य: {jSum('total')}</Text>
                        </View>
                      </View>
                      <Text style={styles.jangarnaSectionLabel}>लिंग / प्रकार</Text>
                      <View style={styles.jangarnaStatRow}>
                        <View style={styles.jangarnaStat}><Text style={styles.jangarnaStatValue}>{jSum('men')}</Text><Text style={styles.jangarnaStatLabel}>पुरुष</Text></View>
                        <View style={styles.jangarnaStat}><Text style={styles.jangarnaStatValue}>{jSum('women')}</Text><Text style={styles.jangarnaStatLabel}>महिला</Text></View>
                        <View style={styles.jangarnaStat}><Text style={styles.jangarnaStatValue}>{jSum('baccha')}</Text><Text style={styles.jangarnaStatLabel}>बच्चा</Text></View>
                        <View style={styles.jangarnaStat}><Text style={styles.jangarnaStatValue}>{jSum('bacchi')}</Text><Text style={styles.jangarnaStatLabel}>बच्ची</Text></View>
                      </View>
                      <Text style={styles.jangarnaChildrenLine}>कुल बच्चे: {jSum('children')}</Text>
                      <Text style={styles.jangarnaSectionLabel}>धर्म</Text>
                      <View style={styles.jangarnaStatRow}>
                        <View style={styles.jangarnaStat}><Text style={styles.jangarnaStatValue}>{jSum('hindu')}</Text><Text style={styles.jangarnaStatLabel}>हिंदू</Text></View>
                        <View style={styles.jangarnaStat}><Text style={styles.jangarnaStatValue}>{jSum('isai')}</Text><Text style={styles.jangarnaStatLabel}>ईसाई</Text></View>
                        <View style={styles.jangarnaStat}><Text style={styles.jangarnaStatValue}>{jSum('muslim')}</Text><Text style={styles.jangarnaStatLabel}>मुस्लिम</Text></View>
                        <View style={styles.jangarnaStat}><Text style={styles.jangarnaStatValue}>{jSum('other')}</Text><Text style={styles.jangarnaStatLabel}>अन्य</Text></View>
                      </View>
                    </View>
                    {jFiltered.map((lvl) => (
                  <View key={`jcard-${lvl.levelCode}`} style={styles.jangarnaCard}>
                    <View style={styles.jangarnaCardHeader}>
                      <Text style={styles.jangarnaLevelName}>{lvl.levelName}</Text>
                      <View style={styles.jangarnaTotalBadge}>
                        <Text style={styles.jangarnaTotalText}>कुल सदस्य: {lvl.total}</Text>
                      </View>
                    </View>

                    <Text style={styles.jangarnaSectionLabel}>लिंग / प्रकार</Text>
                    <View style={styles.jangarnaStatRow}>
                      <View style={styles.jangarnaStat}>
                        <Text style={styles.jangarnaStatValue}>{lvl.men}</Text>
                        <Text style={styles.jangarnaStatLabel}>पुरुष</Text>
                      </View>
                      <View style={styles.jangarnaStat}>
                        <Text style={styles.jangarnaStatValue}>{lvl.women}</Text>
                        <Text style={styles.jangarnaStatLabel}>महिला</Text>
                      </View>
                      <View style={styles.jangarnaStat}>
                        <Text style={styles.jangarnaStatValue}>{lvl.baccha}</Text>
                        <Text style={styles.jangarnaStatLabel}>बच्चा</Text>
                      </View>
                      <View style={styles.jangarnaStat}>
                        <Text style={styles.jangarnaStatValue}>{lvl.bacchi}</Text>
                        <Text style={styles.jangarnaStatLabel}>बच्ची</Text>
                      </View>
                    </View>
                    <Text style={styles.jangarnaChildrenLine}>कुल बच्चे: {lvl.children}</Text>

                    <Text style={styles.jangarnaSectionLabel}>धर्म</Text>
                    <View style={styles.jangarnaStatRow}>
                      <View style={styles.jangarnaStat}>
                        <Text style={styles.jangarnaStatValue}>{lvl.hindu}</Text>
                        <Text style={styles.jangarnaStatLabel}>हिंदू</Text>
                      </View>
                      <View style={styles.jangarnaStat}>
                        <Text style={styles.jangarnaStatValue}>{lvl.isai}</Text>
                        <Text style={styles.jangarnaStatLabel}>ईसाई</Text>
                      </View>
                      <View style={styles.jangarnaStat}>
                        <Text style={styles.jangarnaStatValue}>{lvl.muslim}</Text>
                        <Text style={styles.jangarnaStatLabel}>मुस्लिम</Text>
                      </View>
                      <View style={styles.jangarnaStat}>
                        <Text style={styles.jangarnaStatValue}>{lvl.other}</Text>
                        <Text style={styles.jangarnaStatLabel}>अन्य</Text>
                      </View>
                    </View>
                  </View>
                    ))}
                  </>
                );
              })()
            )}
          </View>
        ) : null}

        {activeTab === 'roles' ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>भूमिका आवंटन</Text>
            </View>
            {!canManageActivities ? (
              <Text style={styles.modalSub}>इस उपयोगकर्ता को कोई नोड दायरा आवंटित नहीं है</Text>
            ) : roleLevels.length === 0 ? (
              <Text style={styles.modalSub}>भूमिका आवंटन के लिए नीचे का कोई नोड कार्यक्षेत्र उपलब्ध नहीं है</Text>
            ) : (
              <View style={styles.assignCardContent}>
                <Text style={styles.sectionLabel}>हाइरार्की नोड चुनें</Text>
                <TreeView
                  levels={roleLevels}
                  breadcrumb={roleBreadcrumb}
                  onSelectNode={(levelIndex, node) => void handleRoleNodeSelect(levelIndex, node)}
                  onOpenMembers={() => { }}
                />

                <View style={styles.assignmentMemberSection}>
                  <Text style={styles.sectionLabel}>प्रमोट करने के लिए कार्यकर्ता चुनें</Text>
                  <View style={styles.selectList}>
                    {loadingRoleMembers ? (
                      <View style={styles.loadingWrapper}><Text style={styles.modalSub}>कार्यकर्ता लोड हो रहे हैं...</Text></View>
                    ) : null}
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
                              <View style={styles.memberSelectItemRow}>
                                <View style={styles.memberMiniAvatar}>
                                  <Text style={styles.memberMiniAvatarText}>{getInitials(member.first_name || '')}</Text>
                                </View>
                                <Text style={[styles.selectItemText, selected && styles.selectItemTextActive]}>
                                  {[member.first_name, member.father_name].filter(Boolean).join(' ') || `उपयोगकर्ता #${userId}`}
                                </Text>
                              </View>
                              {selected && <MaterialIcons name="check-circle" size={18} color={theme.colors.primary} />}
                            </TouchableOpacity>
                          );
                        })}
                    {!loadingRoleMembers && roleMembers.filter((member) => Number(member.user_id || 0) > 0).length === 0 ? (
                      <View style={styles.loadingWrapper}><Text style={styles.modalSub}>चुने गए नोड के लिए कोई कार्यकर्ता नहीं मिला</Text></View>
                    ) : null}
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryAction, (assigningRole || !selectedRoleUserId || !selectedRoleNodeId) && styles.saveBtnDisabled]}
                  onPress={() => void handleAssignRole()}
                  disabled={assigningRole || !selectedRoleUserId || !selectedRoleNodeId}
                >
                  <Text style={styles.primaryActionText}>{assigningRole ? 'आवंटित हो रहा है...' : 'एडमिन भूमिका दें'}</Text>
                </TouchableOpacity>
              </View>
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

      {pillsModalVisible && pillsModalMember ? (
        <StandardModal
          visible={pillsModalVisible}
          onClose={() => {
            setPillsModalVisible(false);
            setPillsModalMember(null);
          }}
          title="आवंटित श्रेणियां और उप-श्रेणियां"
          subtitle={displayValue(memberName(pillsModalMember))}
        >
          <View style={{ padding: 4, gap: 16 }}>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: theme.colors.text.secondary }}>
                श्रेणियां (Categories)
              </Text>
              <View style={styles.tabPillsWrap}>
                {parseLabelList(
                  pillsModalMember.categories && pillsModalMember.categories.length
                    ? pillsModalMember.categories
                    : pillsModalMember.category || ''
                ).map((entry) => (
                  <View key={`modal-cat-${entry}`} style={[styles.tabPill, { paddingHorizontal: 8, paddingVertical: 4 }]}>
                    <Text style={[styles.tabPillText, { fontSize: 11 }]}>{entry}</Text>
                  </View>
                ))}
                {parseLabelList(
                  pillsModalMember.categories && pillsModalMember.categories.length
                    ? pillsModalMember.categories
                    : pillsModalMember.category || ''
                ).length === 0 ? (
                  <Text style={styles.tabPillEmptyText}>कोई आयाम नहीं</Text>
                ) : null}
              </View>
            </View>

            <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: theme.colors.text.secondary }}>
                उप-श्रेणियां (Subcategories)
              </Text>
              <View style={styles.tabPillsWrap}>
                {parseLabelList(
                  pillsModalMember.subcategories && pillsModalMember.subcategories.length
                    ? pillsModalMember.subcategories
                    : pillsModalMember.subcategory || ''
                ).map((entry) => (
                  <View key={`modal-sub-${entry}`} style={[styles.tabPill, { paddingHorizontal: 8, paddingVertical: 4 }]}>
                    <Text style={[styles.tabPillText, { fontSize: 11 }]}>{entry}</Text>
                  </View>
                ))}
                {parseLabelList(
                  pillsModalMember.subcategories && pillsModalMember.subcategories.length
                    ? pillsModalMember.subcategories
                    : pillsModalMember.subcategory || ''
                ).length === 0 ? (
                  <Text style={styles.tabPillEmptyText}>कोई टोली नहीं</Text>
                ) : null}
              </View>
            </View>
          </View>
        </StandardModal>
      ) : null}

      <StandardModal
        visible={showEditMemberModal}
        onClose={() => setShowEditMemberModal(false)}
        title="कार्यकर्ता संपादित करें"
        subtitle={editingMember?.hierarchy_path || editingMember?.node_name || 'कार्यकर्ता विवरण'}
        footer={
          <>
            <TouchableOpacity style={[styles.btn, styles.btnLight]} onPress={() => setShowEditMemberModal(false)}>
              <Text style={styles.btnTextDark}>रद्द करें</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, savingMemberEdit && styles.btnDisabled]}
              disabled={savingMemberEdit}
              onPress={() => void handleSubmitMemberEdit()}
            >
              <Text style={styles.btnText}>{savingMemberEdit ? 'सहेजा जा रहा है...' : 'परिवर्तन सहेजें'}</Text>
            </TouchableOpacity>
          </>
        }
      >
        <View style={styles.formBody}>
          <View style={styles.twoColRow}>
            <View style={styles.twoColField}>
              <Text style={styles.fieldLabel}>मोबाइल नंबर *</Text>
              <TextInput
                style={styles.input}
                value={editMemberForm.mobileNumber}
                onChangeText={(value) => setEditMemberForm((prev) => ({ ...prev, mobileNumber: value }))}
                keyboardType="phone-pad"
                placeholder="मोबाइल नंबर दर्ज करें"
              />
            </View>
            <View style={styles.twoColField}>
              <Text style={styles.fieldLabel}>नाम *</Text>
              <TextInput
                style={styles.input}
                value={editMemberForm.name}
                onChangeText={(value) => setEditMemberForm((prev) => ({ ...prev, name: value }))}
                placeholder="नाम दर्ज करें"
              />
            </View>
          </View>

          <View style={styles.twoColRow}>
            <View style={styles.twoColField}>
              <Text style={styles.fieldLabel}>पासवर्ड (वैकल्पिक)</Text>
              <TextInput
                style={styles.input}
                value={editMemberForm.password}
                onChangeText={(value) => setEditMemberForm((prev) => ({ ...prev, password: value }))}
                placeholder="पासवर्ड दर्ज करें"
                autoCapitalize="none"
                secureTextEntry
              />
            </View>
            <View style={styles.twoColField}>
              <Text style={styles.fieldLabel}>पिता/पति का नाम</Text>
              <TextInput
                style={styles.input}
                value={editMemberForm.fatherOrHusbandName}
                onChangeText={(value) => setEditMemberForm((prev) => ({ ...prev, fatherOrHusbandName: value }))}
                placeholder="पिता/पति का नाम दर्ज करें"
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>कार्यकर्ता फोटो</Text>
          <View style={styles.photoActionsRow}>
            {sanitizeInputValue(editMemberForm.avatar) ? (
              <Image source={{ uri: sanitizeInputValue(editMemberForm.avatar) }} style={styles.memberPhotoPreview} />
            ) : (
              <View style={[styles.memberPhotoPreview, styles.memberPhotoPlaceholder]}>
                <MaterialIcons name="image" size={20} color={theme.colors.text.disabled} />
                <Text style={styles.memberPhotoPlaceholderText}>फोटो प्रीव्यू</Text>
              </View>
            )}
            <View style={styles.photoBtnGroup}>
              <TouchableOpacity
                style={[styles.secondaryAction, uploadingMemberPhoto && styles.saveBtnDisabled]}
                onPress={() => void uploadMemberPhotoFromSource('camera', 'edit')}
                disabled={uploadingMemberPhoto}
              >
                <Text style={styles.secondaryActionText}>फोटो लें</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryAction, uploadingMemberPhoto && styles.saveBtnDisabled]}
                onPress={() => void uploadMemberPhotoFromSource('gallery', 'edit')}
                disabled={uploadingMemberPhoto}
              >
                <Text style={styles.secondaryActionText}>अपलोड</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.twoColRow}>
            <View style={styles.twoColField}>
              <Text style={styles.fieldLabel}>दायित्व</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => {
                  if (selectedVersionId && padOptions.length === 0 && !loadingPads) {
                    void loadPadOptions(selectedVersionId);
                  }
                  setPadPickerVisible(true);
                }}
                disabled={loadingPads}
              >
                <Text style={editMemberForm.pad ? styles.inputText : styles.inputPlaceholder}>
                  {editMemberForm.pad || (loadingPads ? 'लोड हो रहा है...' : 'दायित्व चुनें')}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.twoColField}>
              <Text style={styles.fieldLabel}>आयाम / टोली *</Text>
              <TouchableOpacity style={styles.input} onPress={() => void handleOpenPadbharTransfer('edit')}>
                <Text style={editSelectedSubcategories.length ? styles.inputText : styles.inputPlaceholder}>
                  {editSelectedSubcategories.length ? `${editSelectedSubcategories.length} चयनित` : 'आयाम / टोली चुनें'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity onPress={() => setEditMemberForm((prev) => ({ ...prev, category: '', subcategory: '' }))}>
            <Text style={styles.clearLink}>आयाम साफ करें</Text>
          </TouchableOpacity>

          <Text style={styles.fieldLabel}>उपयोगकर्ता भूमिका</Text>
          <View style={styles.optionRow}>
            {(['user', 'admin'] as const).map((role) => (
              <TouchableOpacity
                key={`edit-role-${role}`}
                style={[styles.optionChip, editMemberForm.userRole === role && styles.optionChipActive]}
                onPress={() => setEditMemberForm((prev) => ({ ...prev, userRole: role }))}
              >
                <Text style={[styles.optionChipText, editMemberForm.userRole === role && styles.optionChipTextActive]}>
                  {role === 'admin' ? 'एडमिन' : 'यूज़र'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {renderOtherInfoSection()}

          <Text style={styles.fieldLabel}>पता</Text>
          <View style={styles.twoColRow}>
            <View style={styles.twoColField}>
              <Text style={styles.fieldLabel}>राज्य</Text>
              <TextInput
                style={styles.input}
                value={editMemberForm.state}
                onChangeText={(value) => setEditMemberForm((prev) => ({ ...prev, state: value }))}
                placeholder="राज्य"
              />
            </View>
            <View style={styles.twoColField}>
              <Text style={styles.fieldLabel}>जिला</Text>
              <TextInput
                style={styles.input}
                value={editMemberForm.district}
                onChangeText={(value) => setEditMemberForm((prev) => ({ ...prev, district: value }))}
                placeholder="जिला"
              />
            </View>
          </View>
          <View style={styles.twoColRow}>
            <View style={styles.twoColField}>
              <Text style={styles.fieldLabel}>तहसील</Text>
              <TextInput
                style={styles.input}
                value={editMemberForm.tehsil}
                onChangeText={(value) => setEditMemberForm((prev) => ({ ...prev, tehsil: value }))}
                placeholder="तहसील"
              />
            </View>
            <View style={styles.twoColField}>
              <Text style={styles.fieldLabel}>गांव</Text>
              <TextInput
                style={styles.input}
                value={editMemberForm.village}
                onChangeText={(value) => setEditMemberForm((prev) => ({ ...prev, village: value }))}
                placeholder="गांव"
              />
            </View>
          </View>
          <View style={styles.twoColRow}>
            <View style={styles.twoColField}>
              <Text style={styles.fieldLabel}>पिनकोड</Text>
              <TextInput
                style={styles.input}
                value={editMemberForm.pincode}
                onChangeText={handleEditMemberPincodeChange}
                placeholder="पिनकोड"
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.twoColField} />
          </View>
        </View>
      </StandardModal>

      <StandardModal
        visible={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        title="कार्यकर्ता जोड़ें"
        subtitle={addTargetNode?.name || 'चयनित नोड'}
        topContent={
          <View style={styles.modalTabRow}>
            <TouchableOpacity
              style={[styles.modalTabBtn, memberModalTab === 'create' && styles.modalTabBtnActive]}
              onPress={() => setMemberModalTab('create')}
            >
              <Text style={[styles.modalTabText, memberModalTab === 'create' && styles.modalTabTextActive]}>
                नया कार्यकर्ता
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalTabBtn, memberModalTab === 'assign' && styles.modalTabBtnActive]}
              onPress={() => setMemberModalTab('assign')}
            >
              <Text style={[styles.modalTabText, memberModalTab === 'assign' && styles.modalTabTextActive]}>
                मौजूदा उपयोगकर्ता
              </Text>
            </TouchableOpacity>
          </View>
        }
        footer={
          <>
            <TouchableOpacity style={[styles.btn, styles.btnLight]} onPress={() => setShowAddMemberModal(false)}>
              <Text style={styles.btnTextDark}>रद्द करें</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, addingMember && styles.btnDisabled]}
              disabled={addingMember}
              onPress={() => void handleSubmitMember()}
            >
              <Text style={styles.btnText}>{addingMember ? 'सहेजा जा रहा है...' : memberModalTab === 'assign' ? 'कार्यकर्ता आवंटित करें' : 'कार्यकर्ता बनाएं'}</Text>
            </TouchableOpacity>
          </>
        }
      >
        {memberModalTab === 'create' ? (
          <View style={styles.formBody}>
            <View style={styles.twoColRow}>
              <View style={styles.twoColField}>
                <Text style={styles.fieldLabel}>मोबाइल नंबर *</Text>
                <TextInput
                  style={styles.input}
                  value={memberForm.mobileNumber}
                  onChangeText={(value) => setMemberForm((prev) => ({ ...prev, mobileNumber: value }))}
                  keyboardType="phone-pad"
                  placeholder="मोबाइल नंबर दर्ज करें"
                />
              </View>
              <View style={styles.twoColField}>
                <Text style={styles.fieldLabel}>नाम *</Text>
                <TextInput
                  style={styles.input}
                  value={memberForm.name}
                  onChangeText={(value) => setMemberForm((prev) => ({ ...prev, name: value }))}
                  placeholder="नाम दर्ज करें"
                />
              </View>
            </View>

            <View style={styles.twoColRow}>
              <View style={styles.twoColField}>
                <Text style={styles.fieldLabel}>पासवर्ड (वैकल्पिक)</Text>
                <TextInput
                  style={styles.input}
                  value={memberForm.password}
                  onChangeText={(value) => setMemberForm((prev) => ({ ...prev, password: value }))}
                  placeholder="पासवर्ड दर्ज करें"
                  autoCapitalize="none"
                  secureTextEntry
                />
              </View>
              <View style={styles.twoColField}>
                <Text style={styles.fieldLabel}>पिता/पति का नाम</Text>
                <TextInput
                  style={styles.input}
                  value={memberForm.fatherOrHusbandName}
                  onChangeText={(value) => setMemberForm((prev) => ({ ...prev, fatherOrHusbandName: value }))}
                  placeholder="पिता/पति का नाम दर्ज करें"
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>कार्यकर्ता फोटो</Text>
            <View style={styles.photoActionsRow}>
              {sanitizeInputValue(memberForm.avatar) ? (
                <Image source={{ uri: sanitizeInputValue(memberForm.avatar) }} style={styles.memberPhotoPreview} />
              ) : (
                <View style={[styles.memberPhotoPreview, styles.memberPhotoPlaceholder]}>
                  <MaterialIcons name="image" size={20} color={theme.colors.text.disabled} />
                  <Text style={styles.memberPhotoPlaceholderText}>फोटो प्रीव्यू</Text>
                </View>
              )}
              <View style={styles.photoBtnGroup}>
                <TouchableOpacity
                  style={[styles.secondaryAction, uploadingMemberPhoto && styles.saveBtnDisabled]}
                  onPress={() => void uploadMemberPhotoFromSource('camera')}
                  disabled={uploadingMemberPhoto}
                >
                  <Text style={styles.secondaryActionText}>फोटो लें</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryAction, uploadingMemberPhoto && styles.saveBtnDisabled]}
                  onPress={() => void uploadMemberPhotoFromSource('gallery')}
                  disabled={uploadingMemberPhoto}
                >
                  <Text style={styles.secondaryActionText}>अपलोड</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.twoColRow}>
              <View style={styles.twoColField}>
                <Text style={styles.fieldLabel}>दायित्व</Text>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => {
                    if (selectedVersionId && padOptions.length === 0 && !loadingPads) {
                      void loadPadOptions(selectedVersionId);
                    }
                    setPadPickerVisible(true);
                  }}
                  disabled={loadingPads}
                >
                  <Text style={memberForm.pad ? styles.inputText : styles.inputPlaceholder}>
                    {memberForm.pad || (loadingPads ? 'लोड हो रहा है...' : 'दायित्व चुनें')}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.twoColField}>
                <Text style={styles.fieldLabel}>आयाम / टोली *</Text>
                <TouchableOpacity style={styles.input} onPress={() => void handleOpenPadbharTransfer()}>
                  <Text style={addFormSelectedSubcategories.length ? styles.inputText : styles.inputPlaceholder}>
                    {addFormSelectedSubcategories.length ? `${addFormSelectedSubcategories.length} चयनित` : 'आयाम / टोली चुनें'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity onPress={() => setMemberForm((prev) => ({ ...prev, category: '', subcategory: '' }))}>
              <Text style={styles.clearLink}>आयाम साफ करें</Text>
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>उपयोगकर्ता भूमिका</Text>
            <View style={styles.optionRow}>
              {(['user', 'admin'] as const).map((role) => (
                <TouchableOpacity
                  key={`create-role-${role}`}
                  style={[styles.optionChip, memberForm.userRole === role && styles.optionChipActive]}
                  onPress={() => setMemberForm((prev) => ({ ...prev, userRole: role }))}
                >
                  <Text style={[styles.optionChipText, memberForm.userRole === role && styles.optionChipTextActive]}>
                    {role === 'admin' ? 'एडमिन' : 'यूज़र'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {renderOtherInfoSection()}

            <Text style={styles.fieldLabel}>पता</Text>
            <View style={styles.twoColRow}>
              <View style={styles.twoColField}>
                <Text style={styles.fieldLabel}>राज्य</Text>
                <TextInput
                  style={styles.input}
                  value={memberForm.state}
                  onChangeText={(value) => setMemberForm((prev) => ({ ...prev, state: value }))}
                  placeholder="राज्य"
                />
              </View>
              <View style={styles.twoColField}>
                <Text style={styles.fieldLabel}>जिला</Text>
                <TextInput
                  style={styles.input}
                  value={memberForm.district}
                  onChangeText={(value) => setMemberForm((prev) => ({ ...prev, district: value }))}
                  placeholder="जिला"
                />
              </View>
            </View>
            <View style={styles.twoColRow}>
              <View style={styles.twoColField}>
                <Text style={styles.fieldLabel}>तहसील</Text>
                <TextInput
                  style={styles.input}
                  value={memberForm.tehsil}
                  onChangeText={(value) => setMemberForm((prev) => ({ ...prev, tehsil: value }))}
                  placeholder="तहसील"
                />
              </View>
              <View style={styles.twoColField}>
                <Text style={styles.fieldLabel}>गांव</Text>
                <TextInput
                  style={styles.input}
                  value={memberForm.village}
                  onChangeText={(value) => setMemberForm((prev) => ({ ...prev, village: value }))}
                  placeholder="गांव"
                />
              </View>
            </View>
            <View style={styles.twoColRow}>
              <View style={styles.twoColField}>
                <Text style={styles.fieldLabel}>पिनकोड</Text>
                <TextInput
                  style={styles.input}
                  value={memberForm.pincode}
                  onChangeText={handleMemberPincodeChange}
                  placeholder="पिनकोड"
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.twoColField} />
            </View>
          </View>
        ) : (
          <View style={styles.formBody}>
            <Text style={styles.fieldLabel}>मोबाइल/ईमेल से मौजूदा उपयोगकर्ता खोजें</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={[styles.input, styles.searchInput]}
                value={userSearchQuery}
                onChangeText={setUserSearchQuery}
                placeholder="मोबाइल या ईमेल दर्ज करें"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.searchBtn, searchingUsers && styles.saveBtnDisabled]}
                onPress={() => void handleSearchUsers()}
                disabled={searchingUsers}
              >
                <Text style={styles.searchBtnText}>{searchingUsers ? '...' : 'खोजें'}</Text>
              </TouchableOpacity>
            </View>

            {selectedUser ? (
              <View style={styles.selectedUserBox}>
                <Text style={styles.fieldLabel}>चयनित उपयोगकर्ता</Text>
                <View style={styles.memberSelectItemRow}>
                  {sanitizeInputValue(selectedUser.avatar || assignForm.avatar) ? (
                    <Image source={{ uri: sanitizeInputValue(selectedUser.avatar || assignForm.avatar) }} style={styles.memberMiniAvatarImage} />
                  ) : (
                    <View style={styles.memberMiniAvatar}>
                      <Text style={styles.memberMiniAvatarText}>{getInitials(fullUserName(selectedUser) || '')}</Text>
                    </View>
                  )}
                  <View>
                    <Text style={styles.infoValue}>{displayValue(fullUserName(selectedUser))}</Text>
                    <Text style={styles.modalSub}>{displayValue(selectedUser.phone || selectedUser.email)}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedUser(null);
                    setAssignForm((prev) => ({ ...prev, avatar: '' }));
                  }}
                >
                  <Text style={styles.clearLink}>चयन हटाएं</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {selectedUser ? (
              <View>
                <Text style={styles.fieldLabel}>कार्यकर्ता फोटो</Text>
                <View style={styles.photoActionsRow}>
                  {sanitizeInputValue(assignForm.avatar || selectedUser.avatar) ? (
                    <Image source={{ uri: sanitizeInputValue(assignForm.avatar || selectedUser.avatar) }} style={styles.memberPhotoPreview} />
                  ) : (
                    <View style={[styles.memberPhotoPreview, styles.memberPhotoPlaceholder]}>
                      <MaterialIcons name="image" size={20} color={theme.colors.text.disabled} />
                      <Text style={styles.memberPhotoPlaceholderText}>फोटो प्रीव्यू</Text>
                    </View>
                  )}
                  <View style={styles.photoBtnGroup}>
                    <TouchableOpacity
                      style={[styles.secondaryAction, uploadingMemberPhoto && styles.saveBtnDisabled]}
                      onPress={() => void uploadMemberPhotoFromSource('camera', 'assign')}
                      disabled={uploadingMemberPhoto}
                    >
                      <Text style={styles.secondaryActionText}>फोटो लें</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.secondaryAction, uploadingMemberPhoto && styles.saveBtnDisabled]}
                      onPress={() => void uploadMemberPhotoFromSource('gallery', 'assign')}
                      disabled={uploadingMemberPhoto}
                    >
                      <Text style={styles.secondaryActionText}>अपलोड</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : null}

            {searchResults.length > 0 ? (
              <View style={styles.searchResultsWrap}>
                {searchResults.map((entry) => (
                  <TouchableOpacity key={`user-${entry.id}`} style={styles.searchResultItem} onPress={() => handlePickUser(entry)}>
                    <View style={styles.memberSelectItemRow}>
                      {sanitizeInputValue(entry.avatar) ? (
                        <Image source={{ uri: sanitizeInputValue(entry.avatar) }} style={styles.memberMiniAvatarImage} />
                      ) : (
                        <View style={styles.memberMiniAvatar}>
                          <Text style={styles.memberMiniAvatarText}>{getInitials(fullUserName(entry) || '')}</Text>
                        </View>
                      )}
                      <View>
                        <Text style={styles.searchResultName}>{fullUserName(entry) || `उपयोगकर्ता #${entry.id}`}</Text>
                        <Text style={styles.searchResultMeta}>{displayValue(entry.phone || entry.email)}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <View style={styles.twoColRow}>
              <View style={styles.twoColField}>
                <Text style={styles.fieldLabel}>दायित्व</Text>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => {
                    if (selectedVersionId && padOptions.length === 0 && !loadingPads) {
                      void loadPadOptions(selectedVersionId);
                    }
                    setPadPickerVisible(true);
                  }}
                  disabled={loadingPads}
                >
                  <Text style={assignForm.pad ? styles.inputText : styles.inputPlaceholder}>
                    {assignForm.pad || (loadingPads ? 'लोड हो रहा है...' : 'दायित्व चुनें')}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.twoColField}>
                <Text style={styles.fieldLabel}>आयाम / टोली *</Text>
                <TouchableOpacity style={styles.input} onPress={() => void handleOpenPadbharTransfer()}>
                  <Text style={addFormSelectedSubcategories.length ? styles.inputText : styles.inputPlaceholder}>
                    {addFormSelectedSubcategories.length ? `${addFormSelectedSubcategories.length} चयनित` : 'आयाम / टोली चुनें'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity onPress={() => setAssignForm((prev) => ({ ...prev, category: '', subcategory: '' }))}>
              <Text style={styles.clearLink}>आयाम साफ करें</Text>
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>उपयोगकर्ता भूमिका</Text>
            <View style={styles.optionRow}>
              {(['user', 'admin'] as const).map((role) => (
                <TouchableOpacity
                  key={`assign-role-${role}`}
                  style={[styles.optionChip, assignForm.userRole === role && styles.optionChipActive]}
                  onPress={() => setAssignForm((prev) => ({ ...prev, userRole: role }))}
                >
                  <Text style={[styles.optionChipText, assignForm.userRole === role && styles.optionChipTextActive]}>
                    {role === 'admin' ? 'एडमिन' : 'यूज़र'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </StandardModal>

      <StandardModal
        visible={showAddNodeModal}
        onClose={() => setShowAddNodeModal(false)}
        title="नोड जोड़ें"
        subtitle={addTargetNode?.name || 'चयनित नोड'}
        footer={
          <>
            <TouchableOpacity style={[styles.btn, styles.btnLight]} onPress={() => setShowAddNodeModal(false)}>
              <Text style={styles.btnTextDark}>रद्द करें</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, (addingNode || allowedNodeLevelOptions.length === 0) && styles.btnDisabled]}
              disabled={addingNode || allowedNodeLevelOptions.length === 0}
              onPress={() => void handleSubmitNode()}
            >
              <Text style={styles.btnText}>{addingNode ? 'सहेजा जा रहा है...' : 'नोड बनाएं'}</Text>
            </TouchableOpacity>
          </>
        }
      >
        <TextInput
          style={styles.input}
          value={nodeForm.name}
          onChangeText={(value) => setNodeForm((prev) => ({ ...prev, name: value }))}
          placeholder="नोड नाम *"
        />

        <Text style={styles.sectionLabel}>इसे इस रूप में बनाएं</Text>
        <View style={styles.optionRow}>
          <TouchableOpacity
            style={[styles.optionChip, nodeForm.relation === 'child' && styles.optionChipActive]}
            onPress={() => setNodeForm((prev) => ({ ...prev, relation: 'child' }))}
          >
            <Text style={[styles.optionChipText, nodeForm.relation === 'child' && styles.optionChipTextActive]}>
              चयनित नोड का चाइल्ड
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionChip, nodeForm.relation === 'parent' && styles.optionChipActive]}
            onPress={() => setNodeForm((prev) => ({ ...prev, relation: 'parent' }))}
          >
            <Text style={[styles.optionChipText, nodeForm.relation === 'parent' && styles.optionChipTextActive]}>
              चयनित नोड का पैरेंट
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>नोड कार्यक्षेत्र</Text>
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
          <Text style={styles.modalSub}>इस संबंध के लिए कोई कार्यक्षेत्र उपलब्ध नहीं है</Text>
        ) : null}
      </StandardModal>

      <StandardModal
        visible={showMeetingModal}
        onClose={() => {
          setShowMeetingModal(false);
          setEditingMeetingId(null);
          setAttendanceBrowseNodeId('');
          setInvitationBrowseNodeId('');
          setMeetingParticipantPreview([]);
          setMeetingInvitePreview([]);
          setShowAttendanceTransferModal(false);
          setShowInvitationTransferModal(false);
        }}
        title={editingMeetingId ? 'बैठक संपादित करें' : 'बैठक बनाएं'}
        footer={
          <>
            <TouchableOpacity
              style={[styles.btn, styles.btnLight]}
              onPress={() => {
                setShowMeetingModal(false);
                setEditingMeetingId(null);
              }}
            >
              <Text style={styles.btnTextDark}>रद्द करें</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, creatingMeeting && styles.btnDisabled]}
              disabled={creatingMeeting}
              onPress={() => void handleSubmitMeeting()}
            >
              <Text style={styles.btnText}>{creatingMeeting ? 'सहेजा जा रहा है...' : editingMeetingId ? 'बैठक अपडेट करें' : 'बैठक बनाएं'}</Text>
            </TouchableOpacity>
          </>
        }
      >
        <Text style={styles.fieldLabel}>बैठक का शीर्षक / नाम *</Text>
        <TextInput
          style={styles.input}
          value={meetingForm.title}
          onChangeText={(value) => setMeetingForm((prev) => ({ ...prev, title: value }))}
          placeholder="बैठक का शीर्षक दर्ज करें *"
        />

        <Text style={styles.fieldLabel}>विवरण (एजेंडा)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          value={meetingForm.description}
          onChangeText={(value) => setMeetingForm((prev) => ({ ...prev, description: value }))}
          placeholder="बैठक का विवरण (एजेंडा) दर्ज करें"
        />

        <Text style={styles.fieldLabel}>बैठक की तिथि (वर्ष-माह-दिन) *</Text>
        <TextInput
          style={styles.input}
          value={meetingForm.meetingDate}
          onChangeText={(value) => setMeetingForm((prev) => ({ ...prev, meetingDate: value }))}
          placeholder="उदाहरण: 2026-05-20 *"
        />

        <Text style={styles.fieldLabel}>कार्यक्षेत्र (स्थान कार्यक्षेत्र चुनें) *</Text>
        <SingleCascaderPicker
          levels={meetingLevels}
          onSelectLevelNode={(levelIndex, node) => void handleMeetingSelectNode(levelIndex, node)}
          title="कार्यक्षेत्र चुनें"
          placeholder="राज्य / जिला / तहसील / गांव चुनें *"
          selectedValue={meetingForm.nodeId}
          allNodes={assignableNodes}
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.fieldLabel}>आमंत्रित कार्यकर्ता ({meetingTransferSelectedItems.length})</Text>
          <TouchableOpacity style={styles.rowActionBtn} onPress={() => setShowAttendanceTransferModal(true)}>
            <Text style={styles.rowActionText}>प्रबंधित करें</Text>
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
          <Text style={styles.modalSub}>अभी कोई आमंत्रित कार्यकर्ता चयनित नहीं है</Text>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.fieldLabel}>उपस्थिति ({meetingInviteSelectedItems.length})</Text>
          <TouchableOpacity style={styles.rowActionBtn} onPress={() => setShowInvitationTransferModal(true)}>
            <Text style={styles.rowActionText}>प्रबंधित करें</Text>
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
          <Text style={styles.modalSub}>अभी कोई उपस्थित कार्यकर्ता चयनित नहीं है</Text>
        )}

        <Text style={styles.fieldLabel}>संलग्नक (फ़ाइल/फोटो/वीडियो)</Text>
        <TouchableOpacity
          style={[styles.secondaryAction, meetingUploadingAttachment && styles.saveBtnDisabled]}
          disabled={meetingUploadingAttachment}
          onPress={() => void handleUploadMeetingAttachment()}
        >
          <Text style={styles.secondaryActionText}>{meetingUploadingAttachment ? 'अपलोड हो रहा है...' : 'फाइल/फोटो/वीडियो अपलोड करें'}</Text>
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
                <Text style={styles.removeText}>हटाएं</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </StandardModal>

      <StandardModal
        visible={showAttendanceTransferModal}
        onClose={() => setShowAttendanceTransferModal(false)}
        title="आमंत्रित कार्यकर्ताओं का प्रबंधन"
        footer={
          <TouchableOpacity style={[styles.btn, styles.btnLight]} onPress={() => setShowAttendanceTransferModal(false)}>
            <Text style={styles.btnTextDark}>पूर्ण</Text>
          </TouchableOpacity>
        }
      >
        <Text style={styles.fieldLabel}>कार्यक्षेत्र (स्थान कार्यक्षेत्र चुनें)</Text>
        <SingleCascaderPicker
          levels={attendanceLevels}
          onSelectLevelNode={(levelIndex, node) => void handleAttendanceSelectNode(levelIndex, node)}
          title="कार्यक्षेत्र चुनें"
          placeholder="राज्य / जिला / तहसील / गांव चुनें"
          selectedValue={currentAttendanceNodeId}
          allNodes={assignableNodes}
        />

        <Text style={styles.sectionLabel}>कार्यकर्ता या अतिथि खोजें</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, styles.searchInput]}
            value={meetingGuestQuery}
            onChangeText={setMeetingGuestQuery}
            placeholder="नाम, मोबाइल या ईमेल"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={() => void handleSearchMeetingGuests()} disabled={meetingGuestSearching}>
            <Text style={styles.searchBtnText}>{meetingGuestSearching ? '...' : 'खोजें'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>अतिथि बनाएं</Text>
        <TextInput
          style={styles.input}
          value={meetingForm.newGuestName}
          onChangeText={(value) => setMeetingForm((prev) => ({ ...prev, newGuestName: value }))}
          placeholder="अतिथि नाम"
        />
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, styles.searchInput]}
            value={meetingForm.newGuestMobile}
            onChangeText={(value) => setMeetingForm((prev) => ({ ...prev, newGuestMobile: value }))}
            placeholder="अतिथि मोबाइल"
            keyboardType="phone-pad"
          />
          <TextInput
            style={[styles.input, styles.searchInput]}
            value={meetingForm.newGuestEmail}
            onChangeText={(value) => setMeetingForm((prev) => ({ ...prev, newGuestEmail: value }))}
            placeholder="अतिथि ईमेल"
            autoCapitalize="none"
          />
        </View>
        <TouchableOpacity style={styles.secondaryAction} onPress={() => void handleCreateMeetingGuest()}>
          <Text style={styles.secondaryActionText}>अतिथि बनाएं और चुनें</Text>
        </TouchableOpacity>

        <View style={styles.transferRow}>
          <View style={styles.transferColumn}>
            <Text style={styles.transferTitle}>उपलब्ध</Text>
            <ScrollView style={styles.transferList}>
              {meetingTransferAvailableItems.map((item) => (
                <TouchableOpacity key={`available-${item.key}`} style={styles.transferItem} onPress={() => handleAddTransferAttendee(item)}>
                  <Text style={styles.transferItemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.transferItemMeta} numberOfLines={1}>
                    {item.subtitle || (item.attendeeType === 'member' ? 'कार्यकर्ता' : 'अतिथि')}
                  </Text>
                </TouchableOpacity>
              ))}
              {meetingTransferAvailableItems.length === 0 ? <Text style={styles.modalSub}>कोई उपलब्ध आमंत्रित कार्यकर्ता नहीं</Text> : null}
            </ScrollView>
          </View>

          <View style={styles.transferColumn}>
            <Text style={styles.transferTitle}>चयनित</Text>
            <ScrollView style={styles.transferList}>
              {meetingTransferSelectedItems.map((item) => (
                <TouchableOpacity key={`selected-${item.key}`} style={styles.transferItemSelected} onPress={() => handleRemoveTransferAttendee(item)}>
                  <Text style={styles.transferItemName} numberOfLines={1}>
                    {item.subtitle ? `${item.name} (${item.subtitle})` : item.name}
                  </Text>
                  <Text style={styles.transferItemMeta} numberOfLines={1}>
                    {item.subtitle || (item.attendeeType === 'member' ? 'कार्यकर्ता' : 'अतिथि')}
                  </Text>
                </TouchableOpacity>
              ))}
              {meetingTransferSelectedItems.length === 0 ? <Text style={styles.modalSub}>कोई चयनित आमंत्रित कार्यकर्ता नहीं</Text> : null}
            </ScrollView>
          </View>
        </View>
      </StandardModal>

      <StandardModal
        visible={showMeetingAttachmentModal}
        onClose={() => setShowMeetingAttachmentModal(false)}
        title={meetingAttachmentTitle || 'बैठक संलग्नक'}
        footer={
          <TouchableOpacity style={[styles.btn, styles.btnLight]} onPress={() => setShowMeetingAttachmentModal(false)}>
            <Text style={styles.btnTextDark}>बंद करें</Text>
          </TouchableOpacity>
        }
      >
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
                <Text style={styles.modalSub}>{item.type || 'संलग्नक'}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.rowActionBtn} onPress={() => void handleOpenAttachmentUrl(item.url)}>
                  <Text style={styles.rowActionText}>खोलें</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.rowActionBtn, { backgroundColor: theme.colors.primary }]} onPress={() => void handleDownloadAttachment(item.url, item.name)}>
                  <Text style={[styles.rowActionText, { color: '#fff' }]}>डाउनलोड</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {meetingAttachmentItems.length === 0 ? <Text style={styles.modalSub}>कोई संलग्नक नहीं मिला</Text> : null}
        </ScrollView>
      </StandardModal>

      <StandardModal
        visible={showTaskAttachmentModal}
        onClose={() => setShowTaskAttachmentModal(false)}
        title={taskAttachmentTitle || 'कार्य संलग्नक'}
        footer={
          <TouchableOpacity style={[styles.btn, styles.btnLight]} onPress={() => setShowTaskAttachmentModal(false)}>
            <Text style={styles.btnTextDark}>बंद करें</Text>
          </TouchableOpacity>
        }
      >
        <ScrollView style={styles.attachmentPreviewList}>
          {taskAttachmentItems.map((item, idx) => (
            <View key={`task-preview-attachment-${idx}`} style={styles.attachmentPreviewItem}>
              {String(item.type || '').toLowerCase().startsWith('image') && item.url ? (
                <Image source={{ uri: item.url }} style={styles.attachmentThumb} resizeMode="cover" />
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.attachmentText} numberOfLines={1}>
                  {item.name || item.url.split('/').pop() || item.url}
                </Text>
                <Text style={styles.modalSub}>{item.type || 'संलग्नक'}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.rowActionBtn} onPress={() => void handleOpenAttachmentUrl(item.url)}>
                  <Text style={styles.rowActionText}>खोलें</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.rowActionBtn, { backgroundColor: theme.colors.primary }]} onPress={() => void handleDownloadAttachment(item.url, item.name)}>
                  <Text style={[styles.rowActionText, { color: '#fff' }]}>डाउनलोड</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {taskAttachmentItems.length === 0 ? <Text style={styles.modalSub}>कोई संलग्नक नहीं मिला</Text> : null}
        </ScrollView>
      </StandardModal>

      <StandardModal
        visible={showInvitationTransferModal}
        onClose={() => setShowInvitationTransferModal(false)}
        title="उपस्थिति प्रबंधन"
        footer={
          <TouchableOpacity style={[styles.btn, styles.btnLight]} onPress={() => setShowInvitationTransferModal(false)}>
            <Text style={styles.btnTextDark}>पूर्ण</Text>
          </TouchableOpacity>
        }
      >
        <Text style={styles.fieldLabel}>कार्यक्षेत्र (स्थान कार्यक्षेत्र चुनें)</Text>
        <SingleCascaderPicker
          levels={invitationLevels}
          onSelectLevelNode={(levelIndex, node) => void handleInvitationSelectNode(levelIndex, node)}
          title="कार्यक्षेत्र चुनें"
          placeholder="राज्य / जिला / तहसील / गांव चुनें"
          selectedValue={currentInvitationNodeId}
          allNodes={assignableNodes}
        />

        <Text style={styles.sectionLabel}>कार्यकर्ता खोजें</Text>
        <TextInput
          style={[styles.input, { marginBottom: 12 }]}
          value={meetingInviteSearchQuery}
          onChangeText={setMeetingInviteSearchQuery}
          placeholder="नाम, मोबाइल या ID से खोजें"
        />

        <View style={styles.transferRow}>
          <View style={styles.transferColumn}>
            <Text style={styles.transferTitle}>उपलब्ध कार्यकर्ता</Text>
            <ScrollView style={styles.transferList}>
              {meetingInviteAvailableItems.map((item) => (
                <TouchableOpacity key={`invite-available-${item.key}`} style={styles.transferItem} onPress={() => handleAddInviteMember(item)}>
                  <Text style={styles.transferItemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.transferItemMeta} numberOfLines={1}>
                    {item.subtitle || 'कार्यकर्ता'}
                  </Text>
                </TouchableOpacity>
              ))}
              {meetingInviteAvailableItems.length === 0 ? <Text style={styles.modalSub}>कोई उपलब्ध कार्यकर्ता नहीं</Text> : null}
            </ScrollView>
          </View>

          <View style={styles.transferColumn}>
            <Text style={styles.transferTitle}>उपस्थित कार्यकर्ता</Text>
            <ScrollView style={styles.transferList}>
              {meetingInviteSelectedItems.map((item) => (
                <TouchableOpacity key={`invite-selected-${item.key}`} style={styles.transferItemSelected} onPress={() => handleRemoveInviteMember(item)}>
                  <Text style={styles.transferItemName} numberOfLines={1}>
                    {item.subtitle ? `${item.name} (${item.subtitle})` : item.name}
                  </Text>
                  <Text style={styles.transferItemMeta} numberOfLines={1}>
                    {item.subtitle || 'कार्यकर्ता'}
                  </Text>
                </TouchableOpacity>
              ))}
              {meetingInviteSelectedItems.length === 0 ? <Text style={styles.modalSub}>कोई उपस्थित कार्यकर्ता नहीं</Text> : null}
            </ScrollView>
          </View>
        </View>
      </StandardModal>

      <StandardModal
        visible={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        title="कार्यक्रम असाइन करें"
        subtitle={activitySelectedPathLabel}
        footer={
          <>
            <TouchableOpacity style={[styles.btn, styles.btnLight]} onPress={() => setShowActivityModal(false)}>
              <Text style={styles.btnTextDark}>रद्द करें</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, submittingActivity && styles.saveBtnDisabled]}
              disabled={submittingActivity}
              onPress={() => void handleSubmitActivity()}
            >
              <Text style={styles.btnText}>{submittingActivity ? 'सहेजा जा रहा है...' : 'कार्यक्रम जमा करें'}</Text>
            </TouchableOpacity>
          </>
        }
      >
        <View style={styles.formBody}>
          <Text style={styles.sectionLabel}>नोड हाइरार्की (स्थान कार्यक्षेत्र चुनें) *</Text>
          <View style={{ marginBottom: 16 }}>
            <TreeView
              levels={activityLevels}
              breadcrumb={activitySelectedPathLabel}
              onSelectNode={(levelIndex, node) => void handleActivitySelectNode(levelIndex, node)}
              showCards={false}
            />
          </View>

          <Text style={styles.fieldLabel}>कार्यक्रम आयाम *</Text>
          <TouchableOpacity style={styles.input} onPress={() => void handleOpenPadbharTransfer('activity')}>
            <Text style={activitySelectedSubcategories.length ? styles.inputText : styles.inputPlaceholder}>
              {activitySelectedSubcategories.length
                ? `${activitySelectedSubcategories.length} टोलियाँ चयनित`
                : 'कार्यक्रम टोलियाँ चुनें *'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActivityForm((prev) => ({ ...prev, category: '', subcategory: '' }))}>
            <Text style={styles.clearLink}>आयाम साफ करें</Text>
          </TouchableOpacity>
          {activitySelectedCategories.length ? (
            <Text style={styles.helper}>आयाम: {activitySelectedCategories.join(', ')}</Text>
          ) : null}
          {activitySelectedSubcategories.length ? (
            <Text style={styles.helper}>टोलियाँ: {activitySelectedSubcategories.join(', ')}</Text>
          ) : null}

          <Text style={styles.fieldLabel}>कार्यक्रम शीर्षक (कार्यक्रम) *</Text>
          <TouchableOpacity
            style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
            onPress={() => {
              const options = [...ACTIVITY_OPTIONS, ACTIVITY_OTHER_LABEL].map(item => ({ label: item, value: item }));
              setSearchPickerTitle('कार्यक्रम शीर्षक चुनें');
              setSearchPickerOptions(options);
              setSearchPickerSearchText('');
              setOnSearchPickerSelect(() => (val: string) => {
                if (val === ACTIVITY_OTHER_LABEL) {
                  setActivityForm(prev => ({ ...prev, titleOther: true, title: ACTIVITY_OPTIONS.includes(prev.title) ? '' : prev.title }));
                } else {
                  setActivityForm(prev => ({ ...prev, titleOther: false, title: val }));
                }
              });
              setSearchPickerVisible(true);
            }}
          >
            <Text style={(activityForm.titleOther || activityForm.title) ? styles.inputText : styles.inputPlaceholder}>
              {activityForm.title || (activityForm.titleOther ? ACTIVITY_OTHER_LABEL : 'कार्यक्रम शीर्षक चुनें *')}
            </Text>
            <MaterialIcons name="arrow-drop-down" size={24} color={theme.colors.text.secondary} />
          </TouchableOpacity>
          {activityForm.titleOther ? (
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              value={activityForm.title}
              onChangeText={(value) => setActivityForm((prev) => ({ ...prev, title: value }))}
              placeholder="कार्यक्रम शीर्षक लिखें *"
            />
          ) : null}

          <Text style={styles.fieldLabel}>विवरण</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            value={activityForm.description}
            onChangeText={(value) => setActivityForm((prev) => ({ ...prev, description: value }))}
            placeholder="कार्यक्रम का विवरण और परिणाम दर्ज करें"
          />

          <View style={{ marginTop: 12, marginBottom: 8, padding: 12, backgroundColor: theme.colors.surfaceContainerHighest, borderRadius: 12 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              onPress={() => setActivityForm((prev) => ({ ...prev, includePopulation: !prev.includePopulation }))}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name="people-outline" size={20} color={theme.colors.primary} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.text.primary }}>जनसंख्या गणना</Text>
              </View>
              <MaterialIcons name={activityForm.includePopulation ? 'check-box' : 'check-box-outline-blank'} size={24} color={theme.colors.primary} />
            </TouchableOpacity>

            {activityForm.includePopulation ? (
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>पुरुष</Text>
                  <TextInput
                    style={styles.input}
                    value={activityForm.maleCount}
                    onChangeText={(value) => setActivityForm((prev) => ({ ...prev, maleCount: value.replace(/[^0-9]/g, '') }))}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>महिला</Text>
                  <TextInput
                    style={styles.input}
                    value={activityForm.femaleCount}
                    onChangeText={(value) => setActivityForm((prev) => ({ ...prev, femaleCount: value.replace(/[^0-9]/g, '') }))}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>बच्चे</Text>
                  <TextInput
                    style={styles.input}
                    value={activityForm.childrenCount}
                    onChangeText={(value) => setActivityForm((prev) => ({ ...prev, childrenCount: value.replace(/[^0-9]/g, '') }))}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            ) : null}
          </View>

          <Text style={styles.fieldLabel}>संलग्नक (फ़ाइल/फोटो/वीडियो)</Text>
          <TouchableOpacity
            style={[styles.secondaryAction, uploadingActivityAttachment && styles.saveBtnDisabled]}
            disabled={uploadingActivityAttachment}
            onPress={() => void pickAndUploadActivityAttachment()}
          >
            <Text style={styles.secondaryActionText}>{uploadingActivityAttachment ? 'अपलोड हो रहा है...' : 'फाइल अपलोड करें (PDF, DOCX, XLSX, Images)'}</Text>
          </TouchableOpacity>
          <View style={styles.attachmentList}>
            {activityForm.attachments.map((item, idx) => (
              <View key={`activity-attachment-${idx}`} style={styles.attachmentItem}>
                <Text style={styles.attachmentText} numberOfLines={1}>
                  {item.name || item.url}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    setActivityForm((prev) => ({
                      ...prev,
                      attachments: prev.attachments.filter((_, i) => i !== idx),
                    }))
                  }
                >
                  <Text style={styles.removeText}>हटाएं</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      </StandardModal>

      <StandardModal
        visible={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        title={editingTaskId ? 'कार्य संपादित करें' : isTaskAssignMode ? 'कार्य असाइन करें' : 'कार्य बनाएं'}
        subtitle={taskSelectedPathLabel}
        footer={
          <>
            <TouchableOpacity style={[styles.btn, styles.btnLight]} onPress={() => setShowTaskModal(false)}>
              <Text style={styles.btnTextDark}>रद्द करें</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, creatingTask && styles.saveBtnDisabled]}
              disabled={creatingTask}
              onPress={() => void handleSubmitTask()}
            >
              <Text style={styles.btnText}>{creatingTask ? 'सहेजा जा रहा है...' : editingTaskId ? 'कार्य अपडेट करें' : isTaskAssignMode ? 'कार्य असाइन करें' : 'कार्य बनाएं'}</Text>
            </TouchableOpacity>
          </>
        }
      >
        <View style={styles.formBody}>
          {!isTaskAssignMode ? (
            <>
              <View style={styles.twoColRow}>
                <View style={styles.twoColField}>
                  <Text style={styles.fieldLabel}>कार्य शीर्षक *</Text>
                  <TextInput
                    style={styles.input}
                    value={taskForm.title}
                    onChangeText={(value) => setTaskForm((prev) => ({ ...prev, title: value }))}
                    placeholder="कार्य शीर्षक दर्ज करें"
                  />
                </View>
                <View style={styles.twoColField}>
                  <Text style={styles.fieldLabel}>स्थिति *</Text>
                  <View style={[styles.optionRow, { marginTop: 4 }]}>
                    {['open', 'in_progress', 'completed'].map((status) => (
                      <TouchableOpacity
                        key={status}
                        style={[styles.optionChip, taskForm.status === status && styles.optionChipActive]}
                        onPress={() => setTaskForm((prev) => ({ ...prev, status }))}
                      >
                        <Text style={[styles.optionChipText, taskForm.status === status && styles.optionChipTextActive]}>
                          {status === 'open' ? 'खुला' : status === 'in_progress' ? 'प्रगति में' : 'पूर्ण'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <Text style={styles.fieldLabel}>विवरण</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                value={taskForm.description}
                onChangeText={(value) => setTaskForm((prev) => ({ ...prev, description: value }))}
                placeholder="कार्य विवरण दर्ज करें"
              />

              <View style={styles.twoColRow}>
                <View style={styles.twoColField}>
                  <Text style={styles.fieldLabel}>कार्य दिनांक (वर्ष-माह-दिन)</Text>
                  <TextInput
                    style={styles.input}
                    value={taskForm.taskDate}
                    onChangeText={(value) => setTaskForm((prev) => ({ ...prev, taskDate: value }))}
                    placeholder="वर्ष-माह-दिन"
                  />
                </View>
                <View style={styles.twoColField}>
                  <Text style={styles.fieldLabel}>अंतिम दिनांक (वैकल्पिक)</Text>
                  <TextInput
                    style={styles.input}
                    value={taskForm.dueDate}
                    onChangeText={(value) => setTaskForm((prev) => ({ ...prev, dueDate: value }))}
                    placeholder="वर्ष-माह-दिन"
                  />
                </View>
              </View>
            </>
          ) : null}

          <Text style={styles.fieldLabel}>कार्य आयाम *</Text>
          <TouchableOpacity style={styles.input} onPress={() => void handleOpenPadbharTransfer('task')}>
            <Text style={taskSelectedSubcategories.length ? styles.inputText : styles.inputPlaceholder}>
              {taskSelectedSubcategories.length
                ? `${taskSelectedSubcategories.length} टोलियाँ चयनित`
                : 'कार्य टोलियाँ चुनें *'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTaskForm((prev) => ({ ...prev, category: '', subcategory: '' }))}>
            <Text style={styles.clearLink}>आयाम साफ करें</Text>
          </TouchableOpacity>
          {taskSelectedCategories.length ? (
            <Text style={styles.helper}>आयाम: {taskSelectedCategories.join(', ')}</Text>
          ) : null}
          {taskSelectedSubcategories.length ? (
            <Text style={styles.helper}>टोलियाँ: {taskSelectedSubcategories.join(', ')}</Text>
          ) : null}

          <Text style={styles.sectionLabel}>नोड हाइरार्की</Text>
          <View style={{ marginBottom: 16 }}>
            <TreeView
              levels={taskLevels}
              breadcrumb={taskSelectedPathLabel}
              onSelectNode={(levelIndex, node) => void handleTaskSelectNode(levelIndex, node)}
              showCards={false}
            />
          </View>
          {selectedTaskNodeIsScopeRoot ? (
            <Text style={styles.errorInline}>चेतावनी: आप आवंटित कार्यक्षेत्र पर कार्य नहीं बना सकते। नीचे का चाइल्ड नोड चुनें।</Text>
          ) : null}

          <Text style={styles.sectionLabel}>कार्यकर्ता आवंटित करें</Text>
          <Text style={styles.fieldLabel}>आवंटित उपयोगकर्ता ({taskForm.assignedUserIds.length})</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 12 }}>
            {taskForm.assignedUserIds.map((userId) => {
              const userObj = taskMemberSearchResults.find((u) => u.id === userId);
              const memObj = taskMembers.find((m) => Number(m.user_id) === userId);
              const editObj = editingTaskAssignees.find((a) => a.id === userId);
              const nameStr = userObj
                ? fullUserName(userObj) || [userObj.first_name, userObj.father_name].filter(Boolean).join(' ')
                : memObj
                  ? [memObj.first_name, memObj.father_name].filter(Boolean).join(' ')
                  : editObj
                    ? [editObj.name, editObj.father_name].filter(Boolean).join(' ')
                    : `उपयोगकर्ता #${userId}`;
              const mobileStr = userObj?.phone || userObj?.email || memObj?.mobile_number || editObj?.mobile_number || '';
              const positionStr = userObj
                ? formatAssignableUserPosition(userObj)
                : memObj
                  ? formatMemberPosition(memObj)
                  : '';
              const metaLine = [mobileStr, positionStr].filter(Boolean).join(' • ');
              return (
                <TouchableOpacity
                  key={`assigned-${userId}`}
                  style={[styles.optionChip, styles.optionChipActive, { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12 }]}
                  onPress={() =>
                    setTaskForm((prev) => ({
                      ...prev,
                      assignedUserIds: prev.assignedUserIds.filter((id) => id !== userId),
                    }))
                  }
                >
                  <View>
                    <Text style={[styles.optionChipTextActive, { fontSize: 13 }]}>{nameStr || `उपयोगकर्ता #${userId}`}</Text>
                    {metaLine ? <Text style={{ fontSize: 10, color: theme.colors.text.secondary }}>{metaLine}</Text> : null}
                  </View>
                  <Text style={{ color: theme.colors.primary, fontSize: 16, fontWeight: '700', marginLeft: 4 }}>×</Text>
                </TouchableOpacity>
              );
            })}
            {taskForm.assignedUserIds.length === 0 ? (
              <Text style={styles.modalSub}>कोई कार्यकर्ता आवंटित नहीं। उपयोगकर्ता खोजें या नीचे से चुनें।</Text>
            ) : null}
          </View>

          <Text style={styles.fieldLabel}>उपयोगकर्ता खोजें और चुनें (मल्टी-सेलेक्ट)</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, styles.searchInput]}
              value={taskMemberSearchQuery}
              onChangeText={setTaskMemberSearchQuery}
              placeholder="पहले नोड चुनें, फिर नाम/मोबाइल से खोजें..."
              autoCapitalize="none"
            />
            {taskMemberSearchQuery.length > 0 ? (
              <TouchableOpacity
                style={{ paddingHorizontal: 12, justifyContent: 'center' }}
                onPress={() => {
                  setTaskMemberSearchQuery('');
                  setTaskMemberSearchResults([]);
                }}
              >
                <Text style={{ color: theme.colors.text.disabled, fontSize: 16, fontWeight: 'bold' }}>×</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.dropdownContainer}>
            <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled>
              {taskMemberSearchQuery.trim().length < 3 ? (
                <>
                  <View style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.colors.surfaceContainerHigh, borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.text.secondary }}>
                      नोड कार्यकर्ता ({taskMembers.length}) — आवंटित कार्यक्षेत्र के नीचे योग्य उपयोगकर्ता खोजने के लिए 3+ अक्षर लिखें
                    </Text>
                  </View>
                  {taskMembers.map((member) => {
                    const userId = Number(member.user_id || 0);
                    if (!userId) return null;
                    const selected = taskForm.assignedUserIds.includes(userId);
                    const nameStr = [member.first_name, member.father_name].filter(Boolean).join(' ') || `उपयोगकर्ता #${userId}`;
                    const mobileStr = member.mobile_number || 'मोबाइल नंबर उपलब्ध नहीं';
                    const positionStr = formatMemberPosition(member);
                    const metaLine = [mobileStr, positionStr].filter(Boolean).join(' • ');
                    return (
                      <TouchableOpacity
                        key={`task-node-member-${member.id}`}
                        style={[styles.userDropdownItem, selected && styles.userDropdownItemActive]}
                        onPress={() =>
                          setTaskForm((prev) => ({
                            ...prev,
                            assignedUserIds: selected
                              ? prev.assignedUserIds.filter((id) => id !== userId)
                              : [...prev.assignedUserIds, userId],
                          }))
                        }
                      >
                        <View style={styles.userAvatar}>
                          <Text style={styles.userAvatarText}>{getInitials(nameStr)}</Text>
                        </View>
                        <View style={styles.userInfo}>
                          <Text style={[styles.userNameText, selected && { color: theme.colors.primary }]}>{nameStr}</Text>
                          <Text style={styles.userMobileText}>{metaLine || mobileStr}</Text>
                        </View>
                        <View style={[styles.userCheckIcon, selected && styles.userCheckIconActive]}>
                          {selected ? <Text style={styles.userCheckText}>✓</Text> : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  {taskMembers.length === 0 ? (
                    <Text style={{ padding: 12, color: theme.colors.text.disabled, fontStyle: 'italic', fontSize: 12 }}>
                      चुने गए नोड में कोई कार्यकर्ता नहीं। ऊपर खोजकर अपने निचले कार्यक्षेत्र के योग्य उपयोगकर्ता खोजें।
                    </Text>
                  ) : null}
                </>
              ) : (
                <>
                  <View style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.colors.surfaceContainerHigh, borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.text.secondary }}>
                      {taskMemberSearching ? 'खोज जारी है...' : `खोज परिणाम (${taskMemberSearchResults.length})`}
                    </Text>
                  </View>
                  {taskMemberSearchResults.map((entry) => {
                    const selected = taskForm.assignedUserIds.includes(entry.id);
                    const nameStr = fullUserName(entry) || [entry.first_name, entry.father_name].filter(Boolean).join(' ') || `उपयोगकर्ता #${entry.id}`;
                    const mobileStr = entry.phone || entry.email || 'मोबाइल नंबर उपलब्ध नहीं';
                    const positionStr = formatAssignableUserPosition(entry);
                    const metaLine = [mobileStr, positionStr].filter(Boolean).join(' • ');
                    return (
                      <TouchableOpacity
                        key={`task-user-search-${entry.id}`}
                        style={[styles.userDropdownItem, selected && styles.userDropdownItemActive]}
                        onPress={() =>
                          setTaskForm((prev) => ({
                            ...prev,
                            assignedUserIds: selected
                              ? prev.assignedUserIds.filter((id) => id !== entry.id)
                              : [...prev.assignedUserIds, entry.id],
                          }))
                        }
                      >
                        <View style={styles.userAvatar}>
                          <Text style={styles.userAvatarText}>{getInitials(nameStr)}</Text>
                        </View>
                        <View style={styles.userInfo}>
                          <Text style={[styles.userNameText, selected && { color: theme.colors.primary }]}>{nameStr}</Text>
                          <Text style={styles.userMobileText}>{metaLine || mobileStr}</Text>
                        </View>
                        <View style={[styles.userCheckIcon, selected && styles.userCheckIconActive]}>
                          {selected ? <Text style={styles.userCheckText}>✓</Text> : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  {!taskMemberSearching && taskMemberSearchResults.length === 0 ? (
                    <Text style={{ padding: 12, color: theme.colors.text.disabled, fontStyle: 'italic', fontSize: 12 }}>
                      &quot;{taskMemberSearchQuery}&quot; के लिए कोई उपयोगकर्ता नहीं मिला
                    </Text>
                  ) : null}
                </>
              )}
            </ScrollView>
          </View>
        </View>

        {!isTaskAssignMode ? (
          <>
            <Text style={styles.sectionLabel}>संलग्नक</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={[styles.input, styles.searchInput]}
                value={taskForm.attachmentInput}
                onChangeText={(value) => setTaskForm((prev) => ({ ...prev, attachmentInput: value }))}
                placeholder="दस्तावेज़ लिंक"
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.searchBtn} onPress={addTaskAttachmentByUrl}>
                <Text style={styles.searchBtnText}>लिंक जोड़ें</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.secondaryAction, taskUploadingAttachment && styles.saveBtnDisabled]}
              disabled={taskUploadingAttachment}
              onPress={() => void handleUploadTaskAttachment()}
            >
              <Text style={styles.secondaryActionText}>{taskUploadingAttachment ? 'अपलोड हो रहा है...' : 'फोटो/वीडियो अपलोड करें'}</Text>
            </TouchableOpacity>
            <View style={styles.attachmentList}>
              {taskForm.attachments.map((item, idx) => (
                <View key={`task-attachment-${idx}`} style={styles.attachmentItem}>
                  <Text style={styles.attachmentText} numberOfLines={1}>
                    {item.name || item.url}
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      setTaskForm((prev) => ({
                        ...prev,
                        attachments: prev.attachments.filter((_, i) => i !== idx),
                      }))
                    }
                  >
                    <Text style={styles.removeText}>हटाएं</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </StandardModal>
      <StandardModal
        visible={Boolean(selectedActivityDetails)}
        onClose={() => setSelectedActivityDetails(null)}
        title="कार्यक्रम विवरण"
        footer={
          <TouchableOpacity style={[styles.btn, styles.btnLight]} onPress={() => setSelectedActivityDetails(null)}>
            <Text style={styles.btnTextDark}>बंद करें</Text>
          </TouchableOpacity>
        }
      >
        <View style={styles.activityHero}>
          <Text style={styles.activityTitle}>{displayValue(selectedActivityDetails?.title)}</Text>
          <View style={styles.activityMetaRow}>
            <MaterialIcons name="event" size={14} color={theme.colors.text.secondary} />
            <Text style={styles.activityMetaText}>{displayValue(String(selectedActivityDetails?.created_at || '').slice(0, 10))}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>आयाम</Text>
              <Text style={styles.infoValue}>{displayValue(selectedActivityDetails?.category)}</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>टोली</Text>
              <Text style={styles.infoValue}>{displayValue(selectedActivityDetails?.subcategory)}</Text>
            </View>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>नोड / स्थान</Text>
            <Text style={styles.infoValue}>{displayValue(selectedActivityDetails?.hierarchy_path || selectedActivityDetails?.node_name)}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>जमा करने वाले</Text>
            <View style={styles.byCellWrap}>
              {sanitizeInputValue(selectedActivityDetails?.submitted_by_avatar) ? (
                <Image source={{ uri: sanitizeInputValue(selectedActivityDetails?.submitted_by_avatar) }} style={styles.byAvatar} />
              ) : (
                <View style={styles.byAvatarFallback}>
                  <Text style={styles.byAvatarFallbackText}>{getInitials(selectedActivityDetails?.submitted_by_name || '')}</Text>
                </View>
              )}
              <Text style={styles.infoValue}>{displayValue(selectedActivityDetails?.submitted_by_name)}</Text>
            </View>
          </View>
          {Boolean(selectedActivityDetails?.male_count || selectedActivityDetails?.female_count || selectedActivityDetails?.children_count) && (
            <>
              <View style={styles.infoDivider} />
              <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>जनसंख्या गणना</Text>
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                  <View style={{ flex: 1, backgroundColor: theme.colors.surfaceContainerHighest, padding: 10, borderRadius: 10, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: theme.colors.text.secondary, fontWeight: '600' }}>पुरुष</Text>
                    <Text style={{ fontSize: 18, color: theme.colors.primary, fontWeight: '700', marginTop: 4 }}>{selectedActivityDetails?.male_count || 0}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: theme.colors.surfaceContainerHighest, padding: 10, borderRadius: 10, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: theme.colors.text.secondary, fontWeight: '600' }}>महिला</Text>
                    <Text style={{ fontSize: 18, color: theme.colors.primary, fontWeight: '700', marginTop: 4 }}>{selectedActivityDetails?.female_count || 0}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: theme.colors.surfaceContainerHighest, padding: 10, borderRadius: 10, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: theme.colors.text.secondary, fontWeight: '600' }}>बच्चे</Text>
                    <Text style={{ fontSize: 18, color: theme.colors.primary, fontWeight: '700', marginTop: 4 }}>{selectedActivityDetails?.children_count || 0}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: theme.colors.primarySoft, padding: 10, borderRadius: 10, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: theme.colors.primary, fontWeight: '700' }}>कुल</Text>
                    <Text style={{ fontSize: 18, color: theme.colors.primary, fontWeight: '800', marginTop: 4 }}>{Number(selectedActivityDetails?.male_count || 0) + Number(selectedActivityDetails?.female_count || 0) + Number(selectedActivityDetails?.children_count || 0)}</Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>

        <Text style={styles.sectionLabel}>विवरण</Text>
        <View style={styles.descriptionBox}>
          <Text style={styles.descriptionText}>{selectedActivityDetails?.description || 'कोई विवरण उपलब्ध नहीं।'}</Text>
        </View>

        <Text style={styles.sectionLabel}>संलग्नक</Text>
        <View style={styles.attachmentPreviewList}>
          {Array.isArray(selectedActivityDetails?.attachments) && selectedActivityDetails.attachments.length > 0 ? (
            selectedActivityDetails.attachments.map((attachment, index) => (
              <View
                key={`activity-details-attachment-${index}`}
                style={styles.attachmentPreviewItem}
              >
                <View style={styles.attachmentThumb}>
                  <MaterialIcons name="insert-drive-file" size={24} color={theme.colors.primary} />
                </View>
                <Text style={[styles.attachmentText, { flex: 1 }]} numberOfLines={1}>{attachment?.name || `संलग्नक ${index + 1}`}</Text>
                <TouchableOpacity style={{ padding: 4 }} onPress={() => void handleOpenAttachmentUrl(attachment?.url)}>
                  <MaterialIcons name="open-in-new" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={{ padding: 4 }} onPress={() => void handleDownloadAttachment(attachment?.url, attachment?.name)}>
                  <MaterialIcons name="file-download" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.modalSub}>कोई संलग्नक उपलब्ध नहीं</Text>
          )}
        </View>
      </StandardModal>

      <Modal visible={padPickerVisible} transparent animationType="fade" onRequestClose={() => setPadPickerVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>दायित्व चुनें</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {padOptions.map((pad) => (
                <TouchableOpacity
                  key={pad}
                  style={styles.padOption}
                  onPress={() => {
                    if (showEditMemberModal) {
                      setEditMemberForm((prev) => ({ ...prev, pad }));
                    } else if (memberModalTab === 'assign') {
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
              {padOptions.length === 0 ? <Text style={styles.modalSub}>कोई दायित्व विकल्प नहीं मिला</Text> : null}
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setPadPickerVisible(false)}>
              <Text style={styles.closeText}>बंद करें</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={searchPickerVisible} transparent animationType="fade" onRequestClose={() => setSearchPickerVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{searchPickerTitle}</Text>
            <View style={{ marginBottom: 12 }}>
              <TextInput
                style={styles.input}
                value={searchPickerSearchText}
                onChangeText={setSearchPickerSearchText}
                placeholder="खोजें..."
              />
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {searchPickerOptions
                .filter(option =>
                  !searchPickerSearchText ||
                  option.label.toLowerCase().includes(searchPickerSearchText.toLowerCase())
                )
                .map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={styles.padOption}
                    onPress={() => {
                      onSearchPickerSelect?.(option.value);
                      setSearchPickerVisible(false);
                    }}
                  >
                    <Text style={styles.padOptionText}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              {searchPickerOptions.filter(option =>
                !searchPickerSearchText ||
                option.label.toLowerCase().includes(searchPickerSearchText.toLowerCase())
              ).length === 0 ? (
                <Text style={[styles.modalSub, { textAlign: 'center', marginTop: 12 }]}>कोई विकल्प नहीं मिला</Text>
              ) : null}
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSearchPickerVisible(false)}>
              <Text style={styles.closeText}>बंद करें</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={padbharTransferVisible} animationType="slide" onRequestClose={() => setPadbharTransferVisible(false)}>
        <View style={styles.selectorPage}>
          <View style={styles.selectorHeader}>
            <Text style={styles.selectorHeaderTitle}>
              {padbharTransferMode === 'task' ? 'कार्य: आयाम / टोली चुनें' : padbharTransferMode === 'activity' ? 'कार्यक्रम: आयाम / टोली चुनें' : 'आयाम / टोली चुनें'}
            </Text>
            <TouchableOpacity onPress={() => setPadbharTransferVisible(false)} style={{ padding: 4 }}>
              <MaterialIcons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.selectorTreeSection} contentContainerStyle={{ padding: 12, gap: 8 }}>
            {categoryTree.map((entry) => {
              const expanded = transferExpandedCategories.includes(entry.category);
              const selectedCount = entry.subcategories.filter((s) => transferDraftSubcategories.includes(s)).length;
              const isActive = selectedCount > 0;
              return (
                <View key={`sel-cat-${entry.category}`} style={styles.selectorCatBlock}>
                  <TouchableOpacity
                    style={[styles.selectorCatHeader, isActive && styles.selectorCatHeaderActive]}
                    onPress={() => toggleTransferCategory(entry.category)}
                  >
                    <MaterialIcons
                      name={expanded ? 'expand-less' : 'expand-more'}
                      size={22}
                      color={isActive ? theme.colors.primary : theme.colors.text.secondary}
                    />
                    <Text style={[styles.selectorCatTitle, isActive && styles.selectorCatTitleActive]}>{entry.category}</Text>
                    {selectedCount > 0 ? (
                      <View style={styles.selectorCatBadge}>
                        <Text style={styles.selectorCatBadgeText}>{selectedCount}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                  {expanded ? (
                    <View style={styles.selectorSubList}>
                      {entry.subcategories.length === 0 ? (
                        <Text style={styles.modalSub}>कोई टोली नहीं</Text>
                      ) : (
                        entry.subcategories.map((subcategory) => {
                          const sel = transferDraftSubcategories.includes(subcategory);
                          return (
                            <TouchableOpacity
                              key={`sel-sub-${entry.category}-${subcategory}`}
                              style={[styles.selectorSubItem, sel && styles.selectorSubItemSelected]}
                              onPress={() => handleTransferToggleSubcategory(subcategory)}
                            >
                              <MaterialIcons
                                name={sel ? 'check-box' : 'check-box-outline-blank'}
                                size={20}
                                color={sel ? theme.colors.primary : theme.colors.text.disabled}
                              />
                              <Text style={[styles.selectorSubText, sel && styles.selectorSubTextSelected]}>{subcategory}</Text>
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.selectorSelectedSection}>
            <Text style={styles.selectorSelectedTitle}>चयनित टोली ({transferDraftSubcategories.length})</Text>
            <Text style={styles.selectorAutoCats}>
              स्वतः निर्धारित आयाम: {deriveCats(transferDraftSubcategories).join(', ') || 'कोई नहीं'}
            </Text>
            <ScrollView style={styles.selectorSelectedScroll} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 }}>
              {transferDraftSubcategories.length === 0 ? (
                <Text style={styles.modalSub}>कोई टोली चयनित नहीं</Text>
              ) : (
                transferDraftSubcategories.map((subcategory) => (
                  <View key={`sel-chip-${subcategory}`} style={styles.selectorChip}>
                    <Text style={styles.selectorChipText}>{subcategory}</Text>
                    <TouchableOpacity onPress={() => handleTransferRemoveSubcategory(subcategory)} style={{ marginLeft: 6 }}>
                      <MaterialIcons name="close" size={16} color="#C0492F" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>

          <View style={styles.selectorFooter}>
            <TouchableOpacity style={[styles.btn, styles.btnLight, { flex: 1 }]} onPress={() => setPadbharTransferVisible(false)}>
              <Text style={styles.btnTextDark}>रद्द करें</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={() => handleApplyPadbharTransfer()}>
              <Text style={styles.btnText}>सेव करें</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <StandardModal
        visible={showAssigneesModal}
        onClose={() => setShowAssigneesModal(false)}
        title="आवंटित कार्यकर्ता"
        subtitle={displayValue(selectedTaskForAssignees?.title)}
        footer={
          <TouchableOpacity style={[styles.btn, styles.btnLight, { flex: 1 }]} onPress={() => setShowAssigneesModal(false)}>
            <Text style={styles.btnTextDark}>बंद करें</Text>
          </TouchableOpacity>
        }
      >
        <ScrollView style={{ maxHeight: 350 }}>
          <View style={{ gap: 12, paddingVertical: 8 }}>
            {selectedTaskForAssignees?.assignees?.map((assignee, index) => {
              const nameStr = [assignee.name, assignee.father_name].filter(Boolean).join(' ') || `उपयोगकर्ता #${assignee.id}`;
              return (
                <View key={`modal-assignee-${assignee.id}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surfaceContainer, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.borderLight }}>
                  <View style={[styles.userAvatar, { width: 36, height: 36, borderRadius: 18 }]}>
                    <Text style={styles.userAvatarText}>{getInitials(nameStr)}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.text.primary }}>{nameStr}</Text>
                    {assignee.mobile_number ? (
                      <Text style={{ fontSize: 12, color: theme.colors.text.secondary, marginTop: 2 }}>📞 {assignee.mobile_number}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
            {(!selectedTaskForAssignees?.assignees || selectedTaskForAssignees.assignees.length === 0) ? (
              <Text style={{ color: theme.colors.text.disabled, fontStyle: 'italic', padding: 12, textAlign: 'center' }}>इस कार्य में कोई उपयोगकर्ता आवंटित नहीं है।</Text>
            ) : null}
          </View>
        </ScrollView>
      </StandardModal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  tabPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tabPill: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tabPillText: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  tabPillEmptyText: {
    fontSize: 12,
    color: theme.colors.text.primary,
    fontWeight: '600',
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
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  tabSwitchBtn: {
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabSwitchBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
    shadowOpacity: 0.15,
    elevation: 3,
  },
  tabSwitchText: {
    color: theme.colors.text.secondary,
    fontWeight: '700',
    fontSize: 13,
  },
  tabSwitchTextActive: {
    color: '#ffffff',
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    padding: 10,
    gap: 10,
  },
  otherInfoBlock: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EDDCD2',
    paddingTop: 12,
  },
  otherInfoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  otherInfoToggleText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  otherInfoBody: {
    marginTop: 12,
  },
  jangarnaCard: {
    borderWidth: 1,
    borderColor: '#FCEFE6',
    borderRadius: 14,
    backgroundColor: '#FFF9F7',
    padding: 14,
    gap: 8,
    marginTop: 10,
  },
  jangarnaSummaryCard: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    backgroundColor: '#FFF3EC',
  },
  jangarnaCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  jangarnaLevelName: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text.primary,
  },
  jangarnaTotalBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  jangarnaTotalText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  jangarnaSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 6,
  },
  jangarnaStatRow: {
    flexDirection: 'row',
    gap: 8,
  },
  jangarnaStat: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCEFE6',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  jangarnaStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  jangarnaStatLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  jangarnaChildrenLine: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  selectorPage: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    paddingTop: Platform.OS === 'ios' ? 52 : 24,
  },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  selectorHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text.primary,
  },
  selectorTreeSection: {
    flex: 1,
  },
  selectorCatBlock: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  selectorCatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
  },
  selectorCatHeaderActive: {
    backgroundColor: '#FFF3EC',
  },
  selectorCatTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  selectorCatTitleActive: {
    color: theme.colors.primary,
  },
  selectorCatBadge: {
    minWidth: 22,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 99,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  selectorCatBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  selectorSubList: {
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 6,
    gap: 2,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  selectorSubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
  },
  selectorSubItemSelected: {},
  selectorSubText: {
    fontSize: 13,
    color: theme.colors.text.primary,
  },
  selectorSubTextSelected: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  selectorSelectedSection: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    maxHeight: 200,
    backgroundColor: '#FFF9F7',
  },
  selectorSelectedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text.primary,
  },
  selectorAutoCats: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  selectorSelectedScroll: {
    maxHeight: 130,
    marginTop: 8,
  },
  selectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCEFE6',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectorChipText: {
    fontSize: 12,
    color: theme.colors.text.primary,
  },
  selectorFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    padding: 10,
    gap: 6,
  },
  cardTitle: {
    fontSize: 14,
    color: theme.colors.text.primary,
    fontWeight: '700',
  },
  cardMeta: {
    fontSize: 12,
    color: theme.colors.text.secondary,
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
  memberPhotoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  memberPhotoPlaceholderText: {
    fontSize: 11,
    color: theme.colors.text.secondary,
    fontWeight: '600',
  },
  tableWrap: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tableHeaderCell: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    textAlign: 'left',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowEven: {
    backgroundColor: '#FBFCFD',
  },
  tableCell: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 13,
    color: theme.colors.text.primary,
    borderRightWidth: 1,
    borderRightColor: '#F1F5F9',
    justifyContent: 'center',
  },
  tableEmpty: {
    paddingVertical: 32,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  tableMeta: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'right',
  },
  colDate: {
    width: 100,
  },
  colTitle: {
    width: 200,
  },
  colNode: {
    width: 200,
  },
  colCount: {
    width: 90,
    textAlign: 'center',
  },
  colAction: {
    width: 90,
    borderRightWidth: 0,
    alignItems: 'center',
  },
  colBy: {
    width: 180,
  },
  colAssignee: {
    width: 160,
  },
  colStatus: {
    width: 100,
  },
  colCat: {
    width: 140,
  },
  colSubcat: {
    width: 160,
  },
  memberTableContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  memberTableDataWrap: {
    flex: 1,
  },
  memberTableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  memberTableHeaderCell: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    textTransform: 'uppercase',
  },
  memberTableRow: {
    flexDirection: 'row',
    minHeight: 58,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  memberTableRowEven: {
    backgroundColor: '#FBFCFD',
  },
  memberTableCell: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: theme.colors.text.primary,
    borderRightWidth: 1,
    borderRightColor: '#F1F5F9',
    fontWeight: '600',
  },
  memberColPhoto: {
    width: 76,
  },
  memberColName: {
    width: 150,
  },
  memberColLevel: {
    width: 120,
  },
  memberColCategory: {
    width: 170,
  },
  memberColSubcategory: {
    width: 190,
  },
  memberColMobile: {
    width: 130,
  },
  memberColGotra: {
    width: 120,
  },
  memberColVillage: {
    width: 130,
  },
  memberColPeriod: {
    width: 130,
  },
  memberColPath: {
    width: 230,
  },
  memberPhotoCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberTableAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceContainerHigh,
  },
  memberTableAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceContainerHigh,
  },
  memberTableAvatarFallbackText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.text.secondary,
  },
  memberStickyEditColumn: {
    width: 94,
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  memberStickyEditHeader: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  memberStickyEditHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
  },
  memberStickyEditCell: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingHorizontal: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FEF3C7',
    alignSelf: 'flex-start',
  },
  statusBadgeCompleted: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    textTransform: 'uppercase',
  },
  statusBadgeTextCompleted: {
    color: '#166534',
  },
  tableCellTextCompact: {
    color: theme.colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  tableCellSubText: {
    color: theme.colors.text.secondary,
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  linkText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  rowActionBtn: {
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  rowActionText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  byCellWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  byAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceContainerHighest,
  },
  byAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  byAvatarFallbackText: {
    color: theme.colors.text.secondary,
    fontSize: 10,
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
    gap: 10,
  },
  twoColField: {
    flexGrow: 1,
    flexBasis: '48%',
    minWidth: 140,
    gap: 6,
  },
  inputCompact: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 34,
    fontSize: 12,
    color: theme.colors.text.primary,
  },
  filterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'flex-end',
    marginBottom: 12,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterCol: {
    flex: 1,
    minWidth: 100,
    gap: 4,
  },
  filterApplyBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterApplyText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  searchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  searchInput: {
    flexGrow: 1,
    flexBasis: 140,
    minWidth: 140,
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
  dropdownContainer: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    maxHeight: 240,
    marginTop: 6,
    overflow: 'hidden',
  },
  userDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  userDropdownItemActive: {
    backgroundColor: theme.colors.primarySoft,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  userMobileText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  userCheckIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  userCheckIconActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  userCheckText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
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
  btn: {
    flexGrow: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnLight: {
    backgroundColor: theme.colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  btnTextDark: {
    color: theme.colors.text.primary,
    fontSize: 14,
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
    flexWrap: 'wrap',
    gap: 8,
  },
  transferColumn: {
    flexGrow: 1,
    flexBasis: 200,
    minWidth: 200,
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
  activityHero: {
    marginBottom: 16,
    gap: 4,
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text.primary,
  },
  activityMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activityMetaText: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  infoCol: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    fontSize: 11,
    color: theme.colors.text.secondary,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 14,
    color: theme.colors.text.primary,
    fontWeight: '700',
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  descriptionBox: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    marginTop: 6,
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 14,
    color: theme.colors.text.primary,
    lineHeight: 20,
    fontWeight: '500',
  },
  assignCardContent: {
    gap: 12,
  },
  optionRowCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  optionChipSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  optionChipTextSmall: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text.secondary,
  },
  assignmentMemberSection: {
    marginTop: 4,
    gap: 6,
  },
  memberSelectItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberMiniAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberMiniAvatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceContainerHigh,
  },
  memberMiniAvatarText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.text.secondary,
  },
  loadingWrapper: {
    padding: 16,
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.text.secondary,
    marginLeft: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  formBody: {
    gap: 14,
  },
  photoBtnGroup: {
    flex: 1,
    gap: 8,
  },
});
