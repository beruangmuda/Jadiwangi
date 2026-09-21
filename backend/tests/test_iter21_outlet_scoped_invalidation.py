"""Iter21 regression guards for outlet-scoped dashboard invalidation + ready completion API."""

import os
import uuid
from pathlib import Path

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

SIAP_DIAMBIL_SCREEN = ROOT / "frontend" / "app" / "siap-diambil.tsx"


@pytest.fixture(scope="module")
def api_client():
    """HTTP module: shared session for auth and order/customer requests."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def pegawai_context(api_client):
    """Auth module: documented employee account from /app/memory/test_credentials.md."""
    login = api_client.post(f"{API}/auth/login", json={"username": "Pegawai", "password": "pegawai123"})
    if login.status_code != 200:
        pytest.skip(f"Pegawai login failed: {login.status_code} {login.text}")
    payload = login.json()
    outlet_id = payload.get("employee", {}).get("outlet_id")
    employee_id = payload.get("employee", {}).get("id")
    assert outlet_id and employee_id
    return {
        "outlet_id": outlet_id,
        "employee_id": employee_id,
        "employee_name": payload.get("employee", {}).get("name") or "Pegawai",
    }


def _create_customer(api_client, outlet_id: str) -> dict:
    suffix = str(uuid.uuid4().int)[-8:]
    payload = {
        "name": f"TEST_iter21_customer_{suffix}",
        "phone": f"08{suffix}21",
        "address": "TEST_iter21",
        "outlet_id": outlet_id,
    }
    res = api_client.post(f"{API}/customers", json=payload)
    assert res.status_code == 200, res.text
    return res.json()


def _create_order(api_client, outlet_id: str, customer_id: str, note: str) -> dict:
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
    return create.json()


class TestOutletScopedInvalidationAndReadyCompletion:
    """Frontend source + backend advance module for final consistency check."""

    def test_source_uses_outlet_scoped_dashboard_invalidation(self):
        source = SIAP_DIAMBIL_SCREEN.read_text(encoding="utf-8")
        assert 'qc.invalidateQueries({ queryKey: ["dashboard", outletId] });' in source
        assert 'qc.invalidateQueries({ queryKey: ["dashboard"] });' not in source

    def test_ready_close_completes_order_and_removes_from_ready_list(self, api_client, pegawai_context):
        outlet_id = pegawai_context["outlet_id"]
        customer = _create_customer(api_client, outlet_id)
        order = _create_order(api_client, outlet_id, customer["id"], "TEST_iter21_ready_completion")
        oid = order["id"]

        for _ in ["washing", "drying", "ironing", "packing", "ready"]:
            advance = api_client.post(
                f"{API}/orders/{oid}/advance",
                json={
                    "employee_id": pegawai_context["employee_id"],
                    "employee_name": pegawai_context["employee_name"],
                },
            )
            assert advance.status_code == 200, advance.text

        ready_before = api_client.get(f"{API}/orders", params={"status": "ready", "sort": "fifo", "outlet_id": outlet_id})
        assert ready_before.status_code == 200, ready_before.text
        assert oid in {item["id"] for item in ready_before.json()}

        completed = api_client.post(
            f"{API}/orders/{oid}/advance",
            json={
                "employee_id": pegawai_context["employee_id"],
                "employee_name": pegawai_context["employee_name"],
            },
        )
        assert completed.status_code == 200, completed.text
        assert completed.json()["status"] == "completed"

        verify = api_client.get(f"{API}/orders/{oid}")
        assert verify.status_code == 200, verify.text
        assert verify.json()["status"] == "completed"

        ready_after = api_client.get(f"{API}/orders", params={"status": "ready", "sort": "fifo", "outlet_id": outlet_id})
        assert ready_after.status_code == 200, ready_after.text
        assert oid not in {item["id"] for item in ready_after.json()}
