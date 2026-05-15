/**
 * Test S3 Upload Standalone Script
 */

require('dotenv').config();
const { uploadProfilePhoto } = require('./src/config/s3');
const fs = require('fs');

async function testUpload() {
  try {
    console.log('🧪 Testing S3 Upload...');
    console.log('USE_S3:', process.env.USE_S3);
    console.log('S3_BUCKET_NAME:', process.env.S3_BUCKET_NAME);
    console.log('AWS_REGION:', process.env.AWS_REGION);
    
    // Create test file
    const testData = Buffer.from('Test image data for S3 upload');
    const fileName = `test/test-${Date.now()}.jpg`;
    const contentType = 'image/jpeg';
    
    console.log('\n📤 Uploading to S3...');
    console.log('   File name:', fileName);
    console.log('   Content type:', contentType);
    console.log('   File size:', testData.length, 'bytes');
    
    const url = await uploadProfilePhoto(testData, fileName, contentType);
    
    console.log('\n✅ Upload successful!');
    console.log('📎 S3 URL:', url);
    console.log('\n🎉 Test passed!');
    
    return url;
  } catch (error) {
    console.error('\n❌ Upload failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testUpload();
