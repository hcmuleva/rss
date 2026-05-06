import { axiosClient } from './axiosClient';

export const getProjects = async () => {
  const { data } = await axiosClient.get('/projects');
  return data;
};

export interface ProjectTaskRow {
  id: string;
  projectCategory: string;
  taskName: string;
  assignedUserIds: string[];
  status: 'Assigned' | 'InProgress' | 'Completed' | 'NotReady' | 'OnHold';
  date: string;
  description: string;
  mediaUrls?: string[];
}

export const getProjectTasks = async () => {
  const { data } = await axiosClient.get<ProjectTaskRow[]>('/projects/tasks');
  return data;
};

export interface CreateProjectTaskPayload {
  projectCategory: string;
  taskName: string;
  assignedUserIds?: string[];
  mediaUrls?: string[];
  status: ProjectTaskRow['status'];
  date: string;
  description: string;
}

export const createProjectTask = async (payload: CreateProjectTaskPayload) => {
  const { data } = await axiosClient.post<ProjectTaskRow>('/projects/tasks', payload);
  return data;
};

export const getProjectTaskById = async (id: string) => {
  const { data } = await axiosClient.get<ProjectTaskRow>(`/projects/tasks/${id}`);
  return data;
};

export const updateProjectTask = async (id: string, payload: CreateProjectTaskPayload) => {
  const { data } = await axiosClient.patch<ProjectTaskRow>(`/projects/tasks/${id}`, payload);
  return data;
};
