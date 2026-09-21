"""Seed data for iter27 UI regression tests."""

from __future__ import annotations

import json
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


def login(username: str, password: str) -> dict:
    response = requests.post(f"{API}/auth/login", json={"username": username, "password": password}, timeout=30)
    response.raise_for_status()
    payload = response.json() or {}
    employee = payload.get("employee") or {}
    return {
        "id": employee.get("id"),
        "name": employee.get("name") or username,
        "outlet_id": employee.get("outlet_id"),
    }


def get_kilo_service(outlet_id: str) -> dict:
    response = requests.get(f"{API}/services", params={"outlet_id": outlet_id}, timeout=30)
    response.raise_for_status()
    rows = response.json() or []
    if not rows:
        raise RuntimeError("Layanan outlet kosong")
    return next((row for row in rows if row.get("unit") == "kg" and float(row.get("price") or 0) > 0), rows[0])


def create_customer(outlet_id: str) -> dict:
    suffix = str(uuid.uuid4().int)[-8:]
    payload = {
        "name": f"TEST_iter27_ui_{suffix}",
        "phone": f"08{suffix}27",
        "address": "TEST_iter27_ui_seed",
        "outlet_id": outlet_id,
    }
    response = requests.post(f"{API}/customers", json=payload, timeout=30)
    response.raise_for_status()
    return response.json()


def create_order(customer_id: str, outlet_id: str, service: dict, note: str, payment_status: str = "unpaid") -> dict:
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
        "notes": note,
        "payment_status": payment_status,
        "payment_method": "cash" if payment_status == "paid" else "qris",
        "created_by": "pegawai",
    }
    response = requests.post(f"{API}/orders", json=payload, timeout=30)
    response.raise_for_status()
    return response.json()


def advance(order_id: str, actor: dict, target: str | None = None):
    body = {"employee_id": actor["id"], "employee_name": actor["name"]}
    if target:
        body["target_status"] = target
    response = requests.post(f"{API}/orders/{order_id}/advance", json=body, timeout=30)
    response.raise_for_status()
    return response.json()


def main() -> None:
    worker_a = login("joko", "pegawai123")
    worker_b = login("andi", "pegawai123")
    worker_c = login("sari", "pegawai123")
    if not worker_a.get("id") or not worker_a.get("outlet_id"):
        raise RuntimeError("Session worker A tidak valid")

    service = get_kilo_service(worker_a["outlet_id"])
    customer = create_customer(worker_a["outlet_id"])

    process_order = create_order(customer["id"], worker_a["outlet_id"], service, f"TEST_iter27_ui_process_{uuid.uuid4().hex[:6]}")
    advance(process_order["id"], worker_a)
    advance(process_order["id"], worker_a)
    advance(process_order["id"], worker_b)
    advance(process_order["id"], worker_b)
    advance(process_order["id"], worker_c)

    queue_order = create_order(customer["id"], worker_a["outlet_id"], service, f"TEST_iter27_ui_queue_{uuid.uuid4().hex[:6]}")
    advance(queue_order["id"], worker_a)  # received -> washing

    ready_unpaid = create_order(customer["id"], worker_a["outlet_id"], service, f"TEST_iter27_ui_ready_{uuid.uuid4().hex[:6]}")
    for _ in ("washing", "drying", "ironing", "packing", "ready"):
        advance(ready_unpaid["id"], worker_a)

    output = {
        "base_url": BASE_URL,
        "outlet_id": worker_a["outlet_id"],
        "actors": {"a": worker_a, "b": worker_b, "c": worker_c},
        "customer_id": customer["id"],
        "process_order": {"id": process_order["id"], "code": process_order["code"]},
        "queue_order": {"id": queue_order["id"], "code": queue_order["code"]},
        "ready_unpaid_order": {"id": ready_unpaid["id"], "code": ready_unpaid["code"]},
    }
    out_file = ROOT / "tests" / "iter27_ui_seed.json"
    out_file.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(str(out_file))
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
