"""Iter29 regression: quoted/payment customer labels + Midtrans settlement idempotency."""

import asyncio
import hashlib
import os
import uuid
from decimal import Decimal
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
    """HTTP module: shared requests client for customer status and Midtrans checks."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def tracked_ids():
    """Cleanup module: remove TEST_iter29 rows after all tests."""
    tracked = {"orders": []}
    yield tracked

    async def _cleanup():
        conn = await asyncpg.connect(**DB_CFG, statement_cache_size=0)
        try:
            if tracked["orders"]:
                order_ids = tracked["orders"]
                await conn.execute("delete from transactions where order_id = any($1::uuid[])", order_ids)
                await conn.execute("delete from work_logs where order_id = any($1::uuid[])", order_ids)
                await conn.execute("delete from order_items where order_id = any($1::uuid[])", order_ids)
                await conn.execute("delete from orders where id = any($1::uuid[])", order_ids)

            await conn.execute("delete from transactions where order_id in (select id from orders where notes like 'TEST_iter29_%')")
            await conn.execute("delete from work_logs where order_id in (select id from orders where notes like 'TEST_iter29_%')")
            await conn.execute("delete from order_items where order_id in (select id from orders where notes like 'TEST_iter29_%')")
            await conn.execute("delete from orders where notes like 'TEST_iter29_%'")
        finally:
            await conn.close()

    asyncio.run(_cleanup())


def _login(api_client, username: str, password: str) -> dict:
    res = api_client.post(f"{API}/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, res.text
    return res.json()


def _pick_service(api_client, outlet_id: str) -> dict:
    services = api_client.get(f"{API}/services", params={"outlet_id": outlet_id})
    assert services.status_code == 200, services.text
    rows = services.json() or []
    assert rows, "Layanan outlet kosong"
    return next((s for s in rows if float(s.get("price") or 0) > 0), rows[0])


def _create_order_for_customer(api_client, customer_id: str, outlet_id: str, service: dict, tracked_ids, note: str) -> dict:
    qty = max(float(service.get("min_kg") or 0), 3.0) if service.get("unit") == "kg" else 1
    body = {
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
        "notes": note,
        "payment_status": "unpaid",
        "payment_method": "qris",
        "created_by": "testing",
    }
    res = api_client.post(f"{API}/orders", json=body)
    assert res.status_code == 200, res.text
    order = res.json()
    tracked_ids["orders"].append(order["id"])
    return order


def _weigh_to_quoted(api_client, order_id: str, service: dict):
    qty = max(float(service.get("min_kg") or 0), 4.0) if service.get("unit") == "kg" else 2
    weigh_body = {
        "items": [{
            "service_id": service["id"],
            "service_name": service["name"],
            "unit": service["unit"],
            "qty": qty,
            "price": float(service["price"]),
        }],
        "employee_name": "TEST_iter29",
        "notes": f"TEST_iter29_weighed_{uuid.uuid4().hex[:6]}",
    }
    res = api_client.post(f"{API}/orders/{order_id}/weigh", json=weigh_body)
    assert res.status_code == 200, res.text
    weighed = res.json()
    assert weighed["status"] == "quoted"
    assert weighed["payment_status"] == "unpaid"


async def _income_count(order_id: str) -> int:
    conn = await asyncpg.connect(**DB_CFG, statement_cache_size=0)
    try:
        return int(await conn.fetchval("select count(*) from transactions where order_id=$1 and type='income'", order_id) or 0)
    finally:
        await conn.close()


class TestIter29CustomerMidtransStatuses:
    """Order/payment module: customer-facing labels and Midtrans webhook behaviors."""

    def test_quoted_order_shows_customer_stage_siap_dibayar_before_payment(self, api_client, tracked_ids):
        customer_login = _login(api_client, "Pelanggan", "pelanggan123")
        assert customer_login.get("role") == "pelanggan"
        customer = customer_login["customer"]

        employee_login = _login(api_client, "joko", "pegawai123")
        outlet_id = employee_login.get("employee", {}).get("outlet_id")
        assert outlet_id == customer.get("outlet_id")

        service = _pick_service(api_client, outlet_id)
        order = _create_order_for_customer(
            api_client,
            customer["id"],
            outlet_id,
            service,
            tracked_ids,
            f"TEST_iter29_quoted_{uuid.uuid4().hex[:8]}",
        )
        _weigh_to_quoted(api_client, order["id"], service)

        detail = api_client.get(f"{API}/orders/{order['id']}")
        assert detail.status_code == 200, detail.text
        row = detail.json()
        assert row["status"] == "quoted"
        assert row["payment_status"] == "unpaid"
        assert row["customer_stage_label"] == "Siap Dibayar"

    def test_midtrans_settlement_moves_to_received_paid_and_is_idempotent(self, api_client, tracked_ids):
        server_key = (os.environ.get("MIDTRANS_SERVER_KEY") or "").strip()
        if not server_key:
            pytest.skip("MIDTRANS_SERVER_KEY belum tersedia, lewati settlement E2E")

        customer_login = _login(api_client, "Pelanggan", "pelanggan123")
        customer = customer_login["customer"]
        employee_login = _login(api_client, "joko", "pegawai123")
        outlet_id = employee_login.get("employee", {}).get("outlet_id")
        service = _pick_service(api_client, outlet_id)

        order = _create_order_for_customer(
            api_client,
            customer["id"],
            outlet_id,
            service,
            tracked_ids,
            f"TEST_iter29_settlement_{uuid.uuid4().hex[:8]}",
        )
        _weigh_to_quoted(api_client, order["id"], service)

        snap = api_client.post(f"{API}/orders/{order['id']}/midtrans/snap", json={})
        assert snap.status_code == 200, snap.text

        before = api_client.get(f"{API}/orders/{order['id']}")
        assert before.status_code == 200, before.text
        before_row = before.json()
        provider_order_id = before_row.get("midtrans_order_id")
        assert provider_order_id
        gross = Decimal(str(before_row.get("midtrans_gross_amount") or before_row.get("total") or 0))
        assert gross > 0

        gross_str = str(gross.quantize(Decimal("1.00")))
        status_code = "200"
        signature = hashlib.sha512(f"{provider_order_id}{status_code}{gross_str}{server_key}".encode("utf-8")).hexdigest()
        txid = f"TEST-TX-{uuid.uuid4().hex[:8]}"
        payload = {
            "order_id": provider_order_id,
            "status_code": status_code,
            "gross_amount": gross_str,
            "signature_key": signature,
            "transaction_status": "settlement",
            "fraud_status": "accept",
            "payment_type": "gopay",
            "transaction_id": txid,
        }

        hook1 = api_client.post(f"{API}/midtrans/webhook", json=payload)
        assert hook1.status_code == 200, hook1.text
        hook2 = api_client.post(f"{API}/midtrans/webhook", json=payload)
        assert hook2.status_code == 200, hook2.text

        after = api_client.get(f"{API}/orders/{order['id']}")
        assert after.status_code == 200, after.text
        after_row = after.json()
        assert after_row["status"] == "received"
        assert after_row["payment_status"] == "paid"
        assert after_row["customer_stage_label"] == "Sedang Diproses"
        assert after_row["payment_method"] == "gopay"

        income_count = asyncio.run(_income_count(order["id"]))
        assert income_count == 1

    def test_regression_requested_and_employee_stage_label(self, api_client):
        customer_login = _login(api_client, "Pelanggan", "pelanggan123")
        customer_id = customer_login["customer"]["id"]
        outlet_id = customer_login["customer"]["outlet_id"]

        req_payload = {
            "customer_id": customer_id,
            "outlet_id": outlet_id,
            "categories": [{"category": "Kiloan", "qty": 1}],
            "delivery_type": "self",
            "notes": f"TEST_iter29_requested_{uuid.uuid4().hex[:6]}",
        }
        req = api_client.post(f"{API}/orders/request", json=req_payload)
        assert req.status_code == 200, req.text
        req_row = req.json()

        detail = api_client.get(f"{API}/orders/{req_row['id']}")
        assert detail.status_code == 200, detail.text
        drow = detail.json()
        assert drow["status"] == "requested"
        assert drow["customer_stage_label"] == "Menunggu Ditimbang"

        employee_view = api_client.get(
            f"{API}/orders",
            params={"outlet_id": outlet_id, "status": "received", "limit": 200},
        )
        assert employee_view.status_code == 200, employee_view.text
        rows = employee_view.json() or []
        if rows:
            assert all(r.get("stage_label") == "Diterima" for r in rows)
