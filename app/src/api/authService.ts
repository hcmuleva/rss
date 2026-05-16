import { authClient } from './client';
import { storage } from '../core/utils/storage';
import type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  User,
} from '../core/types';

export const authService = {
  login: async (credentials: LoginRequest): Promise<AuthResponse> => {
    const response = await authClient.post('/auth/login', {
      ...credentials,
      identifier: credentials.email,
    });
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await authClient.post('/auth/register', data);
    return response.data;
  },

  saveTokens: async (accessToken: string, refreshToken: string) => {
    await storage.setItem('accessToken', accessToken);
    await storage.setItem('refreshToken', refreshToken);
  },

  saveUser: async (user: User) => {
    await storage.setItem('userData', JSON.stringify(user));
  },

  getUser: async (): Promise<User | null> => {
    const userData = await storage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
  },

  logout: async () => {
    console.log('AuthService: Starting logout...');
    
    // Check what's stored before deletion
    const accessToken = await storage.getItem('accessToken');
    const refreshToken = await storage.getItem('refreshToken');
    const userData = await storage.getItem('userData');
    
    console.log('AuthService: Before logout - has accessToken:', !!accessToken);
    console.log('AuthService: Before logout - has refreshToken:', !!refreshToken);
    console.log('AuthService: Before logout - has userData:', !!userData);
    
    // Delete all items
    await storage.deleteItem('accessToken');
    await storage.deleteItem('refreshToken');
    await storage.deleteItem('userData');
    await storage.deleteItem('selectedProfileId');
    
    // Verify deletion
    const accessTokenAfter = await storage.getItem('accessToken');
    const refreshTokenAfter = await storage.getItem('refreshToken');
    const userDataAfter = await storage.getItem('userData');
    
    console.log('AuthService: After logout - accessToken:', accessTokenAfter);
    console.log('AuthService: After logout - refreshToken:', refreshTokenAfter);
    console.log('AuthService: After logout - userData:', userDataAfter);
    console.log('AuthService: Logout complete');
  },

  isAuthenticated: async (): Promise<boolean> => {
    const token = await storage.getItem('accessToken');
    return !!token;
  },

  getMe: async (): Promise<AuthResponse> => {
    const response = await authClient.get('/auth/me');
    return response.data;
  },
};
