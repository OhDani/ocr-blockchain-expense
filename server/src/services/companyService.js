/**
 * companyService.js
 * Quản lý thông tin định danh doanh nghiệp (Company Profile / Enterprise Branding).
 * Cho phép Admin cấu hình động tên công ty, mã số thuế, địa chỉ, liên hệ trực tiếp từ web.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_FILE = join(__dirname, '..', 'config', 'company-info.json');

const DEFAULT_COMPANY = {
    companyName: 'Công ty Cổ phần Công nghệ VKU Global',
    taxCode: '0402123456',
    address: '470 Đường Trần Đại Nghĩa, Khu đô thị Đại học Đà Nẵng, Ngũ Hành Sơn, Đà Nẵng',
    email: 'contact@vku.udn.vn',
    phone: '0236 3667 117',
    website: 'https://vku.udn.vn',
};

let memoryCompany = null;

export function getCompanyInfo() {
    if (memoryCompany) {
        return { ...memoryCompany };
    }

    try {
        if (existsSync(CONFIG_FILE)) {
            const content = readFileSync(CONFIG_FILE, 'utf8');
            const parsed = JSON.parse(content);
            if (parsed && parsed.companyName) {
                memoryCompany = { ...DEFAULT_COMPANY, ...parsed };
                return { ...memoryCompany };
            }
        }
    } catch (err) {
        console.warn('⚠️ Lỗi đọc company-info.json:', err.message);
    }

    memoryCompany = { ...DEFAULT_COMPANY };
    try {
        writeFileSync(CONFIG_FILE, JSON.stringify(memoryCompany, null, 2), 'utf8');
    } catch {}
    return { ...memoryCompany };
}

export function updateCompanyInfo(data) {
    if (!data || typeof data !== 'object') {
        throw new Error('Dữ liệu công ty không hợp lệ');
    }

    const current = getCompanyInfo();
    const updated = {
        ...current,
        companyName: (data.companyName || current.companyName || '').trim(),
        taxCode: (data.taxCode !== undefined ? data.taxCode : current.taxCode || '').trim(),
        address: (data.address !== undefined ? data.address : current.address || '').trim(),
        email: (data.email !== undefined ? data.email : current.email || '').trim(),
        phone: (data.phone !== undefined ? data.phone : current.phone || '').trim(),
        website: (data.website !== undefined ? data.website : current.website || '').trim(),
    };

    if (!updated.companyName) {
        throw new Error('Tên công ty không được để trống');
    }

    memoryCompany = updated;
    try {
        writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
    } catch (err) {
        console.warn('⚠️ Ghi file company-info.json lỗi, lưu tạm bộ nhớ:', err.message);
    }

    return { ...memoryCompany };
}
