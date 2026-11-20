// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/MockVND.sol";
import "../contracts/ExpenseManager.sol";

/**
 * @title DeployScript
 * @dev Foundry Script triển khai MockVND và ExpenseManager lên Sepolia hoặc Linea.
 * Lệnh chạy:
 * forge script script/Deploy.s.sol:DeployScript --rpc-url <RPC_URL> --broadcast --verify
 */
contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("-------------------------------------------");
        console.log("Deploying FlexiTrip Contracts with Foundry");
        console.log("Deployer:", deployer);
        console.log("-------------------------------------------");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy MockVND token
        MockVND vnd = new MockVND();
        console.log("MockVND deployed at:", address(vnd));

        // 2. Deploy ExpenseManager
        ExpenseManager manager = new ExpenseManager(address(vnd));
        console.log("ExpenseManager deployed at:", address(manager));

        // 3. Cấu hình ban đầu: Policy cho các chức danh
        // Staff: 300,000đ/ngày, 200,000đ/hóa đơn
        manager.setPolicy(ExpenseManager.EmployeeTier.Staff, 300_000, 200_000);
        // Manager: 1,000,000đ/ngày, 500,000đ/hóa đơn
        manager.setPolicy(ExpenseManager.EmployeeTier.Manager, 1_000_000, 500_000);
        // Director: 5,000,000đ/ngày, 2,000,000đ/hóa đơn
        manager.setPolicy(ExpenseManager.EmployeeTier.Director, 5_000_000, 2_000_000);

        // 4. Mint 100,000,000 vVND cho Deployer và nạp vào Company Pool của ExpenseManager
        vnd.mint(deployer, 100_000_000);
        vnd.approve(address(manager), 50_000_000);
        manager.fundCompanyPool(50_000_000);

        console.log("Company Pool funded with 50,000,000 vVND");

        vm.stopBroadcast();
    }
}
