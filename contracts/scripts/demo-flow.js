const hre = require("hardhat");

/**
 * Demo Flow — Kịch bản bảo vệ ĐATN
 * 
 * Mô phỏng: Anh A (Staff) đi công tác Đà Nẵng,
 * tiếp khách tối, hóa đơn VAT 800,000đ
 * → AI OCR đọc → Policy Engine xác nhận → Smart Contract hoàn ứng tự động
 */
async function main() {
    const [admin, employeeA] = await hre.ethers.getSigners();

    console.log("╔═══════════════════════════════════════════════════════╗");
    console.log("║   🎬 DEMO: Hoàn ứng chi phí công tác tự động         ║");
    console.log("║   Kịch bản: Anh A công tác Đà Nẵng                   ║");
    console.log("╚═══════════════════════════════════════════════════════╝\n");

    // ──────── Deploy ────────
    console.log("🔧 Setup: Deploying contracts...\n");

    const MockVND = await hre.ethers.getContractFactory("MockVND");
    const mockVND = await MockVND.deploy();
    await mockVND.waitForDeployment();

    const ExpenseManager = await hre.ethers.getContractFactory("ExpenseManager");
    const expenseManager = await ExpenseManager.deploy(await mockVND.getAddress());
    await expenseManager.waitForDeployment();

    // ──────── Bước 1: Admin nạp quỹ ────────
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📌 Bước 1: Admin nạp quỹ 10,000,000 vVND");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    await mockVND.mint(admin.address, 10_000_000);
    await mockVND.approve(await expenseManager.getAddress(), 10_000_000);
    const tx1 = await expenseManager.fundCompanyPool(10_000_000);
    const receipt1 = await tx1.wait();

    console.log("   ✅ Quỹ công ty: 10,000,000 vVND");
    console.log("   📦 TX hash:", receipt1.hash);
    console.log("   ⛽ Gas used:", receipt1.gasUsed.toString());

    // ──────── Bước 2: Đăng ký nhân viên A ────────
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📌 Bước 2: Đăng ký nhân viên A (Staff, hạn mức 1tr/hóa đơn)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    await expenseManager.setPolicy(0, 500_000, 1_000_000); // Staff policy
    const tx2 = await expenseManager.registerEmployee(employeeA.address, 0);
    const receipt2 = await tx2.wait();

    console.log("   ✅ Nhân viên A đã đăng ký");
    console.log("   👤 Ví:", employeeA.address);
    console.log("   🏷️  Cấp bậc: Staff");
    console.log("   📦 TX hash:", receipt2.hash);

    // ──────── Bước 3: Nhân viên A nộp hóa đơn 800k ────────
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📌 Bước 3: Nhân viên A nộp hóa đơn 800,000đ (từ AI OCR)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Mock OCR result
    const ocrResult = {
        vendor: "Nhà hàng Bà Mua - Đà Nẵng",
        tax_id: "0401234567",
        grand_total: 800_000,
        invoiceHash: "QmXxxOcrHashBaMuaDaNang2026",
    };

    console.log("   📄 OCR Result:");
    console.log("      Nhà hàng:", ocrResult.vendor);
    console.log("      MST:", ocrResult.tax_id);
    console.log("      Tổng tiền:", ocrResult.grand_total.toLocaleString() + "đ");

    const tx3 = await expenseManager
        .connect(employeeA)
        .submitExpense(ocrResult.grand_total, ocrResult.invoiceHash);
    const receipt3 = await tx3.wait();

    console.log("   ✅ Chi phí đã nộp (Pending)");
    console.log("   📦 TX hash:", receipt3.hash);

    // ──────── Bước 4: Validator duyệt → Tự động hoàn ứng ────────
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📌 Bước 4: Policy Engine xác nhận → Validator duyệt → Hoàn ứng");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const balanceBefore = await mockVND.balanceOf(employeeA.address);
    console.log("   💰 Số dư A trước:", balanceBefore.toString(), "vVND");

    const tx4 = await expenseManager.validateExpense(0, true); // approved!
    const receipt4 = await tx4.wait();

    const balanceAfter = await mockVND.balanceOf(employeeA.address);
    console.log("   💰 Số dư A sau:  ", balanceAfter.toString(), "vVND");
    console.log("   ✅ Hoàn ứng: +" + (balanceAfter - balanceBefore).toString() + " vVND");
    console.log("   📦 TX hash:", receipt4.hash);
    console.log("   ⛽ Gas used:", receipt4.gasUsed.toString());

    // ──────── Bước 5: Verify on-chain ────────
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📌 Bước 5: Verify trên Blockchain");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const expense = await expenseManager.expenses(0);
    const poolBalance = await expenseManager.getCompanyPoolBalance();

    console.log("   📋 Expense #0:");
    console.log("      Employee:", expense.employee);
    console.log("      Amount:", expense.amount.toString(), "vVND");
    console.log("      Invoice:", expense.invoiceHash);
    console.log("      Status:", expense.status === 1n ? "✅ Approved" : "❌ Rejected");
    console.log("   🏦 Quỹ công ty còn:", poolBalance.toString(), "vVND");

    console.log("\n╔═══════════════════════════════════════════════════════╗");
    console.log("║   🎉 DEMO HOÀN TẤT                                   ║");
    console.log("║                                                       ║");
    console.log("║   ✅ Hóa đơn 800k → OCR đọc → Policy OK              ║");
    console.log("║   ✅ Smart Contract tự động hoàn ứng 800,000 vVND     ║");
    console.log("║   ✅ Giao dịch ghi nhận bất biến trên Blockchain      ║");
    console.log("╚═══════════════════════════════════════════════════════╝");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
