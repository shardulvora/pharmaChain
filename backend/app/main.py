import json
import logging
import os
import re
from datetime import datetime, timezone
from functools import lru_cache  # noqa: F401 — kept in case sub-modules need it
from pathlib import Path
from typing import Any, Literal, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from web3 import Web3

try:
    from groq import Groq as _Groq
except ImportError:  # groq not installed — fallback mode only
    _Groq = None  # type: ignore

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
origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
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
    # DID / manufacturer identity fields (populated when on-chain data is available)
    manufacturerName: str | None = None
    licenseId: str | None = None
    isVerified: bool = False


class ManufacturerInfo(BaseModel):
    address: str
    name: str
    licenseId: str
    isVerified: bool


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


class RegisterBatchRequest(BaseModel):
    batchId: str
    drugName: str
    manufacturer: str
    expiryDate: str  # ISO date string, e.g. "2026-12-31"


class RegisterBatchResponse(BaseModel):
    message: str
    txHash: str


class NarrativeRequest(BaseModel):
    batchId: str
    drugName: str
    manufacturer: str
    status: str
    scanCount: int
    expectedUnits: int
    alertReason: Optional[str] = None
    city: Optional[str] = None
    isVerified: bool = False


class NarrativeResponse(BaseModel):
    narrative: str
    riskLevel: str          # "Low" | "Medium" | "High"
    confidence: int         # 0–100
    keyFindings: list[str]
    recommendation: str
    model: str              # which model responded


class TokenBalanceResponse(BaseModel):
    address: str
    balance: float          # PILL tokens (human-readable, not wei)
    symbol: str             # always "PILL"
    raw: str                # wei value as string (for precision)


# ──────────────────  Contract Helpers  ───────────────────────

BATCH_ID_PATTERN = re.compile(r"^[A-Z0-9_\-]{1,64}$")

# ── Contract singleton (reconnects automatically after Hardhat restart) ──────
# We intentionally do NOT use @lru_cache here: lru_cache keeps the cached
# Web3 + contract object even after the Hardhat node restarts, which causes
# every subsequent call to fail with 500 until the backend is restarted.
# Instead we cache in a module-level dict and re-check is_connected() on
# every call so we can silently reconnect.

_contract_cache: dict[str, Any] = {}   # keys: "w3", "contract"
_token_cache: dict[str, Any] = {}      # keys: "w3", "contract"


def _resolve_path(configured: str) -> Path:
    p = Path(configured)
    if p.is_absolute():
        return p
    return (BASE_DIR / p).resolve()


def _load_contract() -> tuple[Web3, Any]:
    """Return (w3, contract). Reconnects automatically if the node restarted."""
    w3_cached: Web3 | None = _contract_cache.get("w3")
    if w3_cached is not None and w3_cached.is_connected():
        return w3_cached, _contract_cache["contract"]

    # (Re)connect
    deployed_info_file = _resolve_path(DEPLOYED_INFO_PATH)
    if not deployed_info_file.exists():
        raise RuntimeError(
            f"Missing deployed info file at: {deployed_info_file}. "
            "Run: npx hardhat run scripts/deploy.js --network localhost"
        )

    with deployed_info_file.open("r", encoding="utf-8") as fh:
        info = json.load(fh)

    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    if not w3.is_connected():
        raise RuntimeError(
            f"Cannot connect to blockchain node at {RPC_URL}. "
            "Is the Hardhat node running? (npx hardhat node)"
        )

    contract = w3.eth.contract(address=info["address"], abi=info["abi"])
    _contract_cache["w3"] = w3
    _contract_cache["contract"] = contract

    logger.info("(Re)connected to blockchain at %s — contract %s", RPC_URL, info["address"])
    return w3, contract


def _load_token_contract() -> tuple[Web3, Any] | None:
    """Return (w3, token_contract) or None if PillToken not deployed."""
    w3_cached: Web3 | None = _token_cache.get("w3")
    if w3_cached is not None and w3_cached.is_connected():
        return w3_cached, _token_cache["contract"]

    deployed_info_file = _resolve_path(DEPLOYED_INFO_PATH)
    if not deployed_info_file.exists():
        return None

    with deployed_info_file.open("r", encoding="utf-8") as fh:
        info = json.load(fh)

    token_address = info.get("pillTokenAddress")
    token_abi = info.get("pillTokenAbi")
    if not token_address or not token_abi:
        logger.info("PillToken not found in deployedAddress.json — token features disabled")
        return None

    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    if not w3.is_connected():
        return None

    contract = w3.eth.contract(address=token_address, abi=token_abi)
    _token_cache["w3"] = w3
    _token_cache["contract"] = contract
    return w3, contract


