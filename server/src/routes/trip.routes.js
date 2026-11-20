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
 * Manager có thể tạo cho employee phòng mình (gửi userId)
 */
router.post('/', async (req, res, next) => {
    try {
        const { destination, workLocation, purpose, startDate, endDate, budget, userId } = req.body;

        if (!destination || !startDate || !endDate || !budget) {
            return res.status(400).json({
                success: false,
                error: 'Thiếu thông tin: destination, startDate, endDate, budget',
            });
        }

        let targetUserId = req.user.id;

        // Manager có thể tạo chuyến cho employee trong phòng ban
        if (userId && userId !== req.user.id && req.user.role === 'MANAGER') {
            const manager = await prisma.user.findUnique({ where: { id: req.user.id } });
            const employee = await prisma.user.findUnique({ where: { id: userId } });
            if (!employee || employee.departmentId !== manager.departmentId) {
                return res.status(403).json({ success: false, error: 'Chỉ tạo chuyến cho nhân viên trong phòng ban' });
            }
            targetUserId = userId;
        } else if (userId && req.user.role === 'ADMIN') {
            targetUserId = userId;
        }

        const trip = await prisma.trip.create({
            data: {
                userId: targetUserId,
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
 * GET /api/trips — Danh sách chuyến công tác
 * Admin: tất cả, Manager: phòng ban mình, Employee: của mình
 */
router.get('/', async (req, res, next) => {
    try {
        let where = { userId: req.user.id }; // default: Employee

        if (req.user.role === 'ADMIN') {
            where = {}; // Admin xem tất cả
        } else if (req.user.role === 'MANAGER') {
            // Manager xem trips của nhân viên trong phòng ban
            const manager = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (manager?.departmentId) {
                const deptUsers = await prisma.user.findMany({
                    where: { departmentId: manager.departmentId },
                    select: { id: true },
                });
                where = { userId: { in: deptUsers.map(u => u.id) } };
            }
        }

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

        // Kiểm tra quyền: chủ trip, admin, hoặc manager cùng phòng ban
        if (trip.userId !== req.user.id && req.user.role !== 'ADMIN') {
            if (req.user.role === 'MANAGER') {
                const manager = await prisma.user.findUnique({ where: { id: req.user.id } });
                const tripOwner = await prisma.user.findUnique({ where: { id: trip.userId } });
                if (!manager?.departmentId || manager.departmentId !== tripOwner?.departmentId) {
                    return res.status(403).json({ success: false, error: 'Không có quyền xem chuyến này' });
                }
            } else {
                return res.status(403).json({ success: false, error: 'Không có quyền xem chuyến này' });
            }
        }

        res.json({ success: true, data: trip });
    } catch (error) {
        next(error);
    }
});

/**
 * Kiểm tra quyền quản lý chuyến công tác:
 * - Chủ nhân chuyến (Employee / Creator)
 * - Admin (toàn quyền hệ thống)
 * - Trưởng phòng (Manager nếu nhân viên thuộc cùng phòng ban)
 */
async function canManageTrip(tripId, reqUser) {
    const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        include: { user: { select: { id: true, departmentId: true } } },
    });
    if (!trip) return { allowed: false, trip: null, notFound: true };

    if (trip.userId === reqUser.id) return { allowed: true, trip };
    if (reqUser.role === 'ADMIN') return { allowed: true, trip };
    if (reqUser.role === 'MANAGER') {
        const manager = await prisma.user.findUnique({
            where: { id: reqUser.id },
            select: { departmentId: true },
        });
        if (manager?.departmentId && manager.departmentId === trip.user?.departmentId) {
            return { allowed: true, trip };
        }
    }

    return { allowed: false, trip };
}

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

        const { allowed, notFound } = await canManageTrip(req.params.id, req.user);
        if (notFound) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến công tác' });
        }
        if (!allowed) {
            return res.status(403).json({
                success: false,
                error: 'Bạn không có quyền thay đổi trạng thái chuyến công tác này (chỉ chủ chuyến, Trưởng phòng bộ phận hoặc Admin mới được phép)',
            });
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

        const { allowed, notFound } = await canManageTrip(req.params.id, req.user);
        if (notFound) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến công tác' });
        }
        if (!allowed) {
            return res.status(403).json({
                success: false,
                error: 'Chỉ người tạo chuyến, Trưởng phòng bộ phận hoặc Admin mới được thêm kế hoạch',
            });
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

        const { allowed, notFound } = await canManageTrip(req.params.tripId, req.user);
        if (notFound || !allowed) {
            return res.status(403).json({ success: false, error: 'Không có quyền sửa hoạt động này' });
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
        const { allowed, notFound } = await canManageTrip(req.params.tripId, req.user);
        if (notFound || !allowed) {
            return res.status(403).json({ success: false, error: 'Không có quyền xóa hoạt động này' });
        }

        await prisma.tripActivity.delete({ where: { id: req.params.actId } });
        res.json({ success: true, message: 'Đã xóa hoạt động' });
    } catch (error) {
        next(error);
    }
});

export default router;
