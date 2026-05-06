export interface HierarchyNode {
  id: string;
  name_hi: string;
  name_en: string;
  level: string;
  branch: 'rural' | 'urban';
  parentId: string | null;
  address: string;
  addressDetails?: {
    villageOrMohalla: string;
    tehsil: string;
    district: string;
    state: string;
    country: string;
    pincode: string;
  };
  lat: number;
  long: number;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  photo?: string;
  roleLevel: string;
  assignedNodeId: string;
  isFullTime: boolean;
}

export interface SensitiveEntry {
  id: string;
  nodeId: string;
  fromType: string;
  toType: string;
  date: string;
  isPartial: boolean;
  hinduCount?: number;
  convertedCount?: number;
  assignedUserIds?: string[];
  status: 'Assigned' | 'Delayed' | 'NotStarted' | 'Completed' | 'NotReady' | 'OnHold';
  address?: string;
  mediaUrls?: string[];
  photo?: string;
}

export interface Activity {
  id: string;
  nodeId: string;
  category: string;
  date: string;
  media: string[];
  attendance: {
    maleOld: number;
    maleYoung: number;
    maleKids: number;
    femaleOld: number;
    femaleYoung: number;
    femaleKids: number;
  };
  description: string;
  createdBy: string;
  organisedBy: string;
}

export interface Task {
  id: string;
  projectId: string;
  status: 'Assigned' | 'InProgress' | 'Completed' | 'NotReady' | 'OnHold';
  description: string;
  media: string[];
  date: string;
  workedBy: string[];
}

export interface Project {
  id: string;
  categoryId: string;
  teamIds: string[];
  nodeId: string;
  tasks: Task[];
}

export interface AyamEntry {
  id: string;
  subCategory: string;
  nodeId: string;
  media: string[];
  description: string;
  memberIds: string[];
  meta: Record<string, unknown>;
}

export interface MasterListItem {
  id: string;
  listType: string;
  name_hi: string;
  name_en: string;
}

export interface VanshavaliNode {
  id: string;
  parentId: string | null;
  childrenIds: string[];
  photo?: string;
  name: string;
  dates: {
    from?: string;
    till?: string;
  };
  religion: string;
  caste: string;
  gotra: string;
}
