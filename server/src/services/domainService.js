/**
 * domainService.js
 * Quản lý danh sách tên miền email được phép đăng nhập Google SSO (Dynamic Domain Whitelist).
 * Cho phép Admin cấu hình động trực tiếp trên giao diện web mà không cần sửa code hay khởi động lại server.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_FILE = join(__dirname, '..', 'config', 'allowed-domains.json');
const DEFAULT_DOMAINS = ['vku.udn.vn', 'company.vn'];

let memoryDomains = null;

/**
 * Đọc danh sách domain được phép
 */
export function getAllowedDomains() {
    if (memoryDomains && memoryDomains.length > 0) {
        return [...memoryDomains];
    }

    try {
        if (existsSync(CONFIG_FILE)) {
            const content = readFileSync(CONFIG_FILE, 'utf8');
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed) && parsed.length > 0) {
                memoryDomains = parsed.map(d => String(d).trim().toLowerCase()).filter(Boolean);
                return [...memoryDomains];
            }
        }
    } catch (err) {
        console.warn('⚠️ Lỗi đọc allowed-domains.json:', err.message);
    }

    // Nếu chưa có file hoặc lỗi, đọc từ biến môi trường hoặc mặc định
    const envDomains = (process.env.ALLOWED_EMAIL_DOMAINS || '')
        .split(',')
        .map(d => d.trim().toLowerCase())
        .filter(Boolean);

    memoryDomains = Array.from(new Set([...DEFAULT_DOMAINS, ...envDomains]));
    try {
        writeFileSync(CONFIG_FILE, JSON.stringify(memoryDomains, null, 2), 'utf8');
    } catch {}
    return [...memoryDomains];
}

/**
 * Thêm một domain mới vào danh sách Whitelist
 * @param {string} rawDomain - ví dụ "fpt.edu.vn" hoặc "@fpt.edu.vn"
 */
export function addAllowedDomain(rawDomain) {
    if (!rawDomain || typeof rawDomain !== 'string') {
        throw new Error('Vui lòng nhập tên miền hợp lệ');
    }

    // Làm sạch: bỏ @, khoảng trắng, chuyển chữ thường
    const domain = rawDomain.replace(/^@/, '').trim().toLowerCase();

    // Validate format domain (ít nhất có 1 dấu chấm, ký tự a-z, 0-9, dấu gạch ngang)
    const domainRegex = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
    if (!domainRegex.test(domain)) {
        throw new Error('Định dạng tên miền không hợp lệ (ví dụ đúng: vku.udn.vn, company.vn, fpt.edu.vn)');
    }

    const current = getAllowedDomains();
    if (current.includes(domain)) {
        throw new Error(`Tên miền @${domain} đã có sẵn trong danh sách cho phép`);
    }

    const updated = [...current, domain];
    memoryDomains = updated;

    try {
        writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
    } catch (writeErr) {
        console.warn('⚠️ Ghi file allowed-domains.json không thành công, lưu tạm bộ nhớ:', writeErr.message);
    }

    return [...memoryDomains];
}

/**
 * Xóa một domain khỏi danh sách Whitelist
 * @param {string} rawDomain
 */
export function removeAllowedDomain(rawDomain) {
    const domain = String(rawDomain || '').replace(/^@/, '').trim().toLowerCase();
    const current = getAllowedDomains();

    if (!current.includes(domain)) {
        throw new Error(`Tên miền @${domain} không tồn tại trong danh sách`);
    }

    if (current.length <= 1) {
        throw new Error('Hệ thống phải có ít nhất 1 tên miền được cấp phép. Không thể xóa hết!');
    }

    const updated = current.filter(d => d !== domain);
    memoryDomains = updated;

    try {
        writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
    } catch (writeErr) {
        console.warn('⚠️ Ghi file allowed-domains.json không thành công, lưu tạm bộ nhớ:', writeErr.message);
    }

    return [...memoryDomains];
}
