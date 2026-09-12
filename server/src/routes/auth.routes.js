/**
 * auth.routes.js — Đăng nhập, đăng ký, lấy thông tin user.
 */

import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { registerEmployeeOnChain, isBlockchainReady } from '../services/blockchain/blockchainService.js';
import { ethers } from 'ethers';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/auth/check-setup — Kiểm tra hệ thống đã khởi tạo chưa
 */
router.get('/check-setup', async (req, res, next) => {
    try {
        const userCount = await prisma.user.count();
        res.json({ success: true, data: { needSetup: userCount === 0 } });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/auth/setup — Khởi tạo hệ thống (tạo Admin đầu tiên)
 * Chỉ hoạt động khi DB chưa có user nào
 */
router.post('/setup', async (req, res, next) => {
    try {
        const userCount = await prisma.user.count();
        if (userCount > 0) {
            return res.status(400).json({ success: false, error: 'Hệ thống đã được khởi tạo' });
        }

        const { companyName, adminName, email, password } = req.body;
        if (!adminName || !email || !password) {
            return res.status(400).json({ success: false, error: 'Thiếu thông tin: tên, email, mật khẩu' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Tạo admin đầu tiên
        const admin = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: adminName,
                role: 'ADMIN',
            },
            select: { id: true, email: true, name: true, role: true },
        });

        // Lưu tên công ty vào SystemConfig (nếu có table) hoặc env
        // Tạm thời lưu vào metadata

        // Tạo JWT cho admin mới
        const token = jwt.sign(
            { id: admin.id, email: admin.email, role: admin.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            success: true,
            data: {
                token,
                user: admin,
                message: `Hệ thống đã khởi tạo cho ${companyName || 'công ty'}`,
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/auth/register — Tạo tài khoản mới (chỉ Admin)
 */
router.post('/register', authenticate, async (req, res, next) => {
    try {
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({ success: false, error: 'Chỉ Admin tạo được tài khoản' });
        }

        const { email, password, name, role, departmentId, walletAddress } = req.body;

        // Validate
        if (!email || !password || !name) {
            return res.status(400).json({ success: false, error: 'Thiếu email, password hoặc name' });
        }

        // Kiểm tra trùng email
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(409).json({ success: false, error: 'Email đã tồn tại' });
        }

        // Tự động sinh ví nếu không có
        const finalWalletAddress = walletAddress || ethers.Wallet.createRandom().address;

        // Hash password + tạo user
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: role || 'EMPLOYEE',
                departmentId,
                walletAddress: finalWalletAddress,
                wallet: {
                    create: { address: finalWalletAddress, balance: 0 }
                }
            },
            select: { id: true, email: true, name: true, role: true, department: { select: { name: true, id: true } }, walletAddress: true, wallet: true, avatarUrl: true },
        });

        // Đăng ký nhân viên trên blockchain (nếu có ví)
        let blockchainReg = null;
        if (finalWalletAddress && isBlockchainReady() && role !== 'ADMIN') {
            try {
                blockchainReg = await registerEmployeeOnChain(finalWalletAddress, role || 'EMPLOYEE');
            } catch (bcErr) {
                console.warn('⚠️ Blockchain register failed:', bcErr.message);
            }
        }

        res.status(201).json({ success: true, data: user, blockchain: blockchainReg });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/auth/login — Đăng nhập → JWT
 */
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Thiếu email hoặc password' });
        }

        // Tìm user
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ success: false, error: 'Email hoặc password sai' });
        }

        // Check if locked
        if (user.isLocked) {
            return res.status(403).json({ success: false, error: 'Tài khoản đang bị vô hiệu hóa do nhập sai quá 5 lần' });
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            const newFailedAttempts = (user.failedAttempts || 0) + 1;
            const updates = { failedAttempts: newFailedAttempts };
            if (newFailedAttempts >= 5) {
                updates.isLocked = true;
            }
            await prisma.user.update({ where: { id: user.id }, data: updates });

            if (updates.isLocked) {
                return res.status(403).json({ success: false, error: 'Tài khoản đang bị vô hiệu hóa do nhập sai quá 5 lần' });
            }
            return res.status(401).json({ success: false, error: `Email hoặc password sai (Sai ${newFailedAttempts}/5 lần)` });
        }

        // Reset failed attempts on success
        if (user.failedAttempts > 0) {
            await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: 0 } });
        }

        // Tạo JWT (24h)
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    department: user.department?.name,
                    departmentId: user.departmentId,
                    departmentSelfSelected: user.departmentSelfSelected,
                    walletAddress: user.walletAddress,
                    avatarUrl: user.avatarUrl,
                },
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/auth/me — Lấy thông tin user hiện tại
 */
router.get('/me', authenticate, async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                department: { select: { name: true } },
                wallet: true,
                walletAddress: true,
                avatarUrl: true,
                createdAt: true,
            },
        });

        if (!user) {
            return res.status(404).json({ success: false, error: 'User không tồn tại' });
        }

        res.json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
});

export default router;