def _validate_batch_id(batch_id: str) -> None:
    if not BATCH_ID_PATTERN.match(batch_id):
        raise HTTPException(
            status_code=422,
            detail="Invalid batch ID format.",
        )


def _normalize_batch_id(batch_id: str) -> str:
    return batch_id.strip().upper()


def _parse_batch(batch_tuple: tuple) -> BatchData:
    expiry = int(batch_tuple[3])
    registered_by: str = batch_tuple[4]

    # Attempt to resolve manufacturer DID from on-chain identity record.
    manufacturer_name: str | None = None
    license_id: str | None = None
    is_verified: bool = False
    try:
        _, contract = _load_contract()
        if registered_by and registered_by != "0x" + "0" * 40:
            mfg = contract.functions.getManufacturer(registered_by).call()
            manufacturer_name = mfg[0] if mfg[0] else None
            license_id = mfg[1] if mfg[1] else None
            is_verified = bool(mfg[2])
    except Exception:
        # Non-fatal: DID enrichment is best-effort
        pass

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
        registeredBy=registered_by,
        isRevoked=bool(batch_tuple[5]),
        exists=bool(batch_tuple[6]),
        manufacturerName=manufacturer_name,
        licenseId=license_id,
        isVerified=is_verified,
    )


def _verify_batch_internal(batch_id: str) -> VerifyResponse:
    normalized_batch_id = _normalize_batch_id(batch_id)
    _validate_batch_id(normalized_batch_id)

    _, contract = _load_contract()
    result = contract.functions.verifyBatch(normalized_batch_id).call()

    is_authentic = bool(result[0])
    is_expired = bool(result[1])
    is_revoked = bool(result[2])
    batch_data = _parse_batch(result[3])

    if not is_authentic:
        logger.info("Batch %s: NOT FOUND (FAKE)", normalized_batch_id)
        return VerifyResponse(
            status="FAKE",
            message="Batch ID not found in registry.",
            data=batch_data,
        )

    if is_revoked:
        logger.warning("Batch %s: RECALLED", normalized_batch_id)
        return VerifyResponse(
            status="RECALLED",
            message="DANGER: This batch has been recalled by the manufacturer!",
            data=batch_data,
        )

    if is_expired:
        logger.warning("Batch %s: EXPIRED", normalized_batch_id)
        return VerifyResponse(
            status="EXPIRED",
            message="WARNING: This drug has passed its expiration date.",
            data=batch_data,
        )

    logger.info("Batch %s: AUTHENTIC ✓", normalized_batch_id)
    return VerifyResponse(
        status="AUTHENTIC",
        message="Drug verified against the blockchain.",
        data=batch_data,
    )


# ────────────────────────  App  ──────────────────────────────

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app_: FastAPI):  # noqa: ARG001
    """Run startup diagnostics so problems surface immediately, not mid-request."""
    try:
        w3, contract = _load_contract()
        block = w3.eth.block_number
        code  = w3.eth.get_code(contract.address)
        if code in (b"", b"0x", HexBytes("0x")):
            logger.warning(
                "⚠️  CONTRACT HAS NO BYTECODE at %s (block %d). "
                "The Hardhat node was restarted. Redeploy with: "
                "npx hardhat run scripts/deploy.js --network localhost",
                contract.address, block,
            )
        else:
            logger.info(
                "✅ Blockchain ready — block %d, contract %s (%d bytes)",
                block, contract.address, len(code),
            )
    except Exception as exc:
        logger.warning("⚠️  Startup check failed: %s", exc)
    yield  # app runs here


try:
    from hexbytes import HexBytes
except ImportError:
    HexBytes = bytes  # type: ignore

app = FastAPI(title="PillChain API", version="2.0.0", lifespan=lifespan)
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────  Endpoints  ───────────────────────────


