/**
 * notification.routes.js — API thông báo
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

/**
 * GET /api/notifications — Lấy thông báo của user hiện tại
 */
router.get('/', async (req, res, next) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            take: 30,
        });

        const unreadCount = await prisma.notification.count({
            where: { userId: req.user.id, isRead: false },
        });

        res.json({ success: true, data: notifications, unreadCount });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/notifications/read-all — Đánh dấu tất cả đã đọc
 */
router.patch('/read-all', async (req, res, next) => {
    try {
        await prisma.notification.updateMany({
            where: { userId: req.user.id, isRead: false },
            data: { isRead: true },
        });
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/notifications/:id/read — Đánh dấu 1 thông báo đã đọc
 */
router.patch('/:id/read', async (req, res, next) => {
    try {
        await prisma.notification.update({
            where: { id: req.params.id },
            data: { isRead: true },
        });
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

/**
 * Helper: Tạo thông báo (gọi từ các route khác)
 */
export async function createNotification({ userId, type, title, message, expenseId = null }) {
    return prisma.notification.create({
        data: { userId, type, title, message, expenseId },
    });
}

export default router;
