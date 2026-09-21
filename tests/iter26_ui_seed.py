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
    raise RuntimeError("Missing EXPO_BACKEND_URL/EXPO_PUBLIC_BACKEND_URL")

API = f"{BASE_URL}/api"
SEED_FILE = ROOT / "tests" / ".iter26_ui_seed.json"


def _create_order(session: requests.Session, outlet_id: str, customer_id: str, service: dict, note: str, payment_status: str):
    qty = max(4.0, float(service.get("min_kg") or 0)) if service.get("unit") == "kg" else 1.0
    payload = {
        "customer_id": customer_id,
        "outlet_id": outlet_id,
        "delivery_type": "self",
        "notes": note,
        "payment_status": payment_status,
        "payment_method": "cash" if payment_status == "paid" else "qris",
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
    created = session.post(f"{API}/orders", json=payload, timeout=30)
    created.raise_for_status()
    return created.json()


def _advance_to(session: requests.Session, order_id: str, employee_id: str, employee_name: str, target: str):
    pipeline = ["washing", "drying", "ironing", "packing", "ready"]
    idx = pipeline.index(target)
    for expected in pipeline[: idx + 1]:
        advanced = session.post(
            f"{API}/orders/{order_id}/advance",
            json={"employee_id": employee_id, "employee_name": employee_name},
            timeout=30,
        )
        advanced.raise_for_status()
        if advanced.json().get("status") != expected:
            raise RuntimeError(f"advance mismatch for {order_id}: expected {expected} got {advanced.json().get('status')}")


def main():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})

    login = session.post(f"{API}/auth/login", json={"username": "Pegawai", "password": "pegawai123"}, timeout=30)
    login.raise_for_status()
    employee = (login.json() or {}).get("employee") or {}
    outlet_id = employee.get("outlet_id")
    if not outlet_id:
        raise RuntimeError("Pegawai outlet_id missing")

    employees_res = session.get(f"{API}/employees", params={"outlet_id": outlet_id}, timeout=30)
    employees_res.raise_for_status()
    employees = employees_res.json() or []
    target_employee = next((e for e in employees if (e.get("username") or "").lower() == "joko"), None) or employees[0]
    employee_id = target_employee["id"]
    employee_name = target_employee.get("name") or "Joko Produksi"

    suffix = str(uuid.uuid4().int)[-8:]
    customer_payload = {
        "name": f"TEST_iter26_ui_{suffix}",
        "phone": f"08{suffix}26",
        "address": "TEST iter26 ui",
        "outlet_id": outlet_id,
    }
    customer = session.post(f"{API}/customers", json=customer_payload, timeout=30)
    customer.raise_for_status()
    customer_id = customer.json()["id"]

    services = session.get(f"{API}/services", params={"outlet_id": outlet_id}, timeout=30)
    services.raise_for_status()
    rows = services.json() or []
    service = next((s for s in rows if s.get("unit") == "kg" and float(s.get("price") or 0) > 0), rows[0])

    queue_unpaid = _create_order(session, outlet_id, customer_id, service, f"TEST_iter26_ui_queue_unpaid_{suffix}", "unpaid")
    queue_paid = _create_order(session, outlet_id, customer_id, service, f"TEST_iter26_ui_queue_paid_{suffix}", "paid")

    process_order = _create_order(session, outlet_id, customer_id, service, f"TEST_iter26_ui_process_{suffix}", "unpaid")
    _advance_to(session, process_order["id"], employee_id, employee_name, "drying")

    ready_unpaid = _create_order(session, outlet_id, customer_id, service, f"TEST_iter26_ui_ready_unpaid_{suffix}", "unpaid")
    _advance_to(session, ready_unpaid["id"], employee_id, employee_name, "ready")

    ready_paid = _create_order(session, outlet_id, customer_id, service, f"TEST_iter26_ui_ready_paid_{suffix}", "paid")
    _advance_to(session, ready_paid["id"], employee_id, employee_name, "ready")

    payload = {
        "outlet_id": outlet_id,
        "employee_id": employee_id,
        "employee_name": employee_name,
        "customer_id": customer_id,
        "queue_unpaid_id": queue_unpaid["id"],
        "queue_unpaid_code": queue_unpaid["code"],
        "queue_paid_id": queue_paid["id"],
        "queue_paid_code": queue_paid["code"],
        "process_order_id": process_order["id"],
        "process_order_code": process_order["code"],
        "ready_unpaid_id": ready_unpaid["id"],
        "ready_unpaid_code": ready_unpaid["code"],
        "ready_paid_id": ready_paid["id"],
        "ready_paid_code": ready_paid["code"],
    }
    SEED_FILE.write_text(json.dumps(payload))
    print(json.dumps(payload))


if __name__ == "__main__":
    main()
