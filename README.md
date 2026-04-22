# 💊 PillChain — Blockchain-Powered Fake Drug Detection

PillChain is a decentralized pharmaceutical supply chain verification platform that combats counterfeit medicines. Drug batches are registered on the **Ethereum blockchain** by authorized manufacturers, and anyone — consumers, pharmacists, regulators — can instantly verify a drug's authenticity by scanning a QR code or entering a Batch ID.

> **The Problem:** The WHO estimates that 1 in 10 medical products in low/middle-income countries is substandard or falsified. Counterfeit drugs kill over 1 million people annually.
>
> **The Solution:** An immutable, tamper-proof drug registry on the blockchain that anyone can verify in seconds.

---

## 🏗️ Architecture

```
┌─────────────┐       ┌──────────────┐       ┌────────────────────┐
│   Frontend   │◄─────►│   Backend    │◄─────►│   Blockchain       │
│  React + TS  │ REST  │  FastAPI     │ Web3  │  Solidity + Hardhat│
│  Vite        │  API  │  Python      │  RPC  │  Ethereum          │
└─────────────┘       └──────────────┘       └────────────────────┘
     │                                              │
  QR Scan                                     Smart Contract
  Dashboard                                   (PillChain.sol)
  QR Generator                                     │
                                          ┌────────┴────────┐
                                          │  On-Chain Data   │
                                          │  - Drug Batches  │
                                          │  - Manufacturers │
                                          │  - Revocations   │
                                          └─────────────────┘
```

---

## ✨ Features

### 🔗 Smart Contract (Solidity)
- **Batch Registration** — Authorized manufacturers register drug batches with name, manufacturer, and expiry date
- **Batch Verification** — Anyone can verify a batch ID and get real-time status (Authentic / Expired / Recalled / Fake)
- **Batch Enumeration** — On-chain array of all batch IDs with getter functions
- **Manufacturer Management** — Owner can authorize and revoke manufacturer addresses
- **Batch Revocation** — Manufacturers can recall their own batches (e.g., safety issues)
- **Ownership Transfer** — Contract ownership is transferable
- **18 Unit Tests** — Full test coverage with Hardhat + Chai

### 🐍 Backend API (FastAPI + Python)
- `GET /api/verify/{batch_id}` — Verify a drug batch against the blockchain
- `GET /api/batches` — List all registered batches
- `GET /api/stats` — Aggregate statistics (total, authentic, expired, revoked)
- `GET /api/seeded` — Pre-seeded test batch data
- `GET /api/health` — Health check
- **Pydantic Models** — Fully typed request/response schemas with OpenAPI docs
- **Input Validation** — Regex-based batch ID validation
- **Cached Connection** — Blockchain connection cached at startup (not per-request)
- **Structured Logging** — Formatted log output for all operations

### 🎨 Frontend (React + TypeScript + Vite)
- **🔍 Verify Page** — Enter batch ID or scan QR code to verify drug authenticity
- **📷 QR Code Scanner** — Camera-based QR scanning using `html5-qrcode`
- **📊 Dashboard** — Animated stats cards + full batch table with status badges
- **📄 Batch Detail Page** — Shareable URL for any batch verification (`/batch/:id`)
- **📱 QR Code Generator** — Generate and download QR codes for batch IDs
- **ℹ️ About Page** — How PillChain works with step-by-step visual
- **🕓 Verification History** — Recent lookups persisted in localStorage
- **Premium Dark UI** — Glassmorphism, gradient accents, Framer Motion animations
- **Responsive Design** — Works on desktop, tablet, and mobile

### 🔒 Security & DevOps
- **`.gitignore`** — Prevents `.env` files and secrets from being committed
- **GitHub Actions CI** — Automated pipeline: contract tests → backend tests → frontend build
- **Backend Test Suite** — pytest tests for health, validation, endpoints, and OpenAPI schema

---

## 🚀 How It Works

### Step 1: Register (Manufacturer)
An authorized pharmaceutical manufacturer registers a drug batch on the Ethereum blockchain via the smart contract. Each batch includes:
- **Batch ID** (unique identifier printed on the box)
- **Drug Name** (e.g., "Paracetamol 500mg")
- **Manufacturer Name** (e.g., "Sun Pharma")
- **Expiry Date** (Unix timestamp)

This data is stored **immutably on-chain** — it cannot be altered or deleted.

### Step 2: Label (Manufacturer)
A QR code containing the Batch ID is generated using the **QR Generator** page and printed on the medicine packaging.

