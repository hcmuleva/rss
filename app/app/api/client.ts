import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { storage } from '../core/utils/storage';

const resolveApiHost = () => {
  const explicitHost = process.env.EXPO_PUBLIC_API_HOST?.trim();
  if (explicitHost) return explicitHost;

  const hostUri =
    (Constants.expoConfig as any)?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any)?.manifest?.debuggerHost;

  if (hostUri) {
    const [host] = String(hostUri).split(':');
    if (host) return host;
  }

  if (Platform.OS === 'android') return '10.0.2.2';
  return 'localhost';
};

const API_HOST = resolveApiHost();

const ensureApiSuffix = (url: string | undefined): string => {
  if (!url) return '';
  const trimmed = url.trim().replace(/\/$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

export const ELS_BASE_URL =
  ensureApiSuffix(process.env.EXPO_PUBLIC_ELS_API_URL || `http://${API_HOST}:4013`);
export const AUTH_BASE_URL =
  ensureApiSuffix(process.env.EXPO_PUBLIC_AUTH_API_URL || `http://${API_HOST}:4000`);
export const TEMPLE_BASE_URL =
  ensureApiSuffix(process.env.EXPO_PUBLIC_TEMPLE_API_URL || `http://${API_HOST}:4001`);
export const GATHJOD_BASE_URL =
  ensureApiSuffix(process.env.EXPO_PUBLIC_GATHJOD_API_URL || `http://${API_HOST}:4004`);
export const FAMILY_TREE_BASE_URL =
  ensureApiSuffix(process.env.EXPO_PUBLIC_FAMILY_TREE_API_URL || `http://${API_HOST}:4002`);
export const FAMILY_MANAGEMENT_BASE_URL =
  ensureApiSuffix(process.env.EXPO_PUBLIC_FAMILY_MANAGEMENT_API_URL || `http://${API_HOST}:4003`);
export const KARYAKARINI_BASE_URL =
  ensureApiSuffix(process.env.EXPO_PUBLIC_KARYAKARINI_API_URL || `http://${API_HOST}:4014`);

// API client for ELS service
export const elsClient = axios.create({
  baseURL: ELS_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// API client for auth service
export const authClient = axios.create({
  baseURL: AUTH_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// API client for temple service
export const templeClient = axios.create({
  baseURL: TEMPLE_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// API client for gathjod service
export const gathjodClient = axios.create({
  baseURL: GATHJOD_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// API client for family management service
export const familyManagementClient = axios.create({
  baseURL: FAMILY_MANAGEMENT_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// API client for karyakarini service
export const karyakariniClient = axios.create({
  baseURL: KARYAKARINI_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// API client for family tree service
export const familyTreeClient = axios.create({
  baseURL: FAMILY_TREE_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token and fix /api duplication
const addAuthInterceptor = (client: AxiosInstance) => {
  client.interceptors.request.use(
    async (config) => {
      // Fix /api duplication if baseURL already has it
      if (config.url?.startsWith('/api/')) {
        console.warn(`[API Client] Stripping redundant '/api/' prefix from: ${config.url}`);
        config.url = config.url.substring(4);
      } else if (config.url?.startsWith('api/')) {
        console.warn(`[API Client] Stripping redundant 'api/' prefix from: ${config.url}`);
        config.url = config.url.substring(3);
      }

      const token = await storage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      // Let runtime set multipart boundary for FormData uploads
      if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
        delete (config.headers as any)['Content-Type'];
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );
};

// Response interceptor - Handle token refresh
const addResponseInterceptor = (client: AxiosInstance) => {
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const refreshToken = await storage.getItem('refreshToken');
          if (refreshToken) {
            // Use path WITHOUT leading /api because it will be added by baseURL or stripped by interceptor
            const response = await authClient.post('/auth/refresh', {
              refreshToken,
            });

            const { accessToken, refreshToken: newRefreshToken } =
              response.data.data.tokens;

            await storage.setItem('accessToken', accessToken);
            await storage.setItem('refreshToken', newRefreshToken);

            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return client(originalRequest);
          }
        } catch (refreshError) {
          // Refresh failed - clear tokens
          await storage.deleteItem('accessToken');
          await storage.deleteItem('refreshToken');
          await storage.deleteItem('userData');
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    }
  );
};

// Apply interceptors
addAuthInterceptor(elsClient);
addAuthInterceptor(authClient);
addAuthInterceptor(templeClient);
addAuthInterceptor(gathjodClient);
addAuthInterceptor(familyManagementClient);
addAuthInterceptor(karyakariniClient);
addAuthInterceptor(familyTreeClient);

addResponseInterceptor(elsClient);
addResponseInterceptor(authClient);
addResponseInterceptor(templeClient);
addResponseInterceptor(gathjodClient);
addResponseInterceptor(familyManagementClient);
addResponseInterceptor(karyakariniClient);
addResponseInterceptor(familyTreeClient);

export default elsClient;
