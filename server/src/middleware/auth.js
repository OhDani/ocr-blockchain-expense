/**
 * auth.js — Middleware xác thực JWT.
 * Verify token từ header Authorization: Bearer <token>
 */

import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Middleware xác thực — gắn user vào req.user
 */
export function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Token không hợp lệ hoặc thiếu' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // { id, email, role }
        next();
    } catch (error) {
        return res.status(401).json({ success: false, error: 'Token hết hạn hoặc không hợp lệ' });
    }
}

/**
 * Middleware kiểm tra quyền Admin
 */
export function requireAdmin(req, res, next) {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, error: 'Chỉ Admin mới có quyền truy cập' });
    }
    next();
}

/**
 * Middleware kiểm tra quyền Admin hoặc Manager
 */
export function requireManager(req, res, next) {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
        return res.status(403).json({ success: false, error: 'Cần quyền Manager hoặc Admin' });
    }
    next();
}
