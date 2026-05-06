import { axiosClient } from './axiosClient';

export interface FullTimeTaskRow {
  id: string;
  title: string;
  description: string;
  date: string;
  status: 'Assigned' | 'InProgress' | 'Completed' | 'NotReady' | 'OnHold';
  location: string;
  mediaUrls: string[];
  assignedUserIds: string[];
}

export interface FullTimeTaskPayload {
  title: string;
  description: string;
  date: string;
  status: FullTimeTaskRow['status'];
  location: string;
  mediaUrls?: string[];
  assignedUserIds?: string[];
}

export const getFullTimeTasks = async () => {
  const { data } = await axiosClient.get<FullTimeTaskRow[]>('/fulltime');
  return data;
};

export const createFullTimeTask = async (payload: FullTimeTaskPayload) => {
  const { data } = await axiosClient.post<FullTimeTaskRow>('/fulltime', payload);
  return data;
};

export const updateFullTimeTask = async (id: string, payload: FullTimeTaskPayload) => {
  const { data } = await axiosClient.patch<FullTimeTaskRow>(`/fulltime/${id}`, payload);
  return data;
};
