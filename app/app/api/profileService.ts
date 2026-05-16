import { elsClient } from './client';
import type {
  ELSProfile,
  CreateProfileRequest,
  XPData,
  StreakData,
  ActivityTrackRequest,
  ActivitySummary,
  ApiResponse,
} from '../core/types';

export const profileService = {
  // Profile Management
  createProfile: async (
    data: CreateProfileRequest
  ): Promise<ApiResponse<ELSProfile>> => {
    const response = await elsClient.post('/els/profiles', data);
    return response.data;
  },

  getProfiles: async (userId: number): Promise<ApiResponse<ELSProfile[]>> => {
    const response = await elsClient.get(`/els/profiles/${userId}`);
    return response.data;
  },

  getProfileDetails: async (
    profileId: number
  ): Promise<ApiResponse<ELSProfile>> => {
    const response = await elsClient.get(
      `/els/profiles/${profileId}/details`
    );
    return response.data;
  },

  updateProfile: async (
    profileId: number,
    data: Partial<ELSProfile>
  ): Promise<ApiResponse<ELSProfile>> => {
    const response = await elsClient.put(`/els/profiles/${profileId}`, data);
    return response.data;
  },

  deleteProfile: async (profileId: number): Promise<ApiResponse<void>> => {
    const response = await elsClient.delete(`/els/profiles/${profileId}`);
    return response.data;
  },

  // XP & Progress
  getXP: async (profileId: number): Promise<ApiResponse<XPData>> => {
    const response = await elsClient.get(`/els/xp/${profileId}`);
    return response.data;
  },

  addXP: async (
    profileId: number,
    xpAmount: number,
    xpType: 'quiz' | 'story' | 'puzzle'
  ): Promise<ApiResponse<any>> => {
    const response = await elsClient.post('/els/xp/add', {
      profileId,
      xpAmount,
      xpType,
    });
    return response.data;
  },

  // Streaks
  getStreak: async (profileId: number): Promise<ApiResponse<StreakData>> => {
    const response = await elsClient.get(`/els/streaks/${profileId}`);
    return response.data;
  },

  recordDailyActivity: async (
    profileId: number
  ): Promise<ApiResponse<StreakData>> => {
    const response = await elsClient.post('/els/streaks/record', {
      profileId,
    });
    return response.data;
  },

  // Activity Tracking
  trackActivity: async (
    data: ActivityTrackRequest
  ): Promise<ApiResponse<any>> => {
    const response = await elsClient.post('/els/activity/track', data);
    return response.data;
  },

  getActivitySummary: async (
    profileId: number,
    startDate?: string,
    endDate?: string
  ): Promise<ApiResponse<ActivitySummary>> => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await elsClient.get(
      `/els/activity/${profileId}/summary?${params.toString()}`
    );
    return response.data;
  },
};
