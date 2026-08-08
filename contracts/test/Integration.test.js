const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Integration Test — E2E Flow
 * Mô phỏng kịch bản: OCR result → submit expense → validate → reimburse
 * 
 * Giả lập: Anh A đi công tác Đà Nẵng, tiếp khách tối, hóa đơn 800,000đ
 */
describe("Integration: OCR → Smart Contract → Reimburse", function () {
    let mockVND, expenseManager;
    let admin, employeeA;

    // Mock OCR result (giống output từ ocr-poc)
    const ocrResult = {
        vendor: "Nhà hàng Bà Mua - Đà Nẵng",
        tax_id: "0401234567",
        date: "2026-07-15",
        grand_total: 800_000,
        vat_rate: 10,
        vat_amount: 72_727,
        subtotal: 727_273,
        invoiceHash: "QmXxxOcrHash2026Jul15BaMua",
    };

    // Policy: Staff hạn mức 1tr/hóa đơn, ngân sách duyệt 2tr
    const approvedBudget = 2_000_000;

    beforeEach(async function () {
        [admin, employeeA] = await ethers.getSigners();

        // Deploy
        const MockVND = await ethers.getContractFactory("MockVND");
        mockVND = await MockVND.deploy();

        const ExpenseManager = await ethers.getContractFactory("ExpenseManager");
        expenseManager = await ExpenseManager.deploy(await mockVND.getAddress());

        // Admin setup
        await mockVND.mint(admin.address, 10_000_000);
        await mockVND.approve(await expenseManager.getAddress(), 10_000_000);
        await expenseManager.fundCompanyPool(10_000_000);
        await expenseManager.registerEmployee(employeeA.address, 0); // Staff
        await expenseManager.setPolicy(0, 500_000, 1_000_000); // Staff policy
    });

    it("Full flow: OCR → Submit → Validate → Reimburse", async function () {
        // ① Policy check (off-chain simulation)
        const amount = ocrResult.grand_total;
        expect(amount).to.be.lte(1_000_000); // Trong hạn mức per-invoice
        expect(amount).to.be.lte(approvedBudget); // Trong ngân sách duyệt

        // ② Employee submit expense (on-chain)
        await expenseManager.connect(employeeA).submitExpense(amount, ocrResult.invoiceHash);

        // Verify expense created
        const expense = await expenseManager.expenses(0);
        expect(expense.employee).to.equal(employeeA.address);
        expect(expense.amount).to.equal(800_000);
        expect(expense.status).to.equal(0); // Pending

        // ③ Validator approve (on-chain)
        const balanceBefore = await mockVND.balanceOf(employeeA.address);
        await expenseManager.validateExpense(0, true);

        // ④ Verify reimbursement
        const balanceAfter = await mockVND.balanceOf(employeeA.address);
        expect(balanceAfter - balanceBefore).to.equal(800_000);

        // ⑤ Verify expense status = Approved
        const updatedExpense = await expenseManager.expenses(0);
        expect(updatedExpense.status).to.equal(1); // Approved

        // ⑥ Verify company pool decreased
        const poolBalance = await expenseManager.getCompanyPoolBalance();
        expect(poolBalance).to.equal(10_000_000 - 800_000);
    });

    it("OCR result vượt hạn mức → bị từ chối on-chain", async function () {
        // Hóa đơn 1.5 triệu > 1tr limit
        await expect(
            expenseManager.connect(employeeA).submitExpense(1_500_000, "QmOverLimitHash")
        ).to.be.revertedWith("Exceeds per-invoice limit");
    });

    it("Multiple expenses trong 1 chuyến công tác", async function () {
        // Hóa đơn 1: Ăn trưa 300k
        await expenseManager.connect(employeeA).submitExpense(300_000, "QmLunch");
        await expenseManager.validateExpense(0, true);

        // Hóa đơn 2: Tiếp khách 800k
        await expenseManager.connect(employeeA).submitExpense(800_000, "QmDinner");
        await expenseManager.validateExpense(1, true);

        // Tổng đã nhận: 1.1 triệu
        const balance = await mockVND.balanceOf(employeeA.address);
        expect(balance).to.equal(1_100_000);

        // Lịch sử expense
        const ids = await expenseManager.getEmployeeExpenseIds(employeeA.address);
        expect(ids.length).to.equal(2);
    });
});
