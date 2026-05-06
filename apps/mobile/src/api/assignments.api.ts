import { axiosClient } from './axiosClient';

export type AssignmentModuleType = 'Sensitive' | 'Activities' | 'Project' | 'Ayam' | 'DharmRaksha' | 'FullTime';

export interface ModuleAssignmentRow {
  id: string;
  moduleType: AssignmentModuleType;
  assignmentKey: string;
  nodeId?: string | null;
  assignedUserIds: string[];
}

export interface ModuleAssignmentPayload {
  moduleType: AssignmentModuleType;
  assignmentKey: string;
  nodeId?: string | null;
  assignedUserIds: string[];
}

export const getAssignments = async () => {
  const { data } = await axiosClient.get<ModuleAssignmentRow[]>('/assignments');
  return data;
};

export const saveAssignment = async (payload: ModuleAssignmentPayload) => {
  const { data } = await axiosClient.post<ModuleAssignmentRow>('/assignments', payload);
  return data;
};

export const deleteAssignment = async (id: string) => {
  const { data } = await axiosClient.delete<{ id: string }>(`/assignments/${id}`);
  return data;
};
