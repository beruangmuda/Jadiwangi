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
SEED_FILE = ROOT / "tests" / ".iter25_ui_seed.json"


def _create_ready_order(session: requests.Session, outlet_id: str, employee_id: str, employee_name: str, customer_id: str, service: dict, note: str, pay_after_ready: bool):
    qty = max(4.0, float(service.get("min_kg") or 0)) if service.get("unit") == "kg" else 1.0
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
    order = created.json()

    for _ in ["washing", "drying", "ironing", "packing", "ready"]:
        advanced = session.post(
            f"{API}/orders/{order['id']}/advance",
            json={"employee_id": employee_id, "employee_name": employee_name},
            timeout=30,
        )
        advanced.raise_for_status()

    if pay_after_ready:
        paid = session.post(f"{API}/orders/{order['id']}/pay", json={"method": "cash"}, timeout=30)
        paid.raise_for_status()

    detail = session.get(f"{API}/orders/{order['id']}", timeout=30)
    detail.raise_for_status()
    return detail.json()


def main():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})

    login = session.post(f"{API}/auth/login", json={"username": "Pegawai", "password": "pegawai123"}, timeout=30)
    login.raise_for_status()
    ctx = login.json()
    employee = ctx.get("employee") or {}
    outlet_id = employee.get("outlet_id")
    if not outlet_id:
        raise RuntimeError("Pegawai outlet_id missing")

    employees_res = session.get(f"{API}/employees", params={"outlet_id": outlet_id}, timeout=30)
    employees_res.raise_for_status()
    employees = employees_res.json()
    target_employee = next((e for e in employees if (e.get("username") or "").lower() == "joko"), None) or employees[0]
    employee_id = target_employee["id"]
    employee_name = target_employee.get("name") or "Pegawai"

    suffix = str(uuid.uuid4().int)[-8:]
    customer_payload = {
        "name": f"TEST_iter25_ui_{suffix}",
        "phone": f"08{suffix}25",
        "address": "TEST iter25 ui",
        "outlet_id": outlet_id,
    }
    customer = session.post(f"{API}/customers", json=customer_payload, timeout=30)
    customer.raise_for_status()
    customer_id = customer.json()["id"]

    services = session.get(f"{API}/services", params={"outlet_id": outlet_id}, timeout=30)
    services.raise_for_status()
    rows = services.json()
    service = next((s for s in rows if s.get("unit") == "kg" and float(s.get("price") or 0) > 0), rows[0])

    unpaid_ready = _create_ready_order(
        session,
        outlet_id,
        employee_id,
        employee_name,
        customer_id,
        service,
        f"TEST_iter25_ui_unpaid_{suffix}",
        pay_after_ready=False,
    )
    paid_ready = _create_ready_order(
        session,
        outlet_id,
        employee_id,
        employee_name,
        customer_id,
        service,
        f"TEST_iter25_ui_paid_{suffix}",
        pay_after_ready=True,
    )

    payload = {
        "outlet_id": outlet_id,
        "employee_id": employee_id,
        "employee_name": employee_name,
        "customer_id": customer_id,
        "unpaid_order_id": unpaid_ready["id"],
        "unpaid_order_code": unpaid_ready["code"],
        "paid_order_id": paid_ready["id"],
        "paid_order_code": paid_ready["code"],
    }
    SEED_FILE.write_text(json.dumps(payload))
    print(json.dumps(payload))


if __name__ == "__main__":
    main()
