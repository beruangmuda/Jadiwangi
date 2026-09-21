"""Iter15 regression: camera upload, quoted+photo billing visibility, owner reports, idle request auto-cancel."""

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
    # API client module for auth/order/upload/report regression tests
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def pegawai_ctx(api_client):
    # Auth module for Pegawai context used by weigh/trip related flows
    login = api_client.post(f"{API}/auth/login", json={"username": "Pegawai", "password": "pegawai123"})
    assert login.status_code == 200, login.text
    payload = login.json()
    assert payload.get("role") == "pegawai"
    emp = payload.get("employee") or {}
    assert emp.get("outlet_id"), "Pegawai outlet_id missing"
    return {
        "employee_id": emp.get("id"),
        "employee_name": emp.get("name") or "Pegawai",
        "outlet_id": emp.get("outlet_id"),
    }


@pytest.fixture(scope="module")
def owner_ctx(api_client):
    # Auth module for Owner context used by owner report checks
    login = api_client.post(f"{API}/auth/login", json={"username": "owner", "password": "owner123"})
    assert login.status_code == 200, login.text
    payload = login.json()
    assert payload.get("role") == "owner"
    return payload


@pytest.fixture(scope="module")
def tracked_ids():
    # Data lifecycle module for cleaning TEST_ customers/orders and linked records
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

            # Keep cleanup scoped to tracked IDs only to avoid xdist worker cross-deletion.
        finally:
            await conn.close()

    asyncio.run(_cleanup())


def _create_customer(api_client, outlet_id: str, tracked_ids) -> dict:
    suffix = str(uuid.uuid4().int)[-8:]
    payload = {
        "name": f"TEST_iter15_customer_{suffix}",
        "phone": f"08{suffix}17",
        "address": "TEST_iter15 alamat",
        "outlet_id": outlet_id,
    }
    res = api_client.post(f"{API}/customers", json=payload)
    assert res.status_code == 200, res.text
    customer = res.json()
    tracked_ids["customers"].append(customer["id"])
    return customer


def _outlet_services(api_client, outlet_id: str):
    res = api_client.get(f"{API}/services", params={"outlet_id": outlet_id})
    assert res.status_code == 200, res.text
    rows = res.json()
    assert rows, "No services for outlet"
    return rows


def _png_1x1_bytes() -> bytes:
    # Tiny valid PNG for multipart upload regression checks
    return (
        b"\x89PNG\r\n\x1a\n"
        b"\x00\x00\x00\rIHDR"
        b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00"
        b"\x90wS\xde"
        b"\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x03\x01\x01\x00\x18\xdd\x8d\xb1"
        b"\x00\x00\x00\x00IEND\xaeB`\x82"
    )


