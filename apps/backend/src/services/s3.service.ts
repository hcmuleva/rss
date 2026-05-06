import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { env } from '../config/env';

const s3 = new S3Client({
  region: env.awsRegion,
  credentials: {
    accessKeyId: env.awsAccessKeyId,
    secretAccessKey: env.awsSecretAccessKey
  }
});

export const createPresignedUpload = async (fileName: string, contentType: string): Promise<{ uploadUrl: string; key: string; publicUrl: string }> => {
  const key = `uploads/${Date.now()}-${fileName}`;
  const command = new PutObjectCommand({
    Bucket: env.s3BucketName,
    Key: key,
    ContentType: contentType
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  const publicUrl = `https://${env.s3BucketName}.s3.${env.awsRegion}.amazonaws.com/${key}`;
  return { uploadUrl, key, publicUrl };
};
