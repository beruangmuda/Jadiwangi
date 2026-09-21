"""Iter11 customer WhatsApp canonicalization/validation and duplicate checks for /api/customers."""

import asyncio
import os
import uuid
from pathlib import Path

import asyncpg
import pytest
import requests
from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

DB_CFG = {
    "user": os.environ["SUPABASE_DB_USER"],
    "password": os.environ["SUPABASE_DB_PASSWORD"],
    "host": os.environ["SUPABASE_DB_HOST"],
    "port": int(os.environ["SUPABASE_DB_PORT"]),
    "database": os.environ["SUPABASE_DB_NAME"],
}


@pytest.fixture(scope="module")
def api_client():
    """Shared HTTP client for customer endpoint checks."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def owner_outlet_id(api_client):
    """Use owner login to fetch outlet, preferring Kalimulya for employee order context."""
    login = api_client.post(f"{API}/auth/login", json={"username": "owner", "password": "owner123"})
    assert login.status_code == 200, login.text
    outlets = login.json().get("outlets", [])
    assert outlets, "No outlets available"
    pick = next((o for o in outlets if "Kalimulya" in (o.get("name", "") + o.get("city", ""))), outlets[0])
    return pick["id"]


@pytest.fixture(scope="module")
def created_customer_ids():
    """Track created customers and cleanup directly in DB after tests."""
    created: list[str] = []
    yield created

    async def _cleanup():
        conn = await asyncpg.connect(**DB_CFG, statement_cache_size=0)
        try:
            if created:
                ids = [uuid.UUID(cid) for cid in created]
                await conn.execute("delete from customers where id = any($1::uuid[])", ids)
            await conn.execute("delete from customers where name like 'TEST_iter11_%'")
        finally:
            await conn.close()

    asyncio.run(_cleanup())


class TestCustomerWhatsAppRules:
    """Customer create validation: canonical +62, invalid 422, duplicate cross-format 409."""

    def test_create_phone_08_stored_canonical_plus62(self, api_client, owner_outlet_id, created_customer_ids):
        unique = f"{uuid.uuid4().int}"[-10:]
        raw_phone = f"08{unique}"
        payload = {
            "name": f"TEST_iter11_canon_{unique[-4:]}",
            "phone": raw_phone,
            "address": "TEST alamat canonical",
            "outlet_id": owner_outlet_id,
        }
        r = api_client.post(f"{API}/customers", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        created_customer_ids.append(body["id"])
        assert body["phone"].startswith("+62")
        assert body["phone"] == f"+62{raw_phone[1:]}"

    def test_create_invalid_name_returns_422(self, api_client, owner_outlet_id):
        payload = {
            "name": "   ",
            "phone": "081234567890",
            "address": "TEST invalid name",
            "outlet_id": owner_outlet_id,
        }
        r = api_client.post(f"{API}/customers", json=payload)
        assert r.status_code == 422

    def test_create_invalid_phone_returns_422(self, api_client, owner_outlet_id):
        payload = {
            "name": "TEST_iter11_invalid_phone",
            "phone": "12345",
            "address": "TEST invalid phone",
            "outlet_id": owner_outlet_id,
        }
        r = api_client.post(f"{API}/customers", json=payload)
        assert r.status_code == 422

    def test_duplicate_phone_cross_format_returns_409(self, api_client, owner_outlet_id, created_customer_ids):
        unique = f"{uuid.uuid4().int}"[-10:]
        base_08 = f"08{unique}"
        first = {
            "name": f"TEST_iter11_dup_a_{unique[-4:]}",
            "phone": base_08,
            "address": "TEST duplicate A",
            "outlet_id": owner_outlet_id,
        }
        r1 = api_client.post(f"{API}/customers", json=first)
        assert r1.status_code == 200, r1.text
        created_customer_ids.append(r1.json()["id"])

        second = {
            "name": f"TEST_iter11_dup_b_{unique[-4:]}",
            "phone": f"+62{base_08[1:]}",
            "address": "TEST duplicate B",
            "outlet_id": owner_outlet_id,
        }
        r2 = api_client.post(f"{API}/customers", json=second)
        assert r2.status_code == 409, r2.text
