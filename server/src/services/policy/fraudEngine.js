/**
 * fraudEngine.js
 * Kết hợp điểm số AI (Gemini Vision) và các logic rule (Heuristics)
 * để tính fraudScore và gắn cờ cảnh báo chi tiết chống gian lận.
 */

import { PrismaClient } from '@prisma/client';
import { normalizeCategory } from '../../utils/categoryHelper.js';

const prisma = new PrismaClient();

function formatDateVi(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('vi-VN');
}

/**
 * Phân tích rủi ro gian lận của hóa đơn.
 * @param {object} params
 * @param {object} params.ocrData - Dữ liệu JSON đã parse từ AI
 * @param {object} params.trip - Thêm thông tin Trip (nếu có)
 * @param {string} params.invoiceHash - SHA-256 hash của ảnh hoặc nội dung hóa đơn
 * @returns {Promise<{ fraudScore: number, fraudFlags: string[], duplicateInfo: object|null }>}
 */
export async function analyzeFraud({ ocrData, trip, invoiceHash }) {
    let score = 0;
    const flags = [];
    let duplicateInfo = null;

    // ── 1. Phân tích từ AI (Gemini Vision) ──
    if (ocrData.fraud_analysis) {
        const aiScore = Number(ocrData.fraud_analysis.score) || 0;
        if (aiScore > 0) {
            score += Math.min(aiScore, 70);

            if (Array.isArray(ocrData.fraud_analysis.flags)) {
                ocrData.fraud_analysis.flags.forEach((flag) => {
                    flags.push(`[AI] ${flag}`);
                });
            } else if (aiScore >= 50) {
                flags.push(`[AI] Hệ thống AI phát hiện dấu hiệu bất thường về hình ảnh/nội dung`);
            }
        }
    }

    const grandTotal = ocrData.grand_total ?? ocrData.total ?? 0;
    const invDateStr = ocrData.invoice_date || ocrData.date || null;
    const normCategory = normalizeCategory(ocrData.invoice_type).code;

    // ── 2. Rule: Check Trùng lặp hóa đơn Đa tầng (Multi-tier Duplicate Check) ──
    // Tầng 2a: Trùng 100% tệp ảnh qua mã băm SHA-256 (invoiceHash)
    if (invoiceHash) {
        const hashMatch = await prisma.expense.findFirst({
            where: { invoiceHash },
            include: {
                user: { select: { name: true, email: true } },
                trip: { select: { destination: true } },
            },
        });

        if (hashMatch) {
            const uName = hashMatch.user?.name || 'nhân viên';
            const expDate = formatDateVi(hashMatch.createdAt);
            const amtStr = Number(hashMatch.amount).toLocaleString('vi-VN');
            const shortId = hashMatch.id.slice(0, 8);
            flags.push(`[Rule] Trùng lặp 100% tệp ảnh: Trùng hoàn toàn với Hóa đơn #${shortId} do ${uName} nộp ngày ${expDate} (Số tiền: ${amtStr}đ)`);
            score += 70;
            duplicateInfo = {
                type: 'EXACT_IMAGE',
                targetId: hashMatch.id,
                targetShortId: shortId,
                employeeName: uName,
                date: expDate,
                amount: hashMatch.amount,
            };
        }
    }

    // Tầng 2b: Trùng Số hóa đơn (invoice_number / bill_number)
    const invNumber = ocrData.invoice_number || ocrData.bill_number || ocrData.receipt_number;
    if (invNumber && !duplicateInfo) {
        const cleanInvNo = String(invNumber).trim();
        if (cleanInvNo.length >= 2 && cleanInvNo !== '0') {
            const allOcr = await prisma.ocrResult.findMany({
                include: {
                    expense: {
                        include: {
                            user: { select: { name: true } },
                            trip: { select: { destination: true } },
                        },
                    },
                },
            });

            const currentTax = ocrData.tax_id ? String(ocrData.tax_id).replace(/-/g, '').trim() : null;
            const currentStore = ocrData.store_name ? String(ocrData.store_name).toLowerCase().trim() : null;

            const match = allOcr.find((o) => {
                const p = o.parsedData || {};
                const targetNo = p.invoice_number || p.bill_number || p.receipt_number;
                if (!targetNo || String(targetNo).trim() !== cleanInvNo) return false;

                const targetTax = p.tax_id ? String(p.tax_id).replace(/-/g, '').trim() : null;
                const targetStore = p.store_name ? String(p.store_name).toLowerCase().trim() : null;

                if (currentTax && targetTax) {
                    return currentTax === targetTax;
                }
                if (currentStore && targetStore) {
                    return currentStore === targetStore;
                }
                return true;
            });

            if (match && match.expense) {
                const uName = match.expense.user?.name || 'nhân viên';
                const expDate = formatDateVi(match.expense.createdAt);
                const amtStr = Number(match.expense.amount).toLocaleString('vi-VN');
                const shortId = match.expense.id.slice(0, 8);
                flags.push(`[Rule] Trùng số hóa đơn (${cleanInvNo}): Trùng khớp với Hóa đơn #${shortId} do ${uName} nộp ngày ${expDate} (${amtStr}đ)`);
                score += 55;
                duplicateInfo = {
                    type: 'INVOICE_NUMBER',
                    targetId: match.expense.id,
                    targetShortId: shortId,
                    employeeName: uName,
                    date: expDate,
                    amount: match.expense.amount,
                };
            }
        }
    }

    // Tầng 2c: Trùng giao dịch bán lẻ (Cùng Nơi bán HOẶC MST + Cùng Ngày + Cùng Số tiền)
    if (!duplicateInfo && grandTotal > 0 && invDateStr) {
        const currentStore = ocrData.store_name ? String(ocrData.store_name).toLowerCase().trim() : null;
        const currentTax = ocrData.tax_id ? String(ocrData.tax_id).replace(/-/g, '').trim() : null;

        if (currentStore || currentTax) {
            const allOcr = await prisma.ocrResult.findMany({
                include: {
                    expense: {
                        include: {
                            user: { select: { name: true } },
                        },
                    },
                },
            });

            const match = allOcr.find((o) => {
                const p = o.parsedData || {};
                const targetDate = p.invoice_date || p.date;
                if (targetDate !== invDateStr) return false;

                const targetAmt = o.expense?.amount ?? p.grand_total ?? p.total ?? 0;
                if (Math.abs(targetAmt - grandTotal) > 1000) return false;

                const targetTax = p.tax_id ? String(p.tax_id).replace(/-/g, '').trim() : null;
                const targetStore = p.store_name ? String(p.store_name).toLowerCase().trim() : null;

                if (currentTax && targetTax && currentTax === targetTax) return true;
                if (currentStore && targetStore && (currentStore.includes(targetStore) || targetStore.includes(currentStore))) return true;

                return false;
            });

            if (match && match.expense) {
                const uName = match.expense.user?.name || 'nhân viên';
                const expDate = formatDateVi(match.expense.createdAt);
                const shortId = match.expense.id.slice(0, 8);
                const storeDisplay = ocrData.store_name || currentTax || 'cơ sở';
                flags.push(`[Rule] Cảnh báo trùng lặp giao dịch: Đã tồn tại hóa đơn cùng nơi bán '${storeDisplay}', cùng ngày ${invDateStr} và cùng số tiền ${Number(grandTotal).toLocaleString('vi-VN')}đ (Hóa đơn #${shortId} của ${uName})`);
                score += 45;
                duplicateInfo = {
                    type: 'TRANSACTION_MATCH',
                    targetId: match.expense.id,
                    targetShortId: shortId,
                    employeeName: uName,
                    date: expDate,
                    amount: match.expense.amount,
                };
            }
        }
    }

    // ── 3. Rule: Ngày hóa đơn nằm ngoài thời gian công tác ──
    if (trip && trip.startDate && trip.endDate && invDateStr) {
        const dateParts = invDateStr.split('/');
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
                flags.push(`[Rule] Ngày hóa đơn (${invDateStr}) không nằm trong thời gian đi công tác`);
                score += 30;
            }
        }
    }

    // ── 4. Rule: Check thời gian bất thường (ăn uống lúc nửa đêm 1AM - 5AM) ──
    if (ocrData.invoice_time) {
        const timeMatch = ocrData.invoice_time.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch && normCategory === 'restaurant') {
            const hour = parseInt(timeMatch[1], 10);
            if (hour >= 1 && hour <= 5) {
                flags.push(`[Rule] Hóa đơn dịch vụ ăn uống xuất vào giờ khuya (${ocrData.invoice_time})`);
                score += 20;
            }
        }
    }

    // ── 5. Rule: Số tiền quá "tròn" bất thường cho dịch vụ ăn uống, đi lại ──
    if (grandTotal > 0 && ['restaurant', 'taxi', 'transport'].includes(normCategory)) {
        if (grandTotal >= 200000 && grandTotal % 100000 === 0) {
            flags.push(`[Rule] Số tiền dịch vụ (${grandTotal.toLocaleString('vi-VN')}đ) làm tròn bất thường`);
            score += 15;
        }
    }

    // ── 6. Rule: Phát hiện mặt hàng không hợp lệ cho công tác phí (Non-reimbursable Items) ──
    const PROHIBITED_KEYWORDS = [
        { pattern: /\b(thuốc lá|thuốc mèo|thuốc jet|thuốc ba số|555|marlboro|cigar|xì gà|vape|pod)\b/i, category: 'Thuốc lá / Xì gà' },
        { pattern: /\b(chivas|whisky|vodka|hennessy|soju|rượu mạnh|rượu vang|cocktail)\b/i, category: 'Đồ uống có cồn / Rượu mạnh' },
        { pattern: /\b(karaoke|massage|tẩm quất|spa|vũ trường|bar|pub|casino|xổ số|vé số)\b/i, category: 'Dịch vụ giải trí cá nhân' },
    ];

    if (ocrData.items && Array.isArray(ocrData.items)) {
        const detectedItems = [];
        for (const item of ocrData.items) {
            const itemName = String(item.name || item.description || '');
            for (const { pattern, category } of PROHIBITED_KEYWORDS) {
                if (pattern.test(itemName)) {
                    detectedItems.push({ name: itemName, category, amount: item.amount || item.total || 0 });
                    break;
                }
            }
        }

        if (detectedItems.length > 0) {
            detectedItems.forEach((d) => {
                const amtStr = d.amount ? ` (${Number(d.amount).toLocaleString('vi-VN')}đ)` : '';
                flags.push(`[Rule] Mặt hàng không thuộc diện thanh toán công tác phí: '${d.name}' [${d.category}]${amtStr}`);
            });
            score += Math.min(detectedItems.length * 25, 60);
        }
    }

    // ── 7. Rule: Đối chiếu số học chi tiết (Tổng tiền các món vs Tổng thanh toán) ──
    if (ocrData.items && Array.isArray(ocrData.items) && ocrData.items.length >= 2 && grandTotal > 0) {
        let itemsSum = 0;
        let validItemCount = 0;
        for (const it of ocrData.items) {
            const itTotal = Number(it.total || it.amount || (it.quantity && it.unit_price ? it.quantity * it.unit_price : 0));
            if (itTotal > 0) {
                itemsSum += itTotal;
                validItemCount++;
            }
        }

        if (validItemCount >= 2 && itemsSum > 0) {
            const vatAmount = Number(ocrData.vat_amount || 0);
            const discount = Number(ocrData.discount || 0);
            const expectedTotal = itemsSum + vatAmount - discount;
            const diff = Math.abs(grandTotal - expectedTotal);
            const diffPercent = diff / grandTotal;

            // Nếu lệch > 15% và số tiền lệch trên 30.000đ
            if (diffPercent > 0.15 && diff > 30000) {
                flags.push(`[Rule] Dấu hiệu sai lệch số liệu: Tổng các món chi tiết (${Math.round(itemsSum).toLocaleString('vi-VN')}đ) không khớp với Tổng thanh toán (${Math.round(grandTotal).toLocaleString('vi-VN')}đ)`);
                score += 30;
            }
        }
    }

    // ── 8. Rule: Đối chiếu địa bàn công tác (Điểm đến chuyến đi vs Địa chỉ hóa đơn) ──
    if (trip && trip.destination && ['restaurant', 'hotel'].includes(normCategory)) {
        const tripDest = String(trip.destination).toLowerCase().trim();
        const fullAddr = String((ocrData.store_address || '') + ' ' + (ocrData.store_name || '')).toLowerCase();

        const CITIES = [
            { key: 'hà nội', aliases: ['hà nội', 'ha noi', 'hn', 'hoàn kiếm', 'cầu giấy', 'đống đa', 'ba đình', 'hai bà trưng'] },
            { key: 'hồ chí minh', aliases: ['hồ chí minh', 'ho chi minh', 'hcm', 'sài gòn', 'saigon', 'quận 1', 'quận 3', 'quận 7', 'thủ đức'] },
            { key: 'đà nẵng', aliases: ['đà nẵng', 'da nang', 'hải châu', 'sơn trà', 'ngũ hành sơn', 'thanh khê'] },
            { key: 'cần thơ', aliases: ['cần thơ', 'can tho', 'ninh kiều'] },
            { key: 'hải phòng', aliases: ['hải phòng', 'hai phong', 'ngô quyền', 'lê chân'] },
            { key: 'nha trang', aliases: ['nha trang', 'khánh hòa'] },
            { key: 'huế', aliases: ['huế', 'thừa thiên huế'] },
            { key: 'quảng ninh', aliases: ['quảng ninh', 'hạ long'] },
        ];

        const matchedTripCity = CITIES.find((c) => c.aliases.some((a) => tripDest.includes(a)));
        if (matchedTripCity) {
            const otherCity = CITIES.find((c) => c.key !== matchedTripCity.key && c.aliases.some((a) => fullAddr.includes(a)));
            const containsTripCity = matchedTripCity.aliases.some((a) => fullAddr.includes(a));

            if (otherCity && !containsTripCity) {
                flags.push(`[Rule] Lưu ý địa bàn: Hóa đơn dịch vụ tại '${otherCity.key.toUpperCase()}' không nằm trong điểm đến chuyến công tác (${trip.destination})`);
                score += 25;
            }
        }
    }

    score = Math.min(score, 100);

    return {
        fraudScore: score,
        fraudFlags: flags,
        duplicateInfo,
    };
}
