# FlexiTrip — Project Rules

## Language & Communication
- Code comments in Vietnamese (tiếng Việt) — consistent with existing POC codebase
- Variable names, function names, class names in **English**
- Git commit messages in English
- UI text in Vietnamese

## Architecture
- **Monorepo** with 3 packages: `client/`, `server/`, `contracts/`
- Backend follows **Service → Route → Controller** pattern
- All business logic lives in `services/`, routes only handle HTTP
- OCR, Policy Engine, Blockchain are **separate service modules** — never mix concerns

## Backend Conventions
- **ESM** (`"type": "module"`) — use `import/export`, not `require`
- Express 5 with async error handling
- All API responses follow shape: `{ success: boolean, data?: any, error?: string }`
- Authentication via JWT — middleware in `auth.js`
- File uploads via `multer` — save to `server/uploads/`, max 5MB
- Prisma for all DB operations — never write raw SQL
- Environment variables: use `dotenv`, never hardcode secrets

## Frontend Conventions
- React 19 functional components only — no class components
- **Vanilla CSS** — no Tailwind, no CSS-in-JS
- CSS variables for theming in `index.css`
- Use `fetch` or `axios` via centralized `api/client.js` — never call fetch directly in components
- Context API for auth state — no Redux
- File naming: `PascalCase` for components, `camelCase` for utils

## Smart Contracts
- Solidity 0.8.20, OpenZeppelin v5
- Test with Hardhat + Chai
- Deploy to localhost Hardhat node for development
- Token amounts in integer (vVND decimals = 0)

## Wallet & Demo
- **MetaMask** for visual demo (employee sees vVND balance)
- Hardhat Account #0 → Admin/Company wallet (deploy, fund pool)
- Hardhat Account #1 → Employee A, Account #2 → Manager B
- Backend uses **server-side wallet** (private key from `.env`) — employees don't sign TX
- Add vVND as custom ERC-20 token in MetaMask for demo

## Key Constraints
- **No weather tracking features**
- **No voucher features**
- AI Trip suggestions are **mocked** in MVP (static data, not real Gemini calls for itinerary)
- OCR uses **Gemini Vision API** — the only real AI integration
- Blockchain on **Hardhat localhost** only — no testnet deployment in MVP

## Error Handling
- Backend: wrap async route handlers, return proper HTTP status codes
- Frontend: show toast notifications for errors, loading spinners for async ops
- OCR service: retry up to 2 times with exponential backoff (already implemented in POC)

## Security
- Hash passwords with bcrypt (min 10 rounds)
- Validate all inputs server-side
- CORS configured for `localhost:5173` only
- JWT expires in 24h
- File upload: validate MIME type + size before processing
