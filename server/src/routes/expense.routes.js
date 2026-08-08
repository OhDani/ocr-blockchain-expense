/**
 * expense.routes.js — Upload hóa đơn, OCR, Policy, approve/reject.
 * 
 * Core flow: Upload ảnh → AI OCR đọc → Policy Engine đối chiếu → Lưu DB
 */

import { Router } from 'express';
import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireManager } from '../middleware/auth.js';
import { createNotification } from './notification.routes.js';
import { extractInvoice } from '../services/ocr/ocrService.js';
import { parseOcrResult } from '../services/ocr/ocrParser.js';
import { evaluatePolicy } from '../services/policy/policyEngine.js';
import { hashBuffer } from '../utils/hash.js';
import {
    submitExpenseOnChain,
    validateExpenseOnChain,
    isBlockchainReady,
} from '../services/blockchain/blockchainService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();
const prisma = new PrismaClient();

// ──────── Multer config ────────
const storage = multer.diskStorage({
    destination: join(__dirname, '..', '..', 'uploads'),
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e6)}${getExt(file.mimetype)}`;
        cb(null, uniqueName);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ hỗ trợ ảnh JPG, PNG, WEBP'));
        }
    },
});

function getExt(mimeType) {
    const map = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
    return map[mimeType] || '.jpg';
}

// Tất cả route cần đăng nhập
router.use(authenticate);

/**
 * POST /api/expenses/upload — Upload ảnh hóa đơn → OCR → Policy → Lưu DB
 * Body (multipart/form-data): invoice (file), tripId (optional)
 */
router.post('/upload', upload.single('invoice'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Thiếu file ảnh hóa đơn' });
        }

        const { tripId, userNote } = req.body;

        // Bắt buộc phải chọn chuyến công tác
        if (!tripId) {
            return res.status(400).json({ success: false, error: 'Vui lòng chọn chuyến công tác' });
        }

        // Lấy thông tin user + trip
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        let trip = null;
        if (tripId) {
            trip = await prisma.trip.findUnique({ where: { id: tripId } });
            if (!trip || trip.userId !== req.user.id) {
                return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến công tác' });
            }
            // Auto chuyển trạng thái: PLANNED → ONGOING khi có chi phí mới
            if (trip.status === 'PLANNED') {
                await prisma.trip.update({
                    where: { id: tripId },
                    data: { status: 'ONGOING' },
                });
                console.log(`📌 Trip ${trip.destination}: PLANNED → ONGOING (auto)`);
            }
        }

        // ① AI OCR — Đọc hóa đơn
        console.log(`📸 OCR processing: ${req.file.filename}`);
        const { readFileSync } = await import('fs');
        const fileBuffer = readFileSync(req.file.path);
        const { rawText, processingTime } = await extractInvoice(fileBuffer, req.file.mimetype);

        // ② Parse OCR result → structured JSON
        const parseResult = parseOcrResult(rawText);
        if (!parseResult.success) {
            return res.status(422).json({
                success: false,
                error: 'Không thể đọc hóa đơn',
                details: parseResult.errors,
            });
        }

        // ③ Policy Engine — Đối chiếu ngân sách
        const policyResult = evaluatePolicy({
            ocrData: parseResult.data,
            employeeRole: user.role,
            approvedBudget: trip?.budget,
        });

        // ④ Tạo invoice hash (SHA-256)
        const invoiceHash = hashBuffer(fileBuffer);

        // ⑤ Xác định status dựa trên policy
        // VALID → auto-approve; mọi trường hợp khác → PENDING (Admin tự quyết)
        let status = 'PENDING';
        if (policyResult.status === 'VALID') {
            status = 'APPROVED';
        }
        // OVER_BUDGET, INVALID_TAX_ID, INVALID_DATA → giữ PENDING để admin kiểm duyệt

        // ⑥ Lưu vào DB
        const amount = parseResult.data.grand_total ?? parseResult.data.total ?? 0;
        const expense = await prisma.expense.create({
            data: {
                userId: req.user.id,
                tripId: tripId || null,
                amount,
                invoiceType: parseResult.data.invoice_type || null,
                imageUrl: `/uploads/${req.file.filename}`,
                invoiceHash,
                ocrData: parseResult.data,
                ocrRawText: rawText,
                policyResult,
                policyStatus: policyResult.status,
                status,
                userNote: userNote || null,
            },
        });

        // ⑦ Nếu approved + blockchain ready → ghi on-chain + auto hoàn ứng
        let blockchainResult = null;
        let blockchainError = null;
        if (status === 'APPROVED' && isBlockchainReady()) {
            try {
                const bcAmount = Math.floor(amount); // uint256 cần integer
                console.log(`🔗 Blockchain: submitting ${bcAmount}đ | hash: ${invoiceHash.substring(0, 16)}...`);
                blockchainResult = await submitExpenseOnChain(bcAmount, invoiceHash, user.walletAddress);
                console.log(`🔗 Blockchain: submitted, expenseId=${blockchainResult.expenseId}`);
                // Validate ngay (auto-approve → reimburse)
                if (blockchainResult.expenseId !== null) {
                    console.log(`🔗 Blockchain: validating → auto reimburse...`);
                    const validateResult = await validateExpenseOnChain(blockchainResult.expenseId, true);
                    blockchainResult.validateTxHash = validateResult.txHash;
                }

                // Cập nhật DB với TX info
                await prisma.expense.update({
                    where: { id: expense.id },
                    data: {
                        txHash: blockchainResult.txHash,
                        blockchainId: blockchainResult.expenseId,
                        status: 'REIMBURSED',
                    },
                });
                expense.txHash = blockchainResult.txHash;
                expense.blockchainId = blockchainResult.expenseId;
                expense.status = 'REIMBURSED';
                console.log(`✅ Blockchain: REIMBURSED | TX: ${blockchainResult.txHash}`);
            } catch (bcError) {
                blockchainError = bcError.message;
                // Trích xuất reason từ smart contract error
                const reason = bcError.reason || bcError.shortMessage || bcError.message;
                console.error('⚠️ Blockchain error (expense vẫn saved):', reason);
                console.error('   Full error:', bcError.message?.substring(0, 200));
            }
        } else if (status === 'APPROVED' && !isBlockchainReady()) {
            console.log('⚠️ Blockchain not ready — expense APPROVED nhưng chưa hoàn ứng on-chain');
        }

        console.log(`✅ Expense created: ${expense.id} | ${amount.toLocaleString()}đ | ${expense.status}`);

        // Tạo thông báo cho nhân viên
        if (expense.status === 'REIMBURSED') {
            createNotification({
                userId: req.user.id,
                type: 'expense_reimbursed',
                title: 'Hoàn ứng thành công',
                message: `Hóa đơn ${expense.invoiceType || ''} ${amount.toLocaleString('vi-VN')}đ đã được hoàn ứng qua blockchain.`,
                expenseId: expense.id,
            }).catch(() => { });
        } else if (expense.status === 'PENDING') {
            createNotification({
                userId: req.user.id,
                type: 'expense_pending',
                title: 'Hóa đơn chờ duyệt',
                message: `Hóa đơn ${expense.invoiceType || ''} ${amount.toLocaleString('vi-VN')}đ cần admin kiểm duyệt.`,
                expenseId: expense.id,
            }).catch(() => { });
        }

        res.status(201).json({
            success: true,
            data: {
                expense,
                ocr: {
                    data: parseResult.data,
                    warnings: parseResult.warnings,
                    processingTime,
                },
                policy: policyResult,
                blockchain: blockchainResult,
                blockchainError: blockchainError || null,
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/expenses — Danh sách expenses của user
 */
router.get('/', async (req, res, next) => {
    try {
        const expenses = await prisma.expense.findMany({
            where: { userId: req.user.id },
            include: {
                trip: { select: { id: true, destination: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({ success: true, data: expenses });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/expenses/:id — Chi tiết expense
 */
router.get('/:id', async (req, res, next) => {
    try {
        const expense = await prisma.expense.findUnique({
            where: { id: req.params.id },
            include: {
                trip: true,
                user: {
                    select: { id: true, name: true, email: true, role: true, department: true },
                },
            },
        });

        if (!expense) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy expense' });
        }

        if (expense.userId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ success: false, error: 'Không có quyền xem' });
        }

        res.json({ success: true, data: expense });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/expenses/:id/approve — Admin duyệt expense
 */
router.patch('/:id/approve', requireManager, async (req, res, next) => {
    try {
        const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
        if (!expense) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy expense' });
        }
        if (expense.status !== 'PENDING') {
            return res.status(400).json({ success: false, error: 'Expense đã được xử lý' });
        }

        let txHash = null;
        let blockchainId = null;
        let newStatus = 'APPROVED';
        let blockchainError = null;

        // Ghi blockchain nếu sẵn sàng
        if (isBlockchainReady()) {
            try {
                console.log(`🔗 Blockchain: submitting expense ${expense.id} (${expense.amount}đ)...`);
                const submitResult = await submitExpenseOnChain(expense.amount, expense.invoiceHash, null);
                console.log(`🔗 Blockchain: submitted, expenseId=${submitResult.expenseId}`);
                if (submitResult.expenseId !== null) {
                    console.log(`🔗 Blockchain: validating (auto-reimburse)...`);
                    await validateExpenseOnChain(submitResult.expenseId, true);
                }
                txHash = submitResult.txHash;
                blockchainId = submitResult.expenseId;
                newStatus = 'REIMBURSED';
                console.log(`✅ Blockchain: REIMBURSED | TX: ${txHash}`);
            } catch (bcError) {
                console.error('⚠️ Blockchain error:', bcError.message);
                blockchainError = bcError.message;
            }
        } else {
            console.log('⚠️ Blockchain not ready, skipping on-chain submission');
        }

        const updated = await prisma.expense.update({
            where: { id: req.params.id },
            data: { status: newStatus, txHash, blockchainId },
        });

        res.json({
            success: true,
            data: updated,
            blockchain: {
                txHash,
                blockchainId,
                error: blockchainError,
            },
        });

        // Thông báo cho nhân viên
        createNotification({
            userId: expense.userId,
            type: newStatus === 'REIMBURSED' ? 'expense_reimbursed' : 'expense_approved',
            title: newStatus === 'REIMBURSED' ? 'Hoàn ứng thành công' : 'Đơn được duyệt',
            message: newStatus === 'REIMBURSED'
                ? `Chi phí ${expense.amount.toLocaleString('vi-VN')}đ đã được hoàn ứng qua blockchain.`
                : `Chi phí ${expense.amount.toLocaleString('vi-VN')}đ đã được admin duyệt.`,
            expenseId: expense.id,
        }).catch(() => { });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/expenses/:id/reject — Admin từ chối expense
 */
router.patch('/:id/reject', requireManager, async (req, res, next) => {
    try {
        const { reason } = req.body;
        const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
        if (!expense) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy expense' });
        }
        if (expense.status !== 'PENDING') {
            return res.status(400).json({ success: false, error: 'Expense đã được xử lý' });
        }

        const updated = await prisma.expense.update({
            where: { id: req.params.id },
            data: {
                status: 'REJECTED',
                rejectReason: reason || null,
            },
        });

        res.json({ success: true, data: updated });

        // Thông báo cho nhân viên
        createNotification({
            userId: expense.userId,
            type: 'expense_rejected',
            title: 'Đơn bị từ chối',
            message: `Chi phí ${expense.amount.toLocaleString('vi-VN')}đ bị từ chối.${reason ? ' Lý do: ' + reason : ''}`,
            expenseId: expense.id,
        }).catch(() => { });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/expenses/:id/appeal — Nhân viên khiếu nại expense bị từ chối
 */
router.patch('/:id/appeal', async (req, res, next) => {
    try {
        const { note } = req.body;
        if (!note || !note.trim()) {
            return res.status(400).json({ success: false, error: 'Vui lòng nhập lý do khiếu nại' });
        }

        const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
        if (!expense) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy chi phí' });
        }
        if (expense.userId !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Không có quyền khiếu nại' });
        }
        if (expense.status !== 'REJECTED') {
            return res.status(400).json({ success: false, error: 'Chỉ khiếu nại được đơn bị từ chối' });
        }

        const updated = await prisma.expense.update({
            where: { id: req.params.id },
            data: {
                appealNote: note.trim(),
                status: 'PENDING', // Chuyển về PENDING để admin xem lại
            },
        });

        res.json({ success: true, data: updated });

        // Thông báo cho tất cả admin
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
        for (const admin of admins) {
            createNotification({
                userId: admin.id,
                type: 'appeal_received',
                title: 'Khiếu nại mới',
                message: `Nhân viên khiếu nại chi phí ${expense.amount?.toLocaleString('vi-VN') || ''}đ: "${note.trim().substring(0, 50)}"`,
                expenseId: expense.id,
            }).catch(() => { });
        }
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/expenses/:id — Xóa expense (chỉ cho phép khi PENDING)
 */
router.delete('/:id', async (req, res, next) => {
    try {
        const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
        if (!expense) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy chi phí' });
        }
        if (expense.userId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ success: false, error: 'Không có quyền xóa' });
        }
        if (expense.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                error: `Không thể xóa chi phí đã ${expense.status === 'APPROVED' ? 'duyệt' : expense.status === 'REIMBURSED' ? 'hoàn ứng' : 'xử lý'}. Chỉ chi phí "Chờ duyệt" mới xóa được.`,
            });
        }

        await prisma.expense.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Đã xóa chi phí' });
    } catch (error) {
        next(error);
    }
});

export default router;

