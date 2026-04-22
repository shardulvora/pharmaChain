"""
Basic tests for the PillChain FastAPI backend.

These tests validate endpoint structure and input validation.
Tests that require a live blockchain connection are marked to
continue even if the RPC is unavailable.
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


# ── Health Check ─────────────────────────────────────────────


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


# ── Input Validation ─────────────────────────────────────────


def test_verify_rejects_invalid_batch_id():
    # Batch IDs with special characters should be rejected
    response = client.get("/api/verify/BATCH%20001%3B%20DROP%20TABLE")
    assert response.status_code == 400


def test_verify_rejects_empty_batch_id_chars():
    # Test with characters that don't match the alphanumeric pattern
    response = client.get("/api/verify/batch@#$!")
    assert response.status_code == 400


def test_verify_accepts_valid_batch_id_format():
    """Valid format should pass validation (may fail at blockchain layer)."""
    response = client.get("/api/verify/BATCH001")
    # Will be 200 (if blockchain is up) or 500 (if not), but NOT 400
    assert response.status_code != 400


def test_verify_accepts_hyphens_and_underscores():
    response = client.get("/api/verify/BATCH-001_A")
    assert response.status_code != 400


# ── Endpoint Existence ───────────────────────────────────────


def test_batches_endpoint_exists():
    response = client.get("/api/batches")
    # Should return 200 or 500 (no blockchain), never 404
    assert response.status_code != 404


def test_stats_endpoint_exists():
    response = client.get("/api/stats")
    assert response.status_code != 404


def test_seeded_endpoint_exists():
    response = client.get("/api/seeded")
    assert response.status_code != 404


# ── OpenAPI / Schema ─────────────────────────────────────────


def test_openapi_schema_available():
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert schema["info"]["title"] == "PillChain API"
    assert "/api/verify/{batch_id}" in schema["paths"]
    assert "/api/batches" in schema["paths"]
    assert "/api/stats" in schema["paths"]
