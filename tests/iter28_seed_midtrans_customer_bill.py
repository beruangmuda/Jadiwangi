"""Seed one unpaid TEST_ order for Pelanggan account on active outlet."""

import os
import uuid
from pathlib import Path

import requests
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "frontend" / ".env")

BASE_URL = (os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("EXPO_BACKEND_URL/EXPO_PUBLIC_BACKEND_URL tidak ditemukan")
API = f"{BASE_URL}/api"


def main():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})

    login = s.post(f"{API}/auth/login", json={"username": "Pelanggan", "password": "pelanggan123"}, timeout=30)
    login.raise_for_status()
    customer = (login.json() or {}).get("customer") or {}
    customer_id = customer.get("id")
    outlet_id = customer.get("outlet_id")
    if not customer_id or not outlet_id:
        raise RuntimeError("customer.id/outlet_id tidak tersedia dari login pelanggan")

    services = s.get(f"{API}/services", params={"outlet_id": outlet_id}, timeout=30)
    services.raise_for_status()
    rows = services.json() or []
    if not rows:
        raise RuntimeError("Layanan outlet pelanggan kosong")
    svc = next((r for r in rows if float(r.get("price") or 0) > 0), rows[0])

    qty = 2 if svc.get("unit") != "kg" else max(float(svc.get("min_kg") or 0), 3.0)
    payload = {
        "customer_id": customer_id,
        "outlet_id": outlet_id,
        "items": [{
            "service_id": svc["id"],
            "service_name": svc["name"],
            "unit": svc["unit"],
            "qty": qty,
            "price": float(svc["price"]),
        }],
        "delivery_type": "self",
        "notes": f"TEST_iter28_ui_midtrans_{uuid.uuid4().hex[:6]}",
        "payment_status": "unpaid",
        "payment_method": "qris",
        "created_by": "testing",
    }
    created = s.post(f"{API}/orders", json=payload, timeout=30)
    created.raise_for_status()
    order = created.json() or {}
    print(f"SEEDED_ORDER_ID={order.get('id')}")


if __name__ == "__main__":
    main()
