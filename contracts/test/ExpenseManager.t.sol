// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/MockVND.sol";
import "../contracts/ExpenseManager.sol";

/**
 * @title ExpenseManagerTest
 * @dev Foundry Unit & Fuzz Tests cho ExpenseManager.
 * Lệnh chạy: forge test -vvv
 */
contract ExpenseManagerTest is Test {
    MockVND public vnd;
    ExpenseManager public manager;

    address public admin = address(1);
    address public validator = address(2);
    address public employee = address(3);

    function setUp() public {
        vm.startPrank(admin);

        // Deploy contracts
        vnd = new MockVND();
        manager = new ExpenseManager(address(vnd));

        // Cấu hình validator
        manager.setValidator(validator);

        // Cấu hình policy cho Staff: 300k daily, 200k per invoice
        manager.setPolicy(ExpenseManager.EmployeeTier.Staff, 300_000, 200_000);

        // Đăng ký nhân viên
        manager.registerEmployee(employee, ExpenseManager.EmployeeTier.Staff);

        // Nạp quỹ công ty (50,000,000 vVND)
        vnd.mint(admin, 100_000_000);
        vnd.approve(address(manager), 50_000_000);
        manager.fundCompanyPool(50_000_000);

        vm.stopPrank();
    }

    function test_InitialPoolBalance() public view {
        assertEq(manager.getCompanyPoolBalance(), 50_000_000);
    }

    function test_SubmitAndReimburseExpense() public {
        uint256 amount = 150_000; // Hợp lệ (dưới 200k)
        string memory invoiceHash = "sha256:abcd1234ef5678";

        // Validator submit thay nhân viên (Relayer pattern)
        vm.prank(validator);
        manager.submitExpenseFor(employee, amount, invoiceHash);

        assertEq(manager.getExpenseCount(), 1);

        // Validator validate & auto-reimburse
        vm.prank(validator);
        manager.validateExpense(0, true);

        // Kiểm tra số dư ví nhân viên nhận được vVND
        assertEq(vnd.balanceOf(employee), amount);
        // Kiểm tra quỹ công ty bị trừ
        assertEq(manager.getCompanyPoolBalance(), 50_000_000 - amount);
    }

    function test_RevertWhen_ExpenseExceedsLimit() public {
        uint256 excessAmount = 250_000; // Vượt quá hạn mức 200k của Staff

        vm.prank(validator);
        vm.expectRevert("Exceeds per-invoice limit");
        manager.submitExpenseFor(employee, excessAmount, "hash");
    }

    // Fuzz test: kiểm tra với số tiền ngẫu nhiên từ 1 đến 200,000
    function testFuzz_SubmitValidAmount(uint256 randomAmount) public {
        vm.assume(randomAmount > 0 && randomAmount <= 200_000);

        vm.prank(validator);
        manager.submitExpenseFor(employee, randomAmount, "fuzz_hash");

        assertEq(manager.getExpenseCount(), 1);
    }
}
