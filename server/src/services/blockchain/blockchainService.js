/**
 * blockchainService.js
 * Bridge giữa backend Express và Smart Contract trên Linea Sepolia (zkEVM L2).
 * 
 * Sử dụng server-side wallet (private key từ .env) để:
 * - Submit expense lên smart contract (đại diện cho nhân viên)
 * - Validate (approve/reject) expense
 * - Đọc thông tin từ contract
 */

import { ethers } from 'ethers';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ExpenseManagerABI, MockVNDABI } from './abis.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ABI paths (từ Hardhat compiled artifacts)
const ARTIFACTS_DIR = join(__dirname, '..', '..', '..', '..', 'contracts', 'artifacts', 'contracts');

let provider = null;
let adminWallet = null;
let expenseManagerContract = null;
let mockVNDContract = null;

// Cache số dư & trạng thái để tăng tốc API
let cachedPoolBalance = null;
let lastPoolFetchTime = 0;
const POOL_CACHE_TTL = 45 * 1000; // 45 giây cache
const registeredEmployeeCache = new Map();

/**
 * Khởi tạo kết nối blockchain.
 * Gọi 1 lần khi server start.
 */
export function initBlockchain() {
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'https://rpc.sepolia.linea.build';
    const privateKey = process.env.ADMIN_PRIVATE_KEY;
    const emAddress = process.env.EXPENSE_MANAGER_ADDRESS;
    const vndAddress = process.env.VVND_CONTRACT_ADDRESS;

    if (!privateKey || !emAddress || !vndAddress) {
        console.warn('⚠️  Blockchain chưa cấu hình đầy đủ. Smart Contract features sẽ bị tắt.');
        return false;
    }

    try {
        provider = new ethers.JsonRpcProvider(rpcUrl);
        const baseWallet = new ethers.Wallet(privateKey, provider);
        // NonceManager tự quản lý nonce → tránh lỗi "nonce already used"
        adminWallet = new ethers.NonceManager(baseWallet);

        // Load ABI
        const emABI = loadABI('ExpenseManager.sol', 'ExpenseManager');
        const vndABI = loadABI('MockVND.sol', 'MockVND');

        expenseManagerContract = new ethers.Contract(emAddress, emABI, adminWallet);
        mockVNDContract = new ethers.Contract(vndAddress, vndABI, adminWallet);

        console.log('✅ Blockchain connected');
        console.log('   ExpenseManager:', emAddress);
        console.log('   MockVND:', vndAddress);
        return true;
    } catch (error) {
        console.error('❌ Blockchain init failed:', error.message);
        return false;
    }
}

/**
 * Load ABI từ abis.js (hoặc fallback về compiled artifacts nếu có).
 */
function loadABI(contractFile, contractName) {
    if (contractName === 'ExpenseManager' && ExpenseManagerABI) {
        return ExpenseManagerABI;
    }
    if (contractName === 'MockVND' && MockVNDABI) {
        return MockVNDABI;
    }
    const artifactPath = join(ARTIFACTS_DIR, contractFile, `${contractName}.json`);
    if (existsSync(artifactPath)) {
        const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
        return artifact.abi;
    }
    throw new Error(`ABI not found: ${contractName}.`);
}

/**
 * Dịch lỗi blockchain sang thông báo thân thiện cho người dùng.
 */