@app.get("/api/health")
async def health() -> dict:
    """Quick liveness probe + blockchain status for the frontend."""
    try:
        w3, contract = _load_contract()
        block     = w3.eth.block_number
        code      = w3.eth.get_code(contract.address)
        has_code  = len(code) > 2  # "0x" alone = no contract
        return {
            "status": "ok" if has_code else "degraded",
            "node": "connected",
            "block": block,
            "contract": contract.address,
            "contractDeployed": has_code,
            "rpc": RPC_URL,
        }
    except Exception as exc:
        return {"status": "error", "node": "unreachable", "detail": str(exc)}


@limiter.limit("30/minute")
@app.get("/api/verify/{batch_id}", response_model=VerifyResponse)
async def verify_drug(request: Request, batch_id: str) -> VerifyResponse:
    try:
        return _verify_batch_internal(batch_id)
    except HTTPException:
        raise
    except RuntimeError as exc:
        # RuntimeError means node is down or contract not deployed — give a clear 503
        msg = str(exc)
        logger.warning("verify_drug runtime error for %s: %s", batch_id, msg)
        if "Cannot connect" in msg or "blockchain node" in msg.lower():
            raise HTTPException(
                status_code=503,
                detail="Blockchain node is not running. Start it with: npx hardhat node",
            ) from exc
        if "Missing deployed info" in msg:
            raise HTTPException(
                status_code=503,
                detail="Contract not deployed. Run: npx hardhat run scripts/deploy.js --network localhost",
            ) from exc
        raise HTTPException(status_code=500, detail=msg) from exc
    except Exception as exc:
        normalized_batch_id = _normalize_batch_id(batch_id)
        logger.error("verify_drug failed for %s: %s", normalized_batch_id, exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred. Please try again.",
        ) from exc


@limiter.limit("20/minute")
@app.get("/api/manufacturer/{address}", response_model=ManufacturerInfo)
async def get_manufacturer(request: Request, address: str) -> ManufacturerInfo:
    """Return the on-chain DID identity for a manufacturer wallet address."""
    try:
        _, contract = _load_contract()
        result = contract.functions.getManufacturer(address).call()
        return ManufacturerInfo(
            address=address,
            name=result[0],
            licenseId=result[1],
            isVerified=bool(result[2]),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("get_manufacturer failed for %s: %s", address, exc)
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred. Please try again.",
        ) from exc


@limiter.limit("20/minute")
@app.get("/api/batches", response_model=BatchListResponse)
async def list_batches(request: Request) -> BatchListResponse:
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
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred. Please try again.",
        ) from exc


@limiter.limit("10/minute")
@app.get("/api/stats", response_model=StatsResponse)
async def get_stats(request: Request) -> StatsResponse:
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
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred. Please try again.",
        ) from exc


@app.get("/api/seeded", response_model=SeededResponse)
async def seeded_batches() -> SeededResponse:
    """Return info for the seeded test batches."""
    try:
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
            response = _verify_batch_internal(batch_id)
            results.append(
                SeededBatchEntry(
                    batchId=batch_id,
                    verification=response,
                    expiryISO=response.data.expiryISO,
                )
            )

        return SeededResponse(results=results)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("seeded_batches failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred. Please try again.",
        ) from exc


