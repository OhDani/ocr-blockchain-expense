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
    // Hỗ trợ token từ query param (cho <img src> không gửi được header)
    const authHeader = req.headers.authorization;
    const queryToken = req.query?.token;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (queryToken) {
        token = queryToken;
    }

    if (!token) {
        return res.status(401).json({ success: false, error: 'Token không hợp lệ hoặc thiếu' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
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
