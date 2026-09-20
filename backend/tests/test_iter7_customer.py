"""Iter7 backend tests: customer registration outlet gate, promos, leaderboard mask,
unpaid orders, pay methods (qris/cash/coin) with 10% coin discount."""
import os
import uuid
from datetime import date

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://wangi-dashboard.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
DEPOK = "e5fc0b12-25f5-4be2-a117-6fea0df032da"
JAKARTA = "a1564153-3b1a-4528-9132-1a4406acb094"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _rand_phone():
    return "08999" + uuid.uuid4().hex[:8]


# ---------- Registration: outlet is required ----------
class TestRegisterOutletGate:
    def test_register_without_outlet_id_returns_422(self, s):
        r = s.post(f"{API}/auth/register", json={
            "name": "TEST_NoOutlet", "phone": _rand_phone(), "password": "pelanggan123",
        })
        assert r.status_code == 422, r.text
        assert "outlet" in r.text.lower()

    def test_register_invalid_outlet_id_returns_422(self, s):
        r = s.post(f"{API}/auth/register", json={
            "name": "TEST_BadOutlet", "phone": _rand_phone(), "password": "pelanggan123",
            "outlet_id": str(uuid.uuid4()),
        })
        assert r.status_code == 422, r.text

    def test_register_with_valid_outlet_succeeds(self, s):
        phone = _rand_phone()
        r = s.post(f"{API}/auth/register", json={
            "name": "TEST_iter7_reg", "phone": phone, "password": "pelanggan123",
            "outlet_id": DEPOK,
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["role"] == "pelanggan"
        c = data["customer"]
        assert c["outlet_id"] == DEPOK
        # login should now succeed with the phone
        r2 = s.post(f"{API}/auth/login", json={"username": phone, "password": "pelanggan123"})
        assert r2.status_code == 200


# ---------- Patch customer outlet ----------
class TestPickOutlet:
    def test_patch_outlet_ok_and_404_paths(self, s):
        # create a customer w/o outlet (allowed by POST /api/customers)
        phone = _rand_phone()
        cr = s.post(f"{API}/customers", json={"name": "TEST_iter7_pick", "phone": phone})
        assert cr.status_code == 200, cr.text
        cid = cr.json()["id"]
        # unknown outlet -> 404
        r_bad = s.patch(f"{API}/customers/{cid}/outlet", json={"outlet_id": str(uuid.uuid4())})
        assert r_bad.status_code == 404
        # unknown customer -> 404
        r_bad_c = s.patch(f"{API}/customers/{uuid.uuid4()}/outlet", json={"outlet_id": DEPOK})
        assert r_bad_c.status_code == 404
        # ok
        r_ok = s.patch(f"{API}/customers/{cid}/outlet", json={"outlet_id": JAKARTA})
        assert r_ok.status_code == 200, r_ok.text
        assert r_ok.json()["outlet_id"] == JAKARTA


# ---------- Promos ----------
class TestPromos:
    def test_two_promos_seeded_per_outlet(self, s):
        r = s.get(f"{API}/promos", params={"outlet_id": DEPOK})
        assert r.status_code == 200
        rows = r.json()
        # seeded per outlet = 2, but query also returns outlet_id is null; ensure at least 2
        assert len(rows) >= 2
        # both seeded ones are active and not expired
        for p in rows:
            assert p["active"] is True


# ---------- Leaderboard ----------
class TestLeaderboard:
    def test_leaderboard_mask_and_no_spend(self, s):
        cs = s.get(f"{API}/customers", params={"outlet_id": DEPOK}).json()
        assert cs, "no customers in Depok outlet"
        cid = cs[0]["id"]
        r = s.get(f"{API}/leaderboard", params={"outlet_id": DEPOK, "customer_id": cid})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "my_rank" in d and d["my_rank"] is not None
        for k in ("rank", "points", "total_kg", "orders", "is_me"):
            assert k in d["my_rank"], f"my_rank missing {k}"
        assert d["my_rank"]["is_me"] is True
        assert isinstance(d["total_participants"], int) and d["total_participants"] > 0
        # ranking rows: no 'spend' key anywhere; others' names masked
        for e in d["ranking"]:
            assert "spend" not in e, "leaderboard must not expose 'spend'"
            if not e["is_me"]:
                assert "•" in e["name"], f"other name should be masked, got {e['name']}"
            else:
                assert "•" not in e["name"]


# ---------- Unpaid orders ----------
class TestUnpaidOrders:
    def test_unpaid_filter(self, s):
        cs = s.get(f"{API}/customers", params={"outlet_id": DEPOK}).json()
        # take demo pelanggan named 'Pelanggan' if present, else pick first
        target = next((c for c in cs if (c.get("name") or "").lower() == "pelanggan"), cs[0])
        r = s.get(f"{API}/orders", params={"customer_id": target["id"], "unpaid": "true"})
        assert r.status_code == 200
        for o in r.json():
            assert o["payment_status"] == "unpaid"
            assert o["status"] != "cancelled"
            assert float(o["total"]) > 0


# ---------- Pay methods ----------
def _make_paid_target_order(s, outlet_id, customer_id, price=10000):
    svcs = s.get(f"{API}/services", params={"outlet_id": outlet_id}).json()
    svc = svcs[0]
    body = {
        "customer_id": customer_id, "outlet_id": outlet_id,
        "items": [{"service_id": svc["id"], "service_name": svc["name"], "unit": svc["unit"],
                   "qty": 1, "price": price}],
        "notes": "TEST_iter7_pay",
    }
    r = s.post(f"{API}/orders", json=body)
    assert r.status_code == 200, r.text
    return r.json()


class TestPayFlow:
    def _pick_cust(self, s):
        cs = s.get(f"{API}/customers", params={"outlet_id": DEPOK}).json()
        assert cs
        return cs[0]

    def test_pay_qris_full_amount(self, s):
        cust = self._pick_cust(s)
        order = _make_paid_target_order(s, DEPOK, cust["id"], price=20000)
        r = s.post(f"{API}/orders/{order['id']}/pay", json={"method": "qris"})
        assert r.status_code == 200, r.text
        got = s.get(f"{API}/orders/{order['id']}").json()
        assert got["payment_status"] == "paid"
        assert got["payment_method"] == "qris"
        assert float(got.get("discount") or 0) == 0
        assert abs(float(got["paid_amount"]) - 20000) < 1e-6

    def test_pay_cash_full_amount(self, s):
        cust = self._pick_cust(s)
        order = _make_paid_target_order(s, DEPOK, cust["id"], price=15000)
        r = s.post(f"{API}/orders/{order['id']}/pay", json={"method": "cash"})
        assert r.status_code == 200, r.text
        got = s.get(f"{API}/orders/{order['id']}").json()
        assert got["payment_status"] == "paid"
        assert float(got.get("discount") or 0) == 0
        assert abs(float(got["paid_amount"]) - 15000) < 1e-6

    def test_pay_coin_10pct_discount_and_deducts_deposit(self, s):
        # ensure customer has enough deposit
        cust = self._pick_cust(s)
        # top up deposit to something large
        cur = s.get(f"{API}/customers", params={"outlet_id": DEPOK}).json()
        cust_row = next(c for c in cur if c["id"] == cust["id"])
        # update via PUT to set deposit large
        put = s.put(f"{API}/customers/{cust['id']}", json={
            "name": cust_row["name"], "phone": cust_row.get("phone", ""),
            "email": cust_row.get("email", ""), "address": cust_row.get("address", ""),
            "deposit": 500000, "outlet_id": DEPOK,
        })
        assert put.status_code == 200, put.text
        pre_dep = float(put.json()["deposit"])

        order = _make_paid_target_order(s, DEPOK, cust["id"], price=10000)  # total 10.000
        r = s.post(f"{API}/orders/{order['id']}/pay", json={"method": "coin"})
        assert r.status_code == 200, r.text
        got = s.get(f"{API}/orders/{order['id']}").json()
        assert got["payment_method"] == "coin"
        assert float(got["discount"]) == 1000  # 10% of 10.000
        assert abs(float(got["paid_amount"]) - 9000) < 1.0
        # deposit reduced by paid_amount
        after = next(c for c in s.get(f"{API}/customers", params={"outlet_id": DEPOK}).json() if c["id"] == cust["id"])
        assert abs((pre_dep - float(after["deposit"])) - 9000) < 1.0

    def test_pay_coin_insufficient_deposit_returns_400(self, s):
        # customer with zero deposit
        phone = _rand_phone()
        cr = s.post(f"{API}/customers", json={
            "name": "TEST_iter7_broke", "phone": phone, "outlet_id": DEPOK, "deposit": 0,
        })
        assert cr.status_code == 200
        cid = cr.json()["id"]
        order = _make_paid_target_order(s, DEPOK, cid, price=25000)
        r = s.post(f"{API}/orders/{order['id']}/pay", json={"method": "coin"})
        assert r.status_code == 400, r.text
        assert "coin" in r.text.lower()

    def test_pay_idempotent_when_already_paid(self, s):
        cust = self._pick_cust(s)
        order = _make_paid_target_order(s, DEPOK, cust["id"], price=8000)
        r1 = s.post(f"{API}/orders/{order['id']}/pay", json={"method": "qris"})
        assert r1.status_code == 200
        r2 = s.post(f"{API}/orders/{order['id']}/pay", json={"method": "qris"})
        assert r2.status_code == 200, r2.text
        # still paid, no extra changes explosion
        got = s.get(f"{API}/orders/{order['id']}").json()
        assert got["payment_status"] == "paid"


# ---------- Regressions ----------
class TestRegressions:
    def test_dashboard(self, s):
        r = s.get(f"{API}/dashboard")
        assert r.status_code == 200
        for k in ("today", "trend", "queue", "top_services"):
            assert k in r.json()

    def test_reports_today(self, s):
        today = date.today().isoformat()
        for path in ("financial", "transactions", "employees"):
            r = s.get(f"{API}/reports/{path}", params={"frm": today, "to": today})
            assert r.status_code == 200, f"{path}: {r.text}"

    def test_payroll_current_period(self, s):
        period = date.today().strftime("%Y-%m")
        r = s.get(f"{API}/payroll", params={"period": period})
        assert r.status_code == 200

    def test_services_by_outlet(self, s):
        r = s.get(f"{API}/services", params={"outlet_id": DEPOK})
        assert r.status_code == 200
        assert len(r.json()) > 0

    def test_orders_request_endpoint(self, s):
        cs = s.get(f"{API}/customers", params={"outlet_id": DEPOK}).json()
        cust = cs[0]
        r = s.post(f"{API}/orders/request", json={
            "customer_id": cust["id"], "outlet_id": DEPOK,
            "categories": [{"category": "Kiloan", "qty": 3}],
            "delivery_type": "self", "notes": "TEST_iter7_request",
        })
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "requested"
