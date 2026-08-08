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
             ┌───────────┐ ┌────────┐ ┌──────────┐
             │ Gemini AI │ │ Policy │ │ Hardhat  │
             │   OCR     │ │ Engine │ │ Ethereum │
             └───────────┘ └────────┘ └──────────┘
```

## Tech Stack

| Layer | Công nghệ |
|---|---|
| **Frontend** | React 19, Vite, React Router, Lucide Icons |
| **Backend** | Express 5, Prisma ORM, JWT Auth, Multer |
| **Database** | PostgreSQL (Supabase) |
| **AI OCR** | Google Gemini Vision API (gemini-2.0-flash) |
| **Blockchain** | Solidity, Hardhat, Ethers.js v6 |
| **Design** | Glassmorphism, Inter font, Responsive |

## Cài Đặt

### Yêu cầu

- Node.js ≥ 18
- npm ≥ 9
- PostgreSQL (hoặc Supabase account)
- Gemini API Key ([Google AI Studio](https://aistudio.google.com/))

### 1. Clone & cài dependencies

```bash
git clone https://github.com/your-repo/ocr-blockchain-expense.git
cd ocr-blockchain-expense
npm install
```

### 2. Cấu hình environment

```bash
cp server/.env.example server/.env
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

# Blockchain
ADMIN_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
BLOCKCHAIN_RPC_URL="http://127.0.0.1:8545"
```

### 3. Khởi tạo database

```bash
cd server
npx prisma db push
npx prisma db seed
```

## Chạy Ứng Dụng

Cần **3 terminal** chạy song song:

```bash
# Terminal 1 — Blockchain (Hardhat local node)
cd contracts
npx hardhat node

# Terminal 2 — Deploy contracts + Backend
cd contracts
npx hardhat run scripts/deploy.js --network localhost
cd ../server
npm run dev

# Terminal 3 — Frontend
cd client
npm run dev
```

Truy cập: **http://localhost:5173**

## Tài Khoản Demo

| Role | Email | Mật khẩu | Hạn mức/ngày |
|---|---|---|---|
| Admin | admin@company.vn | 123456 | 2,000,000đ |
| Nhân viên | nguyenvana@company.vn | 123456 | 500,000đ |
| Trưởng phòng | tranthib@company.vn | 123456 | 1,000,000đ |

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
⛓️ Ghi lên Blockchain (submitExpense)
   │  → Trả về txHash + onChainExpenseId
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
    └── scripts/               # deploy.js
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

### Test
```bash
cd contracts
npx hardhat test --network localhost   # 30 passing ✅
```

## API Endpoints

### Auth
| Method | Path | Mô tả |
|---|---|---|
| POST | `/api/auth/login` | Đăng nhập |
| GET | `/api/auth/me` | Lấy thông tin user |

### Expenses
| Method | Path | Mô tả |
|---|---|---|
| POST | `/api/expenses/upload` | Upload hóa đơn + AI OCR |
| GET | `/api/expenses` | Danh sách chi phí |
| PUT | `/api/expenses/:id/approve` | Duyệt chi phí |
| PUT | `/api/expenses/:id/reject` | Từ chối chi phí |

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