class TestUploadAndQuotedBilling:
    """Upload + request->weigh->quoted with photos and unpaid bill retrieval."""

    def test_upload_multipart_returns_valid_url(self, api_client):
        files = {"file": ("test_iter15.png", _png_1x1_bytes(), "image/png")}
        data = {"folder": "orders"}
        # requests handles multipart Content-Type automatically
        upload = requests.post(f"{API}/upload", files=files, data=data, timeout=60)
        assert upload.status_code == 200, upload.text
        body = upload.json()
        assert isinstance(body.get("url"), str) and body["url"].startswith("/api/files/")

        fetch = api_client.get(f"{BASE_URL}{body['url']}")
        assert fetch.status_code == 200
        assert fetch.headers.get("Content-Type", "").startswith("image/")

    def test_request_weigh_with_photo_visible_in_unpaid_customer_orders(self, api_client, pegawai_ctx, tracked_ids):
        customer = _create_customer(api_client, pegawai_ctx["outlet_id"], tracked_ids)

        req_payload = {
            "customer_id": customer["id"],
            "outlet_id": pegawai_ctx["outlet_id"],
            "categories": [{"category": "Kiloan", "qty": 2}],
            "delivery_type": "pickup",
            "address": "TEST_iter15 alamat pickup",
            "notes": "TEST_iter15_request_with_photo",
        }
        created = api_client.post(f"{API}/orders/request", json=req_payload)
        assert created.status_code == 200, created.text
        order = created.json()
        tracked_ids["orders"].append(order["id"])
        assert order["status"] == "requested"

        services = _outlet_services(api_client, pegawai_ctx["outlet_id"])
        service = next((s for s in services if s["unit"] in ("kg", "pcs") and float(s["price"]) > 0), services[0])
        qty = max(float(service.get("min_kg") or 1.0), 1.0) if service["unit"] == "kg" else 1.0

        upload = requests.post(
            f"{API}/upload",
            files={"file": ("nota-photo.png", _png_1x1_bytes(), "image/png")},
            data={"folder": "orders"},
            timeout=60,
        )
        assert upload.status_code == 200, upload.text
        photo_url = upload.json()["url"]

        weigh_payload = {
            "items": [{
                "service_id": service["id"],
                "service_name": service["name"],
                "unit": service["unit"],
                "qty": qty,
                "price": float(service["price"]),
            }],
            "express": False,
            "employee_id": pegawai_ctx["employee_id"],
            "employee_name": pegawai_ctx["employee_name"],
            "notes": "TEST_iter15_weighed_with_photo",
            "photos": [photo_url],
        }
        weighed = api_client.post(f"{API}/orders/{order['id']}/weigh", json=weigh_payload)
        assert weighed.status_code == 200, weighed.text
        weighed_json = weighed.json()
        assert weighed_json["status"] == "quoted"
        assert photo_url in (weighed_json.get("photos") or [])

        unpaid = api_client.get(f"{API}/orders", params={"customer_id": customer["id"], "unpaid": "true", "limit": 50})
        assert unpaid.status_code == 200, unpaid.text
        unpaid_rows = unpaid.json()
        hit = next((o for o in unpaid_rows if o["id"] == order["id"]), None)
        assert hit is not None, "Quoted order not found in unpaid customer list"
        assert hit["status"] == "quoted"

        detail = api_client.get(f"{API}/orders/{order['id']}")
        assert detail.status_code == 200, detail.text
        d = detail.json()
        assert isinstance(d.get("items"), list) and len(d["items"]) >= 1
        assert photo_url in (d.get("photos") or [])


