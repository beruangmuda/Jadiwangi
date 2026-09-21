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
SEED_FILE = ROOT / "tests" / ".iter17_ui_seed.json"


def main():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})

    login = s.post(f"{API}/auth/login", json={"username": "Pegawai", "password": "pegawai123"})
    login.raise_for_status()
    outlet_id = login.json().get("employee", {}).get("outlet_id")
    if not outlet_id:
        raise RuntimeError("Pegawai outlet_id missing")

    suffix = str(uuid.uuid4().int)[-8:]
    customer_payload = {
        "name": f"TEST_iter17_ui_{suffix}",
        "phone": f"08{suffix}70",
        "address": "TEST iter17 ui",
        "outlet_id": outlet_id,
    }
    customer = s.post(f"{API}/customers", json=customer_payload)
    customer.raise_for_status()
    customer_id = customer.json()["id"]

    services = s.get(f"{API}/services", params={"outlet_id": outlet_id})
    services.raise_for_status()
    svc_rows = services.json()
    svc = svc_rows[0]
    qty = max(4.0, float(svc.get("min_kg") or 0)) if svc.get("unit") == "kg" else 1.0

    order_payload = {
        "customer_id": customer_id,
        "outlet_id": outlet_id,
        "items": [
            {
                "service_id": svc["id"],
                "service_name": svc["name"],
                "unit": svc["unit"],
                "qty": qty,
                "price": float(svc["price"]),
            }
        ],
        "delivery_type": "self",
        "notes": "TEST_iter17_ui_seed",
        "payment_status": "unpaid",
        "payment_method": "qris",
        "created_by": "pegawai",
        "express": True,
    }
    order = s.post(f"{API}/orders", json=order_payload)
    order.raise_for_status()
    order_body = order.json()

    SEED_FILE.write_text(json.dumps({
        "customer_id": customer_id,
        "order_id": order_body["id"],
        "order_code": order_body["code"],
        "outlet_id": outlet_id,
    }))
    print(json.dumps({"ok": True, "seed": str(SEED_FILE), "order_id": order_body["id"], "order_code": order_body["code"]}))


if __name__ == "__main__":
    main()
