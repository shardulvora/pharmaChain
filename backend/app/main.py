import json
import logging
import os
import re
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from web3 import Web3

# ─────────────────────────  Logging  ─────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("pillchain")

# ──────────────────────  Environment  ────────────────────────


def _load_env_file() -> None:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_env_file()

BASE_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BASE_DIR.parent

RPC_URL = os.getenv("RPC_URL", "http://127.0.0.1:8545")
DEPLOYED_INFO_PATH = os.getenv("DEPLOYED_INFO_PATH", "../blockchain/deployedAddress.json")
SEEDED_BATCHES_PATH = os.getenv("SEEDED_BATCHES_PATH", "../blockchain/seededBatches.json")
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]

# ─────────────────────  Pydantic Models  ─────────────────────


class BatchData(BaseModel):
    batchId: str
    drugName: str
    manufacturer: str
    expiryDate: int
    expiryISO: str | None = None
    registeredBy: str
    isRevoked: bool
    exists: bool


class VerifyResponse(BaseModel):
    status: Literal["AUTHENTIC", "FAKE", "EXPIRED", "RECALLED"]
    message: str
    data: BatchData


class BatchListResponse(BaseModel):
    total: int
    batches: list[BatchData]


class StatsResponse(BaseModel):
    totalBatches: int
    authenticCount: int
    expiredCount: int
    revokedCount: int


class SeededBatchEntry(BaseModel):
    batchId: str
    verification: VerifyResponse
    expiryISO: str | None = None


class SeededResponse(BaseModel):
    results: list[SeededBatchEntry]


# ──────────────────  Contract Helpers  ───────────────────────

BATCH_ID_PATTERN = re.compile(r"^[A-Za-z0-9_\-]{1,64}$")


def _resolve_path(configured: str) -> Path:
    p = Path(configured)
    if p.is_absolute():
        return p
    return (BASE_DIR / p).resolve()


@lru_cache(maxsize=1)
def _load_contract() -> tuple[Web3, Any]:
    deployed_info_file = _resolve_path(DEPLOYED_INFO_PATH)
    if not deployed_info_file.exists():
        raise RuntimeError(
            f"Missing deployed info file at: {deployed_info_file}. Deploy contract first."
        )

    with deployed_info_file.open("r", encoding="utf-8") as file:
        info = json.load(file)

    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    if not w3.is_connected():
        raise RuntimeError(f"Cannot connect to blockchain RPC at {RPC_URL}")

    logger.info("Connected to blockchain at %s", RPC_URL)
    logger.info("Contract address: %s", info["address"])

    return w3, w3.eth.contract(address=info["address"], abi=info["abi"])


def _validate_batch_id(batch_id: str) -> None:
    if not BATCH_ID_PATTERN.match(batch_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid batch ID. Must be 1-64 alphanumeric characters (dashes and underscores allowed).",
        )


def _parse_batch(batch_tuple: tuple) -> BatchData:
    expiry = int(batch_tuple[3])
    return BatchData(
        batchId=batch_tuple[0],
        drugName=batch_tuple[1],
        manufacturer=batch_tuple[2],
        expiryDate=expiry,
        expiryISO=(
            datetime.fromtimestamp(expiry, tz=timezone.utc).isoformat()
            if expiry > 0
            else None
        ),
        registeredBy=batch_tuple[4],
        isRevoked=bool(batch_tuple[5]),
        exists=bool(batch_tuple[6]),
    )


# ────────────────────────  App  ──────────────────────────────

app = FastAPI(title="PillChain API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────  Endpoints  ───────────────────────────


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/verify/{batch_id}", response_model=VerifyResponse)
async def verify_drug(batch_id: str) -> VerifyResponse:
    _validate_batch_id(batch_id)
    try:
        _, contract = _load_contract()
        result = contract.functions.verifyBatch(batch_id).call()

        is_authentic = bool(result[0])
        is_expired = bool(result[1])
        is_revoked = bool(result[2])
        batch_data = _parse_batch(result[3])

        if not is_authentic:
            logger.info("Batch %s: NOT FOUND (FAKE)", batch_id)
            return VerifyResponse(
                status="FAKE",
                message="Batch ID not found in registry.",
                data=batch_data,
            )

        if is_revoked:
            logger.warning("Batch %s: RECALLED", batch_id)
            return VerifyResponse(
                status="RECALLED",
                message="DANGER: This batch has been recalled by the manufacturer!",
                data=batch_data,
            )

        if is_expired:
            logger.warning("Batch %s: EXPIRED", batch_id)
            return VerifyResponse(
                status="EXPIRED",
                message="WARNING: This drug has passed its expiration date.",
                data=batch_data,
            )

        logger.info("Batch %s: AUTHENTIC ✓", batch_id)
        return VerifyResponse(
            status="AUTHENTIC",
            message="Drug verified against the blockchain.",
            data=batch_data,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("verify_drug failed for %s: %s", batch_id, exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/batches", response_model=BatchListResponse)
async def list_batches() -> BatchListResponse:
    """List all registered batches from the blockchain."""
    try:
        w3, contract = _load_contract()
        batch_ids = contract.functions.getAllBatchIds().call()

        batches: list[BatchData] = []
        for bid in batch_ids:
            result = contract.functions.verifyBatch(bid).call()
            batches.append(_parse_batch(result[3]))

        logger.info("Listed %d batches", len(batches))
        return BatchListResponse(total=len(batches), batches=batches)
    except Exception as exc:
        logger.error("list_batches failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/stats", response_model=StatsResponse)
async def get_stats() -> StatsResponse:
    """Get aggregate statistics about all registered batches."""
    try:
        w3, contract = _load_contract()
        batch_ids = contract.functions.getAllBatchIds().call()

        now = datetime.now(tz=timezone.utc).timestamp()
        authentic = 0
        expired = 0
        revoked = 0

        for bid in batch_ids:
            result = contract.functions.verifyBatch(bid).call()
            batch = result[3]
            if bool(batch[5]):  # isRevoked
                revoked += 1
            elif int(batch[3]) < now:  # expiryDate < now
                expired += 1
            else:
                authentic += 1

        return StatsResponse(
            totalBatches=len(batch_ids),
            authenticCount=authentic,
            expiredCount=expired,
            revokedCount=revoked,
        )
    except Exception as exc:
        logger.error("get_stats failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/seeded", response_model=SeededResponse)
async def seeded_batches() -> SeededResponse:
    """Return info for the seeded test batches."""
    # Try to read from seededBatches.json first
    seeded_file = _resolve_path(SEEDED_BATCHES_PATH)
    if seeded_file.exists():
        with seeded_file.open("r", encoding="utf-8") as f:
            seeded_data = json.load(f)
        seeded_ids = [b["batchId"] for b in seeded_data.get("batches", [])]
    else:
        # Fallback to known defaults
        seeded_ids = ["BATCH001", "BATCH002", "BATCH003"]

    results: list[SeededBatchEntry] = []

    for batch_id in seeded_ids:
        response = await verify_drug(batch_id)
        results.append(
            SeededBatchEntry(
                batchId=batch_id,
                verification=response,
                expiryISO=response.data.expiryISO,
            )
        )

    return SeededResponse(results=results)
