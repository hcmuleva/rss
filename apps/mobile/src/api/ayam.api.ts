import { axiosClient } from './axiosClient';
import { VanshavaliNode } from '@/types/models';

export const getAyamEntries = async () => {
  const { data } = await axiosClient.get<AyamEntryRow[]>('/ayam');
  return data;
};

export interface AyamEntryRow {
  id: string;
  subCategory: string;
  nodeId: string;
  assignedUserIds: string[];
  description: string;
  workedFor: string;
  whoWorked: string;
  date: string;
  mediaUrls?: string[];
  documentUrls?: string[];
}

export interface CreateAyamPayload {
  subCategory: string;
  nodeId: string;
  assignedUserIds?: string[];
  mediaUrls?: string[];
  documentUrls?: string[];
  description: string;
  workedFor: string;
  whoWorked: string;
  date: string;
}

export interface AyamMemberRow {
  id: string;
  subCategory: 'Nidhi' | 'Sanskriti' | 'MatraShakti' | 'Vidhi Aayam';
  nodeId: string;
  memberType?: string;
  name: string;
  guardianName: string;
  maritalStatus: 'Single' | 'Married' | 'Widowed' | 'Other';
  dob: string;
  address: string;
  addressDetails?: {
    villageOrMohalla?: string;
    tehsil?: string;
    district?: string;
    state?: string;
    country?: string;
    pincode?: string;
  };
  photoUrl?: string;
  isActive?: boolean;
  assignedUserIds: string[];
}

export interface CreateAyamMemberPayload {
  subCategory: AyamMemberRow['subCategory'];
  nodeId: string;
  memberType?: string;
  name: string;
  guardianName: string;
  maritalStatus: AyamMemberRow['maritalStatus'];
  dob: string;
  address: string;
  addressDetails?: AyamMemberRow['addressDetails'];
  photoUrl?: string;
  assignedUserIds?: string[];
}

export const createAyamEntry = async (payload: CreateAyamPayload) => {
  const { data } = await axiosClient.post<AyamEntryRow>('/ayam', payload);
  return data;
};

export const getAyamEntryById = async (id: string) => {
  const { data } = await axiosClient.get<AyamEntryRow>(`/ayam/${id}`);
  return data;
};

export const updateAyamEntry = async (id: string, payload: CreateAyamPayload) => {
  const { data } = await axiosClient.patch<AyamEntryRow>(`/ayam/${id}`, payload);
  return data;
};

export const getAyamMembers = async (subCategory?: string) => {
  const { data } = await axiosClient.get<AyamMemberRow[]>('/ayam/members', { params: subCategory ? { subCategory } : undefined });
  return data;
};

export const createAyamMember = async (payload: CreateAyamMemberPayload) => {
  const { data } = await axiosClient.post<AyamMemberRow>('/ayam/members', payload);
  return data;
};

export const updateAyamMember = async (id: string, payload: CreateAyamMemberPayload) => {
  const { data } = await axiosClient.patch<AyamMemberRow>(`/ayam/members/${id}`, payload);
  return data;
};

export const updateAyamMemberStatus = async (id: string, isActive: boolean) => {
  const { data } = await axiosClient.patch<{ id: string; isActive: boolean }>(`/ayam/members/${id}/status`, { isActive });
  return data;
};

export const deleteAyamMember = async (id: string) => {
  const { data } = await axiosClient.delete<{ id: string }>(`/ayam/members/${id}`);
  return data;
};

export const getVanshavaliNodes = async () => {
  const { data } = await axiosClient.get<VanshavaliNode[]>('/ayam/vanshavali/nodes');
  return data;
};

export interface CreateVanshavaliPayload {
  parentId: string | null;
  name: string;
  religion: string;
  caste: string;
  gotra: string;
  from?: string;
  till?: string;
}

export const createVanshavaliNode = async (payload: CreateVanshavaliPayload) => {
  const { data } = await axiosClient.post<VanshavaliNode>('/ayam/vanshavali/nodes', payload);
  return data;
};
