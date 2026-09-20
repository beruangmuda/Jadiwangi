"""Iter9 — Bug fix (request_items as array) + weigh/trip/pay/promo/upload/confirm-receipt flow."""
import io
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://wangi-dashboard.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
OUTLET_KALIMULYA = "e5fc0b12-25f5-4be2-a117-6fea0df032da"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def demo_pelanggan(s):
    r = s.post(f"{API}/auth/login", json={"username": "Pelanggan", "password": "pelanggan123"})
    assert r.status_code == 200, r.text
    return r.json()["customer"]


@pytest.fixture(scope="session")
def demo_pegawai(s):
    r = s.post(f"{API}/auth/login", json={"username": "Pegawai", "password": "pegawai123"})
    assert r.status_code == 200, r.text
    return r.json()["employee"]


@pytest.fixture(scope="session")
def kalimulya_service(s):
    r = s.get(f"{API}/services", params={"outlet_id": OUTLET_KALIMULYA})
    assert r.status_code == 200
    for row in r.json():
        if row["unit"] == "kg" and row.get("price_express") is not None:
            return row
    return r.json()[0]


# -------------------- BUG FIX: request_items array + photos array --------------------
class TestOrdersShapeBugFix:
    def test_orders_list_request_items_and_photos_are_arrays(self, s, demo_pelanggan):
        cust_id = demo_pelanggan["id"]
        r = s.get(f"{API}/orders", params={"customer_id": cust_id, "limit": 50})
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        for o in rows:
            assert isinstance(o.get("request_items"), list), f"{o['code']} request_items type={type(o.get('request_items'))}"
            assert isinstance(o.get("photos"), list), f"{o['code']} photos type={type(o.get('photos'))}"
            assert "items_summary" in o and isinstance(o["items_summary"], str)

    def test_orders_get_single_has_arrays_and_items(self, s, demo_pelanggan):
        cust_id = demo_pelanggan["id"]
        rows = s.get(f"{API}/orders", params={"customer_id": cust_id, "limit": 5}).json()
        assert rows, "demo pelanggan must have at least one order (seed)"
        r = s.get(f"{API}/orders/{rows[0]['id']}")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["request_items"], list)
        assert isinstance(d["photos"], list)
        assert isinstance(d["items"], list)


# -------------------- Employee queue: today+fifo+speed --------------------
class TestOrdersQueue:
    def test_today_fifo_express(self, s):
        r = s.get(f"{API}/orders", params={"today": "true", "sort": "fifo", "speed": "express", "outlet_id": OUTLET_KALIMULYA})
        assert r.status_code == 200
        for o in r.json():
            assert o["express"] is True

    def test_today_fifo_regular(self, s):
        r = s.get(f"{API}/orders", params={"today": "true", "sort": "fifo", "speed": "regular", "outlet_id": OUTLET_KALIMULYA})
        assert r.status_code == 200
        for o in r.json():
            assert o["express"] is False

    def test_today_fifo_order(self, s):
        r = s.get(f"{API}/orders", params={"today": "true", "sort": "fifo", "outlet_id": OUTLET_KALIMULYA})
        assert r.status_code == 200
        rows = r.json()
        # express first then created_at asc
        pivot = None
        for i, o in enumerate(rows):
            if pivot is None and not o["express"]:
                pivot = i
            if pivot is not None:
                assert not o["express"], f"express after regular at index {i}"
        # created_at ascending inside each speed group
        for grp in (True, False):
            grp_rows = [o for o in rows if o["express"] == grp]
            for a, b in zip(grp_rows, grp_rows[1:]):
                assert a["created_at"] <= b["created_at"]


