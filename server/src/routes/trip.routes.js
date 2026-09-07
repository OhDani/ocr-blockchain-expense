/**
 * trip.routes.js — CRUD chuyến công tác.
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Tất cả route đều cần đăng nhập
router.use(authenticate);

/**
 * POST /api/trips — Tạo chuyến công tác mới
 */
router.post('/', async (req, res, next) => {
    try {
        const { destination, workLocation, purpose, startDate, endDate, budget } = req.body;

        if (!destination || !startDate || !endDate || !budget) {
            return res.status(400).json({
                success: false,
                error: 'Thiếu thông tin: destination, startDate, endDate, budget',
            });
        }

        const trip = await prisma.trip.create({
            data: {
                userId: req.user.id,
                destination,
                workLocation,
                purpose,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                budget: parseFloat(budget),
            },
        });

        res.status(201).json({ success: true, data: trip });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/trips — Danh sách chuyến công tác của user
 */
router.get('/', async (req, res, next) => {
    try {
        // Admin và Manager xem tất cả trips, nhân viên chỉ xem của mình
        const where = ['ADMIN', 'MANAGER'].includes(req.user.role)
            ? {}
            : { userId: req.user.id };

        const trips = await prisma.trip.findMany({
            where,
            include: {
                user: { select: { id: true, name: true, department: { select: { name: true } } } },
                expenses: {
                    select: { id: true, amount: true, status: true, invoiceType: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({ success: true, data: trips });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/trips/:id — Chi tiết chuyến công tác + expenses
 */
router.get('/:id', async (req, res, next) => {
    try {
        const trip = await prisma.trip.findUnique({
            where: { id: req.params.id },
            include: {
                user: { select: { id: true, name: true, department: { select: { name: true } } } },
                expenses: {
                    orderBy: { createdAt: 'desc' },
                },
                activities: {
                    orderBy: [{ date: 'asc' }, { time: 'asc' }],
                },
            },
        });

        if (!trip) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến công tác' });
        }

        // Kiểm tra quyền: chủ trip, admin, hoặc manager
        if (trip.userId !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Không có quyền xem chuyến này' });
        }

        res.json({ success: true, data: trip });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/trips/:id — Cập nhật trạng thái chuyến công tác
 */
router.patch('/:id', async (req, res, next) => {
    try {
        const { status } = req.body;
        const validStatuses = ['PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED'];

        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: 'Status không hợp lệ' });
        }

        const trip = await prisma.trip.findUnique({ where: { id: req.params.id } });
        if (!trip) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến công tác' });
        }
        if (trip.userId !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Chỉ người tạo chuyến mới được đổi trạng thái' });
        }

        const updated = await prisma.trip.update({
            where: { id: req.params.id },
            data: { status },
        });

        res.json({ success: true, data: updated });
    } catch (error) {
        next(error);
    }
});

// ════════════════════ Trip Activities (Kế hoạch) ════════════════════

/**
 * POST /api/trips/:id/activities — Thêm hoạt động vào chuyến
 */
router.post('/:id/activities', async (req, res, next) => {
    try {
        const { date, time, title, description, location, type, estimatedCost } = req.body;

        if (!date || !title) {
            return res.status(400).json({ success: false, error: 'Cần nhập ngày và tiêu đề' });
        }

        const trip = await prisma.trip.findUnique({ where: { id: req.params.id } });
        if (!trip) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến công tác' });
        }
        if (trip.userId !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Chỉ người tạo chuyến mới được thêm kế hoạch' });
        }

        const activity = await prisma.tripActivity.create({
            data: {
                tripId: req.params.id,
                date: new Date(date),
                time: time || null,
                title,
                description: description || null,
                location: location || null,
                type: type || 'other',
                estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
            },
        });

        res.status(201).json({ success: true, data: activity });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/trips/:tripId/activities/:actId — Sửa hoạt động
 */
router.patch('/:tripId/activities/:actId', async (req, res, next) => {
    try {
        const { date, time, title, description, location, type, completed, estimatedCost } = req.body;

        const trip = await prisma.trip.findUnique({ where: { id: req.params.tripId } });
        if (!trip || trip.userId !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Không có quyền' });
        }

        const data = {};
        if (date) data.date = new Date(date);
        if (time !== undefined) data.time = time || null;
        if (title) data.title = title;
        if (description !== undefined) data.description = description || null;
        if (location !== undefined) data.location = location || null;
        if (type) data.type = type;
        if (completed !== undefined) data.completed = completed;
        if (estimatedCost !== undefined) data.estimatedCost = estimatedCost ? parseFloat(estimatedCost) : null;

        const updated = await prisma.tripActivity.update({
            where: { id: req.params.actId },
            data,
        });

        res.json({ success: true, data: updated });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/trips/:tripId/activities/:actId — Xóa hoạt động
 */
router.delete('/:tripId/activities/:actId', async (req, res, next) => {
    try {
        const trip = await prisma.trip.findUnique({ where: { id: req.params.tripId } });
        if (!trip || trip.userId !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Không có quyền' });
        }

        await prisma.tripActivity.delete({ where: { id: req.params.actId } });
        res.json({ success: true, message: 'Đã xóa hoạt động' });
    } catch (error) {
        next(error);
    }
});

export default router;
