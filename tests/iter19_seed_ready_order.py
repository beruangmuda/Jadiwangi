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
    raise RuntimeError("EXPO_BACKEND_URL/EXPO_PUBLIC_BACKEND_URL is missing")
API = f"{BASE_URL}/api"


def main():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})

    login = s.post(f"{API}/auth/login", json={"username": "Pegawai", "password": "pegawai123"})
    login.raise_for_status()
    ctx = login.json()
    outlet_id = ctx["employee"]["outlet_id"]
    employee_id = ctx["employee"]["id"]
    employee_name = ctx["employee"].get("name") or "Pegawai"

    suffix = str(uuid.uuid4().int)[-8:]
    customer_payload = {
        "name": f"TEST_iter19_ready_customer_{suffix}",
        "phone": f"08{suffix}29",
        "address": "TEST_iter19_ready",
        "outlet_id": outlet_id,
    }
    customer = s.post(f"{API}/customers", json=customer_payload)
    customer.raise_for_status()
    customer_id = customer.json()["id"]

    services = s.get(f"{API}/services", params={"outlet_id": outlet_id})
    services.raise_for_status()
    svc = services.json()[0]
    min_kg = float(svc.get("min_kg") or 0)
    qty = max(3.0, min_kg) if svc["unit"] == "kg" else 1

    order_payload = {
        "customer_id": customer_id,
        "outlet_id": outlet_id,
        "delivery_type": "self",
        "notes": "TEST_iter19_ready_rollback",
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
    order = s.post(f"{API}/orders", json=order_payload)
    order.raise_for_status()
    order_data = order.json()

    for _ in ["washing", "drying", "ironing", "packing", "ready"]:
        adv = s.post(
            f"{API}/orders/{order_data['id']}/advance",
            json={"employee_id": employee_id, "employee_name": employee_name},
        )
        adv.raise_for_status()

    print(
        json.dumps(
            {
                "outlet_id": outlet_id,
                "employee_id": employee_id,
                "order_id": order_data["id"],
                "order_code": order_data["code"],
                "customer_id": customer_id,
                "customer_name": customer_payload["name"],
                "note": "TEST_iter19_ready_rollback",
            }
        )
    )


if __name__ == "__main__":
    main()
