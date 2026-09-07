/**
 * expense.routes.js — Upload hóa đơn, OCR, Policy, approve/reject.
 * 
 * Core flow: Upload ảnh → AI OCR đọc → Policy Engine đối chiếu → Lưu DB
 * 
 * Schema mới: Expense + Image + OcrResult + PolicyCheck + FraudAnalysis + BlockchainTx + ExpenseReview
 */

import { Router } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireManager } from '../middleware/auth.js';
import { createNotification } from './notification.routes.js';
import { extractInvoice } from '../services/ocr/ocrService.js';
import { parseOcrResult } from '../services/ocr/ocrParser.js';
import { evaluatePolicy } from '../services/policy/policyEngine.js';
import { analyzeFraud } from '../services/policy/fraudEngine.js';
import { hashBuffer } from '../utils/hash.js';
import {
    submitExpenseOnChain,
    validateExpenseOnChain,
    isBlockchainReady,
} from '../services/blockchain/blockchainService.js';

const router = Router();
const prisma = new PrismaClient();

// ──────── Multer config (memory storage — lưu vào DB thay vì disk) ────────
const upload = multer({
    storage: multer.memoryStorage(), // Lưu buffer trong RAM, sau đó chuyển base64 vào DB
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

        // ① Lưu ảnh vào bảng Image (Base64)
        const base64Data = req.file.buffer.toString('base64');
        const image = await prisma.image.create({
            data: {
                fileName: req.file.originalname,
                mimeType: req.file.mimetype,
                size: req.file.size,
                data: base64Data,
            },
        });

        // ② AI OCR — Đọc hóa đơn
        console.log(`📸 OCR processing: ${req.file.originalname}`);
        const { rawText, processingTime } = await extractInvoice(req.file.buffer, req.file.mimetype);

        // ③ Parse OCR result → structured JSON
        const parseResult = parseOcrResult(rawText);
        if (!parseResult.success) {
            return res.status(422).json({
                success: false,
                error: 'Không thể đọc hóa đơn',
                details: parseResult.errors,
            });
        }

        // ④ Policy Engine — Đối chiếu ngân sách
        const policyResult = await evaluatePolicy({
            ocrData: parseResult.data,
            employeeRole: user.role,
            approvedBudget: trip?.budget,
        });

        // ⑤ AI Fraud Detection — Phân tích rủi ro
        const fraudResult = await analyzeFraud({
            ocrData: parseResult.data,
            trip: trip,
        });

        // ⑥ Tạo invoice hash (SHA-256)
        const invoiceHash = hashBuffer(req.file.buffer);

        // ⑦ Xác định status dựa trên policy
        let status = 'PENDING';
        if (policyResult.status === 'VALID' && fraudResult.fraudScore === 0) {
            status = 'APPROVED';
        }

        // ⑧ Tạo Expense + các bảng con trong 1 transaction
        const amount = parseResult.data.grand_total ?? parseResult.data.total ?? 0;

        const expense = await prisma.expense.create({
            data: {
                userId: req.user.id,
                tripId: tripId || null,
                amount,
                invoiceType: parseResult.data.invoice_type || 'other',
                invoiceHash,
                status,
                userNote: userNote || null,
                imageId: image.id,
                // Tạo các bảng con
                ocrResult: {
                    create: {
                        rawText,
                        parsedData: parseResult.data,
                        processingTime,
                        warnings: parseResult.warnings,
                    },
                },
                policyCheck: {
                    create: {
                        status: policyResult.status,
                        checks: policyResult.checks,
                        details: policyResult.details,
                        message: policyResult.message,
                    },
                },
                fraudAnalysis: {
                    create: {
                        fraudScore: fraudResult.fraudScore,
                        fraudFlags: fraudResult.fraudFlags,
                    },
                },
            },
            include: {
                image: true,
                ocrResult: true,
                policyCheck: true,
                fraudAnalysis: true,
            },
        });

        // ⑨ Nếu approved + blockchain ready → ghi on-chain + auto hoàn ứng
        let blockchainResult = null;
        let blockchainError = null;
        if (status === 'APPROVED' && isBlockchainReady()) {
            try {
                const bcAmount = Math.floor(amount);
                console.log(`🔗 Blockchain: submitting ${bcAmount}đ | employee: ${user.walletAddress}`);
                blockchainResult = await submitExpenseOnChain(bcAmount, invoiceHash, user.walletAddress);
                console.log(`🔗 Blockchain: submitted, expenseId=${blockchainResult.expenseId}`);

                // Validate ngay (auto-approve → reimburse)
                if (blockchainResult.expenseId !== null) {
                    console.log(`🔗 Blockchain: validating → auto reimburse...`);
                    const validateResult = await validateExpenseOnChain(blockchainResult.expenseId, true);
                    blockchainResult.validateTxHash = validateResult.txHash;
                }

                // Lưu BlockchainTx + cập nhật status REIMBURSED
                await prisma.$transaction([
                    prisma.blockchainTx.create({
                        data: {
                            expenseId: expense.id,
                            txHash: blockchainResult.validateTxHash || blockchainResult.txHash,
                            blockchainId: blockchainResult.expenseId,
                            gasUsed: blockchainResult.gasUsed,
                            status: 'SUCCESS',
                        },
                    }),
                    prisma.expense.update({
                        where: { id: expense.id },
                        data: { status: 'REIMBURSED' },
                    }),
                ]);

                expense.status = 'REIMBURSED';
                console.log(`✅ Blockchain: REIMBURSED | TX: ${blockchainResult.validateTxHash || blockchainResult.txHash}`);
            } catch (err) {
                console.error('❌ Lỗi ghi nhận lên Blockchain:', err.message);
                blockchainError = err.message;
                // Ghi BlockchainTx FAILED
                await prisma.blockchainTx.create({
                    data: {
                        expenseId: expense.id,
                        status: 'FAILED',
                        errorMessage: err.message,
                    },
                }).catch(() => { });
            }
        } else if (status === 'APPROVED' && !isBlockchainReady()) {
            console.log('⚠️ Blockchain not ready — expense APPROVED nhưng chưa hoàn ứng on-chain');
        }

        console.log(`✅ Expense created: ${expense.id} | ${amount.toLocaleString()}đ | ${expense.status}`);

        // Tạo thông báo
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
                image: { select: { id: true, mimeType: true } },
                fraudAnalysis: { select: { fraudScore: true } },
                blockchainTx: { select: { txHash: true, status: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({ success: true, data: expenses });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/expenses/:id — Chi tiết expense (full sub-tables)
 */
router.get('/:id', async (req, res, next) => {
    try {
        const expense = await prisma.expense.findUnique({
            where: { id: req.params.id },
            include: {
                trip: true,
                user: {
                    select: { id: true, name: true, email: true, role: true, department: { select: { name: true } }, walletAddress: true },
                },
                image: true,
                ocrResult: true,
                policyCheck: true,
                fraudAnalysis: true,
                blockchainTx: true,
                reviews: { orderBy: { createdAt: 'desc' } },
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
 * GET /api/expenses/:id/image — Trả ảnh hóa đơn (binary)
 */
router.get('/:id/image', async (req, res, next) => {
    try {
        const expense = await prisma.expense.findUnique({
            where: { id: req.params.id },
            include: { image: true },
        });

        if (!expense || !expense.image) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy ảnh' });
        }

        if (expense.userId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ success: false, error: 'Không có quyền xem' });
        }

        const buffer = Buffer.from(expense.image.data, 'base64');
        res.set('Content-Type', expense.image.mimeType);
        res.set('Content-Length', buffer.length);
        res.send(buffer);
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/expenses/:id/approve — Admin duyệt expense
 * Cho phép gọi lại nếu status = APPROVED (retry blockchain)
 */
router.patch('/:id/approve', requireManager, async (req, res, next) => {
    try {
        const expense = await prisma.expense.findUnique({
            where: { id: req.params.id },
            include: { user: true },
        });
        if (!expense) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy expense' });
        }
        // Cho phép PENDING (duyệt lần đầu) hoặc APPROVED (retry blockchain)
        if (expense.status !== 'PENDING' && expense.status !== 'APPROVED') {
            return res.status(400).json({ success: false, error: 'Expense đã được xử lý (hoàn ứng hoặc từ chối)' });
        }

        const wasApproved = expense.status === 'APPROVED'; // true nếu retry
        let txHash = null;
        let blockchainId = null;
        let gasUsed = null;
        let newStatus = 'APPROVED';
        let blockchainError = null;

        // Ghi blockchain nếu sẵn sàng
        if (isBlockchainReady()) {
            try {
                const employeeWallet = expense.user?.walletAddress;
                if (!employeeWallet) {
                    throw new Error('Nhân viên chưa có wallet address. Vui lòng cập nhật trong phần quản lý user.');
                }

                console.log(`🔗 Blockchain: submitting expense ${expense.id} (${expense.amount}đ) cho ${employeeWallet}...`);
                const submitResult = await submitExpenseOnChain(
                    Math.floor(expense.amount),
                    expense.invoiceHash,
                    employeeWallet
                );
                console.log(`🔗 Blockchain: submitted, expenseId=${submitResult.expenseId}`);

                if (submitResult.expenseId !== null) {
                    console.log(`🔗 Blockchain: validating (auto-reimburse)...`);
                    const validateResult = await validateExpenseOnChain(submitResult.expenseId, true);
                    txHash = validateResult.txHash || submitResult.txHash;
                    gasUsed = validateResult.gasUsed || submitResult.gasUsed;
                } else {
                    txHash = submitResult.txHash;
                    gasUsed = submitResult.gasUsed;
                }

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

        // Cập nhật DB trong 1 transaction
        const updated = await prisma.$transaction(async (tx) => {
            const updatedExpense = await tx.expense.update({
                where: { id: req.params.id },
                data: { status: newStatus },
            });

            // Tạo hoặc cập nhật BlockchainTx
            if (txHash) {
                // Xóa BlockchainTx cũ (nếu retry) rồi tạo mới
                await tx.blockchainTx.deleteMany({ where: { expenseId: expense.id } });
                await tx.blockchainTx.create({
                    data: {
                        expenseId: expense.id,
                        txHash,
                        blockchainId,
                        gasUsed,
                        status: 'SUCCESS',
                    },
                });
            } else if (blockchainError) {
                await tx.blockchainTx.deleteMany({ where: { expenseId: expense.id } });
                await tx.blockchainTx.create({
                    data: {
                        expenseId: expense.id,
                        status: 'FAILED',
                        errorMessage: blockchainError,
                    },
                });
            }

            // Ghi review log
            await tx.expenseReview.create({
                data: {
                    expenseId: expense.id,
                    action: wasApproved ? 'RETRY' : 'APPROVE',
                    reviewerId: req.user.id,
                },
            });

            await tx.auditLog.create({
                data: {
                    action: wasApproved ? 'RETRY_EXPENSE_BLOCKCHAIN' : 'APPROVE_EXPENSE',
                    entity: 'Expense',
                    entityId: expense.id,
                    userId: req.user.id,
                    details: { amount: expense.amount, newStatus },
                }
            });

            return updatedExpense;
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

        const updated = await prisma.$transaction(async (tx) => {
            const updatedExpense = await tx.expense.update({
                where: { id: req.params.id },
                data: { status: 'REJECTED' },
            });

            // Ghi review log
            await tx.expenseReview.create({
                data: {
                    expenseId: expense.id,
                    action: 'REJECT',
                    reviewerId: req.user.id,
                    reason: reason || null,
                },
            });

            await tx.auditLog.create({
                data: {
                    action: 'REJECT_EXPENSE',
                    entity: 'Expense',
                    entityId: expense.id,
                    userId: req.user.id,
                    details: { reason: reason || null },
                }
            });

            return updatedExpense;
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

        const updated = await prisma.$transaction(async (tx) => {
            const updatedExpense = await tx.expense.update({
                where: { id: req.params.id },
                data: { status: 'PENDING' },
            });

            // Ghi review log
            await tx.expenseReview.create({
                data: {
                    expenseId: expense.id,
                    action: 'APPEAL',
                    reason: note.trim(),
                },
            });

            return updatedExpense;
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

        // Xóa expense + cascade xóa các bảng con
        await prisma.expense.delete({ where: { id: req.params.id } });

        // Xóa ảnh nếu có
        if (expense.imageId) {
            await prisma.image.delete({ where: { id: expense.imageId } }).catch(() => { });
        }

        res.json({ success: true, message: 'Đã xóa chi phí' });
    } catch (error) {
        next(error);
    }
});

export default router;
