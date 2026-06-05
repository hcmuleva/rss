import { authClient, karyakariniClient } from './client';

export interface Category {
  id: number;
  name: string;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface Subcategory {
  id: number;
  category_id: number;
  category_name?: string;
  name: string;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface Level {
  id: number;
  name: string;
  code: string | null;
  level_order: number;
  is_active: boolean;
  is_dynamic: boolean;
  created_at: string;
  updated_at: string;
  place_count?: number;
  child_level_count?: number;
}

export interface Karyakshetra {
  id: number;
  name: string;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface LevelConstraint {
  id: number;
  child_level: string;
  parent_level: string | null;
  created_at: string;
}

export interface AuditLog {
  id: number;
  actor_id: number | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  entity_label: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface AuditLogPage {
  logs: AuditLog[];
  total: number;
}

export interface KaryakariniVersion {
  id: number;
  name: string;
  is_current: boolean;
}

export interface TreeNode {
  id: number;
  name: string;
  level: string;
  parent_id: number | null;
  member_count: number;
  child_count: number;
}

export interface SubtreeNode {
  id: number;
  name: string;
  level: string;
  parent_id: number | null;
  depth: number;
}

export const superadminService = {
  // Categories (Aayam)
  listCategories: async (includeInactive = false): Promise<Category[]> => {
    const response = await authClient.get('/superadmin/categories', {
      params: { includeInactive: includeInactive ? 'true' : 'false' },
    });
    return (response.data?.data?.categories || []) as Category[];
  },

  createCategory: async (name: string): Promise<Category> => {
    const response = await authClient.post('/superadmin/categories', { name });
    return response.data?.data?.category as Category;
  },

  updateCategory: async (id: number, name: string): Promise<Category> => {
    const response = await authClient.put(`/superadmin/categories/${id}`, { name });
    return response.data?.data?.category as Category;
  },

  deactivateCategory: async (id: number): Promise<Category> => {
    const response = await authClient.patch(`/superadmin/categories/${id}/deactivate`);
    return response.data?.data?.category as Category;
  },

  reactivateCategory: async (id: number): Promise<Category> => {
    const response = await authClient.patch(`/superadmin/categories/${id}/reactivate`);
    return response.data?.data?.category as Category;
  },

  // Subcategories (Toli)
  listSubcategories: async (categoryId?: number, includeInactive = false): Promise<Subcategory[]> => {
    const response = await authClient.get('/superadmin/subcategories', {
      params: {
        categoryId: categoryId || undefined,
        includeInactive: includeInactive ? 'true' : 'false',
      },
    });
    return (response.data?.data?.subcategories || []) as Subcategory[];
  },

  createSubcategory: async (categoryId: number, name: string): Promise<Subcategory> => {
    const response = await authClient.post('/superadmin/subcategories', { categoryId, name });
    return response.data?.data?.subcategory as Subcategory;
  },

  updateSubcategory: async (id: number, name: string): Promise<Subcategory> => {
    const response = await authClient.put(`/superadmin/subcategories/${id}`, { name });
    return response.data?.data?.subcategory as Subcategory;
  },

  deactivateSubcategory: async (id: number): Promise<Subcategory> => {
    const response = await authClient.patch(`/superadmin/subcategories/${id}/deactivate`);
    return response.data?.data?.subcategory as Subcategory;
  },

  reactivateSubcategory: async (id: number): Promise<Subcategory> => {
    const response = await authClient.patch(`/superadmin/subcategories/${id}/reactivate`);
    return response.data?.data?.subcategory as Subcategory;
  },

  // Levels
  listLevels: async (includeInactive = false): Promise<Level[]> => {
    const response = await authClient.get('/superadmin/levels', {
      params: { includeInactive: includeInactive ? 'true' : 'false' },
    });
    return (response.data?.data?.levels || []) as Level[];
  },

  createLevel: async (name: string, code: string): Promise<Level> => {
    const response = await authClient.post('/superadmin/levels', {
      name,
      code,
      isDynamic: true,
    });
    return response.data?.data?.level as Level;
  },

  updateLevel: async (id: number, name: string): Promise<Level> => {
    const response = await authClient.put(`/superadmin/levels/${id}`, { name });
    return response.data?.data?.level as Level;
  },

  deleteLevel: async (id: number): Promise<void> => {
    await authClient.delete(`/superadmin/levels/${id}`);
  },

  moveLevel: async (id: number, direction: 'up' | 'down'): Promise<Level[]> => {
    const response = await authClient.patch(`/superadmin/levels/${id}/move`, { direction });
    return (response.data?.data?.levels || []) as Level[];
  },

  deactivateLevel: async (id: number): Promise<Level> => {
    const response = await authClient.patch(`/superadmin/levels/${id}/deactivate`);
    return response.data?.data?.level as Level;
  },

  reactivateLevel: async (id: number): Promise<Level> => {
    const response = await authClient.patch(`/superadmin/levels/${id}/reactivate`);
    return response.data?.data?.level as Level;
  },

  // Karyakshetra
  listKaryakshetras: async (includeInactive = false): Promise<Karyakshetra[]> => {
    const response = await authClient.get('/superadmin/karyakshetras', {
      params: { includeInactive: includeInactive ? 'true' : 'false' },
    });
    return (response.data?.data?.karyakshetras || []) as Karyakshetra[];
  },

  createKaryakshetra: async (name: string): Promise<Karyakshetra> => {
    const response = await authClient.post('/superadmin/karyakshetras', { name });
    return response.data?.data?.karyakshetra as Karyakshetra;
  },

  updateKaryakshetra: async (id: number, name: string): Promise<Karyakshetra> => {
    const response = await authClient.put(`/superadmin/karyakshetras/${id}`, { name });
    return response.data?.data?.karyakshetra as Karyakshetra;
  },

  deactivateKaryakshetra: async (id: number): Promise<Karyakshetra> => {
    const response = await authClient.patch(`/superadmin/karyakshetras/${id}/deactivate`);
    return response.data?.data?.karyakshetra as Karyakshetra;
  },

  reactivateKaryakshetra: async (id: number): Promise<Karyakshetra> => {
    const response = await authClient.patch(`/superadmin/karyakshetras/${id}/reactivate`);
    return response.data?.data?.karyakshetra as Karyakshetra;
  },

  // Level constraints (parent-level rules)
  listLevelConstraints: async (): Promise<LevelConstraint[]> => {
    const response = await authClient.get('/superadmin/level-constraints');
    return (response.data?.data?.constraints || []) as LevelConstraint[];
  },

  createLevelConstraint: async (
    childLevel: string,
    parentLevel: string | null
  ): Promise<LevelConstraint> => {
    const response = await authClient.post('/superadmin/level-constraints', {
      childLevel,
      parentLevel,
    });
    return response.data?.data?.constraint as LevelConstraint;
  },

  deleteLevelConstraint: async (id: number): Promise<void> => {
    await authClient.delete(`/superadmin/level-constraints/${id}`);
  },

  // Audit log
  listAuditLogs: async (params?: {
    entityType?: string;
    action?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLogPage> => {
    const response = await authClient.get('/superadmin/audit-logs', {
      params: {
        entityType: params?.entityType || undefined,
        action: params?.action || undefined,
        search: params?.search || undefined,
        limit: params?.limit ?? 50,
        offset: params?.offset ?? 0,
      },
    });
    return {
      logs: (response.data?.data?.logs || []) as AuditLog[],
      total: Number(response.data?.data?.total || 0),
    };
  },

  // Karyakshetra tree (existing karyakarini node data)
  listVersions: async (): Promise<KaryakariniVersion[]> => {
    const response = await karyakariniClient.get('/karyakarini/versions');
    return (response.data?.data?.versions || response.data?.data || []) as KaryakariniVersion[];
  },

  listTreeNodes: async (versionId: number, parentId: number | null): Promise<TreeNode[]> => {
    const response = await karyakariniClient.get('/karyakarini/tree', {
      params: { versionId, parentId: parentId || undefined },
    });
    return (response.data?.data?.nodes || []) as TreeNode[];
  },

  createTreeNode: async (
    versionId: number,
    parentId: number | null,
    name: string,
    level: string
  ): Promise<TreeNode> => {
    const response = await karyakariniClient.post('/karyakarini/nodes', {
      versionId,
      parentId: parentId || undefined,
      name,
      level,
    });
    return response.data?.data as TreeNode;
  },

  updateTreeNode: async (
    nodeId: number,
    versionId: number,
    name: string,
    level: string
  ): Promise<TreeNode> => {
    const response = await karyakariniClient.put(`/karyakarini/nodes/${nodeId}`, {
      versionId,
      name,
      level,
    });
    return response.data?.data as TreeNode;
  },

  deleteTreeNode: async (nodeId: number, versionId: number): Promise<void> => {
    await karyakariniClient.delete(`/karyakarini/nodes/${nodeId}`, {
      params: { versionId },
    });
  },

  getNodeSubtree: async (
    nodeId: number,
    versionId: number,
    includeSelf = true
  ): Promise<SubtreeNode[]> => {
    const response = await karyakariniClient.get(`/karyakarini/nodes/${nodeId}/subtree`, {
      params: { versionId, includeSelf: includeSelf ? 'true' : 'false' },
    });
    return (response.data?.data?.nodes || []) as SubtreeNode[];
  },

  bulkUpdateSubtree: async (
    nodeId: number,
    versionId: number,
    name: string,
    level: string
  ): Promise<{ count: number }> => {
    const response = await karyakariniClient.put(`/karyakarini/nodes/${nodeId}/bulk-update`, {
      versionId,
      name,
      level,
    });
    return (response.data?.data || { count: 0 }) as { count: number };
  },
};
