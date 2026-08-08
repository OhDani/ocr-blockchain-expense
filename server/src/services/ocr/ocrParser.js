/**
 * ocrParser.js
 * Parse raw text từ AI → structured JSON.
 * 
 * Nguyên tắc: Giữ nguyên TẤT CẢ trường AI trả về — không cắt, không lọc.
 * Parser chỉ "dọn dẹp" format, KHÔNG giới hạn trường.
 */

/**
 * Parse raw AI response thành structured data.
 * @param {string} rawText - Raw text từ Gemini API
 * @returns {{ success: boolean, data: object|null, warnings: string[], errors: string[] }}
 */
export function parseOcrResult(rawText) {
    const warnings = [];
    const errors = [];

    if (!rawText || typeof rawText !== 'string') {
        return {
            success: false,
            data: null,
            warnings,
            errors: ['Không nhận được response từ AI'],
        };
    }

    // ① Loại bỏ markdown wrapper (```json ... ```)
    let jsonString = stripMarkdownWrapper(rawText);

    // ② Nếu vẫn không phải JSON thuần, tìm { ... } đầu tiên
    if (!jsonString.trim().startsWith('{') && !jsonString.trim().startsWith('[')) {
        jsonString = extractJsonFromText(jsonString);
        if (!jsonString) {
            return {
                success: false,
                data: null,
                warnings,
                errors: ['Không tìm thấy JSON trong response của AI'],
            };
        }
        warnings.push('AI trả thêm text ngoài JSON — đã tự tách JSON ra');
    }

    // ③ JSON.parse()
    let data;
    try {
        data = JSON.parse(jsonString);
    } catch (parseError) {
        return {
            success: false,
            data: null,
            warnings,
            errors: [`Lỗi parse JSON: ${parseError.message}`],
        };
    }

    // ④ Normalize số tiền (string → number)
    data = normalizeMoneyFields(data);

    // ⑤ Validate tối thiểu
    if (data.grand_total === undefined && data.total === undefined) {
        warnings.push('Không tìm thấy trường grand_total hoặc total — Policy Engine có thể không hoạt động');
    }

    // ⑥ Cross-check tổng tiền (nếu có đủ dữ liệu)
    const crossCheckResult = crossCheckTotal(data);
    if (crossCheckResult) {
        warnings.push(crossCheckResult);
    }

    return {
        success: true,
        data,
        warnings,
        errors,
    };
}

/**
 * Loại bỏ markdown code block wrapper.
 */
function stripMarkdownWrapper(text) {
    const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/;
    const match = text.match(codeBlockRegex);
    if (match) {
        return match[1].trim();
    }
    return text.trim();
}

/**
 * Tìm JSON object đầu tiên trong text.
 */
function extractJsonFromText(text) {
    const startIndex = text.indexOf('{');
    if (startIndex === -1) return null;

    let depth = 0;
    for (let i = startIndex; i < text.length; i++) {
        if (text[i] === '{') depth++;
        if (text[i] === '}') depth--;
        if (depth === 0) {
            return text.substring(startIndex, i + 1);
        }
    }
    return null;
}

/**
 * Normalize số tiền: "1,200,000" → 1200000, "150.000" → 150000
 */
function normalizeMoneyFields(obj) {
    if (Array.isArray(obj)) {
        return obj.map((item) => normalizeMoneyFields(item));
    }

    if (obj !== null && typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string' && isMoneyString(key, value)) {
                result[key] = parseMoneyString(value);
            } else if (typeof value === 'object' && value !== null) {
                result[key] = normalizeMoneyFields(value);
            } else {
                result[key] = value;
            }
        }
        return result;
    }

    return obj;
}

/**
 * Kiểm tra xem một string có phải giá tiền hay không.
 */
function isMoneyString(key, value) {
    const moneyKeys = [
        'price', 'total', 'amount', 'subtotal', 'grand_total',
        'discount', 'vat_amount', 'service_charge', 'unit_price',
        'thanh_tien', 'don_gia', 'tong_tien', 'giam_gia',
    ];

    const isMoneyKey = moneyKeys.some(
        (mk) => key.toLowerCase().includes(mk)
    );

    const isMoneyPattern = /^[\d,.\s]+[đd]?$/.test(value.trim());

    return isMoneyKey && isMoneyPattern;
}

/**
 * Parse chuỗi tiền thành number.
 */
function parseMoneyString(str) {
    const cleaned = str.replace(/[đd\s]/g, '').replace(/[,.]/g, '');
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? str : num;
}

/**
 * Cross-check: subtotal + vat_amount ≈ grand_total
 */
function crossCheckTotal(data) {
    const { subtotal, vat_amount, grand_total } = data;

    if (
        typeof subtotal !== 'number' ||
        typeof vat_amount !== 'number' ||
        typeof grand_total !== 'number'
    ) {
        return null;
    }

    const expected = subtotal + vat_amount;
    const diff = Math.abs(expected - grand_total);
    const tolerance = grand_total * 0.01;

    if (diff > tolerance) {
        return `Cross-check: subtotal(${subtotal}) + VAT(${vat_amount}) = ${expected}, nhưng grand_total = ${grand_total} (chênh ${diff}đ)`;
    }

    return null;
}
