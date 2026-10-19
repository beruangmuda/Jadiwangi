"""Iter28 regression: Midtrans Snap non-secret safety and structural checks."""

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
    raise RuntimeError("EXPO_BACKEND_URL/EXPO_PUBLIC_BACKEND_URL tidak ditemukan")
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
    """HTTP module: shared session for Midtrans safety tests."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def tracked_ids():
    """Cleanup module: remove TEST_iter28 rows after test run."""
    tracked = {"orders": [], "customers": []}
    yield tracked

    async def _cleanup():
        conn = await asyncpg.connect(**DB_CFG, statement_cache_size=0)
        try:
            if tracked["orders"]:
                order_ids = tracked["orders"]
                await conn.execute("delete from transactions where order_id = any($1::uuid[])", order_ids)
                await conn.execute("delete from order_items where order_id = any($1::uuid[])", order_ids)
                await conn.execute("delete from work_logs where order_id = any($1::uuid[])", order_ids)
                await conn.execute("delete from orders where id = any($1::uuid[])", order_ids)
            if tracked["customers"]:
                customer_ids = tracked["customers"]
                await conn.execute("delete from customers where id = any($1::uuid[])", customer_ids)

            await conn.execute("delete from transactions where order_id in (select id from orders where notes like 'TEST_iter28_%')")
            await conn.execute("delete from order_items where order_id in (select id from orders where notes like 'TEST_iter28_%')")
            await conn.execute("delete from work_logs where order_id in (select id from orders where notes like 'TEST_iter28_%')")
            await conn.execute("delete from orders where notes like 'TEST_iter28_%'")
            await conn.execute("delete from customers where name like 'TEST_iter28_%'")
        finally:
            await conn.close()

    asyncio.run(_cleanup())


def _pick_outlet_and_service(api_client):
    outlets = api_client.get(f"{API}/outlets")
    assert outlets.status_code == 200, outlets.text
    rows = outlets.json() or []
    assert rows, "Outlet kosong"
    outlet = rows[0]

    services = api_client.get(f"{API}/services", params={"outlet_id": outlet["id"]})
    assert services.status_code == 200, services.text
    srows = services.json() or []
    assert srows, "Layanan outlet kosong"
    svc = next((s for s in srows if float(s.get("price") or 0) > 0), srows[0])
    return outlet, svc


def _create_test_order(api_client, tracked_ids):
    outlet, svc = _pick_outlet_and_service(api_client)
    suffix = str(uuid.uuid4().int)[-8:]
    customer_payload = {
        "name": f"TEST_iter28_{suffix}",
        "phone": f"08{suffix}",
        "address": "TEST_iter28_midtrans",
        "outlet_id": outlet["id"],
    }
    customer_res = api_client.post(f"{API}/customers", json=customer_payload)
    assert customer_res.status_code == 200, customer_res.text
    customer = customer_res.json()
    tracked_ids["customers"].append(customer["id"])

    qty = 2 if svc.get("unit") != "kg" else max(float(svc.get("min_kg") or 0), 3.0)
    order_payload = {
        "customer_id": customer["id"],
        "outlet_id": outlet["id"],
        "items": [{
            "service_id": svc["id"],
            "service_name": svc["name"],
            "unit": svc["unit"],
            "qty": qty,
            "price": float(svc["price"]),
        }],
        "delivery_type": "self",
        "notes": f"TEST_iter28_midtrans_{uuid.uuid4().hex[:8]}",
        "payment_status": "unpaid",
        "payment_method": "qris",
        "created_by": "testing",
    }
    order_res = api_client.post(f"{API}/orders", json=order_payload)
    assert order_res.status_code == 200, order_res.text
    order = order_res.json()
    tracked_ids["orders"].append(order["id"])
    return order


async def _transaction_count_for_order(order_id: str) -> int:
    conn = await asyncpg.connect(**DB_CFG, statement_cache_size=0)
    try:
        return int(await conn.fetchval("select count(*) from transactions where order_id=$1", order_id) or 0)
    finally:
        await conn.close()


class TestIter28MidtransNonSecret:
    """Midtrans module: openapi presence + non-secret safety behavior."""

    def test_openapi_contains_midtrans_endpoints(self, api_client):
        response = api_client.get(f"{BASE_URL}/openapi.json")
        if response.status_code != 200 or "application/json" not in (response.headers.get("content-type") or ""):
            response = api_client.get(f"{BASE_URL}/api/openapi.json")
        assert response.status_code == 200, response.text
        paths = (response.json() or {}).get("paths") or {}
        assert "/api/orders/{oid}/midtrans/snap" in paths
        assert "/api/midtrans/webhook" in paths
        assert "/api/orders/{oid}/payment-status" in paths
        assert "post" in paths["/api/orders/{oid}/midtrans/snap"]
        assert "post" in paths["/api/midtrans/webhook"]
        assert "get" in paths["/api/orders/{oid}/payment-status"]

    def test_snap_without_server_key_returns_503_and_does_not_mark_paid(self, api_client, tracked_ids):
        order = _create_test_order(api_client, tracked_ids)
        tx_before = asyncio.run(_transaction_count_for_order(order["id"]))

        before_status = api_client.get(f"{API}/orders/{order['id']}")
        assert before_status.status_code == 200, before_status.text
        before = before_status.json()
        assert before.get("payment_status") == "unpaid"

        snap = api_client.post(f"{API}/orders/{order['id']}/midtrans/snap", json={})
        assert snap.status_code == 503, snap.text

        after_status = api_client.get(f"{API}/orders/{order['id']}")
        assert after_status.status_code == 200, after_status.text
        after = after_status.json()
        assert after.get("payment_status") == "unpaid"
        assert after.get("payment_method") != "midtrans_snap"
        tx_after = asyncio.run(_transaction_count_for_order(order["id"]))
        assert tx_after == tx_before == 0

    def test_source_contains_restricted_enabled_payments_and_verification_logic(self):
        source = (ROOT / "backend" / "server.py").read_text(encoding="utf-8")

        assert "MIDTRANS_ENABLED_PAYMENTS = [\"gopay\", \"bni_va\", \"bri_va\", \"cimb_va\", \"echannel\", \"permata_va\"]" in source
        assert '"enabled_payments": MIDTRANS_ENABLED_PAYMENTS' in source

        assert 'gross_amount, discount = await midtrans_amount_for_order(conn, row, b.promo_code or "")' in source
        assert 'expected_signature = hashlib.sha512(' in source
        assert 'if notified_amount != expected_amount:' in source
        assert 'transaction_status in MIDTRANS_SUCCESS' in source
        assert "if not exists:" in source
