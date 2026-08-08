/**
 * policyEngine.js
 * Đối chiếu kết quả OCR với ngân sách công ty.
 * 
 * Input:  { ocrData, employeeRole, approvedBudget }
 * Output: { status, checks, details, message }
 */

import { POLICY_LIMITS } from './policyConfig.js';

// Pattern MST Việt Nam: 10 số hoặc 13 số (10 + 3)
const TAX_ID_PATTERN = /^\d{10}(\d{3})?$/;

/**
 * Đối chiếu OCR result với policy.
 * @param {object} params
 * @param {object} params.ocrData - Dữ liệu OCR đã parse
 * @param {string} params.employeeRole - 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
 * @param {number} params.approvedBudget - Ngân sách được duyệt cho chuyến này
 * @returns {{ status: string, checks: object, details: object, message: string }}
 */
export function evaluatePolicy({ ocrData, employeeRole = 'EMPLOYEE', approvedBudget }) {
    const checks = {
        budget_ok: true,
        policy_ok: true,
        tax_id_ok: true,
    };

    const limits = POLICY_LIMITS[employeeRole];
    if (!limits) {
        return {
            status: 'INVALID_DATA',
            checks,
            details: { employee_role: employeeRole },
            message: `❌ Cấp bậc "${employeeRole}" không hợp lệ`,
        };
    }

    const grandTotal = ocrData.grand_total ?? ocrData.total ?? null;

    if (grandTotal === null || typeof grandTotal !== 'number') {
        return {
            status: 'INVALID_DATA',
            checks: { ...checks, budget_ok: false, policy_ok: false },
            details: {
                employee_role: employeeRole,
                role_label: limits.label,
            },
            message: '❌ Không tìm thấy tổng tiền (grand_total) trong dữ liệu OCR',
        };
    }

    // ① Budget check: grand_total ≤ approvedBudget
    if (approvedBudget !== undefined && approvedBudget !== null) {
        if (grandTotal > approvedBudget) {
            checks.budget_ok = false;
        }
    }

    // ② Policy check: grand_total ≤ hạn mức ăn uống / ngày
    const dailyLimit = limits.meal_per_day;
    if (grandTotal > dailyLimit) {
        checks.policy_ok = false;
    }

    // ③ Tax ID check
    const taxId = ocrData.tax_id;
    if (taxId) {
        const cleanTaxId = String(taxId).replace(/-/g, '');
        if (!TAX_ID_PATTERN.test(cleanTaxId)) {
            checks.tax_id_ok = false;
        }
    }

    // Xếp loại cuối cùng
    let status;
    let message;

    if (!checks.tax_id_ok) {
        status = 'INVALID_TAX_ID';
        message = `❌ Mã số thuế "${taxId}" không hợp lệ (cần 10 hoặc 13 chữ số)`;
    } else if (!checks.budget_ok) {
        const overAmount = grandTotal - approvedBudget;
        status = 'OVER_BUDGET';
        message = `⚠️ Vượt ngân sách: ${formatVND(grandTotal)} > ${formatVND(approvedBudget)} (vượt ${formatVND(overAmount)})`;
    } else if (!checks.policy_ok) {
        const overAmount = grandTotal - dailyLimit;
        status = 'OVER_BUDGET';
        message = `⚠️ Vượt hạn mức ${limits.label}: ${formatVND(grandTotal)} > ${formatVND(dailyLimit)}/ngày (vượt ${formatVND(overAmount)})`;
    } else {
        status = 'VALID';
        message = '✅ Hợp lệ - trong ngân sách được duyệt';
    }

    return {
        status,
        checks,
        details: {
            employee_role: employeeRole,
            role_label: limits.label,
            approved_budget: approvedBudget ?? null,
            actual_amount: grandTotal,
            daily_limit: dailyLimit,
            difference: approvedBudget != null ? approvedBudget - grandTotal : null,
        },
        message,
    };
}

/**
 * Format số tiền theo kiểu VNĐ.
 */
function formatVND(amount) {
    return amount.toLocaleString('vi-VN') + 'đ';
}