function translateBlockchainError(err) {
    const msg = err.message || '';
    const reason = err.reason || '';
    const combined = `${msg} ${reason}`.toLowerCase();

    if (combined.includes('exceeds per-invoice limit'))
        return 'Số tiền hóa đơn vượt quá hạn mức cho phép trên blockchain. Vui lòng liên hệ Admin để điều chỉnh.';
    if (combined.includes('insufficient company pool'))
        return 'Quỹ công ty trên blockchain không đủ để hoàn ứng. Vui lòng nạp thêm quỹ.';
    if (combined.includes('employee not registered'))
        return 'Nhân viên chưa được đăng ký trên blockchain. Vui lòng liên hệ Admin.';
    if (combined.includes('policy not set'))
        return 'Chưa thiết lập chính sách chi tiêu trên blockchain cho cấp bậc này.';
    if (combined.includes('expense already processed'))
        return 'Hóa đơn này đã được xử lý trên blockchain rồi.';
    if (combined.includes('only validator'))
        return 'Lỗi phân quyền blockchain: chỉ validator mới được gọi hàm này.';
    if (combined.includes('reimbursement transfer failed'))
        return 'Chuyển tiền hoàn ứng thất bại trên blockchain.';
    if (combined.includes('nonce') || combined.includes('replacement'))
        return 'Lỗi giao dịch blockchain (nonce). Vui lòng thử lại sau vài giây.';
    if (combined.includes('network') || combined.includes('connect'))
        return 'Không thể kết nối đến blockchain. Vui lòng kiểm tra kết nối mạng và RPC URL.';

    // Fallback: trích xuất reason nếu có
    const reasonMatch = msg.match(/reason="([^"]+)"/);
    if (reasonMatch) return `Lỗi blockchain: ${reasonMatch[1]}`;

    return 'Lỗi blockchain không xác định. Vui lòng thử lại hoặc liên hệ Admin.';
}

/**
 * Submit expense lên smart contract ĐẠI DIỆN cho nhân viên.
 * Dùng submitExpenseFor() — validator gọi thay, reimburse đúng ví employee.
 * 
 * @param {number} amount - Số tiền (VNĐ)
 * @param {string} invoiceHash - Hash hóa đơn
 * @param {string} employeeWallet - Địa chỉ ví nhân viên (BẮT BUỘC)
 * @returns {{ txHash: string, expenseId: number, gasUsed: string }}
 */
export async function submitExpenseOnChain(amount, invoiceHash, employeeWallet) {
    if (!expenseManagerContract) {
        throw new Error('Blockchain chưa được khởi tạo');
    }
    if (!employeeWallet) {
        throw new Error('Nhân viên chưa có địa chỉ ví blockchain. Vui lòng cập nhật trong phần Cài đặt.');
    }

    try {
        // Tự động kiểm tra và đăng ký ví nhân viên trên Linea Smart Contract nếu chưa được đăng ký
        const isRegistered = await checkEmployeeRegisteredOnChain(employeeWallet);
        if (!isRegistered) {
            console.log(`🔗 Tự động đăng ký ví nhân viên ${employeeWallet} trên Linea Smart Contract...`);
            await registerEmployeeOnChain(employeeWallet, 'EMPLOYEE');
        }

        // Gọi submitExpenseFor — validator submit thay cho nhân viên
        const tx = await expenseManagerContract.submitExpenseFor(
            employeeWallet,
            amount,
            invoiceHash
        );
        const receipt = await tx.wait();

        // Parse event để lấy expenseId
        const event = receipt.logs.find(log => {
            try {
                const parsed = expenseManagerContract.interface.parseLog(log);
                return parsed?.name === 'ExpenseSubmitted';
            } catch { return false; }
        });

        let expenseId = null;
        if (event) {
            const parsed = expenseManagerContract.interface.parseLog(event);
            expenseId = Number(parsed.args.expenseId);
        }

        return {
            txHash: receipt.hash,
            expenseId,
            gasUsed: receipt.gasUsed.toString(),
        };
    } catch (err) {
        throw new Error(translateBlockchainError(err));
    }
}

/**
 * Validate expense trên smart contract (approve/reject).
 * @param {number} expenseId - On-chain expense ID
 * @param {boolean} approved - Duyệt hay từ chối
 * @returns {{ txHash: string, gasUsed: string }}
 */
export async function validateExpenseOnChain(expenseId, approved) {
    if (!expenseManagerContract) {
        throw new Error('Blockchain chưa được khởi tạo');
    }

    try {
        const tx = await expenseManagerContract.validateExpense(expenseId, approved);
        const receipt = await tx.wait();

        return {
            txHash: receipt.hash,
            gasUsed: receipt.gasUsed.toString(),
        };
    } catch (err) {
        throw new Error(translateBlockchainError(err));
    }
}

