import { axiosClient } from './axiosClient';

export interface AdminUserRow {
  id: string;
  name: string;
  phone: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'USER';
  assignedNodeId: string;
  isActive: boolean;
  isFullTime?: boolean;
}

export const getUsers = async () => {
  const { data } = await axiosClient.get<AdminUserRow[]>('/users');
  return data;
};

export interface CreateUserPayload {
  name: string;
  phone: string;
  password: string;
  role: 'ADMIN' | 'USER';
  assignedNodeId: string;
  isFullTime?: boolean;
}

export const createUser = async (payload: CreateUserPayload) => {
  const { data } = await axiosClient.post<AdminUserRow>('/users', payload);
  return data;
};

export interface UpdateUserPayload {
  name: string;
  phone: string;
  password?: string;
  role: 'ADMIN' | 'USER';
  assignedNodeId: string;
  isFullTime?: boolean;
}

export const updateUser = async (id: string, payload: UpdateUserPayload) => {
  const { data } = await axiosClient.patch<AdminUserRow>(`/users/${id}`, payload);
  return data;
};

export const updateUserStatus = async (id: string, isActive: boolean) => {
  const { data } = await axiosClient.patch<AdminUserRow>(`/users/${id}/status`, { isActive });
  return data;
};
