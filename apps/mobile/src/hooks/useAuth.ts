import { useMutation } from '@tanstack/react-query';

import { AuthResponse, login, register } from '@/api/auth.api';
import { useAuthStore } from '@/store/authStore';
import { authStorage } from '@/utils/authStorage';

const persistAuth = async (data: AuthResponse, setAuth: (params: { token: string; refreshToken: string; role: 'SUPER_ADMIN' | 'ADMIN' | 'USER'; userId: string; assignedNodeId: string; isFullTime: boolean }) => void) => {
  await authStorage.setItem('access_token', data.token);
  await authStorage.setItem('refresh_token', data.refreshToken);
  await authStorage.setItem('role', data.role);
  await authStorage.setItem('user_id', data.userId);
  await authStorage.setItem('assigned_node_id', data.assignedNodeId);
  await authStorage.setItem('is_full_time', data.isFullTime ? 'true' : 'false');
  setAuth({ token: data.token, refreshToken: data.refreshToken, role: data.role, userId: data.userId, assignedNodeId: data.assignedNodeId, isFullTime: data.isFullTime });
};

export const useLogin = () => {
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: login,
    onSuccess: async (data) => {
      await persistAuth(data, setAuth);
    }
  });
};

export const useRegister = () => {
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: register,
    onSuccess: async (data) => {
      await persistAuth(data, setAuth);
    }
  });
};

export const useLogout = () => {
  const clearAuth = useAuthStore((state) => state.clearAuth);

  return async () => {
    await authStorage.deleteItem('access_token');
    await authStorage.deleteItem('refresh_token');
    await authStorage.deleteItem('role');
    await authStorage.deleteItem('user_id');
    await authStorage.deleteItem('assigned_node_id');
    await authStorage.deleteItem('is_full_time');
    clearAuth();
  };
};