### Step 3: Verify (Consumer)
The consumer scans the QR code (or types the Batch ID) on the PillChain website. The system:
1. Sends the Batch ID to the FastAPI backend
2. Backend calls the smart contract's `verifyBatch()` function via Web3
3. Returns one of four statuses:

| Status | Meaning | Color |
|--------|---------|-------|
| ✅ **AUTHENTIC** | Batch exists on-chain, not expired, not revoked | Green |
| ⏱️ **EXPIRED** | Batch exists but has passed its expiry date | Amber |
| 🚨 **RECALLED** | Batch was revoked/recalled by the manufacturer | Red |
| ❌ **FAKE** | Batch ID not found on the blockchain | Pink |

---

## 📦 Seeded Test Data

The deploy script pre-registers **13 drug batches** for testing:

| Batch ID | Drug Name | Manufacturer |
|----------|-----------|--------------|
| BATCH001 | Paracetamol 500mg | Sun Pharma |
| BATCH002 | Amoxicillin 250mg | Cipla Ltd |
| BATCH003 | Metformin 500mg | Dr. Reddys |
| BATCH004 | Ibuprofen 400mg | Abbott India |
| BATCH005 | Atorvastatin 10mg | Lupin Ltd |
| BATCH006 | Omeprazole 20mg | Torrent Pharma |
| BATCH007 | Azithromycin 500mg | Macleods Pharma |
| BATCH008 | Pantoprazole 40mg | Alkem Laboratories |
| BATCH009 | Cetirizine 10mg | Zydus Lifesciences |
| BATCH010 | Amlodipine 5mg | Glenmark Pharmaceuticals |
| BATCH011 | Levothyroxine 50mcg | GSK India |
| BATCH012 | Losartan 50mg | Intas Pharmaceuticals |
| BATCH013 | Diclofenac 50mg | Novartis India |

Try verifying `BATCH999` to see the **FAKE** response.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Solidity 0.8.20 |
| Blockchain Framework | Hardhat |
| Backend | FastAPI (Python 3.12) |
| Blockchain Interaction | Web3.py |
| Frontend | React 18 + TypeScript |
| Build Tool | Vite |
| Animations | Framer Motion |
| QR Scanning | html5-qrcode |
| QR Generation | qrcode.react |
| Routing | React Router v6 |
| CI/CD | GitHub Actions |

---

## ⚡ Quick Start

### Prerequisites
- **Node.js** ≥ 18
- **Python** ≥ 3.10
- **npm**

### 1. Start the Blockchain (Terminal 1)
```bash
cd blockchain
npm install
npx hardhat node
```

### 2. Deploy the Contract (Terminal 2)
```bash
cd blockchain
npx hardhat run scripts/deploy.js --network localhost
```
This registers all 13 test batches and writes `deployedAddress.json` + `seededBatches.json`.

### 3. Start the Backend (Terminal 3)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```
API available at `http://127.0.0.1:8000` — Swagger docs at `/docs`.

### 4. Start the Frontend (Terminal 4)
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 📁 Project Structure

```
PillChain/
├── blockchain/                 # Smart contract & deployment
│   ├── contracts/
│   │   └── PillChain.sol       # Main smart contract
│   ├── scripts/
│   │   └── deploy.js           # Deploy + seed test data
│   ├── test/
│   │   └── PillChain.test.js   # 18 unit tests
│   ├── hardhat.config.js
│   └── package.json
│
├── backend/                    # FastAPI REST API
│   ├── app/
│   │   └── main.py             # All endpoints + Web3 integration
│   ├── tests/
│   │   └── test_main.py        # Backend tests
│   ├── requirements.txt
│   └── .env
│
├── frontend/                   # React + Vite frontend
│   ├── src/
│   │   ├── components/         # Navbar, QRScanner, StatusBadge, etc.
│   │   ├── pages/              # Home, Dashboard, BatchDetail, Generate, About
│   │   ├── lib/                # API client, history helper
│   │   ├── App.tsx             # Router layout
│   │   ├── main.tsx            # Entry point
│   │   └── styles.css          # Design system
│   ├── index.html
│   └── package.json
│
├── .github/workflows/ci.yml   # CI pipeline
└── .gitignore
```

---

## 🧪 Running Tests

```bash
# Smart contract tests (18 tests)
cd blockchain
npx hardhat test

# Backend tests
cd backend
pip install pytest httpx
python -m pytest tests/ -v

# Frontend build check
cd frontend
npm run build
```

---

## 📄 License

MIT License — see [LICENSE](./LICENSE) for details.
