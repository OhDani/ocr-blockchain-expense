// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./MockVND.sol";

/**
 * @title ExpenseManager
 * @dev Contract cốt lõi — quản lý chi phí công tác + tự động hoàn ứng.
 *
 * Luồng chính:
 *   Admin setup: registerEmployee() → setPolicy() → fundCompanyPool()
 *   Backend:     submitExpenseFor(employee, amount, hash) [validator gọi thay nhân viên]
 *   Validator:   validateExpense(expenseId, true) → _reimburse() [auto]
 */
contract ExpenseManager is Ownable {
    // ──────────────────── Enums ────────────────────
    enum EmployeeTier { Staff, Manager, Director }
    enum ExpenseStatus { Pending, Approved, Rejected }

    // ──────────────────── Structs ────────────────────
    struct Policy {
        uint256 dailyLimit;
        uint256 perInvoiceLimit;
        bool exists;
    }

    struct Employee {
        EmployeeTier tier;
        bool registered;
    }

    struct Expense {
        address employee;
        uint256 amount;
        string invoiceHash;
        ExpenseStatus status;
        uint256 timestamp;
    }

    // ──────────────────── State ────────────────────
    MockVND public vndToken;
    address public validator;

    mapping(address => Employee) public employees;
    mapping(EmployeeTier => Policy) public policies;

    Expense[] public expenses;
    mapping(address => uint256[]) private employeeExpenseIds;

    // ──────────────────── Events ────────────────────
    event EmployeeRegistered(address indexed employee, EmployeeTier tier);
    event PolicySet(EmployeeTier tier, uint256 dailyLimit, uint256 perInvoiceLimit);
    event CompanyPoolFunded(uint256 amount, uint256 newBalance);
    event ExpenseSubmitted(uint256 indexed expenseId, address indexed employee, uint256 amount, string invoiceHash);
    event ExpenseValidated(uint256 indexed expenseId, bool approved);
    event Reimbursed(uint256 indexed expenseId, address indexed employee, uint256 amount);

    // ──────────────────── Modifiers ────────────────────
    modifier onlyValidator() {
        require(msg.sender == validator, "Only validator can call");
        _;
    }

    modifier onlyRegistered() {
        require(employees[msg.sender].registered, "Not a registered employee");
        _;
    }

    // ──────────────────── Constructor ────────────────────
    constructor(address _vndToken) Ownable(msg.sender) {
        vndToken = MockVND(_vndToken);
        validator = msg.sender;
    }

    // ──────────────────── Admin Functions ────────────────────

    function registerEmployee(address _employee, EmployeeTier _tier) external onlyOwner {
        require(!employees[_employee].registered, "Employee already registered");
        employees[_employee] = Employee({ tier: _tier, registered: true });
        emit EmployeeRegistered(_employee, _tier);
    }

    function setPolicy(
        EmployeeTier _tier,
        uint256 _dailyLimit,
        uint256 _perInvoiceLimit
    ) external onlyOwner {
        policies[_tier] = Policy({
            dailyLimit: _dailyLimit,
            perInvoiceLimit: _perInvoiceLimit,
            exists: true
        });
        emit PolicySet(_tier, _dailyLimit, _perInvoiceLimit);
    }

    function fundCompanyPool(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Amount must be > 0");
        bool success = vndToken.transferFrom(msg.sender, address(this), _amount);
        require(success, "Transfer failed");
        emit CompanyPoolFunded(_amount, vndToken.balanceOf(address(this)));
    }

    function setValidator(address _newValidator) external onlyOwner {
        require(_newValidator != address(0), "Invalid validator address");
        validator = _newValidator;
    }

    // ──────────────────── Employee Functions ────────────────────

    /**
     * @dev Nhân viên tự nộp chi phí (gọi trực tiếp từ ví nhân viên).
     */
    function submitExpense(
        uint256 _amount,
        string calldata _invoiceHash
    ) external onlyRegistered {
        require(_amount > 0, "Amount must be > 0");
        require(bytes(_invoiceHash).length > 0, "Invoice hash required");

        EmployeeTier tier = employees[msg.sender].tier;
        Policy memory policy = policies[tier];
        require(policy.exists, "Policy not set for this tier");
        require(_amount <= policy.perInvoiceLimit, "Exceeds per-invoice limit");

        uint256 expenseId = expenses.length;
        expenses.push(Expense({
            employee: msg.sender,
            amount: _amount,
            invoiceHash: _invoiceHash,
            status: ExpenseStatus.Pending,
            timestamp: block.timestamp
        }));

        employeeExpenseIds[msg.sender].push(expenseId);
        emit ExpenseSubmitted(expenseId, msg.sender, _amount, _invoiceHash);
    }

    // ──────────────────── Validator Functions ────────────────────

    /**
     * @dev Validator/Backend submit expense ĐẠI DIỆN cho nhân viên.
     *      Dùng khi backend quản lý ký transaction thay nhân viên (POC).
     *      Reimburse sẽ chuyển vVND đến ví _employee (KHÔNG phải msg.sender).
     */
    function submitExpenseFor(
        address _employee,
        uint256 _amount,
        string calldata _invoiceHash
    ) external onlyValidator {
        require(_amount > 0, "Amount must be > 0");
        require(bytes(_invoiceHash).length > 0, "Invoice hash required");
        require(employees[_employee].registered, "Employee not registered");

        EmployeeTier tier = employees[_employee].tier;
        Policy memory policy = policies[tier];
        require(policy.exists, "Policy not set for this tier");
        require(_amount <= policy.perInvoiceLimit, "Exceeds per-invoice limit");

        uint256 expenseId = expenses.length;
        expenses.push(Expense({
            employee: _employee,
            amount: _amount,
            invoiceHash: _invoiceHash,
            status: ExpenseStatus.Pending,
            timestamp: block.timestamp
        }));

        employeeExpenseIds[_employee].push(expenseId);
        emit ExpenseSubmitted(expenseId, _employee, _amount, _invoiceHash);
    }

    /**
     * @dev Validator duyệt hoặc từ chối chi phí.
     *      Nếu approved → tự động gọi _reimburse().
     */
    function validateExpense(uint256 _expenseId, bool _approved) external onlyValidator {
        require(_expenseId < expenses.length, "Expense does not exist");
        Expense storage expense = expenses[_expenseId];
        require(expense.status == ExpenseStatus.Pending, "Expense already processed");

        if (_approved) {
            expense.status = ExpenseStatus.Approved;
            _reimburse(_expenseId);
        } else {
            expense.status = ExpenseStatus.Rejected;
        }

        emit ExpenseValidated(_expenseId, _approved);
    }

    // ──────────────────── Internal Functions ────────────────────

    function _reimburse(uint256 _expenseId) internal {
        Expense memory expense = expenses[_expenseId];
        uint256 poolBalance = vndToken.balanceOf(address(this));
        require(poolBalance >= expense.amount, "Insufficient company pool balance");

        bool success = vndToken.transfer(expense.employee, expense.amount);
        require(success, "Reimbursement transfer failed");

        emit Reimbursed(_expenseId, expense.employee, expense.amount);
    }

    // ──────────────────── View Functions ────────────────────

    function getEmployeeExpenseIds(address _employee) external view returns (uint256[] memory) {
        return employeeExpenseIds[_employee];
    }

    function getExpenseCount() external view returns (uint256) {
        return expenses.length;
    }

    function getCompanyPoolBalance() external view returns (uint256) {
        return vndToken.balanceOf(address(this));
    }
}
