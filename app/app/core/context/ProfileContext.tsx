import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authService } from '../../api/authService';
import type { User } from '../types';

interface ProfileContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  selectedProfile: null;
  profiles: [];
  selectProfile: (_profile: any) => void;
  loadProfiles: (_forceUserId?: number) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const isAuth = await authService.isAuthenticated();
        setIsAuthenticated(isAuth);
        if (isAuth) {
          const cachedUser = await authService.getUser();
          setUser(cachedUser);
        }
      } finally {
        setIsLoading(false);
      }
    };
    void bootstrap();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authService.login({ email, password });
    await authService.saveTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken);
    await authService.saveUser(response.data.user);
    setUser(response.data.user);
    setIsAuthenticated(true);
  };

  const register = async (data: any) => {
    const response = await authService.register(data);
    await authService.saveTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken);
    await authService.saveUser(response.data.user);
    setUser(response.data.user);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  const refreshUser = async () => {
    const response = await authService.getMe();
    if (response.success && response.data?.user) {
      setUser(response.data.user);
      await authService.saveUser(response.data.user);
    }
  };

  const noopAsync = async () => {};
  const noop = () => {};

  return (
    <ProfileContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
        selectedProfile: null,
        profiles: [],
        selectProfile: noop,
        loadProfiles: noopAsync,
        refreshProfile: noopAsync,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used within ProfileProvider');
  return context;
};
