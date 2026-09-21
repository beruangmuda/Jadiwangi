"""Iter13 regression: payment methods, pipeline advance to ready, and ready listing."""

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

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL") or "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL/EXPO_BACKEND_URL is missing")
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
    """Shared HTTP client for iteration 13 payment + timeline checks."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def employee_context(api_client):
    # Auth module: ensure pegawai credential from memory file can login and provide outlet context
    login = api_client.post(f"{API}/auth/login", json={"username": "Pegawai", "password": "pegawai123"})
    assert login.status_code == 200, login.text
    payload = login.json()
    assert payload.get("role") == "pegawai"
    outlet_id = payload.get("employee", {}).get("outlet_id")
    assert outlet_id, "Employee outlet_id missing"
    return {"outlet_id": outlet_id}


@pytest.fixture(scope="module")
def tracked_ids():
    # Orders/payment module cleanup: delete all TEST_iter13 entities (orders, transactions, work_logs, customers)
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
                cust_ids = [uuid.UUID(x) for x in tracked["customers"]]
                await conn.execute("delete from customers where id = any($1::uuid[])", cust_ids)

            await conn.execute("delete from work_logs where order_id in (select id from orders where notes like 'TEST_iter13_%')")
            await conn.execute("delete from transactions where order_id in (select id from orders where notes like 'TEST_iter13_%')")
            await conn.execute("delete from order_items where order_id in (select id from orders where notes like 'TEST_iter13_%')")
            await conn.execute("delete from orders where notes like 'TEST_iter13_%'")
            await conn.execute("delete from customers where name like 'TEST_iter13_%'")
        finally:
            await conn.close()

    asyncio.run(_cleanup())


def _create_test_customer(api_client, outlet_id: str, tracked_ids) -> dict:
    suffix = str(uuid.uuid4().int)[-8:]
    payload = {
        "name": f"TEST_iter13_customer_{suffix}",
        "phone": f"08{suffix}55",
        "address": "TEST_iter13 alamat",
        "outlet_id": outlet_id,
    }
    created = api_client.post(f"{API}/customers", json=payload)
    assert created.status_code == 200, created.text
    customer = created.json()
    tracked_ids["customers"].append(customer["id"])
    return customer


def _service_for_outlet(api_client, outlet_id: str) -> dict:
    services = api_client.get(f"{API}/services", params={"outlet_id": outlet_id})
    assert services.status_code == 200, services.text
    rows = services.json()
    assert rows, "No services in outlet"
    return rows[0]


def _create_unpaid_order(api_client, outlet_id: str, customer_id: str, tracked_ids, note: str) -> dict:
    svc = _service_for_outlet(api_client, outlet_id)
    payload = {
        "customer_id": customer_id,
        "outlet_id": outlet_id,
        "delivery_type": "self",
        "notes": note,
        "payment_status": "unpaid",
        "payment_method": "qris",
        "created_by": "pegawai",
        "express": False,
        "items": [
            {
                "service_id": svc["id"],
                "service_name": svc["name"],
                "unit": svc["unit"],
                "qty": 2,
                "price": float(svc["price"]),
            }
        ],
    }
    created = api_client.post(f"{API}/orders", json=payload)
    assert created.status_code == 200, created.text
    order = created.json()
    tracked_ids["orders"].append(order["id"])
    return order


class TestIter13PaymentAndPipeline:
    """Critical order API flows tied to Tunai/QRIS/E-Money payment and ironing→packing→ready pipeline."""

    @pytest.mark.parametrize("method", ["cash", "qris", "emoney"])
    def test_unpaid_order_can_be_paid_with_supported_methods(self, api_client, employee_context, tracked_ids, method):
        customer = _create_test_customer(api_client, employee_context["outlet_id"], tracked_ids)
        order = _create_unpaid_order(
            api_client,
            employee_context["outlet_id"],
            customer["id"],
            tracked_ids,
            f"TEST_iter13_pay_{method}",
        )

        paid = api_client.post(f"{API}/orders/{order['id']}/pay", json={"method": method})
        assert paid.status_code == 200, paid.text
        paid_order = paid.json()
        assert paid_order["payment_status"] == "paid"
        assert paid_order["payment_method"] == method

        detail = api_client.get(f"{API}/orders/{order['id']}")
        assert detail.status_code == 200, detail.text
        assert detail.json()["payment_status"] == "paid"

    def test_ironing_advances_to_packing_then_ready_and_visible_in_ready_list(self, api_client, employee_context, tracked_ids):
        customer = _create_test_customer(api_client, employee_context["outlet_id"], tracked_ids)
        order = _create_unpaid_order(
            api_client,
            employee_context["outlet_id"],
            customer["id"],
            tracked_ids,
            "TEST_iter13_timeline",
        )

        set_ironing = api_client.patch(f"{API}/orders/{order['id']}/status", json={"status": "ironing"})
        assert set_ironing.status_code == 200, set_ironing.text
        assert set_ironing.json()["status"] == "ironing"

        to_packing = api_client.post(f"{API}/orders/{order['id']}/advance", json={"employee_name": "TEST Iter13"})
        assert to_packing.status_code == 200, to_packing.text
        assert to_packing.json()["status"] == "packing"

        to_ready = api_client.post(f"{API}/orders/{order['id']}/advance", json={"employee_name": "TEST Iter13"})
        assert to_ready.status_code == 200, to_ready.text
        assert to_ready.json()["status"] == "ready"

        ready_list = api_client.get(
            f"{API}/orders",
            params={"status": "ready", "outlet_id": employee_context["outlet_id"], "sort": "fifo", "limit": 200},
        )
        assert ready_list.status_code == 200, ready_list.text
        ready_ids = [row["id"] for row in ready_list.json()]
        assert order["id"] in ready_ids
