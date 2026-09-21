"""Iter26 regression: stage attribution persistence + ready payment lock/pay flow."""

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
    """HTTP module: shared session for iter26 regression API checks."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def produksi_ctx(api_client):
    """Auth module: login produksi Joko for stage attribution checks."""
    login = api_client.post(f"{API}/auth/login", json={"username": "joko", "password": "pegawai123"})
    if login.status_code != 200:
        pytest.skip(f"Login Joko gagal: {login.status_code} {login.text}")
    employee = (login.json() or {}).get("employee") or {}
    if not employee.get("id") or not employee.get("outlet_id"):
        pytest.skip("Session Joko tidak punya employee.id atau outlet_id")
    return {
        "employee_id": employee["id"],
        "employee_name": employee.get("name") or "Joko Produksi",
        "outlet_id": employee["outlet_id"],
    }


@pytest.fixture(scope="module")
def tracked_ids():
    """Cleanup module: remove TEST_iter26 backend entities after tests."""
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

            await conn.execute("delete from work_logs where order_id in (select id from orders where notes like 'TEST_iter26_backend_%')")
            await conn.execute("delete from transactions where order_id in (select id from orders where notes like 'TEST_iter26_backend_%')")
            await conn.execute("delete from order_items where order_id in (select id from orders where notes like 'TEST_iter26_backend_%')")
            await conn.execute("delete from orders where notes like 'TEST_iter26_backend_%'")
            await conn.execute("delete from customers where name like 'TEST_iter26_backend_%'")
        finally:
            await conn.close()

    asyncio.run(_cleanup())


def _pick_service(api_client, outlet_id: str) -> dict:
    services = api_client.get(f"{API}/services", params={"outlet_id": outlet_id})
    assert services.status_code == 200, services.text
    rows = services.json() or []
    assert rows, "Services outlet kosong"
    return next((s for s in rows if s.get("unit") == "kg" and float(s.get("price") or 0) > 0), rows[0])


def _create_customer(api_client, outlet_id: str, tracked_ids) -> str:
    suffix = str(uuid.uuid4().int)[-8:]
    payload = {
        "name": f"TEST_iter26_backend_{suffix}",
        "phone": f"08{suffix}26",
        "address": "TEST iter26 backend",
        "outlet_id": outlet_id,
    }
    created = api_client.post(f"{API}/customers", json=payload)
    assert created.status_code == 200, created.text
    cid = created.json()["id"]
    tracked_ids["customers"].append(cid)
    return cid


def _create_order(api_client, produksi_ctx, tracked_ids, note_prefix: str, payment_status: str = "unpaid") -> dict:
    service = _pick_service(api_client, produksi_ctx["outlet_id"])
    customer_id = _create_customer(api_client, produksi_ctx["outlet_id"], tracked_ids)
    qty = max(float(service.get("min_kg") or 0), 4.0) if service.get("unit") == "kg" else 1.0
    payload = {
        "customer_id": customer_id,
        "outlet_id": produksi_ctx["outlet_id"],
        "items": [{
            "service_id": service["id"],
            "service_name": service["name"],
            "unit": service["unit"],
            "qty": qty,
            "price": float(service["price"]),
        }],
        "delivery_type": "self",
        "notes": f"{note_prefix}_{uuid.uuid4().hex[:6]}",
        "payment_status": payment_status,
        "payment_method": "cash" if payment_status == "paid" else "qris",
        "created_by": "pegawai",
    }
    created = api_client.post(f"{API}/orders", json=payload)
    assert created.status_code == 200, created.text
    order = created.json()
    tracked_ids["orders"].append(order["id"])
    return order


class TestIter26StageAttributionAndReadyPayment:
    """Orders module: stage attribution persistence and ready payment regression."""

    def test_washing_stage_shows_worker_name_after_advance_and_refetch(self, api_client, produksi_ctx, tracked_ids):
        order = _create_order(api_client, produksi_ctx, tracked_ids, "TEST_iter26_backend_stage")
        body = {"employee_id": produksi_ctx["employee_id"], "employee_name": produksi_ctx["employee_name"]}

        to_washing = api_client.post(f"{API}/orders/{order['id']}/advance", json=body)
        assert to_washing.status_code == 200, to_washing.text
        assert to_washing.json().get("status") == "washing"

        to_drying = api_client.post(f"{API}/orders/{order['id']}/advance", json=body)
        assert to_drying.status_code == 200, to_drying.text
        assert to_drying.json().get("status") == "drying"

        detail1 = api_client.get(f"{API}/orders/{order['id']}")
        assert detail1.status_code == 200, detail1.text
        stage_workers = detail1.json().get("stage_workers") or {}
        assert stage_workers.get("washing", {}).get("employee_name") == produksi_ctx["employee_name"]

        detail2 = api_client.get(f"{API}/orders/{order['id']}")
        assert detail2.status_code == 200, detail2.text
        assert (detail2.json().get("stage_workers") or {}).get("washing", {}).get("employee_name") == produksi_ctx["employee_name"]

    def test_ready_unpaid_is_blocked_then_pay_then_complete(self, api_client, produksi_ctx, tracked_ids):
        order = _create_order(api_client, produksi_ctx, tracked_ids, "TEST_iter26_backend_ready")
        body = {"employee_id": produksi_ctx["employee_id"], "employee_name": produksi_ctx["employee_name"]}

        for status in ("washing", "drying", "ironing", "packing", "ready"):
            moved = api_client.post(f"{API}/orders/{order['id']}/advance", json=body)
            assert moved.status_code == 200, moved.text
            assert moved.json().get("status") == status

        blocked = api_client.post(f"{API}/orders/{order['id']}/advance", json=body)
        assert blocked.status_code == 400, blocked.text

        paid = api_client.post(f"{API}/orders/{order['id']}/pay", json={"method": "emoney"})
        assert paid.status_code == 200, paid.text
        assert paid.json().get("payment_status") == "paid"
        assert paid.json().get("payment_method") == "emoney"

        completed = api_client.post(f"{API}/orders/{order['id']}/advance", json=body)
        assert completed.status_code == 200, completed.text
        assert completed.json().get("status") == "completed"

    def test_ready_list_keeps_paid_and_unpaid_orders_distinct(self, api_client, produksi_ctx, tracked_ids):
        unpaid = _create_order(api_client, produksi_ctx, tracked_ids, "TEST_iter26_backend_ready_unpaid", payment_status="unpaid")
        paid = _create_order(api_client, produksi_ctx, tracked_ids, "TEST_iter26_backend_ready_paid", payment_status="paid")
        body = {"employee_id": produksi_ctx["employee_id"], "employee_name": produksi_ctx["employee_name"]}

        for oid in (unpaid["id"], paid["id"]):
            for status in ("washing", "drying", "ironing", "packing", "ready"):
                moved = api_client.post(f"{API}/orders/{oid}/advance", json=body)
                assert moved.status_code == 200, moved.text
                assert moved.json().get("status") == status

        ready = api_client.get(f"{API}/orders", params={"status": "ready", "outlet_id": produksi_ctx["outlet_id"], "sort": "fifo"})
        assert ready.status_code == 200, ready.text
        rows = ready.json() or []
        by_id = {r.get("id"): r for r in rows}
        assert by_id.get(unpaid["id"], {}).get("payment_status") == "unpaid"
        assert by_id.get(paid["id"], {}).get("payment_status") == "paid"
