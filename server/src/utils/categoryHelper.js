/**
 * categoryHelper.js — Chuẩn hóa danh mục chi phí (Expense Categories)
 * Gom các biến thể do AI trả về (như hotel, hotel_receipt, lodging) về chung một danh mục chuẩn tiếng Việt.
 */

export const CANONICAL_CATEGORIES = {
    HOTEL: {
        code: 'hotel',
        name: 'Khách sạn / Lưu trú',
        aliases: ['hotel', 'hotel_receipt', 'hotel_bill', 'lodging', 'accommodation', 'motel', 'resort', 'homestay', 'khach_san', 'luu_tru', 'phong_nghi'],
    },
    RESTAURANT: {
        code: 'restaurant',
        name: 'Ăn uống / Nhà hàng',
        aliases: ['restaurant', 'restaurant_bill', 'meal', 'food', 'dining', 'cafe', 'coffee', 'an_uong', 'buffet', 'bar', 'nha_hang', 'an_trua', 'an_toi', 'tiep_khach'],
    },
    TRANSPORT: {
        code: 'transport',
        name: 'Di chuyển / Taxi',
        aliases: ['taxi', 'transport', 'transportation', 'grab', 'be', 'car', 'bus', 'train', 'di_chuyen', 'xe_om', 'gojek', 'tau_hoa', 'xe_khach', 've_xe'],
    },
    FLIGHT: {
        code: 'flight',
        name: 'Vé máy bay',
        aliases: ['flight', 'airline', 'air_ticket', 'plane', 'airplane', 've_may_bay', 'aviation', 'vietnam_airlines', 'vietjet', 'bamboo'],
    },
    FUEL: {
        code: 'fuel',
        name: 'Nhiên liệu / Xăng xe',
        aliases: ['fuel', 'gas', 'gasoline', 'petrol', 'oil', 'xang_xe', 'petrolimex', 'nhien_lieu', 'xang_dau'],
    },
    OFFICE: {
        code: 'office',
        name: 'Văn phòng phẩm',
        aliases: ['office', 'office_supplies', 'stationery', 'supplies', 'equipment', 'van_phong_pham', 'printing', 'in_an', 'tai_lieu'],
    },
    OTHER: {
        code: 'other',
        name: 'Chi phí khác',
        aliases: ['other', 'general', 'misc', 'supermarket', 'medical', 'khac', 'toll', 've_cau_duong', 'chi_phi_khac'],
    },
};

function removeVietnameseTones(str) {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
}

/**
 * Chuẩn hóa chuỗi category tự do về canonical category.
 * @param {string} raw
 * @returns {{ code: string, name: string }}
 */
export function normalizeCategory(raw) {
    if (!raw || typeof raw !== 'string') {
        return { code: 'other', name: 'Chi phí khác' };
    }

    const trimmed = raw.trim();
    const lower = trimmed.toLowerCase();

    // 1. Kiểm tra khớp trực tiếp tên hiển thị tiếng Việt
    for (const cat of Object.values(CANONICAL_CATEGORIES)) {
        if (cat.name.toLowerCase() === lower || lower.includes(cat.name.toLowerCase())) {
            return { code: cat.code, name: cat.name };
        }
    }

    // 2. Chuẩn hóa không dấu và ký tự đặc biệt
    const cleanNoTone = removeVietnameseTones(lower).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const cleanRaw = lower.replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');

    for (const cat of Object.values(CANONICAL_CATEGORIES)) {
        if (cat.code === cleanRaw || cat.code === cleanNoTone) {
            return { code: cat.code, name: cat.name };
        }
        if (cat.aliases.includes(cleanRaw) || cat.aliases.includes(cleanNoTone)) {
            return { code: cat.code, name: cat.name };
        }
        if (cat.aliases.some(alias => cleanNoTone.includes(alias) || cleanRaw.includes(alias))) {
            return { code: cat.code, name: cat.name };
        }
    }

    return { code: 'other', name: 'Chi phí khác' };
}

/**
 * Lấy tên tiếng Việt hiển thị đẹp từ mã code hoặc chuỗi thô.
 * @param {string} raw
 * @returns {string}
 */
export function getCategoryLabel(raw) {
    return normalizeCategory(raw).name;
}
