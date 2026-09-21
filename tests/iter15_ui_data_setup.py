"""Prepare deterministic UI data for iter15 mobile web checks."""

import json
import os
from pathlib import Path

import requests
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "frontend" / ".env")

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL") or "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL/EXPO_BACKEND_URL is missing")
API = f"{BASE_URL}/api"


def _png_1x1_bytes() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n"
        b"\x00\x00\x00\rIHDR"
        b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00"
        b"\x90wS\xde"
        b"\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x03\x01\x01\x00\x18\xdd\x8d\xb1"
        b"\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def main():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})

    cust_login = s.post(f"{API}/auth/login", json={"username": "Pelanggan", "password": "pelanggan123"}, timeout=30)
    cust_login.raise_for_status()
    cust = cust_login.json()["customer"]

    emp_login = s.post(f"{API}/auth/login", json={"username": "Pegawai", "password": "pegawai123"}, timeout=30)
    emp_login.raise_for_status()
    emp = emp_login.json().get("employee") or {}

    # A requested order for kurir list/date/detail click validation
    req_order = s.post(
        f"{API}/orders/request",
        json={
            "customer_id": cust["id"],
            "outlet_id": cust["outlet_id"],
            "categories": [{"category": "Kiloan", "qty": 2}],
            "delivery_type": "pickup",
            "address": "TEST_iter15 UI address",
            "notes": "TEST_iter15_ui_kurir_requested",
        },
        timeout=30,
    )
    req_order.raise_for_status()
    requested = req_order.json()

    # A quoted+photo unpaid order for customer Bayar screen validation
    req2 = s.post(
        f"{API}/orders/request",
        json={
            "customer_id": cust["id"],
            "outlet_id": cust["outlet_id"],
            "categories": [{"category": "Kiloan", "qty": 3}],
            "delivery_type": "pickup",
            "address": "TEST_iter15 UI address quote",
            "notes": "TEST_iter15_ui_bayar_quoted",
        },
        timeout=30,
    )
    req2.raise_for_status()
    for_quote = req2.json()

    svc = s.get(f"{API}/services", params={"outlet_id": cust["outlet_id"]}, timeout=30)
    svc.raise_for_status()
    services = svc.json()
    service = next((x for x in services if x.get("unit") in ("kg", "pcs") and float(x.get("price", 0)) > 0), services[0])
    qty = max(float(service.get("min_kg") or 1), 1) if service.get("unit") == "kg" else 1

    up = requests.post(
        f"{API}/upload",
        files={"file": ("iter15-ui.png", _png_1x1_bytes(), "image/png")},
        data={"folder": "orders"},
        timeout=60,
    )
    up.raise_for_status()
    photo_url = up.json()["url"]

    weigh = s.post(
        f"{API}/orders/{for_quote['id']}/weigh",
        json={
            "items": [{
                "service_id": service["id"],
                "service_name": service["name"],
                "unit": service["unit"],
                "qty": qty,
                "price": float(service["price"]),
            }],
            "express": False,
            "employee_id": emp.get("id"),
            "employee_name": emp.get("name") or "Pegawai",
            "notes": "TEST_iter15_ui_bayar_quoted_weighed",
            "photos": [photo_url],
        },
        timeout=30,
    )
    weigh.raise_for_status()

    out = {
        "requested_order_id": requested["id"],
        "requested_order_code": requested["code"],
        "quoted_order_id": for_quote["id"],
        "quoted_order_code": for_quote["code"],
        "customer_id": cust["id"],
    }
    out_path = ROOT / "tests" / "iter15_ui_data.json"
    out_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(json.dumps(out))


if __name__ == "__main__":
    main()
