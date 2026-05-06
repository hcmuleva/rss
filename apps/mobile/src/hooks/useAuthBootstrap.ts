import { useEffect } from 'react';

import { useAuthStore, UserRole } from '@/store/authStore';
import { authStorage } from '@/utils/authStorage';

export const useAuthBootstrap = (): void => {
  const setAuth = useAuthStore((state) => state.setAuth);
  const setHydrated = useAuthStore((state) => state.setHydrated);

  useEffect(() => {
    const bootstrap = async () => {
      const [token, refreshToken, role, userId, assignedNodeId, isFullTime] = await Promise.all([
        authStorage.getItem('access_token'),
        authStorage.getItem('refresh_token'),
        authStorage.getItem('role'),
        authStorage.getItem('user_id'),
        authStorage.getItem('assigned_node_id'),
        authStorage.getItem('is_full_time')
      ]);

      if (token && refreshToken && role && userId && assignedNodeId) {
        setAuth({
          token,
          refreshToken,
          role: role as UserRole,
          userId,
          assignedNodeId,
          isFullTime: isFullTime === 'true'
        });
      }

      setHydrated(true);
    };

    void bootstrap();
  }, [setAuth, setHydrated]);
};
