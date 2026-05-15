require('dotenv').config();
const cors = require('cors');
const express = require('express');
const pool = require('./config/database');
const KaryakariniModel = require('./models/KaryakariniModel');
const karyakariniRoutes = require('./routes/karyakariniRoutes');

const app = express();
const PORT = Number(process.env.PORT || 4014);

const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:19006',
];
const envOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];
const isLocalDevOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || origin.startsWith('exp://');

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (process.env.NODE_ENV !== 'production' && isLocalDevOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.status(200).json({
      success: true,
      service: 'karyakarini-service',
      status: 'ok',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Database connection failed',
    });
  }
});

app.use('/api/karyakarini', karyakariniRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.path,
  });
});

app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: error?.message || 'Internal server error',
  });
});

async function startServer() {
  try {
    await pool.query('SELECT NOW()');
    await KaryakariniModel.initTables();

    app.listen(PORT, () => {
      console.log(`✅ Karyakarini service running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start karyakarini-service:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});

startServer();

module.exports = app;
