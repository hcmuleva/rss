import { axiosClient } from './axiosClient';
import { SensitiveEntry } from '@/types/models';

export const getSensitiveEntries = async () => {
  const { data } = await axiosClient.get<SensitiveEntry[]>('/sensitive');
  return data;
};

export interface CreateSensitivePayload {
  nodeId: string;
  assignedUserIds?: string[];
  mediaUrls?: string[];
  fromType: string;
  toType: string;
  date: string;
  isPartial: boolean;
  hinduCount?: number;
  convertedCount?: number;
  status: SensitiveEntry['status'];
  address: string;
}

export const createSensitiveEntry = async (payload: CreateSensitivePayload) => {
  const { data } = await axiosClient.post<SensitiveEntry>('/sensitive', payload);
  return data;
};

export const getSensitiveEntryById = async (id: string) => {
  const { data } = await axiosClient.get<SensitiveEntry>(`/sensitive/${id}`);
  return data;
};

export const updateSensitiveEntry = async (id: string, payload: CreateSensitivePayload) => {
  const { data } = await axiosClient.patch<SensitiveEntry>(`/sensitive/${id}`, payload);
  return data;
};
