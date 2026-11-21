/**
 * auth.routes.js — Đăng nhập, đăng ký, lấy thông tin user.
 */

import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { registerEmployeeOnChain, isBlockchainReady } from '../services/blockchain/blockchainService.js';
import { getAllowedDomains } from '../services/domainService.js';
import { getCompanyInfo, updateCompanyInfo } from '../services/companyService.js';
import { ethers } from 'ethers';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/auth/check-setup — Kiểm tra hệ thống đã khởi tạo chưa
 */
router.get('/check-setup', async (req, res, next) => {
    try {
        const userCount = await prisma.user.count();
        const company = getCompanyInfo();
        res.json({ success: true, data: { needSetup: userCount === 0, companyName: company.companyName } });
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

        // Lưu tên công ty vào cấu hình hệ thống
        if (companyName) {
            try {
                updateCompanyInfo({ companyName });
            } catch {}
        }

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

        // Nếu có chỉ định ví thì dùng, không thì để null để nhân viên tự liên kết MetaMask chính chủ
        const finalWalletAddress = walletAddress?.trim() || null;

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
                ...(finalWalletAddress ? {
                    wallet: {
                        create: { address: finalWalletAddress, balance: 0 }
                    }
                } : {})
            },
            select: { id: true, email: true, name: true, role: true, department: { select: { name: true, id: true } }, walletAddress: true, wallet: true, avatarUrl: true },
        });

        // Đăng ký nhân viên trên blockchain (nếu có ví và không phải ADMIN)
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
 * POST /api/auth/google — Đăng nhập bằng Google Identity / OAuth 2.0
 * Hỗ trợ tài khoản trường @vku.udn.vn và doanh nghiệp @company.vn
 */
router.post('/google', async (req, res, next) => {
    try {
        const { credential, email: demoEmail, name: demoName, picture: demoPicture } = req.body;

        let email = null;
        let name = null;
        let picture = null;

        // 1. Phân tích token Google nếu có
        if (credential) {
            try {
                const parts = credential.split('.');
                if (parts.length === 3) {
                    const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
                    const payload = JSON.parse(payloadJson);
                    email = payload.email;
                    name = payload.name;
                    picture = payload.picture;
                }
            } catch {
                return res.status(400).json({ success: false, error: 'Token Google không hợp lệ' });
            }
        } else if (demoEmail) {
            // Hỗ trợ chế độ demo xác thực tài khoản trường @vku.udn.vn
            email = demoEmail;
            name = demoName || demoEmail.split('@')[0];
            picture = demoPicture || null;
        }

        if (!email) {
            return res.status(400).json({ success: false, error: 'Thiếu thông tin email từ Google' });
        }

        email = email.toLowerCase().trim();

        // 2. Kiểm tra Whitelist domain được phép truy cập (Dynamic Domain Whitelist do Admin cấu hình)
        const allowedDomains = getAllowedDomains();

        const emailDomain = email.split('@')[1];
        if (!emailDomain || !allowedDomains.includes(emailDomain)) {
            return res.status(403).json({
                success: false,
                error: `Tài khoản ${email} không thuộc tổ chức được phép truy cập. Hệ thống chỉ cho phép các domain: @${allowedDomains.join(', @')}`,
            });
        }

        // 3. Tìm hoặc tự động tạo tài khoản (Auto-provisioning)
        let user = await prisma.user.findUnique({
            where: { email },
            include: { department: { select: { id: true, name: true } } },
        });

        if (!user) {
            // Lấy phòng ban đầu tiên để gán mặc định
            const defaultDept = await prisma.department.findFirst({
                orderBy: { createdAt: 'asc' },
            });

            // Nhân viên mới đăng nhập Google lần đầu: walletAddress để null chờ nhân viên tự liên kết MetaMask chính chủ
            const dummyPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

            user = await prisma.user.create({
                data: {
                    email,
                    name: name || email.split('@')[0],
                    password: dummyPassword,
                    role: 'EMPLOYEE',
                    departmentId: defaultDept ? defaultDept.id : null,
                    walletAddress: null,
                    avatarUrl: picture,
                },
                include: { department: { select: { id: true, name: true } } },
            });
        }

        if (user.isLocked) {
            return res.status(403).json({ success: false, error: 'Tài khoản đang bị khóa. Vui lòng liên hệ Admin.' });
        }

        // 4. Sinh JWT token của FlexiTrip (24h)
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
