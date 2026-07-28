import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { initDatabase } from './database/db';

// Routes
import authRoutes from './routes/auth';
import studentRoutes from './routes/students';
import feeStructureRoutes from './routes/feeStructure';
import transactionRoutes from './routes/transactions';
import importRoutes from './routes/imports';
import ledgerRoutes from './routes/ledger';
import dashboardRoutes from './routes/dashboard';
import adjustmentRoutes from './routes/adjustments';
import adminRoutes from './routes/admin';

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Middleware
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize DB
initDatabase().catch(err => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/fee-structure', feeStructureRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/adjustments', adjustmentRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Fee Ledger Server running on port ${PORT}`);
});

export default app;
