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
 *   Employee:    submitExpense(amount, invoiceHash)
 *   Validator:   validateExpense(expenseId, true) → _reimburse() [auto]
 */
contract ExpenseManager is Ownable {
    // ──────────────────── Enums ────────────────────
    enum EmployeeTier { Staff, Manager, Director }
    enum ExpenseStatus { Pending, Approved, Rejected }

    // ──────────────────── Structs ────────────────────
    struct Policy {
        uint256 dailyLimit;       // Hạn mức chi tiêu / ngày (vVND)
        uint256 perInvoiceLimit;  // Hạn mức / hóa đơn (vVND)
        bool exists;              // Đã thiết lập chưa
    }

    struct Employee {
        EmployeeTier tier;
        bool registered;
    }

    struct Expense {
        address employee;
        uint256 amount;           // Số tiền (vVND)
        string invoiceHash;       // IPFS hash hoặc hash ảnh hóa đơn
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
    /**
     * @param _vndToken Địa chỉ MockVND token đã deploy
     */
    constructor(address _vndToken) Ownable(msg.sender) {
        vndToken = MockVND(_vndToken);
        validator = msg.sender; // Mặc định admin = validator (POC)
    }

    // ──────────────────── Admin Functions ────────────────────

    /**
     * @dev Đăng ký nhân viên + cấp bậc.
     */
    function registerEmployee(address _employee, EmployeeTier _tier) external onlyOwner {
        require(!employees[_employee].registered, "Employee already registered");
        employees[_employee] = Employee({ tier: _tier, registered: true });
        emit EmployeeRegistered(_employee, _tier);
    }

    /**
     * @dev Thiết lập chính sách chi tiêu theo cấp bậc.
     */
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

    /**
     * @dev Nạp vVND vào quỹ công ty (balance của contract này).
     *      Admin phải approve trước: vndToken.approve(expenseManager, amount)
     */
    function fundCompanyPool(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Amount must be > 0");
        bool success = vndToken.transferFrom(msg.sender, address(this), _amount);
        require(success, "Transfer failed");
        emit CompanyPoolFunded(_amount, vndToken.balanceOf(address(this)));
    }

    /**
     * @dev Thay đổi validator (người duyệt chi phí).
     */
    function setValidator(address _newValidator) external onlyOwner {
        require(_newValidator != address(0), "Invalid validator address");
        validator = _newValidator;
    }

    // ──────────────────── Employee Functions ────────────────────

    /**
     * @dev Nhân viên nộp chi phí.
     * @param _amount Số tiền (vVND)
     * @param _invoiceHash Hash của hóa đơn (từ AI OCR)
     */
    function submitExpense(
        uint256 _amount,
        string calldata _invoiceHash
    ) external onlyRegistered {
        require(_amount > 0, "Amount must be > 0");
        require(bytes(_invoiceHash).length > 0, "Invoice hash required");

        // Kiểm tra hạn mức theo cấp bậc
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

    /**
     * @dev Tự động chuyển vVND từ quỹ công ty → ví nhân viên.
     */
    function _reimburse(uint256 _expenseId) internal {
        Expense memory expense = expenses[_expenseId];
        uint256 poolBalance = vndToken.balanceOf(address(this));
        require(poolBalance >= expense.amount, "Insufficient company pool balance");

        bool success = vndToken.transfer(expense.employee, expense.amount);
        require(success, "Reimbursement transfer failed");

        emit Reimbursed(_expenseId, expense.employee, expense.amount);
    }

    // ──────────────────── View Functions ────────────────────

    /**
     * @dev Xem danh sách expense IDs của nhân viên.
     */
    function getEmployeeExpenseIds(address _employee) external view returns (uint256[] memory) {
        return employeeExpenseIds[_employee];
    }

    /**
     * @dev Tổng số expense đã nộp.
     */
    function getExpenseCount() external view returns (uint256) {
        return expenses.length;
    }

    /**
     * @dev Số dư quỹ công ty.
     */
    function getCompanyPoolBalance() external view returns (uint256) {
        return vndToken.balanceOf(address(this));
    }
}
