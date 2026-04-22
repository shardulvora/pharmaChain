# PillChain Explanation (Simple and Detailed)

## What is PillChain?

PillChain is a medicine verification project.  
It helps people check whether a drug batch is safe and real.

The project uses blockchain, so once a batch is registered, the record is hard to change or fake.

## What problem does it solve?

Counterfeit medicines are dangerous.  
People often cannot tell if a product is fake by just looking at packaging.

PillChain gives a fast digital trust check.

## How does it work in simple steps?

1. A manufacturer is authorized by the contract owner.
2. The manufacturer registers a batch on blockchain.
3. A QR code or batch ID is used by a user to verify that batch.
4. The app checks blockchain records and returns a result.

## What results can users get?

- `AUTHENTIC`: Record exists and looks valid.
- `EXPIRED`: Record exists but date is past expiry.
- `RECALLED`: Record exists but was revoked.
- `FAKE`: No matching on-chain record found.

## What is DID here?

DID in this project is implemented in a simple, practical way:

- Every manufacturer address can have:
  - Name
  - License ID
  - Verification status

So users do not just see wallet addresses.  
They can see a real label like:

- `Sun Pharma Ltd (Verified)`
- `License: MFG-IN-2024-001`

## Why this approach is good for hackathons

- Easy to understand
- No heavy external DID dependency
- Works with existing contract flow
- Strong demo value for judges and stakeholders

## Project Layers

### 1) Smart Contract (Blockchain)

The contract stores:

- manufacturer authorization and identity
- batch registration data
- revocation data

Only verified manufacturers can register batches.

### 2) Backend API

Backend connects frontend to blockchain and returns clean JSON responses.

It also enriches verification response with manufacturer DID fields:

- `manufacturerName`
- `licenseId`
- `isVerified`

### 3) Frontend

Frontend lets users:

- scan QR code or enter batch ID
- view status instantly
- view manufacturer trust info
- view details in pages and dashboard table

## What was updated in current project version

- DID-style manufacturer model is implemented in contract.
- Backend response includes DID identity in verification payload.
- Frontend shows `Verified` badge and `License` line.
- Wallet-based direct on-chain verification path also supports DID display.

## How to prove it works to others

### Demo Plan (short)

1. Start local blockchain and deploy contract.
2. Verify a seeded batch (for example `BATCH001`).
3. Show status as `AUTHENTIC`.
4. Show manufacturer name + verified badge + license ID.
5. Verify `BATCH999` and show `FAKE`.
6. Open API response and show DID fields in JSON.

This gives technical proof and visual proof.

## What makes this trustworthy?

- Blockchain records are tamper-resistant.
- Authorization is enforced in smart contract.
- Verification logic is transparent.
- DID info improves real-world trust clarity.

## Current limitations

- It is not full legal KYC identity.
- It is meant for demo/testnet/hackathon use.
- Real production rollout needs stronger governance and audits.

## Final Summary

PillChain combines blockchain verification with simple DID identity.  
It is practical, understandable, and demo-ready.

The user gets clear trust output, and the system stays lightweight.
