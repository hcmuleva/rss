require('dotenv').config();
const pool = require('./config/database');
const KaryakariniModel = require('./models/KaryakariniModel');

async function test() {
  try {
    const versionId = 1;
    const userId = 13;
    const visibleNodeIds = await KaryakariniModel.getMemberVisibleNodeIds({
      userId,
      versionId,
    });
    console.log('Visible Node IDs:', visibleNodeIds);

    const result = await KaryakariniModel.getCategoryActivities({
      versionId,
      visibleNodeIds,
      page: 1,
      limit: 100,
      category: '',
      subcategory: '',
      nodeLevel: '',
    });
    console.log('Activities count:', result.rows.length);
    console.log('Activities:', result.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

test();
