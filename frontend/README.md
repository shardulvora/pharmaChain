# PillChain Frontend

React + TypeScript frontend for verifying drug batches from the PillChain backend API.

## Tech Stack

- Vite
- React 18
- TypeScript

## Run Locally

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Create environment file:

```bash
copy .env.example .env
```

3. Start the app:

```bash
npm run dev
```

App runs on `http://localhost:5173`.

## Backend Requirement

Set `VITE_API_BASE_URL` in `.env`.

Expected endpoint:

- `GET /api/verify/{batch_id}`

Example full URL used by frontend:

- `http://127.0.0.1:8000/api/verify/BATCH001`
