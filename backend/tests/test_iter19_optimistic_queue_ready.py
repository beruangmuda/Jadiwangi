"""Iter19 regression: queue/ready counts integrity across advance and pickup completion."""

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
    """HTTP client module: shared API session for auth + CRUD."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def pegawai_context(api_client):
    """Auth module: use documented employee credentials."""
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
    """Cleanup module: delete TEST_ customer/order data created by this suite."""
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

            await conn.execute("delete from work_logs where order_id in (select id from orders where notes like 'TEST_iter19_%')")
            await conn.execute("delete from transactions where order_id in (select id from orders where notes like 'TEST_iter19_%')")
            await conn.execute("delete from order_items where order_id in (select id from orders where notes like 'TEST_iter19_%')")
            await conn.execute("delete from orders where notes like 'TEST_iter19_%'")
            await conn.execute("delete from customers where name like 'TEST_iter19_%'")
        finally:
            await conn.close()

    asyncio.run(_cleanup())


def _create_customer(api_client, outlet_id: str, tracked_ids) -> dict:
    suffix = str(uuid.uuid4().int)[-8:]
    payload = {
        "name": f"TEST_iter19_customer_{suffix}",
        "phone": f"08{suffix}19",
        "address": "TEST_iter19",
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


class TestQueueReadyCountsAndCompletion:
    """Order advance module: queue/ready count transitions and completion persistence."""

    def test_ready_count_increments_and_returns_to_zero_after_completed(self, api_client, pegawai_context, tracked_ids):
        outlet_id = pegawai_context["outlet_id"]
        dashboard_before = api_client.get(f"{API}/dashboard", params={"outlet_id": outlet_id})
        assert dashboard_before.status_code == 200, dashboard_before.text
        before_queue = dashboard_before.json()["queue"]

        customer = _create_customer(api_client, outlet_id, tracked_ids)
        order = _create_order(api_client, outlet_id, customer["id"], tracked_ids, "TEST_iter19_ready_count")
        oid = order["id"]

        for _ in ["washing", "drying", "ironing", "packing", "ready"]:
            step = api_client.post(
                f"{API}/orders/{oid}/advance",
                json={"employee_id": pegawai_context["employee_id"], "employee_name": pegawai_context["employee_name"]},
            )
            assert step.status_code == 200, step.text

        ready_list = api_client.get(f"{API}/orders", params={"status": "ready", "sort": "fifo", "outlet_id": outlet_id})
        assert ready_list.status_code == 200, ready_list.text
        ready_ids = {item["id"] for item in ready_list.json()}
        assert oid in ready_ids

        dashboard_ready = api_client.get(f"{API}/dashboard", params={"outlet_id": outlet_id})
        assert dashboard_ready.status_code == 200, dashboard_ready.text
        q_ready = dashboard_ready.json()["queue"]
        assert q_ready["ready"] >= before_queue["ready"] + 1
        assert q_ready["in_progress"] >= 0 and q_ready["ready"] >= 0

        complete = api_client.post(
            f"{API}/orders/{oid}/advance",
            json={"employee_id": pegawai_context["employee_id"], "employee_name": pegawai_context["employee_name"]},
        )
        assert complete.status_code == 200, complete.text
        assert complete.json()["status"] == "completed"

        verify = api_client.get(f"{API}/orders/{oid}")
        assert verify.status_code == 200, verify.text
        assert verify.json()["status"] == "completed"

        ready_list_after = api_client.get(f"{API}/orders", params={"status": "ready", "sort": "fifo", "outlet_id": outlet_id})
        assert ready_list_after.status_code == 200, ready_list_after.text
        ready_ids_after = {item["id"] for item in ready_list_after.json()}
        assert oid not in ready_ids_after

        dashboard_after = api_client.get(f"{API}/dashboard", params={"outlet_id": outlet_id})
        assert dashboard_after.status_code == 200, dashboard_after.text
        q_after = dashboard_after.json()["queue"]
        assert q_after["ready"] >= 0 and q_after["in_progress"] >= 0

    def test_advance_with_stale_target_returns_conflict(self, api_client, pegawai_context, tracked_ids):
        customer = _create_customer(api_client, pegawai_context["outlet_id"], tracked_ids)
        order = _create_order(api_client, pegawai_context["outlet_id"], customer["id"], tracked_ids, "TEST_iter19_stale_target")

        conflict = api_client.post(
            f"{API}/orders/{order['id']}/advance",
            json={
                "target_status": "packing",
                "employee_id": pegawai_context["employee_id"],
                "employee_name": pegawai_context["employee_name"],
            },
        )
        assert conflict.status_code == 409, conflict.text
