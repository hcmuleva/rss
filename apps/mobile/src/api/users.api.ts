import { axiosClient } from './axiosClient';

export interface AdminUserRow {
  id: string;
  name: string;
  phone: string;
  photoUrl?: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'USER';
  assignedNodeId: string;
  isActive: boolean;
  isFullTime?: boolean;
}

export interface GetUsersParams {
  assignedNodeId?: string;
}

type QueryContextLike = { queryKey?: unknown };

const resolveGetUsersParams = (input?: GetUsersParams | QueryContextLike): GetUsersParams | undefined => {
  if (!input || typeof input !== 'object') {
    return undefined;
  }
  if ('queryKey' in input) {
    return undefined;
  }
  const params = input as GetUsersParams;
  return typeof params.assignedNodeId === 'string' && params.assignedNodeId ? { assignedNodeId: params.assignedNodeId } : undefined;
};

export const getUsers = async (input?: GetUsersParams | QueryContextLike) => {
  const params = resolveGetUsersParams(input);
  const { data } = await axiosClient.get<AdminUserRow[]>('/users', { params });
  return data;
};

export interface CreateUserPayload {
  name: string;
  phone: string;
  password: string;
  role: 'ADMIN' | 'USER';
  assignedNodeId: string;
  photoUrl?: string;
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
  photoUrl?: string;
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
