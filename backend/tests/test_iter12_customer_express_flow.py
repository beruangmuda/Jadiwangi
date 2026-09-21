"""Iter12 regression: customer +62 lookup, express queue visibility, and key route health."""

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
    """Shared requests session for iteration 12 API checks."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def owner_outlet(api_client):
    """Owner login + Kalimulya outlet selection for stable employee scenarios."""
    login = api_client.post(f"{API}/auth/login", json={"username": "owner", "password": "owner123"})
    assert login.status_code == 200, login.text
    outlets = login.json().get("outlets", [])
    assert outlets, "No outlet available"
    return next((o for o in outlets if "Kalimulya" in (o.get("name", "") + o.get("city", ""))), outlets[0])


@pytest.fixture(scope="module")
def created_ids():
    """Track created customers/orders and hard cleanup all test data at teardown."""
    tracked = {"customers": [], "orders": []}
    yield tracked

    async def _cleanup():
        conn = await asyncpg.connect(**DB_CFG, statement_cache_size=0)
        try:
            if tracked["orders"]:
                order_ids = [uuid.UUID(x) for x in tracked["orders"]]
                await conn.execute("delete from transactions where order_id = any($1::uuid[])", order_ids)
                await conn.execute("delete from order_items where order_id = any($1::uuid[])", order_ids)
                await conn.execute("delete from orders where id = any($1::uuid[])", order_ids)
            if tracked["customers"]:
                cust_ids = [uuid.UUID(x) for x in tracked["customers"]]
                await conn.execute("delete from customers where id = any($1::uuid[])", cust_ids)

            await conn.execute("delete from transactions where order_id in (select id from orders where notes like 'TEST_iter12_%')")
            await conn.execute("delete from order_items where order_id in (select id from orders where notes like 'TEST_iter12_%')")
            await conn.execute("delete from orders where notes like 'TEST_iter12_%'")
            await conn.execute("delete from customers where name like 'TEST_iter12_%'")
        finally:
            await conn.close()

    asyncio.run(_cleanup())


class TestCustomerAndExpressFlow:
    """Customer validation and express order queue visibility for today."""

    def test_customer_create_08_saved_plus62_and_query_found(self, api_client, owner_outlet, created_ids):
        suffix = f"{uuid.uuid4().int}"[-9:]
        raw_phone = f"08{suffix}"
        payload = {
            "name": f"TEST_iter12_customer_{suffix[-4:]}",
            "phone": raw_phone,
            "address": "TEST_iter12 alamat",
            "outlet_id": owner_outlet["id"],
        }
        create = api_client.post(f"{API}/customers", json=payload)
        assert create.status_code == 200, create.text
        created = create.json()
        created_ids["customers"].append(created["id"])
        assert created["phone"] == f"+62{raw_phone[1:]}"

        listed = api_client.get(f"{API}/customers", params={"q": raw_phone}).json()
        found = next((c for c in listed if c["id"] == created["id"]), None)
        assert found is not None
        assert found["phone"].startswith("+62")

    def test_create_customer_duplicate_cross_format_409(self, api_client, owner_outlet, created_ids):
        suffix = f"{uuid.uuid4().int}"[-9:]
        first_phone = f"08{suffix}"
        first = api_client.post(
            f"{API}/customers",
            json={"name": f"TEST_iter12_dup_a_{suffix[-4:]}", "phone": first_phone, "outlet_id": owner_outlet["id"]},
        )
        assert first.status_code == 200, first.text
        created_ids["customers"].append(first.json()["id"])

        second = api_client.post(
            f"{API}/customers",
            json={"name": f"TEST_iter12_dup_b_{suffix[-4:]}", "phone": f"+62{first_phone[1:]}", "outlet_id": owner_outlet["id"]},
        )
        assert second.status_code == 409, second.text

    def test_express_order_saved_and_returned_by_queue_today_express(self, api_client, owner_outlet, created_ids):
        customers = api_client.get(f"{API}/customers", params={"outlet_id": owner_outlet["id"]}).json()
        assert customers, "No customer available for outlet"
        customer = customers[0]

        services = api_client.get(f"{API}/services", params={"outlet_id": owner_outlet["id"]}).json()
        svc = next((s for s in services if s.get("price_express") is not None), None)
        assert svc is not None, "No service with express price"

        order_payload = {
            "customer_id": customer["id"],
            "outlet_id": owner_outlet["id"],
            "delivery_type": "self",
            "notes": "TEST_iter12_express_queue",
            "payment_status": "paid",
            "payment_method": "qris",
            "created_by": "pegawai",
            "express": True,
            "items": [
                {
                    "service_id": svc["id"],
                    "service_name": f"{svc['name']} (Express)",
                    "unit": svc["unit"],
                    "qty": 2,
                    "price": float(svc["price_express"]),
                }
            ],
        }
        created = api_client.post(f"{API}/orders", json=order_payload)
        assert created.status_code == 200, created.text
        order = created.json()
        created_ids["orders"].append(order["id"])
        assert order["express"] is True

        detail = api_client.get(f"{API}/orders/{order['id']}")
        assert detail.status_code == 200, detail.text
        assert detail.json()["express"] is True

        queue = api_client.get(
            f"{API}/orders",
            params={
                "queue": "true",
                "today": "true",
                "speed": "express",
                "sort": "fifo",
                "outlet_id": owner_outlet["id"],
                "limit": 200,
            },
        )
        assert queue.status_code == 200, queue.text
        queue_ids = [o["id"] for o in queue.json()]
        assert order["id"] in queue_ids


class TestRouteHealth:
    """Critical route smoke checks to ensure no backend route errors."""

    def test_core_routes_no_5xx(self, api_client):
        routes = [
            ("GET", f"{API}/outlets"),
            ("GET", f"{API}/services"),
            ("GET", f"{API}/customers"),
            ("GET", f"{API}/orders", {"limit": 5}),
            ("GET", f"{API}/dashboard"),
        ]
        for method, url, *extra in routes:
            params = extra[0] if extra else None
            res = api_client.request(method, url, params=params)
            assert res.status_code < 500, f"{url} returned {res.status_code}: {res.text[:200]}"
