import { axiosClient } from './axiosClient';
import { HierarchyNode } from '@/types/models';

export const getHierarchyNodes = async () => {
  const { data } = await axiosClient.get<HierarchyNode[]>('/hierarchy/nodes');
  return data;
};

export interface CreateHierarchyNodePayload {
  name_hi: string;
  name_en: string;
  level: string;
  branch: 'rural' | 'urban';
  parentId: string | null;
  address: string;
  addressDetails: {
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

export const createHierarchyNode = async (payload: CreateHierarchyNodePayload) => {
  const { data } = await axiosClient.post<HierarchyNode>('/hierarchy/nodes', payload);
  return data;
};
