require('dotenv').config();
const express = require('express');
const cors = require('cors');
const User = require('./models/User');
const Announcement = require('./models/Announcement');
const Category = require('./models/Category');
const Subcategory = require('./models/Subcategory');
const Level = require('./models/Level');
const Karyakshetra = require('./models/Karyakshetra');
const LevelConstraint = require('./models/LevelConstraint');
const AuditLog = require('./models/AuditLog');
const authRoutes = require('./routes/authRoutes');
const announcementsRoutes = require('./routes/announcementsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const superadminRoutes = require('./routes/superadminRoutes');

const app = express();
const PORT = Number(process.env.PORT || 4000);

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

app.get('/health', (req, res) =>
  res.json({
    success: true,
    service: 'auth-service',
    status: 'ok',
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/superadmin', superadminRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled auth-service error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

const startServer = async () => {
  try {
    await User.createTable();
    await Announcement.createTable();
    await Category.createTable();
    await Category.seedDefaults();
    await Subcategory.createTable();
    await Subcategory.seedDefaults();
    await Level.createTable();
    await Level.seedDefaults();
    await Karyakshetra.createTable();
    await LevelConstraint.createTable();
    await LevelConstraint.seedDefaults();
    await AuditLog.createTable();
    await AuditLog.backfillFromMasterData();
    await User.seedSuperAdmin();
    app.listen(PORT, () => console.log(`✅ Auth service running at http://localhost:${PORT}`));
  } catch (error) {
    console.error('❌ Failed to start auth-service:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