/**
 * Lấy số dư quỹ công ty (có cache bộ nhớ đệm 45s để tránh nghẽn RPC Linea).
 */
export async function getCompanyPoolBalance(forceRefresh = false) {
    if (!expenseManagerContract) return null;
    const now = Date.now();
    if (!forceRefresh && cachedPoolBalance !== null && (now - lastPoolFetchTime < POOL_CACHE_TTL)) {
        return cachedPoolBalance;
    }
    try {
        const balance = await expenseManagerContract.getCompanyPoolBalance();
        cachedPoolBalance = Number(balance);
        lastPoolFetchTime = Date.now();
        return cachedPoolBalance;
    } catch (err) {
        console.warn('⚠️ Lỗi đọc số dư quỹ công ty từ blockchain:', err.message);
        return cachedPoolBalance;
    }
}

/**
 * Lấy số dư vVND của 1 ví.
 */
export async function getVNDBalance(address) {
    if (!mockVNDContract) return null;
    const balance = await mockVNDContract.balanceOf(address);
    return Number(balance);
}

/**
 * Đăng ký nhân viên trên Smart Contract.
 * @param {string} walletAddress - Địa chỉ ví Ethereum của nhân viên
 * @param {string} role - Vai trò trong DB: 'EMPLOYEE' | 'MANAGER'
 * @returns {{ txHash: string, gasUsed: string }}
 */
export async function registerEmployeeOnChain(walletAddress, role) {
    if (!expenseManagerContract) {
        throw new Error('Blockchain chưa được khởi tạo');
    }

    // Map DB role → on-chain EmployeeTier enum
    // Staff = 0, Manager = 1, Director = 2
    const tierMap = { EMPLOYEE: 0, MANAGER: 1, ADMIN: 2 };
    const tier = tierMap[role] ?? 0;

    try {
        const tx = await expenseManagerContract.registerEmployee(walletAddress, tier);
        const receipt = await tx.wait();
        console.log(`✅ Employee registered on-chain: ${walletAddress} (tier=${tier})`);
        registeredEmployeeCache.set(walletAddress.toLowerCase(), true);
        return {
            txHash: receipt.hash,
            gasUsed: receipt.gasUsed.toString(),
        };
    } catch (err) {
        // Nếu đã đăng ký rồi thì bỏ qua
        if (err.message?.includes('already registered')) {
            console.log(`ℹ️ Employee already registered on-chain: ${walletAddress}`);
            registeredEmployeeCache.set(walletAddress.toLowerCase(), true);
            return { txHash: null, gasUsed: '0', alreadyRegistered: true };
        }
        throw new Error(translateBlockchainError(err));
    }
}

/**
 * Kiểm tra nhân viên đã đăng ký trên Smart Contract chưa (có in-memory cache).
 * @param {string} walletAddress - Địa chỉ ví Ethereum
 * @returns {Promise<boolean>}
 */
export async function checkEmployeeRegisteredOnChain(walletAddress) {
    if (!expenseManagerContract || !walletAddress) return false;
    const addr = walletAddress.toLowerCase();
    if (registeredEmployeeCache.has(addr)) {
        return registeredEmployeeCache.get(addr);
    }
    try {
        const employeeData = await expenseManagerContract.employees(walletAddress);
        const isReg = !!employeeData.registered;
        if (isReg) {
            registeredEmployeeCache.set(addr, true);
        }
        return isReg;
    } catch (err) {
        console.warn(`⚠️ Lỗi kiểm tra registered on-chain cho ${walletAddress}:`, err.message);
        return false;
    }
}

/**
 * Kiểm tra blockchain đã kết nối chưa.
 */
export function isBlockchainReady() {
    return expenseManagerContract !== null;
}