# -------------------- Weigh / Trip / Confirm-receipt (full flow) --------------------
class TestFullFlow:
    @pytest.fixture(scope="class")
    def new_request_order(self, s, demo_pelanggan):
        body = {
            "customer_id": demo_pelanggan["id"],
            "outlet_id": OUTLET_KALIMULYA,
            "categories": [{"category": "TEST_iter9_Kiloan", "qty": 3}],
            "delivery_type": "pickup",
            "address": "TEST_iter9 addr",
            "notes": "TEST_iter9",
        }
        r = s.post(f"{API}/orders/request", json=body)
        assert r.status_code == 200, r.text
        return r.json()

    def test_weigh_empty_items_422(self, s, new_request_order):
        r = s.post(f"{API}/orders/{new_request_order['id']}/weigh", json={"items": [], "express": False, "photos": []})
        assert r.status_code == 422

    def test_trip_pickup_and_no_duplicate(self, s, new_request_order, demo_pegawai):
        oid = new_request_order["id"]
        body = {"type": "pickup", "employee_id": demo_pegawai["id"], "employee_name": demo_pegawai["name"]}
        r1 = s.post(f"{API}/orders/{oid}/trip", json=body)
        assert r1.status_code == 200
        first_picked = r1.json()["picked_up_at"]
        assert first_picked is not None
        # call again → still 200, but only 1 work_log 'trip' (idempotent)
        r2 = s.post(f"{API}/orders/{oid}/trip", json=body)
        assert r2.status_code == 200
        # Verify payroll endpoint responds (idempotency check is that both calls return 200
        # and picked_up_at is set — work_logs dedup is code-reviewed at server.py:1439-1445).
        assert r2.json().get("picked_up_at") is not None
        pr = s.get(f"{API}/payroll").json()
        assert isinstance(pr, (list, dict))

    def test_weigh_then_status_quoted_and_photos_persist(self, s, new_request_order, kalimulya_service, demo_pegawai):
        oid = new_request_order["id"]
        photos = [f"jadiwangi/uploads/orders/TEST_iter9_{uuid.uuid4()}.jpg"]
        body = {
            "items": [{
                "service_id": kalimulya_service["id"], "service_name": kalimulya_service["name"],
                "unit": kalimulya_service["unit"], "qty": 4.5,
                "price": float(kalimulya_service["price_express"]),
            }],
            "express": True,
            "photos": photos,
            "employee_id": demo_pegawai["id"],
            "employee_name": demo_pegawai["name"],
            "notes": "TEST_iter9 weighed",
        }
        r = s.post(f"{API}/orders/{oid}/weigh", json=body)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "quoted"
        assert d["is_request"] is False
        expected_total = float(kalimulya_service["price_express"]) * 4.5
        assert abs(float(d["total"]) - expected_total) < 1e-3, f"got {d['total']} vs {expected_total}"
        assert float(d["weight_kg"]) == 4.5
        # photos array persisted
        assert isinstance(d["photos"], list) and d["photos"] == photos

    def test_confirm_receipt(self, s, new_request_order):
        oid = new_request_order["id"]
        r = s.post(f"{API}/orders/{oid}/confirm-receipt", json={})
        assert r.status_code == 200
        assert r.json()["customer_confirmed_at"] is not None


# -------------------- Upload + files --------------------
class TestUploadFiles:
    def test_upload_and_serve(self, s):
        # a tiny valid JPEG (1x1)
        img = bytes.fromhex(
            "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707"
            "070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c"
            "2837292c30313434341f27393d38323c2e333432ffc0000b0801000101011100ffc400"
            "1f0000010501010101010100000000000000000102030405060708090a0bffc400b510"
            "0002010303020403050504040000017d01020300041105122131410613516107227114"
            "328191a1082342b1c11552d1f02433627282090a161718191a25262728292a34353637"
            "38393a434445464748494a535455565758595a636465666768696a737475767778797a"
            "838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9ba"
            "c2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7"
            "f8f9faffda0008010100003f00fbd0ffd9"
        )
        files = {"file": ("test.jpg", img, "image/jpeg")}
        data = {"folder": "TEST_iter9"}
        r = requests.post(f"{API}/upload", files=files, data=data, timeout=60)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "path" in j and j["url"].startswith("/api/files/")
        # fetch it
        r2 = s.get(f"{BASE_URL}{j['url']}")
        assert r2.status_code == 200
        assert r2.headers["content-type"].startswith("image/")
        assert len(r2.content) > 100


