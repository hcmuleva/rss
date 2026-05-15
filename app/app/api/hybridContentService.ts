import { elsClient } from './client';
import type { ApiResponse } from '../core/types';

type QueryValue = string | number | boolean | null | undefined;

const buildQueryString = (params: object): string => {
  const query = new URLSearchParams();
  Object.entries(params as Record<string, QueryValue>).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    query.append(key, String(value));
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
};

export interface HybridFeedQuery {
  profileId?: number;
  categoryCode?: string;
  subcategoryCode?: string;
  publishContext?: string;
  grade?: number;
  level?: number;
  date?: string;
  language?: string;
  limit?: number;
  fallbackToHybridResolve?: boolean;
}

export interface HybridFeedItem {
  id: number;
  title: string;
  description: string | null;
  category: { code: string; name: string };
  subcategory?: { code: string; name: string } | null;
  contentType: string;
  sourceType: string;
  sourceUrl?: string | null;
  media?: {
    kind?: string | null;
    payload?: Record<string, any>;
  };
  creator?: {
    name?: string;
    avatarUrl?: string | null;
  };
  publishedDate?: string | null;
  publishContext?: string | null;
  eligibleGrades?: number[];
  allGrades?: boolean;
  tags?: string[];
  qualityScore?: number;
  slotType?: string | null;
}

export interface HybridFeedResponse {
  source: string;
  meta: Record<string, any>;
  slider: HybridFeedItem[];
  list: HybridFeedItem[];
  items: HybridFeedItem[];
  categoriesAvailable?: { code: string; name: string }[];
}

export interface HybridGroupedFeedResponse {
  source: string;
  meta: Record<string, any>;
  grouped: {
    category: { code: string; name: string };
    slider: HybridFeedItem[];
    list: HybridFeedItem[];
    subcategories: {
      subcategory: { code: string; name: string } | null;
      items: HybridFeedItem[];
    }[];
  }[];
}

export const hybridContentService = {
  getFeed: async (
    params: HybridFeedQuery
  ): Promise<ApiResponse<HybridFeedResponse>> => {
    const response = await elsClient.get(
      `/els/hybrid-content/feed${buildQueryString(params)}`
    );
    return response.data;
  },

  getGroupedFeed: async (
    params: HybridFeedQuery
  ): Promise<ApiResponse<HybridGroupedFeedResponse>> => {
    const response = await elsClient.get(
      `/els/hybrid-content/feed/grouped${buildQueryString(params)}`
    );
    return response.data;
  },

  resolveContent: async (
    payload: {
      profileId?: number;
      categoryCode: string;
      subcategoryCode?: string;
      grade: number;
      level: number;
      language?: string;
      limit?: number;
    }
  ): Promise<ApiResponse<HybridFeedResponse>> => {
    const response = await elsClient.post('/els/hybrid-content/resolve', payload);
    return response.data;
  },
};
