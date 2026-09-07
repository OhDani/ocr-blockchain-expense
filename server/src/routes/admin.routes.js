/**
 * admin.routes.js — Dashboard thống kê + quản lý cho admin/manager.
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireAdmin, requireManager } from '../middleware/auth.js';
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

        // Query BlockchainTx thay vì expense.txHash
        const reimbursedStats = await prisma.expense.aggregate({
            where: { status: 'REIMBURSED' },
            _count: { id: true },
            _sum: { amount: true },
        });

        const recentTransactions = await prisma.expense.findMany({
            where: {
                status: 'REIMBURSED',
                blockchainTx: { txHash: { not: null } },
            },
            include: {
                user: { select: { name: true, department: { select: { name: true } } } },
                blockchainTx: { select: { txHash: true, gasUsed: true, createdAt: true } },
            },
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
                    txHash: tx.blockchainTx?.txHash,
                    invoiceType: tx.invoiceType,
                    userName: tx.user?.name,
                    department: tx.user?.department?.name,
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
 * GET /api/admin/expenses — Tất cả expenses (Admin only) hoặc Expenses cùng phòng ban (Manager)
 */
router.get('/expenses', requireManager, async (req, res, next) => {
    try {
        const { page = 1, limit = 20, status, departmentId } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        if (req.user.role === 'MANAGER') {
            const manager = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (manager.departmentId) {
                where.user = { departmentId: manager.departmentId };
            } else {
                where.userId = manager.id; // Nếu không có bộ phận thì chỉ xem của mình
            }
        } else if (departmentId) {
            where.user = { departmentId };
        }

        if (status) where.status = status;

        const [expenses, total] = await Promise.all([
            prisma.expense.findMany({
                where,
                include: {
                    user: { select: { id: true, name: true, email: true, role: true, department: { select: { id: true, name: true } } } },
                    trip: { select: { id: true, destination: true } },
                    fraudAnalysis: { select: { fraudScore: true } },
                    blockchainTx: { select: { txHash: true, status: true } },
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
            include: { user: { select: { department: { select: { name: true } } } } },
        });

        const deptMap = {};
        for (const exp of expenses) {
            const dept = exp.user?.department?.name || 'Chưa phân phòng';
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
 * GET /api/admin/users — Danh sách tất cả user (Admin only) hoặc user cùng phòng ban (Manager)
 */
router.get('/users', requireManager, async (req, res, next) => {
    try {
        const where = {};
        if (req.user.role === 'MANAGER') {
            const manager = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (manager.departmentId) {
                where.departmentId = manager.departmentId;
            } else {
                where.id = manager.id;
            }
        }

        const users = await prisma.user.findMany({
            where,
            select: {
                id: true, name: true, email: true, role: true,
                department: { select: { id: true, name: true } }, walletAddress: true, wallet: true, avatarUrl: true,
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
        const { role, departmentId, name } = req.body;
        const data = {};
        if (role && ['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(role)) data.role = role;
        if (departmentId !== undefined) data.departmentId = departmentId;
        if (name) data.name = name;

        if (Object.keys(data).length === 0) {
            return res.status(400).json({ success: false, error: 'Không có dữ liệu cập nhật' });
        }

        const updated = await prisma.user.update({
            where: { id: req.params.id },
            select: { id: true, name: true, email: true, role: true, department: { select: { id: true, name: true } }, walletAddress: true, wallet: true },
            data,
        });

        res.json({ success: true, data: updated });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/departments/list — Danh sách phòng ban
 */
router.get('/departments/list', requireAdmin, async (req, res, next) => {
    try {
        const departments = await prisma.department.findMany({
            include: { _count: { select: { users: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, data: departments });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/admin/departments — Tạo phòng ban
 */
router.post('/departments', requireAdmin, async (req, res, next) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Tên phòng ban là bắt buộc' });

        const existing = await prisma.department.findUnique({ where: { name } });
        if (existing) return res.status(400).json({ success: false, error: 'Tên phòng ban đã tồn tại' });

        const dept = await prisma.department.create({
            data: { name, description: description || null }
        });
        res.status(201).json({ success: true, data: dept });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/admin/departments/:id — Cập nhật phòng ban
 */
router.patch('/departments/:id', requireAdmin, async (req, res, next) => {
    try {
        const { name, description } = req.body;
        const updated = await prisma.department.update({
            where: { id: req.params.id },
            data: { name, description }
        });
        res.json({ success: true, data: updated });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/admin/departments/:id — Xóa phòng ban
 */
router.delete('/departments/:id', requireAdmin, async (req, res, next) => {
    try {
        const dept = await prisma.department.findUnique({
            where: { id: req.params.id },
            include: { _count: { select: { users: true } } }
        });
        if (!dept) return res.status(404).json({ success: false, error: 'Không tìm thấy phòng ban' });
        if (dept._count.users > 0) return res.status(400).json({ success: false, error: 'Phòng ban đang có nhân viên, không thể xóa' });

        await prisma.department.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Đã xóa phòng ban' });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/policy-limits — Danh sách hạn mức
 */
router.get('/policy-limits', requireAdmin, async (req, res, next) => {
    try {
        const limits = await prisma.policyLimit.findMany({ orderBy: { role: 'asc' } });
        res.json({ success: true, data: limits });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/admin/policy-limits/:id — Cập nhật hạn mức
 */
router.patch('/policy-limits/:id', requireAdmin, async (req, res, next) => {
    try {
        const { dailyLimit, perInvoiceLimit, totalPerTripLimit } = req.body;
        const updated = await prisma.policyLimit.update({
            where: { id: req.params.id },
            data: { dailyLimit, perInvoiceLimit, totalPerTripLimit }
        });
        res.json({ success: true, data: updated });

        await prisma.auditLog.create({
            data: {
                action: 'UPDATE_POLICY',
                entity: 'PolicyLimit',
                entityId: req.params.id,
                userId: req.user.id,
                details: { dailyLimit, perInvoiceLimit, totalPerTripLimit }
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/audit-logs — Nhật ký hệ thống
 */
router.get('/audit-logs', requireAdmin, async (req, res, next) => {
    try {
        const logs = await prisma.auditLog.findMany({
            include: { user: { select: { id: true, name: true, email: true, role: true } } },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        res.json({ success: true, data: logs });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/admin/users — Thêm nhân viên (Chỉ Admin)
 */
router.post('/users', requireAdmin, async (req, res, next) => {
    try {
        const { name, email, password, role, departmentId } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, error: 'Thiếu thông tin bắt buộc (tên, email, mk)' });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ success: false, error: 'Email đã tồn tại!' });
        }

        const { hash } = await import('bcrypt');
        const hashedPassword = await hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: role || 'EMPLOYEE',
                departmentId: departmentId || null,
            },
            select: { id: true, name: true, email: true, role: true, createdAt: true }
        });

        await prisma.auditLog.create({
            data: {
                action: 'CREATE_USER',
                entity: 'User',
                entityId: newUser.id,
                userId: req.user.id,
                details: { email, role }
            }
        });

        res.status(201).json({ success: true, data: newUser });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/reports — Báo cáo toàn công ty (Admin)
 */
router.get('/reports', requireAdmin, async (req, res, next) => {
    try {
        // Chi tiêu theo phòng ban
        const deptExpenses = await prisma.expense.groupBy({
            by: ['userId'],
            _sum: { amount: true },
            _count: { id: true },
        });
        // Map userId -> department
        const userIds = deptExpenses.map(d => d.userId);
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, department: { select: { name: true } } },
        });
        const userDeptMap = {};
        users.forEach(u => { userDeptMap[u.id] = u.department?.name || 'Chưa phân bổ'; });

        const byDepartment = {};
        deptExpenses.forEach(d => {
            const dept = userDeptMap[d.userId] || 'Chưa phân bổ';
            if (!byDepartment[dept]) byDepartment[dept] = { total: 0, count: 0 };
            byDepartment[dept].total += d._sum.amount || 0;
            byDepartment[dept].count += d._count.id || 0;
        });

        // Chi tiêu theo tháng (6 tháng gần nhất)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const recentExpenses = await prisma.expense.findMany({
            where: { createdAt: { gte: sixMonthsAgo } },
            select: { amount: true, status: true, createdAt: true },
        });

        const byMonth = {};
        recentExpenses.forEach(e => {
            const key = `${e.createdAt.getFullYear()}-${String(e.createdAt.getMonth() + 1).padStart(2, '0')}`;
            if (!byMonth[key]) byMonth[key] = { total: 0, approved: 0, rejected: 0, count: 0 };
            byMonth[key].total += e.amount;
            byMonth[key].count++;
            if (e.status === 'APPROVED' || e.status === 'REIMBURSED') byMonth[key].approved++;
            if (e.status === 'REJECTED') byMonth[key].rejected++;
        });

        // Status distribution
        const statusDist = await prisma.expense.groupBy({
            by: ['status'],
            _count: { id: true },
            _sum: { amount: true },
        });

        // Company-wide summary
        const allExpenses = await prisma.expense.aggregate({
            _count: { id: true },
            _sum: { amount: true },
        });
        const companySummary = {
            totalExpenses: allExpenses._count.id || 0,
            totalAmount: allExpenses._sum.amount || 0,
            approved: statusDist.find(s => s.status === 'APPROVED')?._count.id || 0,
            rejected: statusDist.find(s => s.status === 'REJECTED')?._count.id || 0,
            pending: statusDist.find(s => s.status === 'PENDING')?._count.id || 0,
            reimbursed: statusDist.find(s => s.status === 'REIMBURSED')?._count.id || 0,
            approvedAmount: statusDist.find(s => s.status === 'APPROVED')?._sum.amount || 0,
            reimbursedAmount: statusDist.find(s => s.status === 'REIMBURSED')?._sum.amount || 0,
        };

        res.json({
            success: true,
            data: {
                summary: companySummary,
                byDepartment: Object.entries(byDepartment).map(([name, v]) => ({ name, ...v })),
                byMonth: Object.entries(byMonth).map(([month, v]) => ({ month, ...v })).sort((a, b) => a.month.localeCompare(b.month)),
                statusDistribution: statusDist.map(s => ({ status: s.status, count: s._count.id, total: s._sum.amount })),
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/reports/personal — Báo cáo cá nhân (cho tất cả role)
 */
router.get('/reports/personal', async (req, res, next) => {
    try {
        const userId = req.user.id;

        const expenses = await prisma.expense.findMany({
            where: { userId },
            select: { amount: true, status: true, createdAt: true, invoiceType: true },
        });

        const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
        const approved = expenses.filter(e => ['APPROVED', 'REIMBURSED'].includes(e.status)).length;
        const rejected = expenses.filter(e => e.status === 'REJECTED').length;
        const pending = expenses.filter(e => e.status === 'PENDING').length;
        const reimbursed = expenses.filter(e => e.status === 'REIMBURSED').length;

        // By month
        const byMonth = {};
        expenses.forEach(e => {
            const key = `${e.createdAt.getFullYear()}-${String(e.createdAt.getMonth() + 1).padStart(2, '0')}`;
            if (!byMonth[key]) byMonth[key] = { total: 0, count: 0 };
            byMonth[key].total += e.amount;
            byMonth[key].count++;
        });

        // By category
        const byCategory = {};
        expenses.forEach(e => {
            const cat = e.invoiceType || 'Khác';
            if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0 };
            byCategory[cat].total += e.amount;
            byCategory[cat].count++;
        });

        res.json({
            success: true,
            data: {
                summary: { totalSpent, totalCount: expenses.length, approved, rejected, pending, reimbursed },
                byMonth: Object.entries(byMonth).map(([month, v]) => ({ month, ...v })).sort((a, b) => a.month.localeCompare(b.month)),
                byCategory: Object.entries(byCategory).map(([name, v]) => ({ name, ...v })),
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/blockchain — Danh sách giao dịch blockchain (Admin)
 */
router.get('/blockchain', requireAdmin, async (req, res, next) => {
    try {
        const txs = await prisma.blockchainTx.findMany({
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: {
                expense: {
                    select: {
                        id: true,
                        amount: true,
                        invoiceType: true,
                        status: true,
                        user: { select: { name: true, email: true } },
                    },
                },
            },
        });

        res.json({ success: true, data: txs });
    } catch (error) {
        next(error);
    }
});

export default router;