class TestOwnerReportAndIdleCleanup:
    """Owner report coverage for multi-status visibility + 14-day requested auto-cancel."""

    def test_owner_transactions_recent_includes_requested_quoted_completed_and_cancelled(self, api_client, pegawai_ctx, owner_ctx, tracked_ids):
        customer = _create_customer(api_client, pegawai_ctx["outlet_id"], tracked_ids)
        services = _outlet_services(api_client, pegawai_ctx["outlet_id"])
        service = next((s for s in services if s["unit"] in ("kg", "pcs") and float(s["price"]) > 0), services[0])
        qty = max(float(service.get("min_kg") or 1.0), 1.0) if service["unit"] == "kg" else 1.0

        req = api_client.post(
            f"{API}/orders/request",
            json={
                "customer_id": customer["id"],
                "outlet_id": pegawai_ctx["outlet_id"],
                "categories": [{"category": "Kiloan", "qty": 1}],
                "delivery_type": "pickup",
                "notes": "TEST_iter15_owner_recent_requested",
            },
        )
        assert req.status_code == 200, req.text
        req_order = req.json()
        tracked_ids["orders"].append(req_order["id"])

        quoted = api_client.post(
            f"{API}/orders/request",
            json={
                "customer_id": customer["id"],
                "outlet_id": pegawai_ctx["outlet_id"],
                "categories": [{"category": "Kiloan", "qty": 2}],
                "delivery_type": "pickup",
                "notes": "TEST_iter15_owner_recent_quoted",
            },
        )
        assert quoted.status_code == 200, quoted.text
        quoted_order = quoted.json()
        tracked_ids["orders"].append(quoted_order["id"])

        weigh_res = api_client.post(
            f"{API}/orders/{quoted_order['id']}/weigh",
            json={
                "items": [{
                    "service_id": service["id"],
                    "service_name": service["name"],
                    "unit": service["unit"],
                    "qty": qty,
                    "price": float(service["price"]),
                }],
                "express": False,
                "employee_id": pegawai_ctx["employee_id"],
                "employee_name": pegawai_ctx["employee_name"],
                "photos": [],
            },
        )
        assert weigh_res.status_code == 200, weigh_res.text
        assert weigh_res.json()["status"] == "quoted"

        # Create completed via regular order + stage advancing
        created = api_client.post(
            f"{API}/orders",
            json={
                "customer_id": customer["id"],
                "outlet_id": pegawai_ctx["outlet_id"],
                "delivery_type": "self",
                "notes": "TEST_iter15_owner_recent_completed",
                "payment_status": "unpaid",
                "payment_method": "qris",
                "created_by": "pegawai",
                "items": [{
                    "service_id": service["id"],
                    "service_name": service["name"],
                    "unit": service["unit"],
                    "qty": qty,
                    "price": float(service["price"]),
                }],
            },
        )
        assert created.status_code == 200, created.text
        completed_order = created.json()
        tracked_ids["orders"].append(completed_order["id"])

        for exp in ["washing", "drying", "ironing", "packing", "ready", "completed"]:
            adv = api_client.post(
                f"{API}/orders/{completed_order['id']}/advance",
                json={"employee_id": pegawai_ctx["employee_id"], "employee_name": pegawai_ctx["employee_name"]},
            )
            assert adv.status_code == 200, adv.text
            assert adv.json()["status"] == exp

        cancelled_create = api_client.post(
            f"{API}/orders",
            json={
                "customer_id": customer["id"],
                "outlet_id": pegawai_ctx["outlet_id"],
                "delivery_type": "self",
                "notes": "TEST_iter15_owner_recent_cancelled",
                "payment_status": "unpaid",
                "payment_method": "qris",
                "created_by": "pegawai",
                "items": [{
                    "service_id": service["id"],
                    "service_name": service["name"],
                    "unit": service["unit"],
                    "qty": qty,
                    "price": float(service["price"]),
                }],
            },
        )
        assert cancelled_create.status_code == 200, cancelled_create.text
        cancelled_order = cancelled_create.json()
        tracked_ids["orders"].append(cancelled_order["id"])

        cancelled = api_client.post(
            f"{API}/orders/{cancelled_order['id']}/cancel",
            json={"reason": "TEST_iter15_cancel_for_report"},
        )
        assert cancelled.status_code == 200, cancelled.text
        assert cancelled.json()["status"] == "cancelled"

        rep = api_client.get(f"{API}/reports/transactions", params={"outlet_id": pegawai_ctx["outlet_id"]})
        assert rep.status_code == 200, rep.text
        body = rep.json()
        recent = body.get("recent") or []
        recent_ids = {o["id"] for o in recent}

        assert req_order["id"] in recent_ids
        assert quoted_order["id"] in recent_ids
        assert completed_order["id"] in recent_ids
        assert cancelled_order["id"] in recent_ids

    def test_requested_order_older_than_14_days_auto_cancelled_on_get_orders(self, api_client, pegawai_ctx, tracked_ids):
        customer = _create_customer(api_client, pegawai_ctx["outlet_id"], tracked_ids)
        req = api_client.post(
            f"{API}/orders/request",
            json={
                "customer_id": customer["id"],
                "outlet_id": pegawai_ctx["outlet_id"],
                "categories": [{"category": "Kiloan", "qty": 1}],
                "delivery_type": "pickup",
                "notes": "TEST_iter15_idle_cleanup",
            },
        )
        assert req.status_code == 200, req.text
        order = req.json()
        tracked_ids["orders"].append(order["id"])
        assert order["status"] == "requested"

        async def _age_order(oid: str):
            conn = await asyncpg.connect(**DB_CFG, statement_cache_size=0)
            try:
                await conn.execute(
                    "update orders set created_at = now() - interval '15 days', updated_at = now() - interval '15 days' where id=$1",
                    uuid.UUID(oid),
                )
            finally:
                await conn.close()

        asyncio.run(_age_order(order["id"]))

        trigger = api_client.get(f"{API}/orders", params={"outlet_id": pegawai_ctx["outlet_id"], "limit": 200})
        assert trigger.status_code == 200, trigger.text

        detail = api_client.get(f"{API}/orders/{order['id']}")
        assert detail.status_code == 200, detail.text
        row = detail.json()
        assert row["status"] == "cancelled"
        assert "14 hari" in (row.get("cancel_reason") or "")
