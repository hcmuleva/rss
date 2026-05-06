import { axiosClient } from './axiosClient';

export interface MasterListRow {
  id: string;
  listType: 'ConversionFrom' | 'ConversionTo' | 'ProjectCategories' | 'MatraShaktiType' | 'VidhiAayamTeam';
  name_hi: string;
  name_en: string;
}

export const getMasterLists = async () => {
  const { data } = await axiosClient.get<MasterListRow[]>('/master-lists');
  return data;
};

export interface CreateMasterListPayload {
  listType: MasterListRow['listType'];
  name_hi: string;
  name_en: string;
}

export const createMasterListItem = async (payload: CreateMasterListPayload) => {
  const { data } = await axiosClient.post<MasterListRow>('/master-lists', payload);
  return data;
};

export const deleteMasterListItem = async (id: string) => {
  const { data } = await axiosClient.delete<MasterListRow>(`/master-lists/${id}`);
  return data;
};
