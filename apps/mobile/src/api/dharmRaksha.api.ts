import { axiosClient } from './axiosClient';

export interface DharmRakshaRow {
  id: string;
  nodeId: string;
  category: string;
  date: string;
  description: string;
  mediaUrls: string[];
  assignedUserIds: string[];
}

export interface DharmRakshaPayload {
  nodeId: string;
  category: string;
  date: string;
  description: string;
  mediaUrls?: string[];
  assignedUserIds?: string[];
}

export const getDharmRakshaEntries = async () => {
  const { data } = await axiosClient.get<DharmRakshaRow[]>('/dharm-raksha');
  return data;
};

export const createDharmRakshaEntry = async (payload: DharmRakshaPayload) => {
  const { data } = await axiosClient.post<DharmRakshaRow>('/dharm-raksha', payload);
  return data;
};
