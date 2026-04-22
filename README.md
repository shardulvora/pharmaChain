# PillChain - Web3 Pharmaceutical Verification

PillChain is a blockchain-based medicine verification system.  
It helps users check whether a drug batch is authentic, expired, recalled, or fake.

The system is built for hackathon use: simple, understandable, and practical.

## Why This Project Matters

Fake medicines are a serious public health problem.  
Traditional systems can be edited or forged. PillChain uses blockchain to keep batch records tamper-resistant and transparent.

## Core Idea

- Manufacturers register drug batches on-chain.
- Users verify a batch ID from QR code or manual input.
- The app returns a trust status in seconds.
- DID-style manufacturer identity is included without external DID frameworks.

## DID Model (Simple and Hackathon-Ready)

Instead of only trusting a wallet address, the contract now stores:

- Manufacturer name
- License ID
- Verification flag (`isVerified`)

This makes output understandable for non-technical users:

- `Sun Pharma Ltd (Verified)`
- `License: MFG-IN-2024-001`

## Architecture

```text
Frontend (React + TypeScript + Vite)
        |
        | REST API
        v
Backend (FastAPI + Web3.py)
        |
        | RPC
        v
Ethereum Smart Contract (Solidity + Hardhat)
```

## Main Features

### Smart Contract

- Register and verify batches
- Authorize and revoke manufacturers
- DID identity per manufacturer (`name`, `licenseId`, `isVerified`)
- Batch revocation by original registerer
- Batch list enumeration methods
- Ownership transfer support

### Backend API

- Verify batch by ID
- Return enriched manufacturer DID info
- List all batches
- Return dashboard stats
- Return seeded test data
- Manufacturer lookup endpoint

### Frontend

- Verify page (manual + QR flow)
- Wallet-enabled direct on-chain verification fallback flow
- Dashboard + batch table
- Batch detail page
- DID display in UI (`Verified` + `License`)
- Security/risk UI components for demo value

## Verification Status Meaning

| Status | Meaning |
|---|---|
| `AUTHENTIC` | Batch exists, not expired, not recalled |
| `EXPIRED` | Batch exists but expiry date is passed |
| `RECALLED` | Batch exists but has been revoked |
| `FAKE` | Batch not found on-chain |

## API Endpoints

Base URL (default): `http://127.0.0.1:8000`

- `GET /api/health`
- `GET /api/verify/{batch_id}`
- `GET /api/manufacturer/{address}`
- `GET /api/batches`
- `GET /api/stats`
- `GET /api/seeded`

`/api/verify/{batch_id}` returns DID fields in `data`:

- `manufacturerName`
- `licenseId`
- `isVerified`

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- Python 3.10+
- pip

### 1) Blockchain

```bash
cd blockchain
npm install
npx hardhat node
```

### 2) Deploy Contract + Seed Data

```bash
cd blockchain
npx hardhat run scripts/deploy.js --network localhost
```

This creates/updates:

- `blockchain/deployedAddress.json`
- `blockchain/seededBatches.json`

### 3) Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open API docs at: `http://127.0.0.1:8000/docs`

### 4) Frontend

```bash
cd frontend
npm install
npm run dev
```

Open app at: `http://localhost:5173`

## Test Commands

### Smart Contract

```bash
cd blockchain
npx hardhat test
```

### Backend

```bash
cd backend
pip install pytest httpx
python -m pytest tests -v
```

### Frontend Build Check

```bash
cd frontend
npm run build
```

## Demo Data

The deploy script seeds test batch IDs such as:

- `BATCH001`
- `BATCH002`
- `BATCH003`
- ... up to `BATCH013`

Try `BATCH999` to demonstrate the `FAKE` status.

## Project Structure

```text
PillChain-main/
  blockchain/
    contracts/PillChain.sol
    scripts/deploy.js
    test/PillChain.test.js
  backend/
    app/main.py
    tests/test_main.py
  frontend/
    src/pages/
    src/components/
    src/lib/
  README.md
```

## Security Notes

- Keep `.env` files private
- Use testnet or local chain for demos
- Never use production private keys in local demos

## License

MIT
