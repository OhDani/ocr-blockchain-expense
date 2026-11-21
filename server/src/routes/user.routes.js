/**
 * user.routes.js — Profile routes (avatar, etc.)
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { ethers } from 'ethers';
import { registerEmployeeOnChain, checkEmployeeRegisteredOnChain, getVNDBalance, isBlockchainReady } from '../services/blockchain/blockchainService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const prisma = new PrismaClient();
const router = Router();
const walletNonceStore = new Map();

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
            select: { id: true, name: true, email: true, role: true, department: { select: { id: true, name: true } }, departmentSelfSelected: true, walletAddress: true, wallet: true, avatarUrl: true },
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
            data: { 
                departmentId: departmentId || null,
                departmentSelfSelected: true
            },
            select: { id: true, name: true, email: true, role: true, department: { select: { id: true, name: true } }, departmentSelfSelected: true, walletAddress: true, wallet: true, avatarUrl: true },
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
                    select: { action: true, createdAt: true, reviewerId: true },
                },
                blockchainTx: {
                    select: { txHash: true, status: true, createdAt: true },
                },
            },
        });

        // Lấy tên reviewer (nếu có)
        const reviewerIds = [...new Set(
            expenses.flatMap(e => e.reviews.map(r => r.reviewerId)).filter(Boolean)
        )];
        const reviewers = reviewerIds.length > 0
            ? await prisma.user.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, name: true } })
            : [];
        const reviewerMap = Object.fromEntries(reviewers.map(r => [r.id, r.name]));

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
                const reviewerName = reviewerMap[review.reviewerId] || 'Admin';
                const actionLabel = review.action === 'APPROVE' ? 'Được duyệt' : review.action === 'REJECT' ? 'Bị từ chối' : 'Được xử lý lại';
                activities.push({
                    type: review.action,
                    description: `${actionLabel} bởi ${reviewerName} - ${Number(exp.amount).toLocaleString('vi-VN')}đ`,
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

/**
 * GET /api/user/policy-limits — Hạn mức chi tiêu theo role
 */
router.get('/policy-limits', async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        const limits = await prisma.policyLimit.findUnique({
            where: { role: user.role },
        });
        res.json({ success: true, data: limits });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/user/wallet/nonce — Sinh challenge nonce xác thực quyền sở hữu ví cá nhân
 */
router.get('/wallet/nonce', async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User không tồn tại' });
        }

        const nonce = crypto.randomBytes(16).toString('hex');
        const expiresAt = Date.now() + 5 * 60 * 1000; // Có hiệu lực trong 5 phút
        walletNonceStore.set(req.user.id, { nonce, expiresAt });

        const address = req.query.address || '';
        const timestamp = new Date().toISOString();
        const message = [
            'FlexiTrip Expense Management - Xác thực ví cá nhân',
            `Tài khoản: ${user.email}`,
            address ? `Địa chỉ ví: ${address}` : null,
            `Nonce: ${nonce}`,
            `Thời gian: ${timestamp}`,
            '',
            'Bằng việc ký thông điệp này, bạn xác nhận mình là chủ sở hữu hợp pháp của ví để nhận tiền hoàn ứng.',
        ].filter(Boolean).join('\n');

        res.json({
            success: true,
            data: {
                nonce,
                message,
                expiresAt,
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/user/wallet/link — Liên kết ví cá nhân thông qua chữ ký mật mã (EIP-191)
 */
router.post('/wallet/link', async (req, res, next) => {
    try {
        const { address, signature, message } = req.body;
        if (!address || !signature || !message) {
            return res.status(400).json({ success: false, error: 'Thiếu thông tin xác thực ví (address, signature, message)' });
        }

        if (!ethers.isAddress(address)) {
            return res.status(400).json({ success: false, error: 'Địa chỉ ví không đúng định dạng EVM/Ethereum' });
        }

        const stored = walletNonceStore.get(req.user.id);
        if (!stored || Date.now() > stored.expiresAt) {
            return res.status(400).json({ success: false, error: 'Phiên xác thực đã hết hạn (quá 5 phút). Vui lòng thử lại.' });
        }

        if (!message.includes(stored.nonce)) {
            return res.status(400).json({ success: false, error: 'Mã nonce trong thông điệp không khớp với phiên làm việc' });
        }

        // Xác thực chữ ký số (EIP-191 personal_sign)
        let recoveredAddress;
        try {
            recoveredAddress = ethers.verifyMessage(message, signature);
        } catch {
            return res.status(400).json({ success: false, error: 'Chữ ký mật mã không hợp lệ hoặc bị lỗi' });
        }

        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
            return res.status(400).json({ success: false, error: 'Chữ ký không khớp với địa chỉ ví cung cấp' });
        }

        // Kiểm tra xem ví này đã được liên kết với nhân viên nào khác chưa
        const existingOtherUser = await prisma.user.findFirst({
            where: {
                walletAddress: { equals: address, mode: 'insensitive' },
                NOT: { id: req.user.id },
            },
        });
        if (existingOtherUser) {
            return res.status(409).json({ success: false, error: 'Địa chỉ ví này đã được liên kết với một tài khoản khác trong công ty' });
        }

        // Cập nhật ví vào database
        const updated = await prisma.user.update({
            where: { id: req.user.id },
            data: {
                walletAddress: address,
                wallet: {
                    upsert: {
                        create: { address, balance: 0 },
                        update: { address },
                    },
                },
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                department: { select: { id: true, name: true } },
                walletAddress: true,
                wallet: true,
                avatarUrl: true,
            },
        });

        // Xóa nonce đã dùng
        walletNonceStore.delete(req.user.id);

        // Đăng ký nhân viên trên Smart Contract (nếu blockchain đang sẵn sàng và role != ADMIN)
        let blockchainReg = null;
        if (isBlockchainReady() && updated.role !== 'ADMIN') {
            try {
                blockchainReg = await registerEmployeeOnChain(address, updated.role);
            } catch (chainErr) {
                console.warn('⚠️ Blockchain registration warning:', chainErr.message);
            }
        }

        res.json({
            success: true,
            message: 'Liên kết và xác thực ví Web3 thành công!',
            data: updated,
            blockchain: blockchainReg,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/user/wallet/status — Kiểm tra trạng thái ví trên Blockchain (đăng ký on-chain & số dư vVND)
 */
router.get('/wallet/status', async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, walletAddress: true, role: true },
        });

        if (!user || !user.walletAddress) {
            return res.json({ success: true, data: { hasWallet: false } });
        }

        let isRegistered = false;
        let vVNDBalance = 0;

        if (isBlockchainReady()) {
            try {
                isRegistered = await checkEmployeeRegisteredOnChain(user.walletAddress);
                const bal = await getVNDBalance(user.walletAddress);
                if (bal !== null) vVNDBalance = bal;
            } catch (err) {
                console.warn('⚠️ Lỗi kiểm tra blockchain status:', err.message);
            }
        }

        res.json({
            success: true,
            data: {
                hasWallet: true,
                address: user.walletAddress,
                walletAddress: user.walletAddress,
                isRegisteredOnChain: isRegistered,
                balance: vVNDBalance,
                tokenBalance: vVNDBalance,
            },
        });
    } catch (error) {
        next(error);
    }
});

export default router;

