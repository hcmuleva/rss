import { axiosClient } from './axiosClient';

interface PresignResponse {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}

export const createS3PresignedUrl = async (fileName: string, contentType: string) => {
  const { data } = await axiosClient.post<PresignResponse>('/uploads/presign', { fileName, contentType });
  return data;
};
