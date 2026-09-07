import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function cleanData() {
    console.log("🧹 Đang bắt đầu dọn dẹp dữ liệu giao dịch...");
    try {
        // Xóa các bảng liên quan đến Expense (theo thứ tự khóa ngoại để tránh lỗi constraints)
        console.log("🗑️ Xóa OcrResult...");
        await prisma.ocrResult.deleteMany({});

        console.log("🗑️ Xóa PolicyCheck... ");
        await prisma.policyCheck.deleteMany({});

        console.log("🗑️ Xóa FraudAnalysis...");
        await prisma.fraudAnalysis.deleteMany({});

        console.log("🗑️ Xóa BlockchainTx...");
        await prisma.blockchainTx.deleteMany({});

        console.log("🗑️ Xóa ExpenseReview...");
        await prisma.expenseReview.deleteMany({});

        console.log("🗑️ Xóa Image (hóa đơn)...");
        await prisma.image.deleteMany({});

        console.log("🗑️ Xóa Expense...");
        await prisma.expense.deleteMany({});

        console.log("🗑️ Xóa TripActivity...");
        await prisma.tripActivity.deleteMany({});

        console.log("🗑️ Xóa Trip...");
        await prisma.trip.deleteMany({});

        console.log("🗑️ Xóa Notification...");
        await prisma.notification.deleteMany({});

        console.log("🗑️ Xóa AuditLog...");
        await prisma.auditLog.deleteMany({});

        console.log("✅ Dọn dẹp hoàn tất! Giữ lại User, Department và PolicyLimit.");
    } catch (e) {
        console.error("❌ Lỗi khi dọn dẹp dữ liệu:", e);
    } finally {
        await prisma.$disconnect();
    }
}

cleanData();
