"""Seed UI data for iter29 customer status + Midtrans flow validation."""

import hashlib
import json
import os
import uuid
from decimal import Decimal
from pathlib import Path

import requests
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "backend" / ".env")
load_dotenv(ROOT / "frontend" / ".env")

BASE_URL = (os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("EXPO_BACKEND_URL/EXPO_PUBLIC_BACKEND_URL tidak tersedia")
API = f"{BASE_URL}/api"

SERVER_KEY = (os.environ.get("MIDTRANS_SERVER_KEY") or "").strip()
if not SERVER_KEY:
    raise RuntimeError("MIDTRANS_SERVER_KEY belum tersedia")


def login(session: requests.Session, username: str, password: str) -> dict:
    res = session.post(f"{API}/auth/login", json={"username": username, "password": password}, timeout=40)
    res.raise_for_status()
    return res.json()


def pick_service(session: requests.Session, outlet_id: str) -> dict:
    res = session.get(f"{API}/services", params={"outlet_id": outlet_id}, timeout=40)
    res.raise_for_status()
    rows = res.json() or []
    if not rows:
        raise RuntimeError("Layanan kosong")
    return next((r for r in rows if float(r.get("price") or 0) > 0), rows[0])


def create_order(session: requests.Session, customer_id: str, outlet_id: str, service: dict, note: str) -> dict:
    qty = max(float(service.get("min_kg") or 0), 3.0) if service.get("unit") == "kg" else 1
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
        "notes": note,
        "payment_status": "unpaid",
        "payment_method": "qris",
        "created_by": "testing",
    }
    res = session.post(f"{API}/orders", json=payload, timeout=40)
    res.raise_for_status()
    return res.json()


def weigh_order(session: requests.Session, order_id: str, service: dict, suffix: str) -> dict:
    qty = max(float(service.get("min_kg") or 0), 4.0) if service.get("unit") == "kg" else 2
    payload = {
        "items": [{
            "service_id": service["id"],
            "service_name": service["name"],
            "unit": service["unit"],
            "qty": qty,
            "price": float(service["price"]),
        }],
        "employee_name": "TEST_iter29_ui",
        "notes": f"TEST_iter29_ui_weigh_{suffix}",
    }
    res = session.post(f"{API}/orders/{order_id}/weigh", json=payload, timeout=40)
    res.raise_for_status()
    return res.json()


def start_snap(session: requests.Session, order_id: str):
    res = session.post(f"{API}/orders/{order_id}/midtrans/snap", json={}, timeout=45)
    res.raise_for_status()
    detail = session.get(f"{API}/orders/{order_id}", timeout=40)
    detail.raise_for_status()
    row = detail.json()
    provider_order_id = row.get("midtrans_order_id")
    gross = Decimal(str(row.get("midtrans_gross_amount") or row.get("total") or 0)).quantize(Decimal("1.00"))
    if not provider_order_id or gross <= 0:
        raise RuntimeError("Data snap belum lengkap")
    return row, provider_order_id, str(gross)


def build_settlement_payload(provider_order_id: str, gross_amount: str, txid_suffix: str) -> dict:
    status_code = "200"
    signature = hashlib.sha512(f"{provider_order_id}{status_code}{gross_amount}{SERVER_KEY}".encode("utf-8")).hexdigest()
    return {
        "order_id": provider_order_id,
        "status_code": status_code,
        "gross_amount": gross_amount,
        "signature_key": signature,
        "transaction_status": "settlement",
        "fraud_status": "accept",
        "payment_type": "gopay",
        "transaction_id": f"TEST-ITER29-{txid_suffix}",
    }


def main():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})

    cust_login = login(session, "Pelanggan", "pelanggan123")
    customer = cust_login["customer"]

    emp_login = login(session, "joko", "pegawai123")
    outlet_id = emp_login["employee"]["outlet_id"]
    service = pick_service(session, outlet_id)

    # A) paid order => should appear Sedang Diproses + Lunas
    paid_suffix = uuid.uuid4().hex[:8]
    paid_order = create_order(session, customer["id"], outlet_id, service, f"TEST_iter29_ui_paid_{paid_suffix}")
    weigh_order(session, paid_order["id"], service, paid_suffix)
    _, paid_provider_order_id, paid_gross = start_snap(session, paid_order["id"])
    paid_payload = build_settlement_payload(paid_provider_order_id, paid_gross, f"PAID-{paid_suffix}")
    hook = session.post(f"{API}/midtrans/webhook", json=paid_payload, timeout=40)
    hook.raise_for_status()

    paid_detail = session.get(f"{API}/orders/{paid_order['id']}", timeout=40)
    paid_detail.raise_for_status()

    # B) unpaid quoted order => should appear Siap Dibayar + Belum bayar and test Bayar flow
    unpaid_suffix = uuid.uuid4().hex[:8]
    unpaid_order = create_order(session, customer["id"], outlet_id, service, f"TEST_iter29_ui_unpaid_{unpaid_suffix}")
    weigh_order(session, unpaid_order["id"], service, unpaid_suffix)
    _, unpaid_provider_order_id, unpaid_gross = start_snap(session, unpaid_order["id"])
    unpaid_settlement_payload = build_settlement_payload(unpaid_provider_order_id, unpaid_gross, f"UNPAID-{unpaid_suffix}")

    result = {
        "base_url": BASE_URL,
        "customer_id": customer["id"],
        "paid_order_id": paid_order["id"],
        "unpaid_order_id": unpaid_order["id"],
        "paid_order_code": paid_detail.json().get("code"),
        "unpaid_settlement_payload": unpaid_settlement_payload,
    }
    print(json.dumps(result))


if __name__ == "__main__":
    main()
