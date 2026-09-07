/**
 * fraudEngine.js
 * Kết hợp điểm số AI (Gemini) và các logic rule (Heuristics) để tính fraudScore.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Phân tích rủi ro gian lận của hóa đơn.
 * @param {object} params
 * @param {object} params.ocrData - Dữ liệu JSON đã parse từ AI
 * @param {object} params.trip - Thêm thông tin Trip (nếu có)
 * @returns {Promise<{ fraudScore: number, fraudFlags: string[] }>}
 */
export async function analyzeFraud({ ocrData, trip }) {
    let score = 0;
    const flags = [];

    // 1. Phân tích từ AI (Gemini Vision)
    if (ocrData.fraud_analysis) {
        const aiScore = Number(ocrData.fraud_analysis.score) || 0;
        if (aiScore > 0) {
            score += Math.min(aiScore, 70);

            if (Array.isArray(ocrData.fraud_analysis.flags)) {
                ocrData.fraud_analysis.flags.forEach(flag => {
                    flags.push(`[AI] ${flag}`);
                });
            } else if (aiScore >= 50) {
                flags.push(`[AI] Hệ thống AI phát hiện dấu hiệu bất thường về hình ảnh/nội dung`);
            }
        }
    }

    // 2. Rule: Ngày hóa đơn nằm ngoài thời gian công tác
    if (trip && trip.startDate && trip.endDate && ocrData.invoice_date) {
        const dateParts = ocrData.invoice_date.split('/');
        if (dateParts.length === 3) {
            const y = parseInt(dateParts[2], 10);
            const m = parseInt(dateParts[1], 10) - 1;
            const d = parseInt(dateParts[0], 10);

            const invDate = new Date(y, m, d);
            const tripStart = new Date(trip.startDate);
            const tripEnd = new Date(trip.endDate);

            invDate.setHours(0, 0, 0, 0);
            tripStart.setHours(0, 0, 0, 0);
            tripEnd.setHours(0, 0, 0, 0);

            if (invDate < tripStart || invDate > tripEnd) {
                flags.push(`[Rule] Ngày hóa đơn (${ocrData.invoice_date}) không nằm trong thời gian đi công tác`);
                score += 30;
            }
        }
    }

    // 3. Rule: Check thời gian bất thường (ăn uống lúc nửa đêm 1AM - 5AM)
    if (ocrData.invoice_time) {
        const timeMatch = ocrData.invoice_time.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch && (ocrData.invoice_type === 'restaurant' || ocrData.invoice_type === 'meal')) {
            const hour = parseInt(timeMatch[1], 10);
            if (hour >= 1 && hour <= 5) {
                flags.push(`[Rule] Hóa đơn dịch vụ ăn uống xuất vào giờ khuya (${ocrData.invoice_time})`);
                score += 20;
            }
        }
    }

    // 4. Rule: Số tiền quá "tròn" bất thường cho dịch vụ ăn uống, đi lại
    const grandTotal = ocrData.grand_total ?? ocrData.total ?? 0;
    if (grandTotal > 0 && ['restaurant', 'meal', 'taxi'].includes(ocrData.invoice_type)) {
        if (grandTotal >= 200000 && grandTotal % 100000 === 0) {
            flags.push(`[Rule] Số tiền dịch vụ (${grandTotal.toLocaleString('vi-VN')}đ) làm tròn bất thường`);
            score += 15;
        }
    }

    // 5. Rule: Duplicate Invoice Check — query OcrResult thay vì Expense.ocrData
    if (ocrData.tax_id) {
        const taxId = String(ocrData.tax_id).replace(/-/g, '').trim();

        // 5a. Trùng số hóa đơn
        if (ocrData.invoice_number) {
            const existingOcrResults = await prisma.ocrResult.findMany({
                select: { id: true, parsedData: true, expense: { select: { amount: true } } }
            });

            const hasSameInvoiceNumber = existingOcrResults.some(ocr => {
                const data = ocr.parsedData || {};
                const tId = String(data.tax_id || '').replace(/-/g, '').trim();
                return tId === taxId && data.invoice_number === ocrData.invoice_number;
            });

            if (hasSameInvoiceNumber) {
                flags.push(`[Rule] Phát hiện hóa đơn trùng lặp với CSDL (Cùng MST và Số hóa đơn)`);
                score += 50;
            }
        }

        // 5b. Trùng MST + Ngày + Số tiền
        if (!ocrData.invoice_number && ocrData.invoice_date && grandTotal > 0) {
            const existingOcrResults = await prisma.ocrResult.findMany({
                select: { parsedData: true, expense: { select: { amount: true } } }
            });

            const isDuplicate = existingOcrResults.some(ocr => {
                const data = ocr.parsedData || {};
                const tId = String(data.tax_id || '').replace(/-/g, '').trim();
                return tId === taxId
                    && data.invoice_date === ocrData.invoice_date
                    && ocr.expense?.amount === grandTotal;
            });

            if (isDuplicate) {
                flags.push(`[Rule] Cảnh báo trùng lặp: Đã tồn tại hóa đơn cùng MST, cùng ngày và cùng số tiền`);
                score += 40;
            }
        }
    }

    score = Math.min(score, 100);

    return {
        fraudScore: score,
        fraudFlags: flags
    };
}
