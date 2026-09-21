"""Jadiwangi App backend tests (username/password auth, per-outlet services + express)."""
import os
import uuid
from datetime import date
from pathlib import Path
import pytest
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / "frontend" / ".env")
BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL wajib tersedia untuk backend test")
API = f"{BASE_URL}/api"

OUTLETS = {
    "depok": ("e5fc0b12-25f5-4be2-a117-6fea0df032da", 41),
    "jakarta": ("a1564153-3b1a-4528-9132-1a4406acb094", 43),
    "bandung": ("654ab50b-111c-4e9b-8df3-ff7a9a1e0916", 43),
}


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------- Auth (username / password) ----------
class TestAuth:
    def test_owner_login(self, s):
        r = s.post(f"{API}/auth/login", json={"username": "owner", "password": "owner123"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["role"] == "owner"
        assert isinstance(d.get("outlets"), list) and len(d["outlets"]) == 3

    def test_owner_wrong_password(self, s):
        r = s.post(f"{API}/auth/login", json={"username": "owner", "password": "wrong"})
        assert r.status_code == 401

    def test_pegawai_login(self, s):
        r = s.post(f"{API}/auth/login", json={"username": "andi", "password": "pegawai123"})
        assert r.status_code == 200, r.text
        assert r.json().get("role") == "pegawai" or "employee" in r.json()


# ---------- Master data ----------
class TestOutlets:
    def test_list_three_outlets(self, s):
        r = s.get(f"{API}/outlets")
        assert r.status_code == 200
        ids = {o["id"] for o in r.json()}
        for oid, _ in OUTLETS.values():
            assert oid in ids


# ---------- Services per outlet with express pricing ----------
class TestServicesPerOutlet:
    """Verify per-outlet service counts + new columns (price_express/duration/duration_express/min_kg/category)."""

    @pytest.mark.parametrize("key", list(OUTLETS.keys()))
    def test_outlet_service_count(self, s, key):
        oid, expected = OUTLETS[key]
        r = s.get(f"{API}/services", params={"outlet_id": oid})
        assert r.status_code == 200, r.text
        rows = r.json()
        assert len(rows) == expected, f"{key} expected {expected}, got {len(rows)}"

    @pytest.mark.parametrize("key", list(OUTLETS.keys()))
    def test_service_shape(self, s, key):
        oid, _ = OUTLETS[key]
        rows = s.get(f"{API}/services", params={"outlet_id": oid}).json()
        for row in rows:
            for k in ("id", "name", "category", "unit", "price",
                      "price_express", "duration", "duration_express", "min_kg", "outlet_id"):
                assert k in row, f"missing {k} in {key} service {row.get('name')}"
            assert row["outlet_id"] == oid

    def test_at_least_some_express_prices(self, s):
        """Regression: at least some services in each outlet should have price_express set."""
        for key, (oid, _) in OUTLETS.items():
            rows = s.get(f"{API}/services", params={"outlet_id": oid}).json()
            has_exp = [r for r in rows if r.get("price_express") is not None]
            assert has_exp, f"{key}: no services with price_express"

    def test_category_grouping(self, s):
        """At least Kiloan and Add-on categories present in Depok."""
        oid, _ = OUTLETS["depok"]
        rows = s.get(f"{API}/services", params={"outlet_id": oid}).json()
        cats = {r["category"] for r in rows}
        assert any(c.lower().startswith("kilo") for c in cats), f"cats={cats}"


# ---------- Service create/update persistence of new columns ----------
class TestServiceCRUD:
    def test_create_update_service_persists_new_columns(self, s):
        oid, _ = OUTLETS["depok"]
        name = f"TEST_Svc_{uuid.uuid4().hex[:6]}"
        body = {
            "name": name, "category": "Kiloan", "unit": "kg",
            "price": 8000, "price_express": 16000,
            "duration": "2 Hari", "duration_express": "6 Jam",
            "min_kg": 3, "outlet_id": oid,
            "icon": "washing-machine", "active": True,
        }
        r = s.post(f"{API}/services", json=body)
        assert r.status_code == 200, r.text
        created = r.json()
        sid = created["id"]
        assert float(created["price"]) == 8000
        assert float(created["price_express"]) == 16000
        assert created["duration"] == "2 Hari"
        assert created["duration_express"] == "6 Jam"
        assert float(created["min_kg"]) == 3
        assert created["outlet_id"] == oid

        # Update: change express price and duration
        body2 = dict(body, price=9000, price_express=18000, duration="1 Hari", duration_express="4 Jam", min_kg=5, active=False)
        r2 = s.put(f"{API}/services/{sid}", json=body2)
        assert r2.status_code == 200, r2.text
        u = r2.json()
        assert float(u["price"]) == 9000
        assert float(u["price_express"]) == 18000
        assert u["duration"] == "1 Hari"
        assert u["duration_express"] == "4 Jam"
        assert float(u["min_kg"]) == 5
        assert u["active"] is False

        # GET verify persistence: include inactive
        rows = s.get(f"{API}/services", params={"include_inactive": "true", "outlet_id": oid}).json()
        found = next((r for r in rows if r["id"] == sid), None)
        assert found is not None
        assert float(found["price_express"]) == 18000
        assert found["duration_express"] == "4 Jam"


# ---------- Order using express price ----------
class TestExpressOrder:
    def test_order_with_express_price_total(self, s):
        oid, _ = OUTLETS["depok"]
        # get a service that has price_express
        svcs = s.get(f"{API}/services", params={"outlet_id": oid}).json()
        svc = next((x for x in svcs if x.get("price_express") is not None), None)
        assert svc, "no express service found"

        # pick any customer at that outlet (fallback to any)
        cs = s.get(f"{API}/customers").json()
        cust = next((c for c in cs if c.get("outlet_id") == oid), cs[0])

        express_price = float(svc["price_express"])
        qty = 5
        body = {
            "customer_id": cust["id"], "outlet_id": oid,
            "items": [{
                "service_id": svc["id"],
                "service_name": f"{svc['name']} (Express)",
                "unit": svc["unit"], "qty": qty, "price": express_price,
            }],
            "delivery_type": "self",
            "notes": "TEST_express",
        }
        r = s.post(f"{API}/orders", json=body)
        assert r.status_code == 200, r.text
        order = r.json()
        assert abs(float(order["total"]) - express_price * qty) < 1e-6, \
            f"total mismatch: expected {express_price*qty}, got {order['total']}"

        # GET back and confirm items[0].price == express price
        got = s.get(f"{API}/orders/{order['id']}").json()
        assert abs(float(got["items"][0]["price"]) - express_price) < 1e-6

    def test_order_with_regular_price(self, s):
        oid, _ = OUTLETS["jakarta"]
        svcs = s.get(f"{API}/services", params={"outlet_id": oid}).json()
        svc = svcs[0]
        cs = s.get(f"{API}/customers").json()
        cust = next((c for c in cs if c.get("outlet_id") == oid), cs[0])
        regular = float(svc["price"])
        qty = 2
        body = {
            "customer_id": cust["id"], "outlet_id": oid,
            "items": [{"service_id": svc["id"], "service_name": svc["name"], "unit": svc["unit"], "qty": qty, "price": regular}],
        }
        r = s.post(f"{API}/orders", json=body)
        assert r.status_code == 200, r.text
        assert abs(float(r.json()["total"]) - regular * qty) < 1e-6


# ---------- Dashboard / Reports smoke ----------
class TestDashboardReports:
    def test_dashboard(self, s):
        r = s.get(f"{API}/dashboard")
        assert r.status_code == 200
        for k in ("today", "trend", "queue", "top_services"):
            assert k in r.json()

    def test_reports_today(self, s):
        today = date.today().isoformat()
        for path in ("financial", "transactions", "employees", "customers"):
            r = s.get(f"{API}/reports/{path}", params={"frm": today, "to": today})
            assert r.status_code == 200, f"{path}: {r.text}"
