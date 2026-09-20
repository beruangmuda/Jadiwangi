"""Iter6 tests: Dashboard top_customers, today-only orders, customer DB with aggregates, cancel flow."""
import os
import pytest
import requests
from datetime import datetime

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"


@pytest.fixture(scope="module")
def owner_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"username": "owner", "password": "owner123"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"session": s, "outlets": data.get("outlets", []), "data": data}


@pytest.fixture(scope="module")
def outlet_id(owner_session):
    outlets = owner_session["outlets"]
    assert outlets
    # Prefer Kalimulya (per problem statement)
    for o in outlets:
        if "Kalimulya" in (o.get("name", "") + o.get("city", "")):
            return o["id"]
    return outlets[0]["id"]


# ---- Dashboard: top_customers (<=3) with required fields for current month ----
class TestDashboardTopCustomers:
    def test_top_customers_shape(self, owner_session, outlet_id):
        r = owner_session["session"].get(f"{API}/dashboard?outlet_id={outlet_id}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "top_customers" in d
        tc = d["top_customers"]
        assert isinstance(tc, list)
        assert len(tc) <= 3
        for c in tc:
            assert set(["name", "kg", "spend", "orders"]).issubset(c.keys())
            assert isinstance(c["name"], str)
            assert isinstance(c["kg"], (int, float))
            assert isinstance(c["spend"], (int, float))
            assert isinstance(c["orders"], int)

    def test_top_customers_ordered_by_spend_desc(self, owner_session, outlet_id):
        r = owner_session["session"].get(f"{API}/dashboard?outlet_id={outlet_id}")
        tc = r.json()["top_customers"]
        if len(tc) >= 2:
            assert tc[0]["spend"] >= tc[1]["spend"]

    def test_dashboard_trend_month(self, owner_session, outlet_id):
        r = owner_session["session"].get(f"{API}/dashboard?outlet_id={outlet_id}")
        d = r.json()
        assert "trend" in d and isinstance(d["trend"], list)
        # Trend covers current month up to today
        today_day = datetime.utcnow().day
        assert len(d["trend"]) >= 1
        assert d["trend"][-1]["day"] == today_day
        for p in d["trend"]:
            assert "day" in p and "omzet" in p and "pendapatan" in p


# ---- Today-only orders ----
class TestOrdersToday:
    def test_today_filter(self, owner_session, outlet_id):
        r = owner_session["session"].get(f"{API}/orders?today=true&outlet_id={outlet_id}")
        assert r.status_code == 200
        orders = r.json()
        today = datetime.utcnow().date().isoformat()
        for o in orders:
            assert o["created_at"].startswith(today), f"non-today order leaked: {o['created_at']}"


# ---- Customers list: aggregate fields + address ----
class TestCustomersList:
    def test_customers_have_aggregates(self, owner_session):
        r = owner_session["session"].get(f"{API}/customers")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and rows
        c = rows[0]
        for key in ["id", "name", "phone", "address", "total_kg", "tx_count", "total_spend", "first_order", "last_order", "outlet_name"]:
            assert key in c, f"missing key {key} in customer row"
        assert isinstance(c["tx_count"], int)
        assert isinstance(c["total_kg"], (int, float))
        assert isinstance(c["total_spend"], (int, float))

    def test_customers_search(self, owner_session):
        r = owner_session["session"].get(f"{API}/customers?q=a")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)


# ---- Customer detail ----
class TestCustomerDetail:
    def test_detail_shape(self, owner_session):
        r = owner_session["session"].get(f"{API}/customers")
        # Find a customer with tx_count>0 to check recent_orders content
        pick = next((c for c in r.json() if c["tx_count"] > 0), r.json()[0])
        d = owner_session["session"].get(f"{API}/customers/{pick['id']}/detail")
        assert d.status_code == 200
        dj = d.json()
        for key in ["name", "phone", "address", "total_kg", "tx_count", "total_spend", "first_order", "last_order", "recent_orders", "deposit"]:
            assert key in dj, f"missing {key}"
        assert isinstance(dj["recent_orders"], list)
        if dj["tx_count"] > 0:
            assert len(dj["recent_orders"]) >= 1
            ro = dj["recent_orders"][0]
            for k in ["code", "total", "status", "weight_kg", "created_at"]:
                assert k in ro

    def test_detail_404(self, owner_session):
        d = owner_session["session"].get(f"{API}/customers/00000000-0000-0000-0000-000000000000/detail")
        assert d.status_code == 404


# ---- Create/Update customer persists address ----
class TestCustomerCRUD:
    created_id = None

    def test_create_with_address(self, owner_session, outlet_id):
        payload = {
            "name": "TEST_iter6_cust",
            "phone": "0812TEST6",
            "email": "",
            "address": "Jl. Jadiwangi 6 Depok",
            "deposit": 5000,
            "outlet_id": outlet_id,
        }
        r = owner_session["session"].post(f"{API}/customers", json=payload)
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["name"] == payload["name"]
        assert c["address"] == payload["address"]
        assert float(c.get("deposit", 0)) == 5000
        TestCustomerCRUD.created_id = c["id"]

    def test_get_shows_address_persisted(self, owner_session):
        assert TestCustomerCRUD.created_id
        r = owner_session["session"].get(f"{API}/customers/{TestCustomerCRUD.created_id}/detail")
        assert r.status_code == 200
        assert r.json()["address"] == "Jl. Jadiwangi 6 Depok"

    def test_update_address(self, owner_session, outlet_id):
        assert TestCustomerCRUD.created_id
        payload = {
            "name": "TEST_iter6_cust",
            "phone": "0812TEST6",
            "email": "",
            "address": "Jl. Baru 99",
            "deposit": 5000,
            "outlet_id": outlet_id,
        }
        r = owner_session["session"].put(f"{API}/customers/{TestCustomerCRUD.created_id}", json=payload)
        assert r.status_code == 200
        assert r.json()["address"] == "Jl. Baru 99"
        # Verify via GET
        g = owner_session["session"].get(f"{API}/customers/{TestCustomerCRUD.created_id}/detail")
        assert g.json()["address"] == "Jl. Baru 99"


# ---- Cancel order flow ----
class TestCancelOrder:
    def test_cancel_removes_from_omzet(self, owner_session, outlet_id):
        # find a today's active order for test outlet
        r = owner_session["session"].get(f"{API}/orders?today=true&outlet_id={outlet_id}")
        orders = [o for o in r.json() if o["status"] not in ("completed", "cancelled")]
        if not orders:
            pytest.skip("No cancellable today order to test")
        target = orders[0]

        # get pre-cancel dashboard omzet
        pre = owner_session["session"].get(f"{API}/dashboard?outlet_id={outlet_id}").json()
        pre_omzet = pre["today"]["omzet"]

        c = owner_session["session"].post(
            f"{API}/orders/{target['id']}/cancel", json={"reason": "TEST_iter6 cancel"}
        )
        assert c.status_code == 200
        assert c.json()["status"] == "cancelled"
        assert c.json().get("cancel_reason") == "TEST_iter6 cancel"

        post = owner_session["session"].get(f"{API}/dashboard?outlet_id={outlet_id}").json()
        # omzet should drop by target total (approx)
        assert post["today"]["omzet"] <= pre_omzet - float(target["total"]) + 0.01

    def test_cancel_missing_order(self, owner_session):
        r = owner_session["session"].post(
            f"{API}/orders/00000000-0000-0000-0000-000000000000/cancel",
            json={"reason": "x"},
        )
        assert r.status_code == 404
