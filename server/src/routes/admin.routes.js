/**
 * admin.routes.js — Dashboard thống kê + quản lý cho admin/manager.
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { getCompanyPoolBalance, isBlockchainReady } from '../services/blockchain/blockchainService.js';

const router = Router();
const prisma = new PrismaClient();

// Tất cả route cần đăng nhập
router.use(authenticate);

/**
 * GET /api/admin/dashboard — Thống kê tổng quan (Admin only)
 */
router.get('/dashboard', requireAdmin, async (req, res, next) => {
    try {
        const statusCounts = await prisma.expense.groupBy({
            by: ['status'],
            _count: { id: true },
            _sum: { amount: true },
        });

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthlyExpenses = await prisma.expense.aggregate({
            _count: { id: true },
            _sum: { amount: true },
            where: { createdAt: { gte: startOfMonth } },
        });

        const totalUsers = await prisma.user.count();
        const totalTrips = await prisma.trip.count();

        let companyPoolBalance = null;
        let blockchainConnected = false;
        try {
            if (isBlockchainReady()) {
                companyPoolBalance = await getCompanyPoolBalance();
                blockchainConnected = true;
            }
        } catch (err) {
            console.warn('[Dashboard] Blockchain không khả dụng:', err.message);
        }

        const reimbursedStats = await prisma.expense.aggregate({
            where: { status: 'REIMBURSED' },
            _count: { id: true },
            _sum: { amount: true },
        });

        const recentTransactions = await prisma.expense.findMany({
            where: { status: 'REIMBURSED', txHash: { not: null } },
            include: { user: { select: { name: true, department: true } } },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });

        const stats = {
            overview: {
                totalUsers,
                totalTrips,
                totalExpenses: statusCounts.reduce((sum, s) => sum + s._count.id, 0),
                totalAmount: statusCounts.reduce((sum, s) => sum + (s._sum.amount || 0), 0),
            },
            byStatus: statusCounts.map(s => ({
                status: s.status,
                count: s._count.id,
                amount: s._sum.amount || 0,
            })),
            monthly: {
                count: monthlyExpenses._count.id,
                amount: monthlyExpenses._sum.amount || 0,
            },
            blockchain: {
                connected: blockchainConnected,
                companyPoolBalance,
                totalReimbursed: reimbursedStats._sum.amount || 0,
                txCount: reimbursedStats._count.id || 0,
                recentTransactions: recentTransactions.map(tx => ({
                    id: tx.id,
                    amount: tx.amount,
                    txHash: tx.txHash,
                    invoiceType: tx.invoiceType,
                    userName: tx.user?.name,
                    department: tx.user?.department,
                    createdAt: tx.createdAt,
                })),
            },
        };

        res.json({ success: true, data: stats });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/expenses — Tất cả expenses (Admin only)
 */
router.get('/expenses', requireAdmin, async (req, res, next) => {
    try {
        const { page = 1, limit = 20, status, department } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        if (status) where.status = status;
        if (department) where.user = { department };

        const [expenses, total] = await Promise.all([
            prisma.expense.findMany({
                where,
                include: {
                    user: { select: { id: true, name: true, email: true, role: true, department: true } },
                    trip: { select: { id: true, destination: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit),
            }),
            prisma.expense.count({ where }),
        ]);

        res.json({
            success: true,
            data: expenses,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/departments — Chi phí theo phòng ban (Admin only)
 */
router.get('/departments', requireAdmin, async (req, res, next) => {
    try {
        const expenses = await prisma.expense.findMany({
            where: { status: { in: ['APPROVED', 'REIMBURSED'] } },
            include: { user: { select: { department: true } } },
        });

        const deptMap = {};
        for (const exp of expenses) {
            const dept = exp.user?.department || 'Chưa phân phòng';
            if (!deptMap[dept]) {
                deptMap[dept] = { department: dept, count: 0, totalAmount: 0 };
            }
            deptMap[dept].count++;
            deptMap[dept].totalAmount += exp.amount;
        }

        res.json({ success: true, data: Object.values(deptMap) });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/users — Danh sách tất cả user (Admin only)
 */
router.get('/users', requireAdmin, async (req, res, next) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true, name: true, email: true, role: true,
                department: true, walletAddress: true, avatarUrl: true,
                createdAt: true,
                _count: { select: { expenses: true, trips: true } },
            },
            orderBy: { createdAt: 'asc' },
        });
        res.json({ success: true, data: users });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/admin/users/:id — Cập nhật user (Admin only)
 */
router.patch('/users/:id', requireAdmin, async (req, res, next) => {
    try {
        const { role, department, name } = req.body;
        const data = {};
        if (role && ['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(role)) data.role = role;
        if (department !== undefined) data.department = department;
        if (name) data.name = name;

        if (Object.keys(data).length === 0) {
            return res.status(400).json({ success: false, error: 'Không có dữ liệu cập nhật' });
        }

        const updated = await prisma.user.update({
            where: { id: req.params.id },
            select: { id: true, name: true, email: true, role: true, department: true, walletAddress: true },
            data,
        });

        res.json({ success: true, data: updated });
    } catch (error) {
        next(error);
    }
});

export default router;
