import { axiosClient } from './axiosClient';

export interface ActivityRow {
  id: string;
  nodeId: string;
  assignedUserIds: string[];
  category: string;
  date: string;
  description: string;
  maleOld: number;
  maleYoung: number;
  maleKids: number;
  femaleOld: number;
  femaleYoung: number;
  femaleKids: number;
  mediaUrls?: string[];
}

export const getActivities = async () => {
  const { data } = await axiosClient.get<ActivityRow[]>('/activities');
  return data;
};

export interface CreateActivityPayload {
  nodeId: string;
  assignedUserIds?: string[];
  mediaUrls?: string[];
  category: string;
  date: string;
  description: string;
  maleOld: number;
  maleYoung: number;
  maleKids: number;
  femaleOld: number;
  femaleYoung: number;
  femaleKids: number;
}

export const createActivity = async (payload: CreateActivityPayload) => {
  const { data } = await axiosClient.post<ActivityRow>('/activities', payload);
  return data;
};

export const getActivityById = async (id: string) => {
  const { data } = await axiosClient.get<ActivityRow>(`/activities/${id}`);
  return data;
};

export const updateActivity = async (id: string, payload: CreateActivityPayload) => {
  const { data } = await axiosClient.patch<ActivityRow>(`/activities/${id}`, payload);
  return data;
};
