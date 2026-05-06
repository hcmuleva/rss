export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'USER';

export interface AdminUser {
  id: string;
  name: string;
  phone: string;
  password: string;
  role: Role;
  assignedNodeId: string;
  isActive: boolean;
  isFullTime: boolean;
}

export interface MasterListItem {
  id: string;
  listType: 'ConversionFrom' | 'ConversionTo' | 'ProjectCategories' | 'MatraShaktiType' | 'VidhiAayamTeam';
  name_hi: string;
  name_en: string;
}

export const adminUsers: AdminUser[] = [
  {
    id: 'u-sa-1',
    name: 'Super Admin',
    phone: '8888888888',
    password: 'super123',
    role: 'SUPER_ADMIN',
    assignedNodeId: 'h-l1-1',
    isActive: true,
    isFullTime: false
  },
  {
    id: 'u-ad-1',
    name: 'Admin User',
    phone: '9999999999',
    password: 'admin123',
    role: 'ADMIN',
    assignedNodeId: 'h-l4-1',
    isActive: true,
    isFullTime: false
  }
];

export const masterListItems: MasterListItem[] = [
  { id: 'ml-1', listType: 'ConversionFrom', name_hi: 'हिंदू', name_en: 'Hindu' },
  { id: 'ml-2', listType: 'ConversionTo', name_hi: 'अन्य', name_en: 'Other' },
  { id: 'ml-3', listType: 'ProjectCategories', name_hi: 'शिक्षा', name_en: 'Education' },
  { id: 'ml-4', listType: 'MatraShaktiType', name_hi: 'महिला प्रमुख', name_en: 'Women Lead' },
  { id: 'ml-5', listType: 'VidhiAayamTeam', name_hi: 'वकील', name_en: 'Advocate' }
];
