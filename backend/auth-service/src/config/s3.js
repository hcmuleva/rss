/**
 * AWS S3 Configuration for Profile Photo Uploads
 */

const AWS = require('aws-sdk');
const https = require('https');
require('dotenv').config();

// Configure AWS
AWS.config.update({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  httpOptions: {
    agent: new https.Agent({
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    })
  }
});

const s3 = new AWS.S3();
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'gathjod-emeelan';

/**
 * Upload profile photo to S3
 * @param {Buffer} fileBuffer - File buffer
 * @param {number} userId - User ID
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} - S3 URL
 */
const uploadProfilePhoto = async (fileBuffer, userId, contentType) => {
  const timestamp = Date.now();
  const key = `profiles/${userId}/${timestamp}.jpg`;

  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
    ACL: 'public-read'
  };

  try {
    const result = await s3.upload(params).promise();
    console.log(`✅ Profile photo uploaded to S3: ${result.Location}`);
    return result.Location;
  } catch (error) {
    console.error('❌ S3 upload error:', error);
    throw new Error('Failed to upload profile photo to S3');
  }
};

/**
 * Delete profile photo from S3
 * @param {string} photoUrl - S3 URL
 */
const deleteProfilePhoto = async (photoUrl) => {
  if (!photoUrl || !photoUrl.includes(BUCKET_NAME)) {
    return; // Not an S3 URL
  }

  try {
    // Extract key from URL
    const urlParts = photoUrl.split('.com/');
    if (urlParts.length < 2) return;
    
    const key = urlParts[1];

    const params = {
      Bucket: BUCKET_NAME,
      Key: key
    };

    await s3.deleteObject(params).promise();
    console.log(`✅ Deleted profile photo from S3: ${key}`);
  } catch (error) {
    console.error('❌ S3 delete error:', error);
    // Don't throw error - deletion is not critical
  }
};

module.exports = {
  uploadProfilePhoto,
  deleteProfilePhoto,
  s3,
  BUCKET_NAME
};
