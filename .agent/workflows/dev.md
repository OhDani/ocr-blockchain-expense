---
description: Start local development environment for FlexiTrip
---

# Local Development Workflow

## Prerequisites
- Node.js 20+
- PostgreSQL running locally
- `.env` files configured in `server/` and `contracts/`

## Steps

1. Install all dependencies
// turbo
```powershell
cd d:\datn\ocr-blockchain-expense
npm install
```

2. Run database migrations
```powershell
cd d:\datn\ocr-blockchain-expense\server
npx prisma migrate dev
```

3. Seed demo data
```powershell
cd d:\datn\ocr-blockchain-expense\server
npm run db:seed
```

4. Start Hardhat local blockchain node (keep running)
```powershell
cd d:\datn\ocr-blockchain-expense\contracts
npx hardhat node
```

5. Deploy smart contracts to local node (new terminal)
```powershell
cd d:\datn\ocr-blockchain-expense\contracts
npx hardhat run scripts/deploy.js --network localhost
```

6. Start backend server (new terminal)
// turbo
```powershell
cd d:\datn\ocr-blockchain-expense\server
npm run dev
```

7. Start frontend dev server (new terminal)
// turbo
```powershell
cd d:\datn\ocr-blockchain-expense\client
npm run dev
```

8. Open browser at http://localhost:5173

## Demo Accounts (after seed)

| Email | Password | Role |
|-------|----------|------|
| admin@company.vn | admin123 | Admin |
| nguyenvana@company.vn | employee123 | Employee |
| tranthib@company.vn | employee123 | Manager |
