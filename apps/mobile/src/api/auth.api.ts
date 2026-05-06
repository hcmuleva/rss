import { axiosClient } from './axiosClient';

export interface LoginPayload {
  phone: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  phone: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'USER';
  userId: string;
  assignedNodeId: string;
  isFullTime: boolean;
}

export const login = async (payload: LoginPayload) => {
  const { data } = await axiosClient.post<AuthResponse>('/auth/login', payload);
  return data;
};

export const register = async (payload: RegisterPayload) => {
  const { data } = await axiosClient.post<AuthResponse>('/auth/register', payload);
  return data;
};
