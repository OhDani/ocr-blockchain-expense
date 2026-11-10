/**
 * policyEngine.js
 * Đối chiếu kết quả OCR với ngân sách công ty.
 * 
 * Input:  { ocrData, employeeRole, approvedBudget, userId, tripId }
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
 * @param {string} params.userId - ID user (để tính tổng chi trong ngày)
 * @param {string} params.tripId - ID trip (để tính tổng chi cho chuyến)
 * @returns {{ status: string, checks: object, details: object, message: string }}
 */
export async function evaluatePolicy({ ocrData, employeeRole = 'EMPLOYEE', approvedBudget, userId, tripId }) {
    const checks = {
        budget_ok: true,
        policy_ok: true,
        daily_ok: true,
        per_trip_ok: true,
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

    // ① Budget check: grand_total ≤ approvedBudget (ngân sách chuyến employee đề xuất)
    if (approvedBudget !== undefined && approvedBudget !== null) {
        if (grandTotal > approvedBudget) {
            checks.budget_ok = false;
        }
    }

    // ② Per-invoice limit check (hạn mức/hóa đơn do HR đặt)
    if (limits.perInvoice && grandTotal > limits.perInvoice) {
        checks.policy_ok = false;
    }

    // ③ Daily limit check — tính TỔNG tất cả hóa đơn trong ngày + hóa đơn hiện tại
    let todayTotal = 0;
    if (limits.daily && userId) {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        const dailyAgg = await prisma.expense.aggregate({
            _sum: { amount: true },
            where: {
                userId,
                createdAt: { gte: startOfDay, lt: endOfDay },
            },
        });
        todayTotal = (dailyAgg._sum.amount || 0) + grandTotal;

        if (todayTotal > limits.daily) {
            checks.daily_ok = false;
        }
    } else if (limits.daily && grandTotal > limits.daily) {
        // Fallback nếu không có userId
        checks.daily_ok = false;
        todayTotal = grandTotal;
    }

    // ④ Per-trip limit check — tính TỔNG chi phí chuyến + hóa đơn hiện tại vs hạn mức/chuyến HR
    let tripTotal = 0;
    if (limits.perTrip && tripId) {
        const tripAgg = await prisma.expense.aggregate({
            _sum: { amount: true },
            where: { tripId },
        });
        tripTotal = (tripAgg._sum.amount || 0) + grandTotal;

        if (tripTotal > limits.perTrip) {
            checks.per_trip_ok = false;
        }
    }

    // ⑤ Tax ID check
    const taxId = ocrData.tax_id;
    if (taxId) {
        const cleanTaxId = String(taxId).replace(/-/g, '');
        if (!TAX_ID_PATTERN.test(cleanTaxId)) {
            checks.tax_id_ok = false;
        }
    }

    // Xếp loại cuối cùng — theo thứ tự ưu tiên
    let status;
    let message;

    if (!checks.tax_id_ok) {
        status = 'INVALID_TAX_ID';
        message = `❌ Mã số thuế "${taxId}" không hợp lệ (cần 10 hoặc 13 chữ số)`;
    } else if (!checks.policy_ok) {
        const overAmount = grandTotal - limits.perInvoice;
        status = 'OVER_BUDGET';
        message = `⚠️ Vượt hạn mức/hóa đơn ${limits.label}: ${formatVND(grandTotal)} > ${formatVND(limits.perInvoice)} (vượt ${formatVND(overAmount)})`;
    } else if (!checks.daily_ok) {
        status = 'OVER_BUDGET';
        message = `⚠️ Vượt hạn mức/ngày ${limits.label}: tổng trong ngày ${formatVND(todayTotal)} > ${formatVND(limits.daily)}`;
    } else if (!checks.per_trip_ok) {
        status = 'OVER_BUDGET';
        message = `⚠️ Vượt hạn mức/chuyến ${limits.label}: tổng chuyến ${formatVND(tripTotal)} > ${formatVND(limits.perTrip)}`;
    } else if (!checks.budget_ok) {
        const overAmount = grandTotal - approvedBudget;
        status = 'OVER_BUDGET';
        message = `⚠️ Vượt ngân sách chuyến đi: ${formatVND(grandTotal)} > ${formatVND(approvedBudget)} (vượt ${formatVND(overAmount)})`;
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
            daily_total: todayTotal || grandTotal,
            per_invoice_limit: limits.perInvoice,
            per_trip_limit: limits.perTrip,
            trip_total: tripTotal || null,
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
