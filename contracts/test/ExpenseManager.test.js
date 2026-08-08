const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ExpenseManager", function () {
    let mockVND, expenseManager;
    let admin, employee1, employee2, outsider;

    const STAFF = 0;
    const MANAGER = 1;
    const DIRECTOR = 2;

    const PENDING = 0;
    const APPROVED = 1;
    const REJECTED = 2;

    // Policy cho Staff: 500k/ngày, 1tr/hóa đơn
    const STAFF_DAILY = 500_000;
    const STAFF_PER_INVOICE = 1_000_000;

    // Quỹ công ty ban đầu
    const POOL_AMOUNT = 10_000_000;

    beforeEach(async function () {
        [admin, employee1, employee2, outsider] = await ethers.getSigners();

        // Deploy MockVND
        const MockVND = await ethers.getContractFactory("MockVND");
        mockVND = await MockVND.deploy();

        // Deploy ExpenseManager
        const ExpenseManager = await ethers.getContractFactory("ExpenseManager");
        expenseManager = await ExpenseManager.deploy(await mockVND.getAddress());

        // Setup: mint vVND cho admin → approve → fund pool
        await mockVND.mint(admin.address, POOL_AMOUNT);
        await mockVND.approve(await expenseManager.getAddress(), POOL_AMOUNT);
        await expenseManager.fundCompanyPool(POOL_AMOUNT);

        // Setup: đăng ký employee1 là Staff + set policy
        await expenseManager.registerEmployee(employee1.address, STAFF);
        await expenseManager.setPolicy(STAFF, STAFF_DAILY, STAFF_PER_INVOICE);
    });

    // ──────────────────── Admin Setup ────────────────────

    describe("Admin Setup", function () {
        it("Đăng ký nhân viên", async function () {
            const emp = await expenseManager.employees(employee1.address);
            expect(emp.registered).to.be.true;
            expect(emp.tier).to.equal(STAFF);
        });

        it("Không đăng ký trùng", async function () {
            await expect(
                expenseManager.registerEmployee(employee1.address, STAFF)
            ).to.be.revertedWith("Employee already registered");
        });

        it("Chỉ admin đăng ký được", async function () {
            await expect(
                expenseManager.connect(outsider).registerEmployee(employee2.address, STAFF)
            ).to.be.revertedWithCustomError(expenseManager, "OwnableUnauthorizedAccount");
        });

        it("Set policy đúng cấp bậc", async function () {
            const policy = await expenseManager.policies(STAFF);
            expect(policy.dailyLimit).to.equal(STAFF_DAILY);
            expect(policy.perInvoiceLimit).to.equal(STAFF_PER_INVOICE);
            expect(policy.exists).to.be.true;
        });

        it("Nạp quỹ công ty thành công", async function () {
            expect(await expenseManager.getCompanyPoolBalance()).to.equal(POOL_AMOUNT);
        });

        it("Nạp quỹ = 0 thất bại", async function () {
            await expect(
                expenseManager.fundCompanyPool(0)
            ).to.be.revertedWith("Amount must be > 0");
        });
    });

    // ──────────────────── Submit Expense ────────────────────

    describe("Submit Expense", function () {
        it("Nhân viên nộp chi phí thành công", async function () {
            await expenseManager.connect(employee1).submitExpense(800_000, "QmInvoiceHash123");

            const expense = await expenseManager.expenses(0);
            expect(expense.employee).to.equal(employee1.address);
            expect(expense.amount).to.equal(800_000);
            expect(expense.invoiceHash).to.equal("QmInvoiceHash123");
            expect(expense.status).to.equal(PENDING);
        });

        it("Emit event ExpenseSubmitted", async function () {
            await expect(
                expenseManager.connect(employee1).submitExpense(800_000, "QmHash")
            )
                .to.emit(expenseManager, "ExpenseSubmitted")
                .withArgs(0, employee1.address, 800_000, "QmHash");
        });

        it("Người ngoài không nộp được", async function () {
            await expect(
                expenseManager.connect(outsider).submitExpense(100_000, "QmHash")
            ).to.be.revertedWith("Not a registered employee");
        });

        it("Vượt hạn mức hóa đơn bị từ chối", async function () {
            await expect(
                expenseManager.connect(employee1).submitExpense(2_000_000, "QmHash") // > 1tr limit
            ).to.be.revertedWith("Exceeds per-invoice limit");
        });

        it("Amount = 0 bị từ chối", async function () {
            await expect(
                expenseManager.connect(employee1).submitExpense(0, "QmHash")
            ).to.be.revertedWith("Amount must be > 0");
        });

        it("Thiếu invoice hash bị từ chối", async function () {
            await expect(
                expenseManager.connect(employee1).submitExpense(100_000, "")
            ).to.be.revertedWith("Invoice hash required");
        });
    });

    // ──────────────────── Validate & Reimburse ────────────────────

    describe("Validate & Reimburse", function () {
        beforeEach(async function () {
            // Employee1 nộp 800k
            await expenseManager.connect(employee1).submitExpense(800_000, "QmHash800k");
        });

        it("Duyệt → tự động hoàn ứng vVND", async function () {
            const balanceBefore = await mockVND.balanceOf(employee1.address);

            await expenseManager.validateExpense(0, true);

            const balanceAfter = await mockVND.balanceOf(employee1.address);
            expect(balanceAfter - balanceBefore).to.equal(800_000);

            // Kiểm tra status = Approved
            const expense = await expenseManager.expenses(0);
            expect(expense.status).to.equal(APPROVED);
        });

        it("Quỹ công ty giảm sau hoàn ứng", async function () {
            const poolBefore = await expenseManager.getCompanyPoolBalance();
            await expenseManager.validateExpense(0, true);
            const poolAfter = await expenseManager.getCompanyPoolBalance();

            expect(poolBefore - poolAfter).to.equal(800_000);
        });

        it("Emit events: ExpenseValidated + Reimbursed", async function () {
            await expect(expenseManager.validateExpense(0, true))
                .to.emit(expenseManager, "ExpenseValidated").withArgs(0, true)
                .and.to.emit(expenseManager, "Reimbursed").withArgs(0, employee1.address, 800_000);
        });

        it("Từ chối → không chuyển tiền", async function () {
            await expenseManager.validateExpense(0, false);

            const balance = await mockVND.balanceOf(employee1.address);
            expect(balance).to.equal(0);

            const expense = await expenseManager.expenses(0);
            expect(expense.status).to.equal(REJECTED);
        });

        it("Không duyệt 2 lần", async function () {
            await expenseManager.validateExpense(0, true);
            await expect(
                expenseManager.validateExpense(0, true)
            ).to.be.revertedWith("Expense already processed");
        });

        it("Chỉ validator mới duyệt được", async function () {
            await expect(
                expenseManager.connect(outsider).validateExpense(0, true)
            ).to.be.revertedWith("Only validator can call");
        });
    });

    // ──────────────────── View Functions ────────────────────

    describe("View Functions", function () {
        it("getEmployeeExpenseIds trả danh sách đúng", async function () {
            await expenseManager.connect(employee1).submitExpense(100_000, "QmHash1");
            await expenseManager.connect(employee1).submitExpense(200_000, "QmHash2");

            const ids = await expenseManager.getEmployeeExpenseIds(employee1.address);
            expect(ids.length).to.equal(2);
            expect(ids[0]).to.equal(0);
            expect(ids[1]).to.equal(1);
        });

        it("getExpenseCount đếm đúng", async function () {
            await expenseManager.connect(employee1).submitExpense(100_000, "QmHash1");
            await expenseManager.connect(employee1).submitExpense(200_000, "QmHash2");

            expect(await expenseManager.getExpenseCount()).to.equal(2);
        });
    });
});
