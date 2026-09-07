/**
 * index.js
 * Entry point cho Express 5 server.
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import authRoutes from './routes/auth.routes.js';
import tripRoutes from './routes/trip.routes.js';
import expenseRoutes from './routes/expense.routes.js';
import adminRoutes from './routes/admin.routes.js';
import userRoutes from './routes/user.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import { initBlockchain } from './services/blockchain/blockchainService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ──────── Middleware ────────
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

// Ảnh lưu trong DB (bảng Image), serve qua /api/expenses/:id/image

// ──────── Routes ────────
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// ──────── Global Error Handler ────────
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.message);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal Server Error',
    });
});

// ──────── Start Server ────────
app.listen(PORT, () => {
    console.log(`\n🚀 FlexiTrip Server running at http://localhost:${PORT}`);
    console.log(`📝 API docs: http://localhost:${PORT}/api/health\n`);

    // Khởi tạo blockchain (không bắt buộc — server chạy được mà không có blockchain)
    initBlockchain();
});

export default app;
