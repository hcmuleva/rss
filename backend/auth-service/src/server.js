require('dotenv').config();
const express = require('express');
const cors = require('cors');
const User = require('./models/User');
const Announcement = require('./models/Announcement');
const authRoutes = require('./routes/authRoutes');
const announcementsRoutes = require('./routes/announcementsRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (origin.startsWith('http://localhost:') || origin.startsWith('exp://')) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
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
    await User.seedSuperAdmin();
    app.listen(PORT, () => console.log(`✅ Auth service running at http://localhost:${PORT}`));
  } catch (error) {
    console.error('❌ Failed to start auth-service:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
