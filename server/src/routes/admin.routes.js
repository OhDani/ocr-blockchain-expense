/**
 * admin.routes.js — Dashboard thống kê + quản lý cho admin/manager.
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireAdmin, requireManager } from '../middleware/auth.js';
import { getCompanyPoolBalance, isBlockchainReady, registerEmployeeOnChain, checkEmployeeRegisteredOnChain } from '../services/blockchain/blockchainService.js';
import { getAllowedDomains, addAllowedDomain, removeAllowedDomain } from '../services/domainService.js';
import { getCompanyInfo, updateCompanyInfo } from '../services/companyService.js';
import { normalizeCategory, getCategoryLabel } from '../utils/categoryHelper.js';
import { ethers } from 'ethers';

const router = Router();
const prisma = new PrismaClient();

// Tất cả route cần đăng nhập
router.use(authenticate);

/**
 * GET /api/admin/dashboard — Thống kê tổng quan (Admin only, song song hóa DB & cache blockchain)
 */
router.get('/dashboard', requireAdmin, async (req, res, next) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

        // Chạy song song tất cả truy vấn database & blockchain cache để tốc độ cực nhanh
        const [
            statusCounts,
            monthlyTotalExpenses,
            monthlyApprovedExpenses,
            totalUsers,
            totalTrips,
            reimbursedStats,
            companyPoolBalance,
            pendingExpenses,
            fraudAnalyses,
            sixMonthExpenses,
            categoryExpenses,
        ] = await Promise.all([
            // 1. Phân bổ trạng thái
            prisma.expense.groupBy({
                by: ['status'],
                _count: { id: true },
                _sum: { amount: true },
            }),
            // 2. Tổng hóa đơn tháng này
            prisma.expense.aggregate({
                _count: { id: true },
                where: { createdAt: { gte: startOfMonth } },
            }),
            // 3. Đã duyệt/hoàn ứng tháng này
            prisma.expense.aggregate({
                _count: { id: true },
                _sum: { amount: true },
                where: {
                    createdAt: { gte: startOfMonth },
                    status: { in: ['APPROVED', 'REIMBURSED'] },
                },
            }),
            // 4. Số nhân sự
            prisma.user.count(),
            // 5. Số chuyến công tác
            prisma.trip.count(),
            // 6. Thống kê hoàn ứng
            prisma.expense.aggregate({
                where: { status: 'REIMBURSED' },
                _count: { id: true },
                _sum: { amount: true },
            }),
            // 7. Số dư quỹ Smart Contract (đã có in-memory cache 45s)
            getCompanyPoolBalance(),
            // 8. 5 phiếu chi chờ duyệt mới nhất (Action Queue cho Dashboard)
            prisma.expense.findMany({
                where: { status: 'PENDING' },
                include: {
                    user: { select: { name: true, department: { select: { name: true } } } },
                    fraudAnalysis: { select: { fraudScore: true, fraudFlags: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 5,
            }),
            // 9. Dữ liệu phân tích rủi ro AI (AI Fraud Radar)
            prisma.fraudAnalysis.findMany({
                select: { fraudScore: true, fraudFlags: true },
            }),
            // 10. Xu hướng 6 tháng gần nhất
            prisma.expense.findMany({
                where: {
                    createdAt: { gte: sixMonthsAgo },
                    status: { in: ['APPROVED', 'REIMBURSED'] },
                },
                select: { amount: true, createdAt: true },
            }),
            // 11. Phân bổ danh mục chi tiêu thực tế
            prisma.expense.findMany({
                where: { status: { in: ['APPROVED', 'REIMBURSED'] } },
                select: { amount: true, invoiceType: true },
            }),
        ]);

        // Tổng chi tiêu toàn hệ thống: Chỉ tính hóa đơn ĐÃ DUYỆT hoặc ĐÃ HOÀN ỨNG
        const totalApprovedAmount = statusCounts
            .filter(s => s.status === 'APPROVED' || s.status === 'REIMBURSED')
            .reduce((sum, s) => sum + (s._sum.amount || 0), 0);

        // Xu hướng chi tiêu 6 tháng
        const monthlyTrendMap = {};
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = `Tháng ${d.getMonth() + 1}`;
            monthlyTrendMap[key] = { month: key, label, amount: 0, count: 0 };
        }
        sixMonthExpenses.forEach(e => {
            const k = `${e.createdAt.getFullYear()}-${String(e.createdAt.getMonth() + 1).padStart(2, '0')}`;
            if (monthlyTrendMap[k]) {
                monthlyTrendMap[k].amount += e.amount;
                monthlyTrendMap[k].count++;
            }
        });
        const monthlyTrend = Object.values(monthlyTrendMap);

        // Phân bổ danh mục đã chuẩn hóa (gộp hotel và hotel_receipt về tiếng Việt)
        const catMap = {};
        categoryExpenses.forEach(e => {
            const norm = normalizeCategory(e.invoiceType);
            if (!catMap[norm.code]) {
                catMap[norm.code] = { code: norm.code, name: norm.name, amount: 0, count: 0 };
            }
            catMap[norm.code].amount += e.amount;
            catMap[norm.code].count++;
        });
        const byCategory = Object.values(catMap).sort((a, b) => b.amount - a.amount);

        // Tính toán chỉ số Giám sát Rủi ro AI (AI Fraud Radar)
        const totalAnalyzed = fraudAnalyses.length;
        let highRiskCount = 0;   // >= 50
        let mediumRiskCount = 0; // 20 - 49
        let lowRiskCount = 0;    // < 20
        let nightExpenses = 0;
        let roundedAmounts = 0;

        fraudAnalyses.forEach(f => {
            const score = f.fraudScore || 0;
            if (score >= 50) highRiskCount++;
            else if (score >= 20) mediumRiskCount++;
            else lowRiskCount++;

            if (Array.isArray(f.fraudFlags)) {
                if (f.fraudFlags.includes('NIGHT_EXPENSE') || f.fraudFlags.includes('NIGHT_TIME_RESTAURANT')) nightExpenses++;
                if (f.fraudFlags.includes('ROUNDED_AMOUNT') || f.fraudFlags.includes('ROUNDED_TAXI_AMOUNT')) roundedAmounts++;
            }
        });

        const complianceRate = totalAnalyzed > 0
            ? Math.round(((totalAnalyzed - highRiskCount) / totalAnalyzed) * 100)
            : 100;

        const fraudRadar = {
            totalAnalyzed,
            complianceRate,
            lowRiskCount,
            mediumRiskCount,
            highRiskCount,
            nightExpenses,
            roundedAmounts,
        };

        const stats = {
            overview: {
                totalUsers,
                totalTrips,
                totalExpenses: statusCounts.reduce((sum, s) => sum + s._count.id, 0),
                totalAmount: totalApprovedAmount,
                fraudSuspectCount: highRiskCount,
            },
            fraudRadar,
            byStatus: statusCounts.map(s => ({
                status: s.status,
                count: s._count.id,
                amount: s._sum.amount || 0,
            })),
            byCategory,
            monthly: {
                count: monthlyTotalExpenses._count.id,
                amount: monthlyApprovedExpenses._sum.amount || 0,
                approvedCount: monthlyApprovedExpenses._count.id,
            },
            monthlyTrend,
            pendingActionQueue: pendingExpenses.map(p => ({
                id: p.id,
                amount: p.amount,
                userName: p.user?.name || 'Ẩn danh',
                department: p.user?.department?.name || 'Chưa phân phòng',
                createdAt: p.createdAt,
                fraudScore: p.fraudAnalysis?.fraudScore || 0,
                categoryName: getCategoryLabel(p.invoiceType),
            })),
            blockchain: {
                connected: isBlockchainReady(),
                companyPoolBalance,
                totalReimbursed: reimbursedStats._sum.amount || 0,
                txCount: reimbursedStats._count.id || 0,
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
        const { page = 1, limit = 20, status, departmentId, q } = req.query;
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

        if (q && q.trim()) {
            const searchKeyword = q.trim();
            where.OR = [
                { user: { name: { contains: searchKeyword, mode: 'insensitive' } } },
                { user: { email: { contains: searchKeyword, mode: 'insensitive' } } },
                { invoiceType: { contains: searchKeyword, mode: 'insensitive' } },
                { trip: { destination: { contains: searchKeyword, mode: 'insensitive' } } },
            ];
        }

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

        // Add blockchain registered status
        const usersWithBlockchainStatus = await Promise.all(users.map(async (u) => {
            if (u.walletAddress && u.role !== 'ADMIN') {
                u.isRegisteredOnChain = await checkEmployeeRegisteredOnChain(u.walletAddress);
            } else {
                u.isRegisteredOnChain = false;
            }
            return u;
        }));

        res.json({ success: true, data: usersWithBlockchainStatus });
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
 * POST /api/admin/users/:id/register-blockchain — Đăng ký nhân viên lên Smart Contract
 */
router.post('/users/:id/register-blockchain', requireAdmin, async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, walletAddress: true, role: true, name: true } });
        if (!user) return res.status(404).json({ success: false, error: 'Không tìm thấy user' });
        if (!user.walletAddress) return res.status(400).json({ success: false, error: 'User chưa có địa chỉ ví blockchain' });
        if (!isBlockchainReady()) return res.status(503).json({ success: false, error: 'Blockchain chưa sẵn sàng' });

        const result = await registerEmployeeOnChain(user.walletAddress, user.role);
        res.json({ success: true, data: result, message: `Đã đăng ký ${user.name} trên blockchain` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/admin/users/:id — Xóa nhân viên
 * Admin: xóa bất kỳ user nào (trừ chính mình)
 * Manager: chỉ xóa EMPLOYEE cùng phòng ban
 */
router.delete('/users/:id', requireManager, async (req, res, next) => {
    try {
        const targetId = req.params.id;

        // Không thể tự xóa chính mình
        if (targetId === req.user.id) {
            return res.status(400).json({ success: false, error: 'Không thể xóa tài khoản của chính mình' });
        }

        const targetUser = await prisma.user.findUnique({
            where: { id: targetId },
            include: { department: true },
        });

        if (!targetUser) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy nhân viên' });
        }

        // Manager chỉ xóa EMPLOYEE cùng phòng ban
        if (req.user.role === 'MANAGER') {
            if (targetUser.role !== 'EMPLOYEE') {
                return res.status(403).json({ success: false, error: 'Manager chỉ có thể xóa nhân viên (Employee)' });
            }
            const manager = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (!manager.departmentId || manager.departmentId !== targetUser.departmentId) {
                return res.status(403).json({ success: false, error: 'Chỉ xóa được nhân viên trong phòng ban của bạn' });
            }
        }

        // Xóa cascade: các bảng liên quan
        await prisma.$transaction(async (tx) => {
            // Xóa expenses + sub-tables
            const expenses = await tx.expense.findMany({ where: { userId: targetId }, select: { id: true } });
            const expenseIds = expenses.map(e => e.id);
            if (expenseIds.length > 0) {
                await tx.ocrResult.deleteMany({ where: { expenseId: { in: expenseIds } } });
                await tx.policyCheck.deleteMany({ where: { expenseId: { in: expenseIds } } });
                await tx.fraudAnalysis.deleteMany({ where: { expenseId: { in: expenseIds } } });
                await tx.blockchainTx.deleteMany({ where: { expenseId: { in: expenseIds } } });
                await tx.expenseReview.deleteMany({ where: { expenseId: { in: expenseIds } } });
                await tx.expense.deleteMany({ where: { userId: targetId } });
            }
            // Xóa trips + activities
            const trips = await tx.trip.findMany({ where: { userId: targetId }, select: { id: true } });
            const tripIds = trips.map(t => t.id);
            if (tripIds.length > 0) {
                await tx.tripActivity.deleteMany({ where: { tripId: { in: tripIds } } });
                await tx.trip.deleteMany({ where: { userId: targetId } });
            }
            // Xóa notifications
            await tx.notification.deleteMany({ where: { userId: targetId } });
            // Xóa wallet
            await tx.wallet.deleteMany({ where: { userId: targetId } });
            // Xóa user
            await tx.user.delete({ where: { id: targetId } });
        });

        res.json({ success: true, message: `Đã xóa nhân viên ${targetUser.name}` });
    } catch (error) {
        next(error);
    }
});
/**
 * GET /api/admin/departments/list — Danh sách phòng ban
 */
router.get('/departments/list', requireManager, async (req, res, next) => {
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
        const limits = await prisma.policyLimit.findMany({ where: { role: { not: 'ADMIN' } }, orderBy: { role: 'asc' } });
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
 * POST /api/admin/users — Thêm nhân viên (Admin hoặc Manager)
 */
router.post('/users', requireManager, async (req, res, next) => {
    try {
        const { name, email, password, role, walletAddress } = req.body;
        let { departmentId } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, error: 'Thiếu thông tin bắt buộc (tên, email, mk)' });
        }

        let assignedRole = role || 'EMPLOYEE';

        // Manager chỉ được tạo EMPLOYEE và tự động gán vào phòng ban của Manager
        if (req.user.role === 'MANAGER') {
            assignedRole = 'EMPLOYEE';
            const manager = await prisma.user.findUnique({ where: { id: req.user.id } });
            departmentId = manager.departmentId;
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ success: false, error: 'Email đã tồn tại!' });
        }

        const { hash } = await import('bcrypt');
        const hashedPassword = await hash(password, 10);

        const newWalletAddress = walletAddress?.trim() || null;

        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: assignedRole,
                departmentId: departmentId || null,
                departmentSelfSelected: false,
                walletAddress: newWalletAddress,
                ...(newWalletAddress ? {
                    wallet: {
                        create: { address: newWalletAddress, balance: 0 }
                    }
                } : {})
            },
            select: { id: true, name: true, email: true, role: true, createdAt: true, walletAddress: true }
        });

        // Tự động đăng ký blockchain (nếu có chỉ định ví sẵn)
        if (newWalletAddress && isBlockchainReady() && newUser.role !== 'ADMIN') {
            try {
                await registerEmployeeOnChain(newWalletAddress, newUser.role);
            } catch (err) {
                console.warn('⚠️ Lỗi đăng ký blockchain tự động khi tạo tài khoản:', err.message);
            }
        }

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
 * POST /api/admin/users/bulk — Thêm danh sách nhân viên hàng loạt (Admin hoặc Manager)
 */
router.post('/users/bulk', requireManager, async (req, res, next) => {
    try {
        const { users, defaultPassword, defaultDepartmentId, defaultRole } = req.body;

        if (!Array.isArray(users) || users.length === 0) {
            return res.status(400).json({ success: false, error: 'Danh sách nhân viên không hợp lệ hoặc rỗng' });
        }

        let targetDeptId = defaultDepartmentId || null;
        let targetRole = defaultRole || 'EMPLOYEE';

        // Manager chỉ được tạo EMPLOYEE và chỉ gán vào phòng ban của Manager
        if (req.user.role === 'MANAGER') {
            targetRole = 'EMPLOYEE';
            const manager = await prisma.user.findUnique({ where: { id: req.user.id } });
            targetDeptId = manager?.departmentId || null;
        }

        const commonPassword = defaultPassword || 'employee123';
        const { hash } = await import('bcrypt');
        const defaultHashedPassword = await hash(commonPassword, 10);

        const createdUsers = [];
        const skippedUsers = [];

        for (const item of users) {
            const name = item.name?.trim();
            const email = item.email?.trim().toLowerCase();

            if (!name || !email) {
                skippedUsers.push({ email: email || '—', name: name || '—', reason: 'Thiếu tên hoặc email' });
                continue;
            }

            // Kiểm tra email trùng
            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) {
                skippedUsers.push({ email, name, reason: 'Email đã tồn tại' });
                continue;
            }

            const itemPassword = item.password ? await hash(item.password, 10) : defaultHashedPassword;
            const itemDeptId = req.user.role === 'MANAGER' ? targetDeptId : (item.departmentId || targetDeptId);
            const itemRole = req.user.role === 'MANAGER' ? 'EMPLOYEE' : (item.role || targetRole);

            try {
                const newUser = await prisma.user.create({
                    data: {
                        name,
                        email,
                        password: itemPassword,
                        role: itemRole,
                        departmentId: itemDeptId,
                        departmentSelfSelected: false,
                        walletAddress: null,
                    },
                    select: { id: true, name: true, email: true, role: true, departmentId: true },
                });
                createdUsers.push(newUser);
            } catch (createErr) {
                skippedUsers.push({ email, name, reason: createErr.message });
            }
        }

        if (createdUsers.length > 0) {
            try {
                await prisma.auditLog.create({
                    data: {
                        action: 'BULK_CREATE_USERS',
                        entity: 'User',
                        entityId: req.user.id,
                        userId: req.user.id,
                        details: {
                            count: createdUsers.length,
                            skipped: skippedUsers.length,
                            emails: createdUsers.map(u => u.email),
                        },
                    },
                });
            } catch {}
        }

        res.status(201).json({
            success: true,
            message: `Đã tạo thành công ${createdUsers.length} nhân viên${skippedUsers.length > 0 ? ` (Bỏ qua ${skippedUsers.length} mục trùng hoặc lỗi)` : ''}`,
            data: {
                createdCount: createdUsers.length,
                skippedCount: skippedUsers.length,
                createdUsers,
                skippedUsers,
            },
        });
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

        // By category (chuẩn hóa danh mục tiếng Việt, gộp hotel và hotel_receipt)
        const byCategory = {};
        expenses.forEach(e => {
            const cat = normalizeCategory(e.invoiceType).name;
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
 * GET /api/admin/reports/department — Báo cáo theo phòng ban
 * Manager: chỉ xem phòng ban mình
 * Admin: chọn departmentId qua query param, hoặc bỏ trống = tất cả
 */
router.get('/reports/department', requireManager, async (req, res, next) => {
    try {
        let departmentId = req.query.departmentId || null;
        const period = req.query.period || 'all'; // 'this_month' | 'last_month' | 'this_quarter' | 'all'
        const customStartDate = req.query.startDate ? new Date(req.query.startDate) : null;
        const customEndDate = req.query.endDate ? new Date(req.query.endDate) : null;

        let dateFilter = {};
        const now = new Date();
        if (customStartDate && customEndDate) {
            dateFilter = { gte: customStartDate, lte: customEndDate };
        } else if (period === 'this_month') {
            dateFilter = { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
        } else if (period === 'last_month') {
            dateFilter = {
                gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
                lt: new Date(now.getFullYear(), now.getMonth(), 1),
            };
        } else if (period === 'this_quarter') {
            const currentQuarter = Math.floor(now.getMonth() / 3);
            dateFilter = { gte: new Date(now.getFullYear(), currentQuarter * 3, 1) };
        }

        // Manager chỉ xem phòng ban mình
        if (req.user.role === 'MANAGER') {
            const manager = await prisma.user.findUnique({ where: { id: req.user.id } });
            departmentId = manager.departmentId;
            if (!departmentId) {
                return res.json({ success: true, data: { summary: null, employees: [], byMonth: [], byCategory: [] } });
            }
        }

        // Build where clause
        const userWhere = departmentId ? { departmentId } : {};
        const users = await prisma.user.findMany({
            where: userWhere,
            select: { id: true, name: true, email: true, role: true, department: { select: { name: true } } },
        });
        const userIds = users.map(u => u.id);

        const expenseWhere = {
            userId: { in: userIds },
            ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        };

        const expenses = await prisma.expense.findMany({
            where: expenseWhere,
            select: { amount: true, status: true, createdAt: true, invoiceType: true, userId: true },
        });

        const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);
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

        // By category (chuẩn hóa danh mục tiếng Việt, gộp hotel và hotel_receipt)
        const byCategory = {};
        expenses.forEach(e => {
            const cat = normalizeCategory(e.invoiceType).name;
            if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0 };
            byCategory[cat].total += e.amount;
            byCategory[cat].count++;
        });

        // Per-employee summary
        const employeeStats = users.map(u => {
            const userExpenses = expenses.filter(e => e.userId === u.id);
            return {
                name: u.name,
                email: u.email,
                role: u.role,
                department: u.department?.name,
                totalExpenses: userExpenses.length,
                totalAmount: userExpenses.reduce((s, e) => s + e.amount, 0),
            };
        });

        // Department name & estimated budget
        let departmentName = 'Tất cả phòng ban';
        let budgetLimit = null;
        if (departmentId) {
            const dept = await prisma.department.findUnique({ where: { id: departmentId } });
            departmentName = dept?.name || departmentId;

            // Tính định mức ngân sách công tác phòng ban dựa theo policy
            const policyLimits = await prisma.policyLimit.findMany();
            const managerLimit = policyLimits.find(p => p.role === 'MANAGER')?.totalPerTripLimit || 30000000;
            const empLimit = policyLimits.find(p => p.role === 'EMPLOYEE')?.totalPerTripLimit || 15000000;
            const mgrCount = users.filter(u => u.role === 'MANAGER').length;
            const empCount = users.filter(u => u.role === 'EMPLOYEE').length;
            budgetLimit = (mgrCount * managerLimit) + (empCount * empLimit);
        }

        res.json({
            success: true,
            data: {
                departmentName,
                summary: {
                    totalUsers: users.length,
                    totalExpenses: expenses.length,
                    totalAmount,
                    approved, rejected, pending, reimbursed,
                    budgetLimit,
                },
                employees: employeeStats,
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

/**
 * GET /api/admin/domains — Lấy danh sách domain Google SSO được phép truy cập
 */
router.get('/domains', requireManager, (req, res) => {
    try {
        const domains = getAllowedDomains();
        res.json({ success: true, data: domains });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/admin/domains — Thêm domain Google SSO mới
 */
router.post('/domains', requireAdmin, async (req, res) => {
    try {
        const { domain } = req.body;
        const updated = addAllowedDomain(domain);

        try {
            await prisma.auditLog.create({
                data: {
                    userId: req.user.id,
                    action: 'ADD_DOMAIN_WHITELIST',
                    details: `Thêm domain @${domain.replace(/^@/, '')} vào danh sách Google SSO`,
                },
            });
        } catch {}

        res.json({ success: true, message: `Đã thêm tên miền @${domain.replace(/^@/, '')}`, data: updated });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

/**
 * DELETE /api/admin/domains/:domain — Xóa domain khỏi danh sách Google SSO
 */
router.delete('/domains/:domain', requireAdmin, async (req, res) => {
    try {
        const { domain } = req.params;
        const updated = removeAllowedDomain(domain);

        try {
            await prisma.auditLog.create({
                data: {
                    userId: req.user.id,
                    action: 'REMOVE_DOMAIN_WHITELIST',
                    details: `Xóa domain @${domain} khỏi danh sách Google SSO`,
                },
            });
        } catch {}

        res.json({ success: true, message: `Đã xóa tên miền @${domain}`, data: updated });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/admin/company — Lấy thông tin định danh công ty
 */
router.get('/company', requireManager, (req, res) => {
    try {
        const info = getCompanyInfo();
        res.json({ success: true, data: info });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/admin/company — Cập nhật thông tin công ty (Admin only)
 */
router.put('/company', requireAdmin, async (req, res) => {
    try {
        const updated = updateCompanyInfo(req.body);
        try {
            await prisma.auditLog.create({
                data: {
                    userId: req.user.id,
                    action: 'UPDATE_COMPANY_INFO',
                    details: `Cập nhật thông tin công ty: ${updated.companyName}`,
                },
            });
        } catch {}
        res.json({ success: true, message: 'Cập nhật thông tin công ty thành công', data: updated });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

export default router;

