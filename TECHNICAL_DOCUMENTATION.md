# PillChain Technical Documentation

## 1. Overview

PillChain is a 3-layer Web3 application:

- Smart contract layer (Solidity)
- Backend service layer (FastAPI + Web3.py)
- Frontend layer (React + TypeScript)

The system verifies pharmaceutical batches through immutable blockchain records.

## 2. Objectives

- Prevent counterfeit batch claims
- Allow fast verification by public users
- Add practical DID-style manufacturer identity
- Keep implementation simple for hackathons

## 3. Smart Contract Design

Contract file: `blockchain/contracts/PillChain.sol`

### 3.1 State Structures

#### DrugBatch

Stores batch metadata:

- `batchId`
- `drugName`
- `manufacturer`
- `expiryDate`
- `registeredBy`
- `isRevoked`
- `exists`

#### Manufacturer

Stores DID-style identity:

- `name`
- `licenseId`
- `isVerified`

### 3.2 Key Mappings and Arrays

- `mapping(string => DrugBatch) private batches`
- `mapping(address => Manufacturer) public manufacturers`
- `string[] private batchIds`

### 3.3 Access Control

- `owner` controls authorization and ownership transfer
- `onlyOwner` modifier for admin operations
- `onlyAuthorized` modifier checks:
  - `manufacturers[msg.sender].isVerified == true`

### 3.4 Core Functions

- `authorizeManufacturer(address addr, string name, string licenseId)`
- `revokeManufacturer(address addr)`
- `registerBatch(string _batchId, string _drugName, string _manufacturer, uint256 _expiryDate)`
- `revokeBatch(string _batchId)`
- `verifyBatch(string _batchId)`
- `getManufacturer(address addr)`
- `getBatchCount()`
- `getBatchIdAtIndex(uint256 _index)`
- `getAllBatchIds()`

### 3.5 Events

- `ManufacturerAuthorized`
- `ManufacturerRevoked`
- `BatchRegistered`
- `BatchRevoked`
- `OwnershipTransferred`

## 4. Backend Design

Backend file: `backend/app/main.py`

### 4.1 Technology

- FastAPI
- Web3.py
- Pydantic
- SlowAPI (rate limiting)

### 4.2 Contract Connection

The backend reads:

- Contract address
- Contract ABI

from `blockchain/deployedAddress.json` using cached loading (`@lru_cache`).

### 4.3 Data Enrichment Flow

For `verifyBatch` results:

1. Backend calls contract `verifyBatch(batchId)`.
2. Gets `batch.registeredBy`.
3. Calls `getManufacturer(registeredBy)`.
4. Adds DID fields:
   - `manufacturerName`
   - `licenseId`
   - `isVerified`

### 4.4 API Endpoints

- `GET /api/health`
- `GET /api/verify/{batch_id}`
- `GET /api/manufacturer/{address}`
- `GET /api/batches`
- `GET /api/stats`
- `GET /api/seeded`

### 4.5 Response Models

Important Pydantic models:

- `BatchData`
- `VerifyResponse`
- `ManufacturerInfo`
- `BatchListResponse`
- `StatsResponse`
- `SeededResponse`

## 5. Frontend Design

Primary files:

- `frontend/src/pages/VerifyPage.tsx`
- `frontend/src/pages/BatchDetailPage.tsx`
- `frontend/src/components/BatchTable.tsx`
- `frontend/src/lib/api.ts`

### 5.1 Verification Modes

1. Backend verification (`/api/verify`)
2. Direct on-chain verification (when wallet connected)

Both paths now support DID display (`manufacturerName`, `licenseId`, `isVerified`).

### 5.2 DID Rendering Behavior

If DID data exists:

- Show manufacturer name
- Show verified badge if `isVerified = true`
- Show license line

If DID data is not available:

- Fallback to legacy manufacturer field

### 5.3 UX Components

- QR scanner flow
- Manual batch input
- Result cards for status and metadata
- Batch list table with clickable rows
- Batch detail page with shareable URL

## 6. Deployment and Seeding

Script file: `blockchain/scripts/deploy.js`

Responsibilities:

- Deploy contract
- Authorize one test manufacturer with DID fields
- Seed sample batches
- Write deployment artifact JSON
- Write seeded batch JSON

## 7. Testing Strategy

### 7.1 Smart Contract Tests

File: `blockchain/test/PillChain.test.js`

Coverage includes:

- owner authorization rules
- DID fields for manufacturers
- revoked authorization behavior
- batch registration constraints
- duplicate prevention
- batch verification outcomes
- batch revocation ownership check
- enumeration and bounds checks

### 7.2 Backend Tests

File: `backend/tests/test_main.py`

Covers API behavior and validations.

### 7.3 Frontend Validation

- TypeScript build (`npm run build`)
- Runtime verification behavior through app UI

## 8. Security and Reliability Notes

- Authorization checks happen on-chain
- DID fields are stored directly in contract state
- Backend enrichment is best-effort and non-fatal
- Rate limits reduce API abuse
- Input validation protects against malformed batch IDs

## 9. Known Practical Limitations

- No external DID framework integration (intentional)
- Local/testnet dependent setup for demos
- Large frontend bundle warning in production build
- Real-world KYC validation is out of scope for hackathon version

## 10. Recommended Demo Verification Checklist

1. Run local chain and deploy
2. Verify known seeded batch (expect `AUTHENTIC`)
3. Verify unknown batch (expect `FAKE`)
4. Show DID fields in API response
5. Show DID fields in UI table/detail/verify page
6. Revoke batch and re-verify (expect `RECALLED`)

## 11. Future Enhancements (Optional)

- Multi-manufacturer admin dashboard
- Signature-based off-chain attestations
- Indexer for analytics at scale
- Better code splitting for frontend bundle size
- Role-based access control extension
