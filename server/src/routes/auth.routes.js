/**
 * auth.routes.js — Đăng nhập, đăng ký, lấy thông tin user.
 */

import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

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

        // Hash password + tạo user
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: role || 'EMPLOYEE',
                departmentId,
                walletAddress,
                ...(walletAddress && {
                    wallet: {
                        create: { address: walletAddress, balance: 0 }
                    }
                })
            },
            select: { id: true, email: true, name: true, role: true, department: { select: { name: true, id: true } }, walletAddress: true, wallet: true, avatarUrl: true },
        });

        res.status(201).json({ success: true, data: user });
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

        // Verify password
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ success: false, error: 'Email hoặc password sai' });
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
