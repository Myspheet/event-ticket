require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./db/database');

const authRoutes = require('./routes/auth');
const guestRoutes = require('./routes/guests');
const publicRoutes = require('./routes/public');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/public', publicRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Serve static uploads if any
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Initialize DB (creates tables + seeds users) then start server
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("[DB] Failed to initialize database:", err);
    process.exit(1);
  });
