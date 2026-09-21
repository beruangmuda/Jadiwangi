"""Setup deterministic UI test data for Iter14 employee flows.

- Creates one ready order (for /siap-diambil close action)
- Creates one requested order (for /timbang flow visibility)
- Stores created IDs in /app/test_reports/iter14_ui_ids.json
"""

from __future__ import annotations

import json
import os
import uuid
from pathlib import Path

import requests
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "frontend" / ".env")

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL") or "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL/EXPO_BACKEND_URL missing")

API = f"{BASE_URL}/api"
OUT_PATH = ROOT / "test_reports" / "iter14_ui_ids.json"


def pick_valid_qty(service: dict) -> float:
    if service.get("unit") != "kg":
        return 1.0
    min_kg = float(service.get("min_kg") or 1.0)
    return max(min_kg, 4.0)


def main() -> None:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})

    login = s.post(f"{API}/auth/login", json={"username": "Pegawai", "password": "pegawai123"}, timeout=30)
    login.raise_for_status()
    login_data = login.json()
    outlet_id = login_data["employee"]["outlet_id"]
    employee_id = login_data["employee"]["id"]
    employee_name = login_data.get("name") or login_data["employee"].get("name") or "Pegawai"

    suffix = str(uuid.uuid4().int)[-8:]
    cust_payload = {
        "name": f"TEST_iter14_ui_{suffix}",
        "phone": f"08{suffix}77",
        "address": "TEST iter14 UI",
        "outlet_id": outlet_id,
    }
    cust_res = s.post(f"{API}/customers", json=cust_payload, timeout=30)
    cust_res.raise_for_status()
    customer = cust_res.json()

    svc_res = s.get(f"{API}/services", params={"outlet_id": outlet_id}, timeout=30)
    svc_res.raise_for_status()
    services = svc_res.json()
    if not services:
        raise RuntimeError("No services available")

    ready_service = next((x for x in services if x.get("unit") in ("kg", "pcs") and float(x.get("price") or 0) > 0), services[0])
    ready_qty = pick_valid_qty(ready_service)

    ready_order_payload = {
        "customer_id": customer["id"],
        "outlet_id": outlet_id,
        "delivery_type": "self",
        "notes": "TEST_iter14_ui_ready",
        "payment_status": "unpaid",
        "payment_method": "qris",
        "created_by": "pegawai",
        "items": [
            {
                "service_id": ready_service["id"],
                "service_name": ready_service["name"],
                "unit": ready_service["unit"],
                "qty": ready_qty,
                "price": float(ready_service["price"]),
            }
        ],
    }
    ready_created = s.post(f"{API}/orders", json=ready_order_payload, timeout=30)
    ready_created.raise_for_status()
    ready_order = ready_created.json()

    for _ in range(5):
        adv = s.post(
            f"{API}/orders/{ready_order['id']}/advance",
            json={"employee_id": employee_id, "employee_name": employee_name},
            timeout=30,
        )
        adv.raise_for_status()

    request_payload = {
        "customer_id": customer["id"],
        "outlet_id": outlet_id,
        "categories": [{"category": "Kiloan", "qty": 1}],
        "delivery_type": "self",
        "address": "TEST iter14 UI",
        "notes": "TEST_iter14_ui_request",
    }
    request_created = s.post(f"{API}/orders/request", json=request_payload, timeout=30)
    request_created.raise_for_status()
    request_order = request_created.json()

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps(
            {
                "customer_id": customer["id"],
                "ready_order_id": ready_order["id"],
                "request_order_id": request_order["id"],
                "outlet_id": outlet_id,
                "employee_id": employee_id,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"SETUP_OK {OUT_PATH}")


if __name__ == "__main__":
    main()
