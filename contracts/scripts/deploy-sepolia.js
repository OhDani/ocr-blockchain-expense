const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploy to Sepolia Testnet
 * - Chỉ dùng 1 signer (deployer) vì trên testnet chỉ có 1 private key
 * - Đăng ký employee bằng wallet address từ DB (sẽ cập nhật sau nếu cần)
 */
async function main() {
    const signers = await hre.ethers.getSigners();
    if (signers.length === 0) {
        console.error("❌ Không tìm thấy signer! Hãy kiểm tra PRIVATE_KEY trong contracts/.env");
        console.error("   Mở MetaMask → Account Details → Show Private Key → Copy vào .env");
        process.exit(1);
    }
    const [deployer] = signers;
    const balance = await hre.ethers.provider.getBalance(deployer.address);

    console.log("═══════════════════════════════════════════════════");
    console.log("  📋 Deploying Smart Contracts to SEPOLIA");
    console.log("  👤 Deployer:", deployer.address);
    console.log("  💰 Balance:", hre.ethers.formatEther(balance), "ETH");
    console.log("  🌐 Network:", hre.network.name);
    console.log("═══════════════════════════════════════════════════\n");

    if (balance === 0n) {
        console.error("❌ Không đủ ETH để deploy! Cần ít nhất 0.01 SepoliaETH");
        process.exit(1);
    }

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
    const tx1 = await mockVND.mint(deployer.address, INITIAL_POOL);
    await tx1.wait();

    console.log("   Approving ExpenseManager to spend vVND...");
    const tx2 = await mockVND.approve(emAddress, INITIAL_POOL);
    await tx2.wait();

    console.log("   Funding company pool...");
    const tx3 = await expenseManager.fundCompanyPool(INITIAL_POOL);
    await tx3.wait();
    console.log("   ✅ Company pool funded:", INITIAL_POOL.toLocaleString(), "vVND");

    // 4. Register deployer as Director + set policies
    console.log("\n④ Registering deployer as Director...");
    const tx4 = await expenseManager.registerEmployee(deployer.address, 2);
    await tx4.wait();
    console.log("   ✅ Deployer registered as Director:", deployer.address);

    // 5. Set policies
    console.log("\n⑤ Setting policies...");
    const tx5a = await expenseManager.setPolicy(0, 5_000_000, 2_000_000);
    await tx5a.wait();
    const tx5b = await expenseManager.setPolicy(1, 10_000_000, 5_000_000);
    await tx5b.wait();
    const tx5c = await expenseManager.setPolicy(2, 20_000_000, 10_000_000);
    await tx5c.wait();
    console.log("   ✅ Staff:    5tr/ngày, 2tr/hóa đơn");
    console.log("   ✅ Manager:  10tr/ngày, 5tr/hóa đơn");
    console.log("   ✅ Director: 20tr/ngày, 10tr/hóa đơn");

    // 6. Lưu địa chỉ
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
        // Cập nhật RPC URL sang Sepolia
        envContent = envContent.replace(
            /BLOCKCHAIN_RPC_URL=.*/,
            `BLOCKCHAIN_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com`
        );
        // Cập nhật private key (dùng key từ env thay vì hardcode)
        if (process.env.PRIVATE_KEY) {
            envContent = envContent.replace(
                /ADMIN_PRIVATE_KEY=.*/,
                `ADMIN_PRIVATE_KEY="0x${process.env.PRIVATE_KEY.replace(/^0x/, '')}"`
            );
        }
        fs.writeFileSync(envPath, envContent);
        console.log("\n   ✅ server/.env auto-updated with Sepolia config");
    }

    console.log("\n═══════════════════════════════════════════════════");
    console.log("  🎉 SEPOLIA Deployment complete!");
    console.log("═══════════════════════════════════════════════════");
    console.log("\n  Addresses:");
    console.log("  MockVND:        ", vndAddress);
    console.log("  ExpenseManager: ", emAddress);
    console.log(`\n  🔗 Verify on Etherscan:`);
    console.log(`  MockVND:         https://sepolia.etherscan.io/address/${vndAddress}`);
    console.log(`  ExpenseManager:  https://sepolia.etherscan.io/address/${emAddress}`);
    console.log(`\n  📄 Addresses saved to: deployed-addresses.json`);
    console.log(`  📄 server/.env updated automatically`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