@limiter.limit("10/minute")
@app.post("/api/register", response_model=RegisterBatchResponse)
async def register_batch(request: Request, payload: RegisterBatchRequest) -> RegisterBatchResponse:
    """Register a new drug batch on the blockchain via the deployer account."""
    try:
        normalized_batch_id = _normalize_batch_id(payload.batchId)
        _validate_batch_id(normalized_batch_id)

        drug_name = payload.drugName.strip()
        manufacturer = payload.manufacturer.strip()
        if not drug_name:
            raise HTTPException(status_code=422, detail="drugName must not be empty.")
        if not manufacturer:
            raise HTTPException(status_code=422, detail="manufacturer must not be empty.")

        # Accept ISO date (YYYY-MM-DD) or full ISO datetime and convert to unix timestamp.
        try:
            expiry_dt = datetime.fromisoformat(payload.expiryDate)
            expiry_ts = int(expiry_dt.timestamp())
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail="Invalid expiryDate. Use ISO format, e.g. \"2026-12-31\".",
            )

        if expiry_ts <= int(datetime.now(tz=timezone.utc).timestamp()):
            raise HTTPException(status_code=422, detail="expiryDate must be in the future.")

        w3, contract = _load_contract()

        # Use the first unlocked Hardhat account (deployer / owner).
        accounts = w3.eth.accounts
        if not accounts:
            raise HTTPException(status_code=503, detail="No unlocked accounts available on the RPC node.")
        caller = accounts[0]

        tx_hash = contract.functions.registerBatch(
            normalized_batch_id,
            drug_name,
            manufacturer,
            expiry_ts,
        ).transact({"from": caller})

        # Block until the transaction is mined so the caller gets a confirmed tx hash.
        w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

        tx_hex = tx_hash.hex()
        logger.info("Batch registered on-chain: %s  tx=%s", normalized_batch_id, tx_hex)
        return RegisterBatchResponse(
            message=f"Batch {normalized_batch_id} registered successfully on the blockchain.",
            txHash=tx_hex,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("register_batch failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Registration failed: {exc}",
        ) from exc


# ────────────────────────  Groq AI  ──────────────────────────

_GROQ_MODEL = "llama-3.1-8b-instant"


def _groq_client():
    """Return a Groq client if the SDK is available and key is set, else None."""
    if _Groq is None:
        return None
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key or api_key == "your_groq_api_key_here":
        return None
    return _Groq(api_key=api_key)


def _fallback_narrative(body: NarrativeRequest) -> NarrativeResponse:
    """Rule-based fallback used when Groq is unavailable."""
    if body.status in ("FAKE", "RECALLED") or body.alertReason == "LOCATION_ANOMALY":
        risk = "High"
        confidence = 90
    elif body.status == "EXPIRED" or body.alertReason == "VELOCITY_EXCEEDED":
        risk = "Medium"
        confidence = 78
    else:
        risk = "Low"
        confidence = 92

    alert_txt = f" Alert: {body.alertReason}." if body.alertReason else " No anomalies detected."
    return NarrativeResponse(
        narrative=(
            f"Batch {body.batchId} ({body.drugName}) has been verified with "
            f"blockchain status: {body.status}.{alert_txt}"
        ),
        riskLevel=risk,
        confidence=confidence,
        keyFindings=[
            f"Blockchain status: {body.status}",
            f"Scan count: {body.scanCount} of {body.expectedUnits} expected",
            f"Manufacturer verified on-chain: {body.isVerified}",
        ],
        recommendation="Consult your pharmacist if you have any concerns about this medicine.",
        model="fallback",
    )


@limiter.limit("20/minute")
@app.post("/api/ai-narrative", response_model=NarrativeResponse)
async def generate_narrative(request: Request, body: NarrativeRequest) -> NarrativeResponse:
    """Generate a natural-language risk narrative via Groq LLM (llama-3.1-8b-instant)."""
    client = _groq_client()
    if client is None:
        logger.info("Groq unavailable — returning fallback narrative for %s", body.batchId)
        return _fallback_narrative(body)

    system_prompt = (
        "You are a pharmaceutical supply chain security analyst. "
        "Your job is to assess drug batch verification data and return a risk assessment "
        "in strict JSON format. You are precise, factual, and never hallucinate data not "
        "given to you. You always return valid JSON only."
    )

    user_prompt = f"""Analyze this drug batch verification data and return a risk assessment.

Batch Data:
- Batch ID: {body.batchId}
- Drug Name: {body.drugName}
- Manufacturer: {body.manufacturer}
- Manufacturer Verified On-Chain: {body.isVerified}
- Blockchain Status: {body.status}
- Times Scanned: {body.scanCount}
- Expected Units in Batch: {body.expectedUnits}
- Fraud Alert Triggered: {body.alertReason or "None"}
- Current Scan Location: {body.city or "Unknown"}

Rules:
- If alertReason is LOCATION_ANOMALY: riskLevel MUST be "High"
- If alertReason is VELOCITY_EXCEEDED and scanCount > expectedUnits * 1.5: riskLevel is "High"
- If alertReason is VELOCITY_EXCEEDED and scanCount <= expectedUnits * 1.5: riskLevel is "Medium"
- If status is RECALLED or FAKE: riskLevel MUST be "High"
- If status is EXPIRED: riskLevel is "Medium"
- If status is AUTHENTIC and no alertReason: riskLevel is "Low", confidence between 85-96
- narrative must be 2-3 sentences in plain English a patient can understand
- keyFindings must be exactly 3 items, factual, based only on provided data
- recommendation must be one clear action sentence

Return ONLY this JSON with no markdown, no backticks, no extra text:
{{
  "narrative": "...",
  "riskLevel": "Low|Medium|High",
  "confidence": <integer 0-100>,
  "keyFindings": ["finding 1", "finding 2", "finding 3"],
  "recommendation": "..."
}}"""

    try:
        completion = client.chat.completions.create(
            model=_GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            temperature=0.2,
            max_tokens=512,
            response_format={"type": "json_object"},
        )
        raw = completion.choices[0].message.content or "{}"
        parsed = json.loads(raw.strip())

        return NarrativeResponse(
            narrative=parsed.get("narrative", "Verification complete."),
            riskLevel=parsed.get("riskLevel", "Low"),
            confidence=int(parsed.get("confidence", 75)),
            keyFindings=parsed.get("keyFindings", ["Blockchain record found"]),
            recommendation=parsed.get(
                "recommendation",
                "Consult your pharmacist if you have any concerns.",
            ),
            model=_GROQ_MODEL,
        )
    except Exception as exc:
        logger.warning("Groq call failed (%s) — returning fallback narrative", exc)
        return _fallback_narrative(body)


# ──────────────────────────  Token Balance  ───────────────────────────────────

_ETH_ADDRESS_PATTERN = re.compile(r"^0x[0-9a-fA-F]{40}$")


@limiter.limit("60/minute")
@app.get("/api/token-balance/{address}", response_model=TokenBalanceResponse)
async def get_token_balance(request: Request, address: str) -> TokenBalanceResponse:
    """Return the PILL token balance for a given wallet address."""
    if not _ETH_ADDRESS_PATTERN.match(address):
        raise HTTPException(status_code=422, detail="Invalid Ethereum address format.")

    # Zero balance returned when PillToken is not yet deployed.
    token_result = _load_token_contract()
    if token_result is None:
        return TokenBalanceResponse(address=address, balance=0.0, symbol="PILL", raw="0")

    try:
        w3, token_contract = token_result
        checksum_address = w3.to_checksum_address(address)
        raw_balance: int = token_contract.functions.balanceOf(checksum_address).call()
        human_balance = raw_balance / (10 ** 18)
        return TokenBalanceResponse(
            address=checksum_address,
            balance=round(human_balance, 4),
            symbol="PILL",
            raw=str(raw_balance),
        )
    except Exception as exc:
        logger.warning("token_balance fetch failed for %s: %s", address, exc)
        return TokenBalanceResponse(address=address, balance=0.0, symbol="PILL", raw="0")


# ──────────────────────────  DAO Proposals  ───────────────────────────────────

class ProposalResponse(BaseModel):
    proposalId: int
    candidate: str          # wallet address of proposed manufacturer
    name: str               # company name
    licenseId: str          # regulatory license ID
    voteCount: int          # current votes (0–5)
    quorum: int             # required votes (always 3)
    executed: bool          # True when quorum was reached and mfg was authorized
    status: str             # "PENDING" | "APPROVED"


@limiter.limit("30/minute")
@app.get("/api/proposals", response_model=list[ProposalResponse])
async def get_proposals(request: Request) -> list[ProposalResponse]:
    """Return all DAO manufacturer authorization proposals with vote counts."""
    try:
        _, contract = _load_contract()
        total: int = contract.functions.proposalCount().call()
        result: list[ProposalResponse] = []

        for proposal_id in range(total):
            try:
                raw = contract.functions.getProposal(proposal_id).call()
                # returns: (candidate, name, licenseId, voteCount, executed)
                candidate  = raw[0]
                name       = raw[1]
                license_id = raw[2]
                vote_count = int(raw[3])
                executed   = bool(raw[4])
                result.append(ProposalResponse(
                    proposalId=proposal_id,
                    candidate=candidate,
                    name=name,
                    licenseId=license_id,
                    voteCount=vote_count,
                    quorum=3,
                    executed=executed,
                    status="APPROVED" if executed else "PENDING",
                ))
            except Exception as inner_exc:
                logger.warning("Failed to fetch proposal #%d: %s", proposal_id, inner_exc)

        return result

    except Exception as exc:
        logger.error("get_proposals failed: %s", exc)
        # Return empty list rather than 500 so the DAO panel degrades gracefully.
        return []
