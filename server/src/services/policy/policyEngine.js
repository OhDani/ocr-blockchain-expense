/**
 * policyEngine.js
 * Đối chiếu kết quả OCR với ngân sách công ty.
 * 
 * Input:  { ocrData, employeeRole, approvedBudget }
 * Output: { status, checks, details, message }
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
export async function evaluatePolicy({ ocrData, employeeRole = 'EMPLOYEE', approvedBudget }) {
    const checks = {
        budget_ok: true,
        policy_ok: true,
        tax_id_ok: true,
    };

    const dbLimit = await prisma.policyLimit.findUnique({
        where: { role: employeeRole }
    });

    if (!dbLimit) {
        return {
            status: 'INVALID_DATA',
            checks,
            details: { employee_role: employeeRole },
            message: `❌ Không tìm thấy hạn mức cho role "${employeeRole}"`,
        };
    }

    const limits = {
        label: employeeRole === 'ADMIN' ? 'Giám đốc' : employeeRole === 'MANAGER' ? 'Trưởng phòng' : 'Nhân viên',
        daily: dbLimit.dailyLimit,
        perInvoice: dbLimit.perInvoiceLimit,
        perTrip: dbLimit.totalPerTripLimit,
    };

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

    // ② Per-invoice limit check
    if (limits.perInvoice && grandTotal > limits.perInvoice) {
        checks.policy_ok = false;
    }

    // ③ Daily limit check (secondary)
    if (limits.daily && grandTotal > limits.daily) {
        checks.policy_ok = false;
    }

    // ④ Tax ID check
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
        message = `⚠️ Vượt ngân sách chuyến đi: ${formatVND(grandTotal)} > ${formatVND(approvedBudget)} (vượt ${formatVND(overAmount)})`;
    } else if (!checks.policy_ok) {
        // Determine which limit was violated for the message
        if (limits.perInvoice && grandTotal > limits.perInvoice) {
            const overAmount = grandTotal - limits.perInvoice;
            status = 'OVER_BUDGET';
            message = `⚠️ Vượt hạn mức/hóa đơn ${limits.label}: ${formatVND(grandTotal)} > ${formatVND(limits.perInvoice)} (vượt ${formatVND(overAmount)})`;
        } else {
            const overAmount = grandTotal - limits.daily;
            status = 'OVER_BUDGET';
            message = `⚠️ Vượt hạn mức/ngày ${limits.label}: ${formatVND(grandTotal)} > ${formatVND(limits.daily)} (vượt ${formatVND(overAmount)})`;
        }
    } else {
        status = 'VALID';
        message = '✅ Hợp lệ - trong hạn mức được duyệt';
    }

    return {
        status,
        checks,
        details: {
            employee_role: employeeRole,
            role_label: limits.label,
            approved_budget: approvedBudget ?? null,
            actual_amount: grandTotal,
            daily_limit: limits.daily,
            per_invoice_limit: limits.perInvoice,
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
