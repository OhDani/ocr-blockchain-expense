/**
 * user.routes.js — Profile routes (avatar, etc.)
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const prisma = new PrismaClient();
const router = Router();

import { authenticate } from '../middleware/auth.js';
router.use(authenticate);

// Avatar upload config
const avatarStorage = multer.diskStorage({
    destination: join(__dirname, '..', '..', 'uploads', 'avatars'),
    filename: (req, file, cb) => {
        const ext = file.originalname.split('.').pop();
        cb(null, `avatar-${req.user.id}-${Date.now()}.${ext}`);
    },
});
const uploadAvatar = multer({
    storage: avatarStorage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Chỉ chấp nhận file ảnh'));
    },
});

/**
 * PATCH /api/user/avatar — Upload avatar mới
 */
router.patch('/avatar', uploadAvatar.single('avatar'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Không có file nào' });
        }

        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        const updated = await prisma.user.update({
            where: { id: req.user.id },
            data: { avatarUrl },
            select: { id: true, name: true, email: true, role: true, department: true, walletAddress: true, avatarUrl: true },
        });

        res.json({ success: true, data: updated });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/user/me — Lấy thông tin user hiện tại
 */
router.get('/me', async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, name: true, email: true, role: true, department: true, walletAddress: true, avatarUrl: true },
        });
        res.json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
});

export default router;
