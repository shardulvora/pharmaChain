# PillChain Backend (FastAPI)

Backend API that connects to local Hardhat blockchain and verifies drug batches.

## Endpoints

- `GET /api/health`
- `GET /api/verify/{batch_id}`
- `GET /api/seeded`

## Setup

1. Create `.env` from `.env.example`.
2. Install dependencies:

```bash
cd backend
pip install -r requirements.txt
```

3. Start the API:

```bash
uvicorn app.main:app --reload --port 8000
```

4. Verify:

```bash
http://127.0.0.1:8000/api/verify/BATCH001
```

## Notes

- Keep `npx hardhat node` running.
- If blockchain is restarted, redeploy contract and refresh `deployedAddress.json`.
