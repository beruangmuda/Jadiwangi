"""Iter14 regression: ready queue separation, ready->completed closure, and min_kg/outlet validation."""

import asyncio
import time
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
    """Shared requests client for order lifecycle and weigh validation tests."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def pegawai_context(api_client):
    # Auth module: use provided Pegawai credential to get stable outlet context
    login = api_client.post(f"{API}/auth/login", json={"username": "Pegawai", "password": "pegawai123"})
    assert login.status_code == 200, login.text
    payload = login.json()
    assert payload.get("role") == "pegawai"
    outlet_id = payload.get("employee", {}).get("outlet_id")
    assert outlet_id, "Pegawai outlet_id missing"
    return {
        "employee_id": payload.get("employee", {}).get("id"),
        "employee_name": payload.get("employee", {}).get("name") or "Pegawai",
        "outlet_id": outlet_id,
    }


@pytest.fixture(scope="module")
def tracked_ids():
    # Cleanup module: remove generated orders/customers + related work_logs/transactions/order_items
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

            # defensive cleanup in case one id misses tracking
            await conn.execute("delete from work_logs where order_id in (select id from orders where notes like 'TEST_iter14_%')")
            await conn.execute("delete from transactions where order_id in (select id from orders where notes like 'TEST_iter14_%')")
            await conn.execute("delete from order_items where order_id in (select id from orders where notes like 'TEST_iter14_%')")
            await conn.execute("delete from orders where notes like 'TEST_iter14_%'")
            await conn.execute("delete from customers where name like 'TEST_iter14_%'")
        finally:
            await conn.close()

    asyncio.run(_cleanup())


def _create_customer(api_client, outlet_id: str, tracked_ids) -> dict:
    suffix = str(uuid.uuid4().int)[-8:]
    payload = {
        "name": f"TEST_iter14_customer_{suffix}",
        "phone": f"08{suffix}91",
        "address": "TEST_iter14 alamat",
        "outlet_id": outlet_id,
    }
    created = api_client.post(f"{API}/customers", json=payload)
    assert created.status_code == 200, created.text
    customer = created.json()
    tracked_ids["customers"].append(customer["id"])
    return customer


def _services_for_outlet(api_client, outlet_id: str):
    svc = api_client.get(f"{API}/services", params={"outlet_id": outlet_id})
    assert svc.status_code == 200, svc.text
    rows = svc.json()
    assert rows, "No services available"
    return rows


def _create_order(api_client, outlet_id: str, customer_id: str, service: dict, tracked_ids, note: str, qty: float):
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
    return order


class TestReadyAndClosureFlow:
    """Order status filtering and closure path via ready stage."""

    def test_active_excludes_ready_and_status_ready_includes_order(self, api_client, pegawai_context, tracked_ids):
        services = _services_for_outlet(api_client, pegawai_context["outlet_id"])
        usable_service = next((s for s in services if s["unit"] in ("kg", "pcs") and float(s["price"]) > 0), services[0])
        qty = 4.0 if usable_service["unit"] == "kg" else 1.0
        customer = _create_customer(api_client, pegawai_context["outlet_id"], tracked_ids)
        order = _create_order(
            api_client,
            pegawai_context["outlet_id"],
            customer["id"],
            usable_service,
            tracked_ids,
            "TEST_iter14_ready_filter",
            qty,
        )

        advance_body = {
            "employee_id": pegawai_context["employee_id"],
            "employee_name": pegawai_context["employee_name"],
        }
        # received -> washing -> drying -> ironing -> packing -> ready
        expected = ["washing", "drying", "ironing", "packing", "ready"]
        for exp in expected:
            moved = api_client.post(f"{API}/orders/{order['id']}/advance", json=advance_body)
            assert moved.status_code == 200, moved.text
            assert moved.json()["status"] == exp

        active_list = api_client.get(
            f"{API}/orders",
            params={"active": "true", "outlet_id": pegawai_context["outlet_id"], "limit": 300},
        )
        assert active_list.status_code == 200, active_list.text
        active_ids = [row["id"] for row in active_list.json()]
        assert order["id"] not in active_ids

        # retry once to handle transient list lag from parallel background activity
        ready_ids = []
        ready_list = None
        for _ in range(2):
            ready_list = api_client.get(
                f"{API}/orders",
                params={"status": "ready", "outlet_id": pegawai_context["outlet_id"], "sort": "fifo", "limit": 300},
            )
            assert ready_list.status_code == 200, ready_list.text
            ready_ids = [row["id"] for row in ready_list.json()]
            if order["id"] in ready_ids:
                break
            time.sleep(0.8)

        if order["id"] not in ready_ids:
            detail = api_client.get(f"{API}/orders/{order['id']}")
            assert detail.status_code == 200, detail.text
            assert detail.json()["status"] == "ready", detail.text
            pytest.fail("Order ready tidak muncul di GET /orders?status=ready")

        close = api_client.post(f"{API}/orders/{order['id']}/advance", json=advance_body)
        assert close.status_code == 200, close.text
        assert close.json()["status"] == "completed"


class TestMinKgAndOutletValidation:
    """POST /orders and POST /orders/{id}/weigh should reject under-minimum and cross-outlet service."""

    def test_create_order_rejects_qty_below_service_min_kg(self, api_client, pegawai_context, tracked_ids):
        services = _services_for_outlet(api_client, pegawai_context["outlet_id"])
        kilo_service = next((s for s in services if s["unit"] == "kg" and s.get("min_kg") and float(s["min_kg"]) >= 2), None)
        if not kilo_service:
            pytest.skip("No kilo service with min_kg >= 2 in selected outlet")

        customer = _create_customer(api_client, pegawai_context["outlet_id"], tracked_ids)
        min_kg = float(kilo_service["min_kg"])
        bad_qty = max(0.1, min_kg - 1)
        payload = {
            "customer_id": customer["id"],
            "outlet_id": pegawai_context["outlet_id"],
            "delivery_type": "self",
            "notes": "TEST_iter14_min_kg_create",
            "items": [
                {
                    "service_id": kilo_service["id"],
                    "service_name": kilo_service["name"],
                    "unit": "kg",
                    "qty": bad_qty,
                    "price": float(kilo_service["price"]),
                }
            ],
        }
        res = api_client.post(f"{API}/orders", json=payload)
        assert res.status_code == 422, res.text
        assert "minimal" in res.text.lower()

    def test_create_order_rejects_service_from_other_outlet(self, api_client, pegawai_context, tracked_ids):
        outlets = api_client.get(f"{API}/outlets")
        assert outlets.status_code == 200, outlets.text
        outlet_rows = outlets.json()
        other = next((o for o in outlet_rows if o["id"] != pegawai_context["outlet_id"]), None)
        assert other is not None, "Need second outlet to test cross-outlet service validation"

        foreign_services = _services_for_outlet(api_client, other["id"])
        foreign = foreign_services[0]
        customer = _create_customer(api_client, pegawai_context["outlet_id"], tracked_ids)
        qty = 1.0 if foreign["unit"] != "kg" else max(1.0, float(foreign.get("min_kg") or 1.0))
        payload = {
            "customer_id": customer["id"],
            "outlet_id": pegawai_context["outlet_id"],
            "delivery_type": "self",
            "notes": "TEST_iter14_cross_outlet_create",
            "items": [
                {
                    "service_id": foreign["id"],
                    "service_name": foreign["name"],
                    "unit": foreign["unit"],
                    "qty": qty,
                    "price": float(foreign["price"]),
                }
            ],
        }
        res = api_client.post(f"{API}/orders", json=payload)
        assert res.status_code == 422, res.text
        assert "outlet" in res.text.lower() or "layanan" in res.text.lower()

    def test_weigh_rejects_below_min_kg(self, api_client, pegawai_context, tracked_ids):
        services = _services_for_outlet(api_client, pegawai_context["outlet_id"])
        kilo_service = next((s for s in services if s["unit"] == "kg" and s.get("min_kg") and float(s["min_kg"]) >= 2), None)
        if not kilo_service:
            pytest.skip("No kilo service with min_kg >= 2 in selected outlet")

        customer = _create_customer(api_client, pegawai_context["outlet_id"], tracked_ids)
        request_order = api_client.post(
            f"{API}/orders/request",
            json={
                "customer_id": customer["id"],
                "outlet_id": pegawai_context["outlet_id"],
                "categories": [{"category": "Kiloan", "qty": 1}],
                "delivery_type": "pickup",
                "notes": "TEST_iter14_weigh_min_request",
            },
        )
        assert request_order.status_code == 200, request_order.text
        order = request_order.json()
        tracked_ids["orders"].append(order["id"])

        min_kg = float(kilo_service["min_kg"])
        bad_qty = max(0.1, min_kg - 1)
        weigh_payload = {
            "items": [
                {
                    "service_id": kilo_service["id"],
                    "service_name": kilo_service["name"],
                    "unit": "kg",
                    "qty": bad_qty,
                    "price": float(kilo_service["price"]),
                }
            ],
            "express": False,
            "employee_id": pegawai_context["employee_id"],
            "employee_name": pegawai_context["employee_name"],
            "photos": [],
        }
        res = api_client.post(f"{API}/orders/{order['id']}/weigh", json=weigh_payload)
        assert res.status_code == 422, res.text
        assert "minimal" in res.text.lower()
