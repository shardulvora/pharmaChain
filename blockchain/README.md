# PillChain — Blockchain Module

Smart contracts and deployment scripts for the PillChain fake drug detection system.

---

## Quick Start

```bash
cd blockchain

# 1. Install dependencies
npm install

# 2. Start a local Hardhat node (keep this terminal open)
npx hardhat node

# 3. In a NEW terminal — deploy & seed test data
npx hardhat run scripts/deploy.js --network localhost

# 4. Run the test suite
npx hardhat test
```

---

## deployedAddress.json

After running the deploy script, a file called **`deployedAddress.json`** is written to this directory. It contains everything the backend needs to connect to the contract:

```json
{
  "address": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "abi": [ ... ],
  "network": "localhost"
}
```

| Field     | Description                                          |
| --------- | ---------------------------------------------------- |
| `address` | The deployed contract address                        |
| `abi`     | The full ABI array — pass this to `web3.py`          |
| `network` | The Hardhat network the contract was deployed on     |

### Backend Usage (Python / web3.py)

```python
import json
from web3 import Web3

w3 = Web3(Web3.HTTPProvider("http://127.0.0.1:8545"))

with open("../blockchain/deployedAddress.json") as f:
    info = json.load(f)

contract = w3.eth.contract(address=info["address"], abi=info["abi"])

# Verify a batch
result = contract.functions.verifyBatch("BATCH001").call()
is_authentic, is_expired, is_revoked, batch = result
```

---

## Contract Function Signatures

### Owner-only

| Function                                     | Description                              |
| -------------------------------------------- | ---------------------------------------- |
| `authorizeManufacturer(address _manufacturer)` | Authorize an address to register batches |

### Manufacturer-only (must be authorized first)

| Function                                                                                            | Description                    |
| --------------------------------------------------------------------------------------------------- | ------------------------------ |
| `registerBatch(string _batchId, string _drugName, string _manufacturer, uint256 _expiryDate)` | Register a new drug batch      |
| `revokeBatch(string _batchId)`                                                                     | Recall / revoke a drug batch   |

### Public (anyone can call)

| Function                          | Returns                                                        |
| --------------------------------- | -------------------------------------------------------------- |
| `verifyBatch(string _batchId)` | `(bool isAuthentic, bool isExpired, bool isRevoked, DrugBatch)` |

### DrugBatch Struct

```solidity
struct DrugBatch {
    string   batchId;
    string   drugName;
    string   manufacturer;
    uint256  expiryDate;      // unix timestamp
    address  registeredBy;    // manufacturer wallet
    bool     isRevoked;
    bool     exists;
}
```

### Events

| Event                       | Emitted When                     |
| --------------------------- | -------------------------------- |
| `ManufacturerAuthorized`    | Owner authorizes a manufacturer  |
| `BatchRegistered`           | A new batch is registered        |
| `BatchRevoked`              | A batch is recalled              |

---

## Seeded Test Data

The deploy script registers 3 test batches under `signers[1]`:

| Batch ID   | Drug Name          | Manufacturer | Expiry         |
| ---------- | ------------------ | ------------ | -------------- |
| `BATCH001` | Paracetamol 500mg  | Sun Pharma   | 1 year from now|
| `BATCH002` | Amoxicillin 250mg  | Cipla Ltd    | 1 year from now|
| `BATCH003` | Metformin 500mg    | Dr. Reddys   | 1 year from now|


