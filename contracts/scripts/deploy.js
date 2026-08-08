const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("═══════════════════════════════════════════════════");
    console.log("  📋 Deploying Smart Contracts");
    console.log("  👤 Deployer:", deployer.address);
    console.log("═══════════════════════════════════════════════════\n");

    // 1. Deploy MockVND
    console.log("① Deploying MockVND (vVND stablecoin)...");
    const MockVND = await hre.ethers.getContractFactory("MockVND");
    const mockVND = await MockVND.deploy();
    await mockVND.waitForDeployment();
    const vndAddress = await mockVND.getAddress();
    console.log("   ✅ MockVND deployed at:", vndAddress);

    // 2. Deploy ExpenseManager
    console.log("\n② Deploying ExpenseManager...");
    const ExpenseManager = await hre.ethers.getContractFactory("ExpenseManager");
    const expenseManager = await ExpenseManager.deploy(vndAddress);
    await expenseManager.waitForDeployment();
    const emAddress = await expenseManager.getAddress();
    console.log("   ✅ ExpenseManager deployed at:", emAddress);

    // 3. Setup: Mint vVND → Fund pool
    const INITIAL_POOL = 10_000_000;
    console.log(`\n③ Minting ${INITIAL_POOL.toLocaleString()} vVND → Admin...`);
    await mockVND.mint(deployer.address, INITIAL_POOL);

    console.log("   Approving ExpenseManager to spend vVND...");
    await mockVND.approve(emAddress, INITIAL_POOL);

    console.log("   Funding company pool...");
    await expenseManager.fundCompanyPool(INITIAL_POOL);
    console.log("   ✅ Company pool funded:", INITIAL_POOL.toLocaleString(), "vVND");

    // 4. Register employees (khớp với walletAddress trong seed.js)
    console.log("\n④ Registering employees...");
    const signers = await hre.ethers.getSigners();
    // Hardhat #0 = Admin (Director)
    await expenseManager.registerEmployee(signers[0].address, 2);
    console.log("   ✅ Admin (Director):", signers[0].address);
    // Hardhat #1 = Nguyễn Văn A (Staff)
    await expenseManager.registerEmployee(signers[1].address, 0);
    console.log("   ✅ Employee (Staff):", signers[1].address);
    // Hardhat #2 = Trần Thị B (Manager)
    await expenseManager.registerEmployee(signers[2].address, 1);
    console.log("   ✅ Manager:", signers[2].address);

    // 5. Set policies
    console.log("\n⑤ Setting policies...");
    await expenseManager.setPolicy(0, 500_000, 1_000_000);   // Staff
    await expenseManager.setPolicy(1, 700_000, 2_000_000);   // Manager
    await expenseManager.setPolicy(2, 1_000_000, 5_000_000); // Director
    console.log("   ✅ Staff:    500k/ngày, 1tr/hóa đơn");
    console.log("   ✅ Manager:  700k/ngày, 2tr/hóa đơn");
    console.log("   ✅ Director: 1tr/ngày,  5tr/hóa đơn");

    // 5. Lưu địa chỉ vào file để backend đọc
    const addresses = {
        MockVND: vndAddress,
        ExpenseManager: emAddress,
        deployer: deployer.address,
        network: hre.network.name,
        deployedAt: new Date().toISOString(),
    };

    const outputPath = path.join(__dirname, "..", "deployed-addresses.json");
    fs.writeFileSync(outputPath, JSON.stringify(addresses, null, 2));

    // Auto-update server/.env
    const envPath = path.join(__dirname, "..", "..", "server", ".env");
    if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, "utf-8");
        envContent = envContent.replace(
            /VVND_CONTRACT_ADDRESS=.*/,
            `VVND_CONTRACT_ADDRESS=${vndAddress}`
        );
        envContent = envContent.replace(
            /EXPENSE_MANAGER_ADDRESS=.*/,
            `EXPENSE_MANAGER_ADDRESS=${emAddress}`
        );
        fs.writeFileSync(envPath, envContent);
        console.log("   ✅ server/.env auto-updated with new addresses");
    }

    console.log("\n═══════════════════════════════════════════════════");
    console.log("  🎉 Deployment complete!");
    console.log("═══════════════════════════════════════════════════");
    console.log("\n  Addresses:");
    console.log("  MockVND:        ", vndAddress);
    console.log("  ExpenseManager: ", emAddress);
    console.log(`\n  📄 Addresses saved to: deployed-addresses.json`);
    console.log(`  📄 server/.env updated automatically`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