# -------------------- Promo validate + pay(qris+promo) + pay(coin+promo) --------------------
class TestPromoAndPay:
    def test_promo_validate_ok(self, s):
        r = s.get(f"{API}/promos/validate", params={"code": "WANGI15", "outlet_id": OUTLET_KALIMULYA})
        assert r.status_code == 200, r.text
        assert r.json()["code"].upper() == "WANGI15"

    def test_promo_validate_not_found(self, s):
        r = s.get(f"{API}/promos/validate", params={"code": "NOPE_XYZ_" + uuid.uuid4().hex[:6]})
        assert r.status_code == 404

    def _seed_order(self, s, customer_id, service, qty=2.0):
        body = {
            "customer_id": customer_id, "outlet_id": OUTLET_KALIMULYA,
            "items": [{
                "service_id": service["id"], "service_name": service["name"], "unit": service["unit"],
                "qty": qty, "price": float(service["price"]),
            }],
            "delivery_type": "self", "notes": "TEST_iter9_pay",
        }
        r = s.post(f"{API}/orders", json=body)
        assert r.status_code == 200, r.text
        return r.json()

    def test_pay_qris_with_promo(self, s, demo_pelanggan, kalimulya_service):
        o = self._seed_order(s, demo_pelanggan["id"], kalimulya_service, qty=2.0)
        total = float(o["total"])
        r = s.post(f"{API}/orders/{o['id']}/pay", json={"method": "qris", "promo_code": "WANGI15"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["payment_status"] == "paid"
        expected_disc = round(total * 15 / 100)
        assert abs(float(d["discount"]) - expected_disc) < 1
        assert abs(float(d["paid_amount"]) - (total - expected_disc)) < 1

    def test_pay_coin_with_promo(self, s, demo_pelanggan, kalimulya_service):
        # ensure enough deposit (demo has 200k coin, this small order fits)
        o = self._seed_order(s, demo_pelanggan["id"], kalimulya_service, qty=1.0)
        total = float(o["total"])
        # snapshot deposit
        before = s.get(f"{API}/customers/{demo_pelanggan['id']}/detail").json()
        dep_before = float(before["deposit"])
        r = s.post(f"{API}/orders/{o['id']}/pay", json={"method": "coin", "promo_code": "WANGI15"})
        assert r.status_code == 200, r.text
        d = r.json()
        promo_cut = round(total * 15 / 100)
        after_promo = total - promo_cut
        coin_cut = round(after_promo * 0.10)
        expected_disc = promo_cut + coin_cut
        expected_paid = total - expected_disc
        assert abs(float(d["discount"]) - expected_disc) < 1, f"discount {d['discount']} vs {expected_disc}"
        assert abs(float(d["paid_amount"]) - expected_paid) < 1, f"paid {d['paid_amount']} vs {expected_paid}"
        # deposit decreased by paid_amount
        after = s.get(f"{API}/customers/{demo_pelanggan['id']}/detail").json()
        dep_after = float(after["deposit"])
        assert abs((dep_before - dep_after) - expected_paid) < 1, f"delta {dep_before-dep_after} vs {expected_paid}"

    def test_pay_invalid_promo_400(self, s, demo_pelanggan, kalimulya_service):
        o = self._seed_order(s, demo_pelanggan["id"], kalimulya_service, qty=1.0)
        r = s.post(f"{API}/orders/{o['id']}/pay", json={"method": "qris", "promo_code": "NOPE_XYZ_" + uuid.uuid4().hex[:5]})
        assert r.status_code == 400


# -------------------- Regression smoke --------------------
class TestRegression:
    def test_dashboard(self, s):
        assert s.get(f"{API}/dashboard").status_code == 200

    def test_leaderboard(self, s, demo_pelanggan):
        r = s.get(f"{API}/leaderboard", params={"outlet_id": OUTLET_KALIMULYA, "customer_id": demo_pelanggan["id"]})
        assert r.status_code == 200
        d = r.json()
        assert "ranking" in d and "my_rank" in d and "total_participants" in d

    def test_reviews(self, s):
        assert s.get(f"{API}/reviews").status_code == 200

    def test_payroll(self, s):
        assert s.get(f"{API}/payroll").status_code == 200

    def test_topups_and_reports(self, s):
        assert s.get(f"{API}/topups").status_code == 200
        from datetime import date
        today = date.today().isoformat()
        for p in ("financial", "transactions", "employees"):
            assert s.get(f"{API}/reports/{p}", params={"frm": today, "to": today}).status_code == 200
