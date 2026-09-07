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
import bcrypt from 'bcrypt';

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
            select: { id: true, name: true, email: true, role: true, department: { select: { id: true, name: true } }, walletAddress: true, wallet: true, avatarUrl: true },
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
            select: { id: true, name: true, email: true, role: true, department: { select: { id: true, name: true } }, walletAddress: true, wallet: true, avatarUrl: true },
        });
        res.json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/user/password — Đổi mật khẩu
 */
router.patch('/password', async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, error: 'Vui lòng điền đủ mật khẩu cũ và mới' });
        }

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User không tồn tại' });
        }

        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
            return res.status(401).json({ success: false, error: 'Mật khẩu cũ không chính xác' });
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: req.user.id },
            data: { password: hashed },
        });

        res.json({ success: true, message: 'Đổi mật khẩu thành công' });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/user/profile — Cập nhật thông tin cá nhân
 */
router.patch('/profile', async (req, res, next) => {
    try {
        const { departmentId } = req.body;

        // Hiện tại cho phép user tự chọn phòng ban
        const updated = await prisma.user.update({
            where: { id: req.user.id },
            data: { departmentId: departmentId || null },
            select: { id: true, name: true, email: true, role: true, department: { select: { id: true, name: true } }, walletAddress: true, wallet: true, avatarUrl: true },
        });

        res.json({ success: true, data: updated });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/user/departments — Lấy danh sách phòng ban cho menu chọn
 */
router.get('/departments', async (req, res, next) => {
    try {
        const departments = await prisma.department.findMany({
            select: { id: true, name: true }
        });
        res.json({ success: true, data: departments });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/user/activity — Lịch sử hoạt động cá nhân
 */
router.get('/activity', async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Lấy expenses + reviews gần nhất
        const expenses = await prisma.expense.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
                id: true,
                amount: true,
                invoiceType: true,
                status: true,
                createdAt: true,
                reviews: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { action: true, createdAt: true, reviewer: { select: { name: true } } },
                },
                blockchainTx: {
                    select: { txHash: true, status: true, createdAt: true },
                },
            },
        });

        // Tạo activity timeline
        const activities = [];
        expenses.forEach(exp => {
            activities.push({
                type: 'SUBMIT',
                description: `Đã nộp hóa đơn ${exp.invoiceType || ''} - ${Number(exp.amount).toLocaleString('vi-VN')}đ`,
                timestamp: exp.createdAt,
                expenseId: exp.id,
            });
            if (exp.reviews?.[0]) {
                const review = exp.reviews[0];
                const actionLabel = review.action === 'APPROVE' ? 'Được duyệt' : review.action === 'REJECT' ? 'Bị từ chối' : 'Được xử lý lại';
                activities.push({
                    type: review.action,
                    description: `${actionLabel} bởi ${review.reviewer?.name || 'Admin'} - ${Number(exp.amount).toLocaleString('vi-VN')}đ`,
                    timestamp: review.createdAt,
                    expenseId: exp.id,
                });
            }
            if (exp.blockchainTx) {
                activities.push({
                    type: 'BLOCKCHAIN',
                    description: `Giao dịch blockchain ${exp.blockchainTx.status === 'SUCCESS' ? 'thành công' : 'thất bại'} - ${Number(exp.amount).toLocaleString('vi-VN')}đ`,
                    timestamp: exp.blockchainTx.createdAt,
                    expenseId: exp.id,
                    txHash: exp.blockchainTx.txHash,
                });
            }
        });

        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({ success: true, data: activities.slice(0, 50) });
    } catch (error) {
        next(error);
    }
});

export default router;

