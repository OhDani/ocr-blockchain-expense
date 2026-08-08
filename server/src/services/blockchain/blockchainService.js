/**
 * blockchainService.js
 * Bridge giữa backend Express và Smart Contract trên Hardhat.
 * 
 * Sử dụng server-side wallet (private key từ .env) để:
 * - Submit expense lên smart contract
 * - Validate (approve/reject) expense
 * - Đọc thông tin từ contract
 */

import { ethers } from 'ethers';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ABI paths (từ Hardhat artifacts)
const ARTIFACTS_DIR = join(__dirname, '..', '..', '..', '..', 'contracts', 'artifacts', 'contracts');

let provider = null;
let adminWallet = null;
let expenseManagerContract = null;
let mockVNDContract = null;

/**
 * Khởi tạo kết nối blockchain.
 * Gọi 1 lần khi server start.
 */
export function initBlockchain() {
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
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
        // khi gửi 2 TX liên tiếp (submit + validate)
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
 * Load ABI từ Hardhat artifacts.
 */
function loadABI(contractFile, contractName) {
    const artifactPath = join(ARTIFACTS_DIR, contractFile, `${contractName}.json`);
    if (!existsSync(artifactPath)) {
        throw new Error(`ABI not found: ${artifactPath}. Hãy chạy 'npx hardhat compile' trước.`);
    }
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
    return artifact.abi;
}

/**
 * Submit expense lên smart contract.
 * @param {number} amount - Số tiền (VNĐ)
 * @param {string} invoiceHash - Hash hóa đơn
 * @param {string} employeeWallet - Địa chỉ ví nhân viên
 * @returns {{ txHash: string, expenseId: number }}
 */
export async function submitExpenseOnChain(amount, invoiceHash, employeeWallet) {
    if (!expenseManagerContract) {
        throw new Error('Blockchain chưa được khởi tạo');
    }

    // Gọi submitExpense từ ví admin (vì backend quản lý)
    // Trong production, nhân viên sẽ ký TX từ ví riêng
    const tx = await expenseManagerContract.submitExpense(amount, invoiceHash);
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
}

/**
 * Validate expense trên smart contract (approve/reject).
 * @param {number} expenseId - On-chain expense ID
 * @param {boolean} approved - Duyệt hay từ chối
 * @returns {{ txHash: string }}
 */
export async function validateExpenseOnChain(expenseId, approved) {
    if (!expenseManagerContract) {
        throw new Error('Blockchain chưa được khởi tạo');
    }

    const tx = await expenseManagerContract.validateExpense(expenseId, approved);
    const receipt = await tx.wait();

    return {
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
    };
}

/**
 * Lấy số dư quỹ công ty.
 */
export async function getCompanyPoolBalance() {
    if (!expenseManagerContract) return null;
    const balance = await expenseManagerContract.getCompanyPoolBalance();
    return Number(balance);
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
 * Kiểm tra blockchain đã kết nối chưa.
 */
export function isBlockchainReady() {
    return expenseManagerContract !== null;
}
