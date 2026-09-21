"""Iter17 regression: order advance idempotency/target validation and 3-day photo purge on list."""

import asyncio
import os
import uuid
from pathlib import Path

import asyncpg
import pytest
import requests
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / "backend" / ".env")
load_dotenv(ROOT / "frontend" / ".env")

BASE_URL = (os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("EXPO_BACKEND_URL/EXPO_PUBLIC_BACKEND_URL is missing")
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
    """Shared HTTP client for auth + order CRUD lifecycle checks."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def pegawai_context(api_client):
    # Auth module: use documented employee credential from test_credentials
    login = api_client.post(f"{API}/auth/login", json={"username": "Pegawai", "password": "pegawai123"})
    assert login.status_code == 200, login.text
    payload = login.json()
    assert payload.get("role") == "pegawai"
    outlet_id = payload.get("employee", {}).get("outlet_id")
    employee_id = payload.get("employee", {}).get("id")
    assert outlet_id and employee_id
    return {
        "outlet_id": outlet_id,
        "employee_id": employee_id,
        "employee_name": payload.get("employee", {}).get("name") or "Pegawai",
    }


@pytest.fixture(scope="module")
def tracked_ids():
    # Cleanup module: remove generated orders/customers and dependencies
    tracked = {"orders": [], "customers": []}
    yield tracked

    async def _cleanup():
        conn = await asyncpg.connect(**DB_CFG, statement_cache_size=0)
        try:
            if tracked["orders"]:
                order_ids = [uuid.UUID(x) for x in tracked["orders"]]
                await conn.execute("delete from work_logs where order_id = any($1::uuid[])", order_ids)
                await conn.execute("delete from transactions where order_id = any($1::uuid[])", order_ids)
                await conn.execute("delete from order_items where order_id = any($1::uuid[])", order_ids)
                await conn.execute("delete from orders where id = any($1::uuid[])", order_ids)
            if tracked["customers"]:
                customer_ids = [uuid.UUID(x) for x in tracked["customers"]]
                await conn.execute("delete from customers where id = any($1::uuid[])", customer_ids)

            await conn.execute("delete from work_logs where order_id in (select id from orders where notes like 'TEST_iter17_%')")
            await conn.execute("delete from transactions where order_id in (select id from orders where notes like 'TEST_iter17_%')")
            await conn.execute("delete from order_items where order_id in (select id from orders where notes like 'TEST_iter17_%')")
            await conn.execute("delete from orders where notes like 'TEST_iter17_%'")
            await conn.execute("delete from customers where name like 'TEST_iter17_%'")
        finally:
            await conn.close()

    asyncio.run(_cleanup())


def _create_customer(api_client, outlet_id: str, tracked_ids) -> dict:
    suffix = str(uuid.uuid4().int)[-8:]
    payload = {
        "name": f"TEST_iter17_customer_{suffix}",
        "phone": f"08{suffix}17",
        "address": "TEST_iter17",
        "outlet_id": outlet_id,
    }
    res = api_client.post(f"{API}/customers", json=payload)
    assert res.status_code == 200, res.text
    customer = res.json()
    tracked_ids["customers"].append(customer["id"])
    return customer


def _create_order(api_client, outlet_id: str, customer_id: str, tracked_ids, note: str) -> dict:
    services = api_client.get(f"{API}/services", params={"outlet_id": outlet_id})
    assert services.status_code == 200, services.text
    rows = services.json()
    assert rows, "No service found for outlet"
    svc = rows[0]
    min_kg = float(svc.get("min_kg") or 0)
    qty = max(3.0, min_kg) if svc["unit"] == "kg" else 1
    payload = {
        "customer_id": customer_id,
        "outlet_id": outlet_id,
        "delivery_type": "self",
        "notes": note,
        "payment_status": "unpaid",
        "payment_method": "qris",
        "created_by": "pegawai",
        "items": [
            {
                "service_id": svc["id"],
                "service_name": svc["name"],
                "unit": svc["unit"],
                "qty": qty,
                "price": float(svc["price"]),
            }
        ],
    }
    create = api_client.post(f"{API}/orders", json=payload)
    assert create.status_code == 200, create.text
    order = create.json()
    tracked_ids["orders"].append(order["id"])
    return order


class TestOrderAdvanceTargetStatus:
    """Order advance module: idempotent same-target and strict next-stage validation."""

    def test_advance_idempotent_and_invalid_target_conflict(self, api_client, pegawai_context, tracked_ids):
        customer = _create_customer(api_client, pegawai_context["outlet_id"], tracked_ids)
        order = _create_order(
            api_client,
            pegawai_context["outlet_id"],
            customer["id"],
            tracked_ids,
            "TEST_iter17_advance_target",
        )

        cur = api_client.get(f"{API}/orders/{order['id']}")
        assert cur.status_code == 200, cur.text
        assert cur.json()["status"] == "received"

        same = api_client.post(
            f"{API}/orders/{order['id']}/advance",
            json={
                "target_status": "received",
                "employee_id": pegawai_context["employee_id"],
                "employee_name": pegawai_context["employee_name"],
            },
        )
        assert same.status_code == 200, same.text
        assert same.json()["status"] == "received"

        bad = api_client.post(
            f"{API}/orders/{order['id']}/advance",
            json={
                "target_status": "drying",
                "employee_id": pegawai_context["employee_id"],
                "employee_name": pegawai_context["employee_name"],
            },
        )
        assert bad.status_code == 409, bad.text

        nxt = api_client.post(
            f"{API}/orders/{order['id']}/advance",
            json={
                "target_status": "washing",
                "employee_id": pegawai_context["employee_id"],
                "employee_name": pegawai_context["employee_name"],
            },
        )
        assert nxt.status_code == 200, nxt.text
        assert nxt.json()["status"] == "washing"

        verify = api_client.get(f"{API}/orders/{order['id']}")
        assert verify.status_code == 200, verify.text
        assert verify.json()["status"] == "washing"


class TestPhotoPurgeOnListOrders:
    """Photo retention module: stale order photos are purged when GET /orders is called."""

    def test_list_orders_purges_stale_photos(self, api_client, pegawai_context, tracked_ids):
        customer = _create_customer(api_client, pegawai_context["outlet_id"], tracked_ids)
        order = _create_order(
            api_client,
            pegawai_context["outlet_id"],
            customer["id"],
            tracked_ids,
            "TEST_iter17_photo_purge",
        )

        async def _mark_old_with_photos(order_id: str):
            conn = await asyncpg.connect(**DB_CFG, statement_cache_size=0)
            try:
                await conn.execute(
                    """update orders
                       set photos='["https://example.com/test-old-photo.jpg"]'::jsonb,
                           photos_uploaded_at=now() - interval '4 days',
                           photos_purged_at=null,
                           updated_at=now()
                       where id=$1::uuid""",
                    order_id,
                )
            finally:
                await conn.close()

        asyncio.run(_mark_old_with_photos(order["id"]))

        before = api_client.get(f"{API}/orders/{order['id']}")
        assert before.status_code == 200, before.text
        assert isinstance(before.json().get("photos"), list)
        assert len(before.json().get("photos") or []) == 1

        listed = api_client.get(
            f"{API}/orders",
            params={"outlet_id": pegawai_context["outlet_id"], "limit": 200},
        )
        assert listed.status_code == 200, listed.text

        after = api_client.get(f"{API}/orders/{order['id']}")
        assert after.status_code == 200, after.text
        assert after.json().get("photos") == []
        assert after.json().get("photos_purged_at") is not None
