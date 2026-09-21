"""Iter24 regression: stage workers attribution, payroll stage aggregates, and ready unpaid lock."""

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
    """HTTP module: shared session for iter24 regression flow."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def produksi_ctx(api_client):
    """Auth module: login as produksi user 'joko' to validate stage worker attribution."""
    login = api_client.post(f"{API}/auth/login", json={"username": "joko", "password": "pegawai123"})
    assert login.status_code == 200, login.text
    payload = login.json()
    employee = payload.get("employee") or {}
    assert employee.get("id"), "Missing employee id for joko"
    assert employee.get("outlet_id"), "Missing outlet_id for joko"
    return {
        "employee_id": employee["id"],
        "employee_name": employee.get("name") or "Joko Produksi",
        "outlet_id": employee["outlet_id"],
    }


@pytest.fixture(scope="module")
def tracked_ids():
    """Cleanup module: remove TEST_iter24 orders/customers and related rows."""
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

            await conn.execute("delete from work_logs where order_id in (select id from orders where notes like 'TEST_iter24_%')")
            await conn.execute("delete from transactions where order_id in (select id from orders where notes like 'TEST_iter24_%')")
            await conn.execute("delete from order_items where order_id in (select id from orders where notes like 'TEST_iter24_%')")
            await conn.execute("delete from orders where notes like 'TEST_iter24_%'")
            await conn.execute("delete from customers where name like 'TEST_iter24_%'")
        finally:
            await conn.close()

    asyncio.run(_cleanup())


def _payroll_row(api_client, outlet_id: str, employee_id: str, period: str):
    res = api_client.get(f"{API}/payroll", params={"outlet_id": outlet_id, "period": period})
    assert res.status_code == 200, res.text
    rows = (res.json() or {}).get("employees") or []
    row = next((r for r in rows if r.get("employee_id") == employee_id), None)
    assert row is not None, f"Employee {employee_id} missing in payroll"
    return row


def _create_customer(api_client, outlet_id: str, tracked_ids) -> dict:
    suffix = str(uuid.uuid4().int)[-8:]
    payload = {
        "name": f"TEST_iter24_customer_{suffix}",
        "phone": f"08{suffix}24",
        "address": "TEST_iter24",
        "outlet_id": outlet_id,
    }
    res = api_client.post(f"{API}/customers", json=payload)
    assert res.status_code == 200, res.text
    customer = res.json()
    tracked_ids["customers"].append(customer["id"])
    return customer


def _pick_service(api_client, outlet_id: str) -> dict:
    res = api_client.get(f"{API}/services", params={"outlet_id": outlet_id})
    assert res.status_code == 200, res.text
    services = res.json()
    assert services, "No services found"
    kg_svc = next((s for s in services if s.get("unit") == "kg" and float(s.get("price") or 0) > 0), None)
    return kg_svc or services[0]


@pytest.fixture(scope="module")
def iter24_flow(api_client, produksi_ctx, tracked_ids):
    """Order lifecycle module: received→ready captures stage workers, unpaid ready locked, then paid can complete."""
    period = date.today().strftime("%Y-%m")
    baseline_payroll = _payroll_row(api_client, produksi_ctx["outlet_id"], produksi_ctx["employee_id"], period)

    customer = _create_customer(api_client, produksi_ctx["outlet_id"], tracked_ids)
    svc = _pick_service(api_client, produksi_ctx["outlet_id"])
    qty = max(float(svc.get("min_kg") or 0), 4.0) if svc.get("unit") == "kg" else 1.0
    order_payload = {
        "customer_id": customer["id"],
        "outlet_id": produksi_ctx["outlet_id"],
        "delivery_type": "self",
        "notes": f"TEST_iter24_stage_workers_{uuid.uuid4().hex[:6]}",
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
    created = api_client.post(f"{API}/orders", json=order_payload)
    assert created.status_code == 200, created.text
    order = created.json()
    tracked_ids["orders"].append(order["id"])

    # Stage module: advance order to ready while attributing Joko on each production stage.
    body = {
        "employee_id": produksi_ctx["employee_id"],
        "employee_name": produksi_ctx["employee_name"],
    }
    expected_statuses = ["washing", "drying", "ironing", "packing", "ready"]
    for expected in expected_statuses:
        moved = api_client.post(f"{API}/orders/{order['id']}/advance", json=body)
        assert moved.status_code == 200, moved.text
        assert moved.json().get("status") == expected

    # Payment lock module: ready order with unpaid status must be blocked.
    blocked = api_client.post(f"{API}/orders/{order['id']}/advance", json=body)
    assert blocked.status_code == 400, blocked.text

    paid = api_client.post(f"{API}/orders/{order['id']}/pay", json={"method": "cash"})
    assert paid.status_code == 200, paid.text
    assert paid.json().get("payment_status") == "paid"

    completed = api_client.post(f"{API}/orders/{order['id']}/advance", json=body)
    assert completed.status_code == 200, completed.text
    assert completed.json().get("status") == "completed"

    detail = api_client.get(f"{API}/orders/{order['id']}")
    assert detail.status_code == 200, detail.text

    after_payroll = _payroll_row(api_client, produksi_ctx["outlet_id"], produksi_ctx["employee_id"], period)
    return {
        "order": detail.json(),
        "employee_name": produksi_ctx["employee_name"],
        "qty": qty if svc.get("unit") == "kg" else 0.0,
        "baseline_payroll": baseline_payroll,
        "after_payroll": after_payroll,
    }


class TestIter24StageWorkersPayrollReadyLock:
    """Iter24 features module: stage_workers response, payroll stage kg fields, and unpaid-ready blocking."""

    def test_get_order_includes_stage_workers_for_all_production_stages(self, iter24_flow):
        order = iter24_flow["order"]
        workers = order.get("stage_workers") or {}
        expected_name = iter24_flow["employee_name"]

        for stage in ("washing", "drying", "ironing", "packing"):
            assert stage in workers, f"Missing stage_workers[{stage}]"
            assert workers[stage].get("employee_name") == expected_name

    def test_payroll_returns_stage_kg_fields_and_processed_kg_without_500(self, iter24_flow):
        before = iter24_flow["baseline_payroll"]
        after = iter24_flow["after_payroll"]
        qty = float(iter24_flow["qty"])

        for field in ("wash_kg", "dry_kg", "iron_kg", "packing_kg", "processed_kg"):
            assert field in after
            assert isinstance(after[field], (int, float))

        if qty > 0:
            assert float(after["wash_kg"]) >= float(before.get("wash_kg") or 0) + qty
            assert float(after["dry_kg"]) >= float(before.get("dry_kg") or 0) + qty
            assert float(after["iron_kg"]) >= float(before.get("iron_kg") or 0) + qty
            assert float(after["packing_kg"]) >= float(before.get("packing_kg") or 0) + qty

        expected_processed = float(after["wash_kg"]) + float(after["dry_kg"]) + float(after["iron_kg"]) + float(after["packing_kg"])
        assert float(after["processed_kg"]) == pytest.approx(expected_processed)