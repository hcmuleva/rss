import { createS3PresignedUrl } from '@/api/uploads.api';

export const uploadFileToS3 = async (uri: string, fileName: string, contentType = 'image/jpeg'): Promise<string> => {
  const signed = await createS3PresignedUrl(fileName, contentType);
  const fileResponse = await fetch(uri);
  const blob = await fileResponse.blob();
  await fetch(signed.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob
  });
  return signed.publicUrl;
};