/**
 * hash.js — Utility để hash ảnh hóa đơn.
 * SHA-256 hash dùng làm invoiceHash cho blockchain.
 */

import { createHash } from 'crypto';

/**
 * Tạo SHA-256 hash từ buffer.
 * @param {Buffer} buffer - File buffer
 * @returns {string} Hex hash string
 */
export function hashBuffer(buffer) {
    return createHash('sha256').update(buffer).digest('hex');
}
