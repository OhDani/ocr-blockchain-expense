# FlexiTrip — Hệ Thống Quản Lý Chi Phí Công Tác

Ứng dụng quản lý chi phí công tác tích hợp **AI OCR** và **Blockchain**, tự động hóa quy trình từ bóc tách hóa đơn → kiểm tra chính sách → hoàn ứng trên smart contract.

## 📋 Mục Lục

- [Tổng quan](#tổng-quan)
- [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
- [Tech Stack](#tech-stack)
- [Cài đặt](#cài-đặt)
- [Chạy ứng dụng](#chạy-ứng-dụng)
- [Tài khoản Demo](#tài-khoản-demo)
- [Luồng xử lý chính](#luồng-xử-lý-chính)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Smart Contracts](#smart-contracts)
- [API Endpoints](#api-endpoints)

---

## Tổng Quan

FlexiTrip giải quyết bài toán quản lý chi phí công tác doanh nghiệp:

| Vấn đề truyền thống | Giải pháp FlexiTrip |
|---|---|
| Nhập liệu hóa đơn thủ công | AI OCR (Gemini Vision) tự động bóc tách |
| Kiểm tra chính sách bằng tay | Policy Engine tự động đối chiếu theo cấp bậc |
| Quy trình hoàn ứng chậm trễ | Smart Contract tự động chuyển khoản vVND |
| Thiếu minh bạch | Blockchain ghi nhận bất biến mọi giao dịch |

## Kiến Trúc Hệ Thống

```
┌────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   React/Vite   │────▶│  Express Server  │────▶│  PostgreSQL      │
│   (Frontend)   │     │  (Backend API)   │     │  (Supabase)      │
└────────────────┘     └────────┬─────────┘     └──────────────────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
             ┌───────────┐ ┌────────┐ ┌──────────────┐
             │ Gemini AI │ │ Policy │ │   Ethereum   │
             │   OCR     │ │ Engine │ │   Sepolia    │
             └───────────┘ └────────┘ └──────────────┘
```

## Tech Stack

| Layer | Công nghệ |
|---|---|
| **Frontend** | React 19, Vite, React Router, Lucide Icons |
| **Backend** | Express 5, Prisma ORM, JWT Auth, Multer |
| **Database** | PostgreSQL (Supabase) |
| **AI OCR** | Google Gemini Vision API (gemini-2.0-flash) |
| **Blockchain** | Solidity, Ethers.js v6, Sepolia Testnet |
| **Design** | Glassmorphism, Inter font, Responsive |

## Cài Đặt

### Yêu cầu

- Node.js ≥ 18
- npm ≥ 9
- PostgreSQL (hoặc Supabase account)
- Gemini API Key ([Google AI Studio](https://aistudio.google.com/))
- Ví Ethereum có SepoliaETH (xem [Lấy SepoliaETH](#lấy-sepoliaETH))

### 1. Clone & cài dependencies

```bash
git clone https://github.com/your-repo/ocr-blockchain-expense.git
cd ocr-blockchain-expense
npm install
```

### 2. Cấu hình environment

```bash
cp server/.env.example server/.env
cp contracts/.env.example contracts/.env
```

Sửa `server/.env`:
```env
# Database (Supabase)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# JWT
JWT_SECRET="your-secret-key"

# Gemini AI OCR
GEMINI_API_KEY="your_gemini_api_key"

# Blockchain (Sepolia Testnet)
ADMIN_PRIVATE_KEY="your_private_key"
BLOCKCHAIN_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
```

Sửa `contracts/.env`:
```env
SEPOLIA_URL="https://ethereum-sepolia-rpc.publicnode.com"
PRIVATE_KEY="your_private_key_here"
```

### 3. Khởi tạo database

```bash
cd server
npx prisma db push
npx prisma db seed
```

### 4. Deploy Smart Contracts lên Sepolia

```bash
npm run contracts:deploy:sepolia
```

Script sẽ tự động cập nhật `server/.env` với địa chỉ contract mới.

### Lấy SepoliaETH

Smart contract deploy lên Sepolia cần SepoliaETH (gas fee). Lấy miễn phí tại:

- [Google Cloud Sepolia Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia)
- [Alchemy Sepolia Faucet](https://sepoliafaucet.com/)
- [Infura Sepolia Faucet](https://www.infura.io/faucet/sepolia)

Cần khoảng **0.05 SepoliaETH** để deploy + chạy vài giao dịch.

## Chạy Ứng Dụng

Cần **2 terminal** chạy song song:

```bash
# Terminal 1 — Backend server
cd server
npm run dev

# Terminal 2 — Frontend
cd client
npm run dev
```

Truy cập: **http://localhost:5173**

> **Lưu ý:** Blockchain kết nối trực tiếp đến Sepolia Testnet qua RPC, không cần chạy node riêng.

## Khởi Tạo Hệ Thống

Lần đầu triển khai (DB trống), truy cập web sẽ tự động hiện **trang Setup**:

1. Nhập tên công ty
2. Tạo tài khoản Admin đầu tiên (tên, email, mật khẩu)
3. Hệ thống khởi tạo → redirect sang Login
4. Admin đăng nhập → tạo phòng ban, Manager, Employee

> **Mô hình multi-company:** Mỗi công ty = 1 deployment riêng (database riêng). Khi bán cho công ty mới, deploy instance mới → họ tự setup Admin.

## Phân Quyền

| Chức năng | Admin | Manager | Employee |
|---|:---:|:---:|:---:|
| Bảng quản trị (thống kê) | ✅ | ❌ | ❌ |
| Duyệt/Từ chối hóa đơn | ✅ | ❌ | ❌ |
| Tạo phòng ban | ✅ | ❌ | ❌ |
| Tạo tài khoản | ✅ | ✅ (phòng mình) | ❌ |
| Xem chuyến công tác | Tất cả | Phòng ban | Bản thân |
| Tạo chuyến công tác | ❌ | ✅ (cho NV phòng) | ✅ (bản thân) |
| Báo cáo & Xuất PDF/Excel | ✅ | ❌ | ❌ |

## Tài Khoản Demo

> **Lưu ý:** Nếu dùng seed data, các tài khoản mặc định là:

| Role | Email | Mật khẩu |
|---|---|---|
| Admin | admin@company.vn | admin123 |
| Nhân viên | nguyenvana@company.vn | employee123 |
| Trưởng phòng | tranthib@company.vn | employee123 |

## Luồng Xử Lý Chính

```
📸 Upload ảnh hóa đơn
   │
   ▼
🤖 AI OCR (Gemini Vision)
   │  Bóc tách: tên cửa hàng, MST, tổng tiền, ngày, loại
   │
   ▼
📋 Policy Engine
   │  Kiểm tra: hạn mức theo cấp bậc, MST hợp lệ
   │  → VALID / OVER_BUDGET / INVALID_TAX_ID
   │
   ▼
💾 Lưu vào PostgreSQL
   │
   ▼
⛓️ Ghi lên Blockchain Sepolia (submitExpense)
   │  → Trả về txHash + onChainExpenseId
   │  → Verify trên Etherscan Sepolia
   │
   ▼
⏳ Chờ Admin duyệt
   │
   ├── ✅ Duyệt → Smart Contract tự hoàn ứng vVND
   │              (validateExpense → _reimburse)
   │
   └── ❌ Từ chối → Đánh dấu REJECTED
```

## Cấu Trúc Thư Mục

```
ocr-blockchain-expense/
├── client/                    # React frontend
│   ├── public/assets/         # Logo, static files
│   └── src/
│       ├── api/               # Axios client
│       ├── components/        # Layout, Sidebar
│       ├── context/           # AuthContext
│       └── pages/             # Dashboard, Upload, Trips, Expenses, Admin
│
├── server/                    # Express backend
│   ├── prisma/                # Schema + seed
│   └── src/
│       ├── routes/            # auth, expense, trip, admin
│       ├── services/          # ocrService, policyService, blockchainService
│       └── middleware/        # auth JWT middleware
│
└── contracts/                 # Solidity + Hardhat
    ├── contracts/             # MockVND.sol, ExpenseManager.sol
    ├── test/                  # 30 test cases
    └── scripts/               # deploy.js, deploy-sepolia.js
```

## Smart Contracts

### MockVND (ERC-20)
- Token giả lập tiền Việt Nam Đồng (vVND)
- Owner mint token, transfer giữa ví

### ExpenseManager
- `submitExpense()` — Nhân viên nộp hóa đơn on-chain
- `validateExpense()` — Admin duyệt/từ chối
- `_reimburse()` — Tự động chuyển vVND từ quỹ công ty → ví nhân viên
- Policy on-chain: hạn mức theo cấp bậc (EMPLOYEE / MANAGER / ADMIN)

### Deploy & Test
```bash
# Test
cd contracts
npx hardhat test   # 30 passing ✅

# Deploy lên Sepolia
npm run contracts:deploy:sepolia
```

## API Endpoints

### Auth
| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/auth/check-setup` | Kiểm tra cần setup không |
| POST | `/api/auth/setup` | Khởi tạo Admin đầu tiên |
| POST | `/api/auth/login` | Đăng nhập |
| GET | `/api/auth/me` | Lấy thông tin user |

### Expenses
| Method | Path | Mô tả |
|---|---|---|
| POST | `/api/expenses/upload` | Upload hóa đơn + AI OCR |
| GET | `/api/expenses` | Danh sách chi phí |
| PATCH | `/api/expenses/:id/approve` | Admin duyệt chi phí |
| PATCH | `/api/expenses/:id/reject` | Admin từ chối chi phí |

### Trips
| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/trips` | Danh sách chuyến |
| POST | `/api/trips` | Tạo chuyến mới |

### Admin
| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/admin/dashboard` | Thống kê tổng quan |
| GET | `/api/admin/expenses` | Tất cả chi phí (phân trang) |
| GET | `/api/admin/departments` | Chi phí theo phòng ban |

---

**Đồ án tốt nghiệp** — Hệ thống quản lý chi phí công tác ứng dụng AI OCR và Blockchain
