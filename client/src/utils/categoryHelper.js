/**
 * categoryHelper.js — Chuẩn hóa danh mục chi phí hiển thị ở Frontend
 */

export const CANONICAL_CATEGORIES = {
    HOTEL: {
        code: 'hotel',
        name: 'Khách sạn / Lưu trú',
        color: '#3b82f6', // blue
        aliases: ['hotel', 'hotel_receipt', 'hotel_bill', 'lodging', 'accommodation', 'motel', 'resort', 'homestay', 'khach_san', 'luu_tru', 'phong_nghi'],
    },
    RESTAURANT: {
        code: 'restaurant',
        name: 'Ăn uống / Nhà hàng',
        color: '#f59e0b', // amber
        aliases: ['restaurant', 'restaurant_bill', 'meal', 'food', 'dining', 'cafe', 'coffee', 'an_uong', 'buffet', 'bar', 'nha_hang', 'an_trua', 'an_toi', 'tiep_khach'],
    },
    TRANSPORT: {
        code: 'transport',
        name: 'Di chuyển / Taxi',
        color: '#10b981', // emerald
        aliases: ['taxi', 'transport', 'transportation', 'grab', 'be', 'car', 'bus', 'train', 'di_chuyen', 'xe_om', 'gojek', 'tau_hoa', 'xe_khach', 've_xe'],
    },
    FLIGHT: {
        code: 'flight',
        name: 'Vé máy bay',
        color: '#8b5cf6', // purple
        aliases: ['flight', 'airline', 'air_ticket', 'plane', 'airplane', 've_may_bay', 'aviation', 'vietnam_airlines', 'vietjet', 'bamboo'],
    },
    FUEL: {
        code: 'fuel',
        name: 'Nhiên liệu / Xăng xe',
        color: '#ef4444', // red
        aliases: ['fuel', 'gas', 'gasoline', 'petrol', 'oil', 'xang_xe', 'petrolimex', 'nhien_lieu', 'xang_dau'],
    },
    OFFICE: {
        code: 'office',
        name: 'Văn phòng phẩm',
        color: '#06b6d4', // cyan
        aliases: ['office', 'office_supplies', 'stationery', 'supplies', 'equipment', 'van_phong_pham', 'printing', 'in_an', 'tai_lieu'],
    },
    OTHER: {
        code: 'other',
        name: 'Chi phí khác',
        color: '#64748b', // slate
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

export function normalizeCategory(raw) {
    if (!raw || typeof raw !== 'string') {
        return { code: 'other', name: 'Chi phí khác', color: '#64748b' };
    }

    const trimmed = raw.trim();
    const lower = trimmed.toLowerCase();

    // 1. Kiểm tra khớp trực tiếp tên hiển thị tiếng Việt (ví dụ: "Khách sạn / Lưu trú")
    for (const cat of Object.values(CANONICAL_CATEGORIES)) {
        if (cat.name.toLowerCase() === lower || lower.includes(cat.name.toLowerCase())) {
            return { code: cat.code, name: cat.name, color: cat.color };
        }
    }

    // 2. Chuẩn hóa không dấu và ký tự đặc biệt
    const cleanNoTone = removeVietnameseTones(lower).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const cleanRaw = lower.replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');

    for (const cat of Object.values(CANONICAL_CATEGORIES)) {
        if (cat.code === cleanRaw || cat.code === cleanNoTone) {
            return { code: cat.code, name: cat.name, color: cat.color };
        }
        if (cat.aliases.includes(cleanRaw) || cat.aliases.includes(cleanNoTone)) {
            return { code: cat.code, name: cat.name, color: cat.color };
        }
        if (cat.aliases.some(alias => cleanNoTone.includes(alias) || cleanRaw.includes(alias))) {
            return { code: cat.code, name: cat.name, color: cat.color };
        }
    }

    return { code: 'other', name: 'Chi phí khác', color: '#64748b' };
}

export function getCategoryLabel(raw) {
    return normalizeCategory(raw).name;
}

export function getCategoryColor(raw) {
    return normalizeCategory(raw).color;
}
