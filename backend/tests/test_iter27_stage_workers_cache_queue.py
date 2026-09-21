"""Iter27 regression: stage worker attribution, payment gate, and ready queue payment status."""

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
    """HTTP module: shared session for API regression checks."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def _login_employee(api_client, username: str, password: str = "pegawai123") -> dict:
    response = api_client.post(f"{API}/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200, response.text
    data = response.json() or {}
    employee = data.get("employee") or {}
    assert employee.get("id"), f"employee.id kosong untuk {username}"
    assert employee.get("outlet_id"), f"employee.outlet_id kosong untuk {username}"
    return {
        "id": employee["id"],
        "name": employee.get("name") or username,
        "outlet_id": employee["outlet_id"],
    }


@pytest.fixture(scope="module")
def worker_ctx(api_client):
    """Auth module: login pegawai untuk skenario lintas tahap."""
    try:
        worker_a = _login_employee(api_client, "joko")
        worker_b = _login_employee(api_client, "andi")
        worker_c = _login_employee(api_client, "sari")
    except AssertionError as exc:
        pytest.skip(f"Login pegawai gagal: {exc}")
    return {"a": worker_a, "b": worker_b, "c": worker_c}


@pytest.fixture(scope="module")
def tracked_ids():
    """Cleanup module: hapus semua data TEST_iter27 setelah regression selesai."""
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

            await conn.execute("delete from work_logs where order_id in (select id from orders where notes like 'TEST_iter27_%')")
            await conn.execute("delete from transactions where order_id in (select id from orders where notes like 'TEST_iter27_%')")
            await conn.execute("delete from order_items where order_id in (select id from orders where notes like 'TEST_iter27_%')")
            await conn.execute("delete from orders where notes like 'TEST_iter27_%'")
            await conn.execute("delete from customers where name like 'TEST_iter27_%'")
            await conn.execute("delete from kasbon where note like 'TEST_iter27_%'")
        finally:
            await conn.close()

    asyncio.run(_cleanup())


def _pick_kilo_service(api_client, outlet_id: str) -> dict:
    response = api_client.get(f"{API}/services", params={"outlet_id": outlet_id})
    assert response.status_code == 200, response.text
    services = response.json() or []
    assert services, "Layanan outlet kosong"
    return next((s for s in services if s.get("unit") == "kg" and float(s.get("price") or 0) > 0), services[0])


def _create_customer(api_client, outlet_id: str, tracked_ids) -> str:
    suffix = str(uuid.uuid4().int)[-8:]
    payload = {
        "name": f"TEST_iter27_{suffix}",
        "phone": f"08{suffix}27",
        "address": "TEST_iter27_backend",
        "outlet_id": outlet_id,
    }
    created = api_client.post(f"{API}/customers", json=payload)
    assert created.status_code == 200, created.text
    customer_id = created.json()["id"]
    tracked_ids["customers"].append(customer_id)
    return customer_id


def _create_kilo_order(api_client, outlet_id: str, tracked_ids, note_prefix: str, payment_status: str = "unpaid") -> dict:
    service = _pick_kilo_service(api_client, outlet_id)
    customer_id = _create_customer(api_client, outlet_id, tracked_ids)
    qty = max(float(service.get("min_kg") or 0), 4.0)
    payload = {
        "customer_id": customer_id,
        "outlet_id": outlet_id,
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


class TestIter27StageWorkersAndQueue:
    """Orders module: lintas pegawai per tahap + validasi gate pembayaran ready queue."""

    def test_stage_workers_saved_per_stage_with_different_employees(self, api_client, worker_ctx, tracked_ids):
        worker_a = worker_ctx["a"]
        worker_b = worker_ctx["b"]
        worker_c = worker_ctx["c"]

        order = _create_kilo_order(api_client, worker_a["outlet_id"], tracked_ids, "TEST_iter27_stage_workers")

        steps = [
            worker_a,  # received -> washing
            worker_a,  # washing -> drying (logs washing by A)
            worker_b,  # drying -> ironing (logs drying by B)
            worker_b,  # ironing -> packing (logs ironing by B)
            worker_c,  # packing -> ready (logs packing by C)
        ]
        expected_statuses = ["washing", "drying", "ironing", "packing", "ready"]
        for actor, expected_status in zip(steps, expected_statuses):
            moved = api_client.post(
                f"{API}/orders/{order['id']}/advance",
                json={"employee_id": actor["id"], "employee_name": actor["name"]},
            )
            assert moved.status_code == 200, moved.text
            assert moved.json().get("status") == expected_status

        detail = api_client.get(f"{API}/orders/{order['id']}")
        assert detail.status_code == 200, detail.text
        stage_workers = (detail.json() or {}).get("stage_workers") or {}

        assert stage_workers.get("washing", {}).get("employee_name") == worker_a["name"]
        assert stage_workers.get("drying", {}).get("employee_name") == worker_b["name"]
        assert stage_workers.get("ironing", {}).get("employee_name") == worker_b["name"]
        assert stage_workers.get("packing", {}).get("employee_name") == worker_c["name"]
        assert stage_workers.get("washing", {}).get("employee_name") != stage_workers.get("drying", {}).get("employee_name")

    def test_ready_must_be_paid_before_completed_and_verified_by_get(self, api_client, worker_ctx, tracked_ids):
        worker_a = worker_ctx["a"]
        order = _create_kilo_order(api_client, worker_a["outlet_id"], tracked_ids, "TEST_iter27_ready_payment_gate")
        actor = {"employee_id": worker_a["id"], "employee_name": worker_a["name"]}

        for expected_status in ("washing", "drying", "ironing", "packing", "ready"):
            moved = api_client.post(f"{API}/orders/{order['id']}/advance", json=actor)
            assert moved.status_code == 200, moved.text
            assert moved.json().get("status") == expected_status

        blocked = api_client.post(f"{API}/orders/{order['id']}/advance", json=actor)
        assert blocked.status_code == 400

        paid = api_client.post(f"{API}/orders/{order['id']}/pay", json={"method": "cash"})
        assert paid.status_code == 200, paid.text
        assert paid.json().get("payment_status") == "paid"

        detail = api_client.get(f"{API}/orders/{order['id']}")
        assert detail.status_code == 200, detail.text
        assert detail.json().get("payment_status") == "paid"

        completed = api_client.post(f"{API}/orders/{order['id']}/advance", json=actor)
        assert completed.status_code == 200, completed.text
        assert completed.json().get("status") == "completed"

    def test_ready_list_payment_status_values_are_compact_paid_unpaid_only(self, api_client, worker_ctx, tracked_ids):
        worker_a = worker_ctx["a"]
        paid_order = _create_kilo_order(api_client, worker_a["outlet_id"], tracked_ids, "TEST_iter27_ready_paid", payment_status="paid")
        unpaid_order = _create_kilo_order(api_client, worker_a["outlet_id"], tracked_ids, "TEST_iter27_ready_unpaid", payment_status="unpaid")
        actor = {"employee_id": worker_a["id"], "employee_name": worker_a["name"]}

        for order_id in (paid_order["id"], unpaid_order["id"]):
            for _ in ("washing", "drying", "ironing", "packing", "ready"):
                moved = api_client.post(f"{API}/orders/{order_id}/advance", json=actor)
                assert moved.status_code == 200, moved.text

        ready_rows = api_client.get(
            f"{API}/orders",
            params={"status": "ready", "outlet_id": worker_a["outlet_id"], "sort": "fifo"},
        )
        assert ready_rows.status_code == 200, ready_rows.text
        rows = ready_rows.json() or []
        by_id = {row.get("id"): row for row in rows}

        assert by_id.get(paid_order["id"], {}).get("payment_status") == "paid"
        assert by_id.get(unpaid_order["id"], {}).get("payment_status") == "unpaid"
        for oid in (paid_order["id"], unpaid_order["id"]):
            assert by_id.get(oid, {}).get("payment_status") in {"paid", "unpaid"}
