const AWS = require('aws-sdk');

AWS.config.update({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();
const BUCKET_NAME =
  process.env.S3_BUCKET_NAME ||
  process.env.AWS_S3_BUCKET ||
  'emeelan-seervi-portal';

const sanitizeFileName = (value) =>
  String(value || 'file')
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')
    .replace(/_+/g, '_');

const uploadBufferToS3 = async ({ buffer, key, contentType }) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType || 'application/octet-stream',
    ACL: 'public-read',
  };

  const result = await s3.upload(params).promise();
  return result.Location;
};

module.exports = {
  s3,
  BUCKET_NAME,
  sanitizeFileName,
  uploadBufferToS3,
};
