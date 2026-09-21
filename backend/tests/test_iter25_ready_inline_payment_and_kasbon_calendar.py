"""Iter25 regression: ready inline payment flow and kasbon selected-date persistence."""

import asyncio
import os
import uuid
from datetime import date
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
    """HTTP module: shared session for iter25 regression API checks."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def produksi_ctx(api_client):
    """Auth module: login as produksi account to create/advance ready test orders."""
    login = api_client.post(f"{API}/auth/login", json={"username": "joko", "password": "pegawai123"})
    if login.status_code != 200:
        pytest.skip(f"Pegawai login failed: {login.status_code} {login.text}")
    payload = login.json()
    employee = payload.get("employee") or {}
    outlet_id = employee.get("outlet_id")
    employee_id = employee.get("id")
    if not outlet_id or not employee_id:
        pytest.skip("Pegawai session missing outlet_id or employee id")
    return {
        "outlet_id": outlet_id,
        "employee_id": employee_id,
        "employee_name": employee.get("name") or "Joko Produksi",
    }


@pytest.fixture(scope="module")
def tracked_ids():
    """Cleanup module: remove TEST_iter25 orders/customers/kasbon and related transaction/work_logs."""
    tracked = {"orders": [], "customers": [], "kasbon": []}
    yield tracked

    async def _cleanup():
        conn = await asyncpg.connect(**DB_CFG, statement_cache_size=0)
        try:
            if tracked["kasbon"]:
                kasbon_ids = [uuid.UUID(x) for x in tracked["kasbon"]]
                await conn.execute("delete from kasbon where id = any($1::uuid[])", kasbon_ids)

            if tracked["orders"]:
                order_ids = [uuid.UUID(x) for x in tracked["orders"]]
                await conn.execute("delete from work_logs where order_id = any($1::uuid[])", order_ids)
                await conn.execute("delete from transactions where order_id = any($1::uuid[])", order_ids)
                await conn.execute("delete from order_items where order_id = any($1::uuid[])", order_ids)
                await conn.execute("delete from orders where id = any($1::uuid[])", order_ids)

            if tracked["customers"]:
                customer_ids = [uuid.UUID(x) for x in tracked["customers"]]
                await conn.execute("delete from customers where id = any($1::uuid[])", customer_ids)

            await conn.execute("delete from kasbon where note like 'TEST_iter25_%'")
            await conn.execute("delete from work_logs where order_id in (select id from orders where notes like 'TEST_iter25_%')")
            await conn.execute("delete from transactions where order_id in (select id from orders where notes like 'TEST_iter25_%')")
            await conn.execute("delete from order_items where order_id in (select id from orders where notes like 'TEST_iter25_%')")
            await conn.execute("delete from orders where notes like 'TEST_iter25_%'")
            await conn.execute("delete from customers where name like 'TEST_iter25_%'")
        finally:
            await conn.close()

    asyncio.run(_cleanup())


def _create_customer(api_client, outlet_id: str, tracked_ids) -> dict:
    suffix = str(uuid.uuid4().int)[-8:]
    payload = {
        "name": f"TEST_iter25_customer_{suffix}",
        "phone": f"08{suffix}25",
        "address": "TEST iter25",
        "outlet_id": outlet_id,
    }
    created = api_client.post(f"{API}/customers", json=payload)
    assert created.status_code == 200, created.text
    customer = created.json()
    tracked_ids["customers"].append(customer["id"])
    return customer


def _pick_service(api_client, outlet_id: str) -> dict:
    res = api_client.get(f"{API}/services", params={"outlet_id": outlet_id})
    assert res.status_code == 200, res.text
    rows = res.json() or []
    assert rows, "No services available"
    kg_service = next((s for s in rows if s.get("unit") == "kg" and float(s.get("price") or 0) > 0), None)
    return kg_service or rows[0]


def _create_ready_unpaid_order(api_client, produksi_ctx, tracked_ids, note_prefix: str) -> dict:
    customer = _create_customer(api_client, produksi_ctx["outlet_id"], tracked_ids)
    service = _pick_service(api_client, produksi_ctx["outlet_id"])
    qty = max(float(service.get("min_kg") or 0), 4.0) if service.get("unit") == "kg" else 1.0
    payload = {
        "customer_id": customer["id"],
        "outlet_id": produksi_ctx["outlet_id"],
        "delivery_type": "self",
        "notes": f"{note_prefix}_{uuid.uuid4().hex[:6]}",
        "payment_status": "unpaid",
        "payment_method": "qris",
        "created_by": "pegawai",
        "items": [
            {
                "service_id": service["id"],
                "service_name": service["name"],
                "unit": service["unit"],
                "qty": qty,
                "price": float(service["price"]),
            }
        ],
    }
    created = api_client.post(f"{API}/orders", json=payload)
    assert created.status_code == 200, created.text
    order = created.json()
    tracked_ids["orders"].append(order["id"])

    body = {"employee_id": produksi_ctx["employee_id"], "employee_name": produksi_ctx["employee_name"]}
    for expected in ("washing", "drying", "ironing", "packing", "ready"):
        moved = api_client.post(f"{API}/orders/{order['id']}/advance", json=body)
        assert moved.status_code == 200, moved.text
        assert moved.json().get("status") == expected
    return order


class TestIter25ReadyInlinePaymentKasbonCalendar:
    """Iter25 module: unpaid-ready lock, pay endpoint status update, and kasbon_date persistence."""

    @pytest.mark.parametrize("method", ["cash", "emoney"])
    def test_ready_unpaid_can_be_paid_then_completed_and_get_shows_paid(self, api_client, produksi_ctx, tracked_ids, method):
        order = _create_ready_unpaid_order(api_client, produksi_ctx, tracked_ids, "TEST_iter25_ready_inline")
        body = {"employee_id": produksi_ctx["employee_id"], "employee_name": produksi_ctx["employee_name"]}

        blocked = api_client.post(f"{API}/orders/{order['id']}/advance", json=body)
        assert blocked.status_code == 400, blocked.text

        paid = api_client.post(f"{API}/orders/{order['id']}/pay", json={"method": method})
        assert paid.status_code == 200, paid.text
        assert paid.json().get("payment_status") == "paid"
        assert paid.json().get("payment_method") == method

        detail = api_client.get(f"{API}/orders/{order['id']}")
        assert detail.status_code == 200, detail.text
        assert detail.json().get("payment_status") == "paid"
        assert detail.json().get("payment_method") == method

        completed = api_client.post(f"{API}/orders/{order['id']}/advance", json=body)
        assert completed.status_code == 200, completed.text
        assert completed.json().get("status") == "completed"

    def test_kasbon_create_persists_selected_kasbon_date(self, api_client, produksi_ctx, tracked_ids):
        picked_date = date.today().replace(day=min(5, date.today().day)).isoformat()
        note = f"TEST_iter25_kasbon_{uuid.uuid4().hex[:8]}"
        payload = {
            "employee_id": produksi_ctx["employee_id"],
            "outlet_id": produksi_ctx["outlet_id"],
            "amount": 54321,
            "note": note,
            "kasbon_date": picked_date,
        }
        created = api_client.post(f"{API}/kasbon", json=payload)
        assert created.status_code == 200, created.text
        created_row = created.json()
        tracked_ids["kasbon"].append(created_row["id"])
        assert created_row.get("kasbon_date") == picked_date

        period = picked_date[:7]
        listed = api_client.get(f"{API}/kasbon", params={"outlet_id": produksi_ctx["outlet_id"], "period": period})
        assert listed.status_code == 200, listed.text
        rows = listed.json() or []
        match = next((r for r in rows if r.get("id") == created_row["id"]), None)
        assert match is not None
        assert match.get("kasbon_date") == picked_date
        assert match.get("note") == note
