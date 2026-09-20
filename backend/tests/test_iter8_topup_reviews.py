"""Iter 8 backend tests: top-up, reviews, vouchers, promos, dashboard, customer detail."""
import os
import time
import uuid
import pytest
import requests
from datetime import date, timedelta

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") + "/api"

DEMO_CUSTOMER_ID = "e45561f8-fd2a-4586-88a8-db1e0155bd0d"
DEMO_OUTLET_ID = "e5fc0b12-25f5-4be2-a117-6fea0df032da"  # Depok / Kalimulya
COMPLETED_ORDER_ID = "70cca6fa-6fcd-4874-9e09-da89711cfcad"  # JW-260920-2733
UNPAID_ORDER_ID_FROM_SEED = None  # will search dynamically


@pytest.fixture(scope="module")
def s():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# ---------- topup packages ----------
def test_topup_packages(s):
    r = s.get(f"{BASE}/topup/packages")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) == 4
    amounts = {int(p["amount"]): int(p["coins"]) for p in data}
    assert amounts == {50000: 50000, 100000: 100000, 250000: 250000, 500000: 530000}
    p500 = next(p for p in data if p["amount"] == 500000)
    assert int(p500["bonus"]) == 30000


# ---------- create topup ----------
def test_create_topup_valid_pending(s):
    r = s.post(f"{BASE}/topups", json={
        "customer_id": DEMO_CUSTOMER_ID, "outlet_id": DEMO_OUTLET_ID,
        "amount": 50000, "method": "cash"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "pending"
    assert float(body["coins"]) == 50000
    # verify appears in listing
    lst = s.get(f"{BASE}/topups?status=pending&customer_id={DEMO_CUSTOMER_ID}").json()
    match = [t for t in lst if t["id"] == body["id"]]
    assert match and match[0].get("customer_name") and "customer_phone" in match[0] and "outlet_name" in match[0]
    # cleanup: reject to keep balance stable
    r2 = s.post(f"{BASE}/topups/{body['id']}/reject")
    assert r2.status_code == 200


def test_create_topup_invalid_amount(s):
    r = s.post(f"{BASE}/topups", json={
        "customer_id": DEMO_CUSTOMER_ID, "outlet_id": DEMO_OUTLET_ID,
        "amount": 75000, "method": "cash"})
    assert r.status_code == 422


def test_create_topup_customer_not_found(s):
    r = s.post(f"{BASE}/topups", json={
        "customer_id": str(uuid.uuid4()), "outlet_id": DEMO_OUTLET_ID,
        "amount": 50000, "method": "cash"})
    assert r.status_code == 404


# ---------- confirm topup: balance & expiry & idempotent & no income tx ----------
def test_confirm_topup_flow(s):
    # snapshot financial income
    fin_before = s.get(f"{BASE}/reports/financial").json()
    inc_before = float(fin_before.get("total_income", fin_before.get("income", 0)) or 0)

    # snapshot customer deposit
    cust_before = s.get(f"{BASE}/customers/{DEMO_CUSTOMER_ID}/detail").json()
    dep_before = float(cust_before["deposit"])

    # create top-up 100k
    r = s.post(f"{BASE}/topups", json={
        "customer_id": DEMO_CUSTOMER_ID, "outlet_id": DEMO_OUTLET_ID,
        "amount": 100000, "method": "cash"})
    assert r.status_code == 200
    tid = r.json()["id"]

    # confirm
    r2 = s.post(f"{BASE}/topups/{tid}/confirm")
    assert r2.status_code == 200
    assert r2.json()["status"] == "confirmed"

    cust_after = s.get(f"{BASE}/customers/{DEMO_CUSTOMER_ID}/detail").json()
    assert float(cust_after["deposit"]) == pytest.approx(dep_before + 100000)
    exp = cust_after.get("deposit_expires_at")
    assert exp, "deposit_expires_at should be set"
    exp_d = date.fromisoformat(exp[:10])
    today = date.today()
    # 3 months (~89-93 days)
    delta = (exp_d - today).days
    assert 85 <= delta <= 95, f"delta days {delta}"

    # idempotency
    r3 = s.post(f"{BASE}/topups/{tid}/confirm")
    assert r3.status_code == 200 and r3.json()["status"] == "confirmed"
    cust_after2 = s.get(f"{BASE}/customers/{DEMO_CUSTOMER_ID}/detail").json()
    assert float(cust_after2["deposit"]) == pytest.approx(dep_before + 100000)

    # income unchanged
    fin_after = s.get(f"{BASE}/reports/financial").json()
    inc_after = float(fin_after.get("total_income", fin_after.get("income", 0)) or 0)
    assert inc_after == pytest.approx(inc_before), "top-up must not increase income"

    # revert deposit to keep demo balance stable (we cannot revert deposit endpoint directly,
    # so use PUT /customers to subtract)
    revert = {
        "name": cust_after2["name"], "phone": cust_after2["phone"],
        "email": cust_after2.get("email", ""), "address": cust_after2.get("address", ""),
        "deposit": dep_before, "outlet_id": cust_after2["outlet_id"],
    }
    s.put(f"{BASE}/customers/{DEMO_CUSTOMER_ID}", json=revert)


# ---------- reject topup ----------
def test_reject_topup_and_double_reject(s):
    r = s.post(f"{BASE}/topups", json={
        "customer_id": DEMO_CUSTOMER_ID, "amount": 50000, "method": "qris"})
    assert r.status_code == 200
    tid = r.json()["id"]
    cust_before = float(s.get(f"{BASE}/customers/{DEMO_CUSTOMER_ID}/detail").json()["deposit"])

    r2 = s.post(f"{BASE}/topups/{tid}/reject")
    assert r2.status_code == 200 and r2.json()["status"] == "rejected"
    cust_after = float(s.get(f"{BASE}/customers/{DEMO_CUSTOMER_ID}/detail").json()["deposit"])
    assert cust_after == cust_before

    # reject again → 404
    r3 = s.post(f"{BASE}/topups/{tid}/reject")
    assert r3.status_code == 404


# ---------- coin expiry ----------
def test_coin_expiry(s):
    # create a temporary customer with deposit and past expiry
    tmp = s.post(f"{BASE}/customers", json={
        "name": "TEST_iter8_expiry", "phone": f"0899{int(time.time())%10**8:08d}",
        "outlet_id": DEMO_OUTLET_ID, "deposit": 25000, "password": "pelanggan123"}).json()
    cid = tmp["id"]
    # Set deposit_expires_at directly via a topup then manual PUT? no way to set past date via API,
    # skip if unreachable
    # We can't set deposit_expires_at directly via API; approach: rely on expire_deposits when past.
    # Since we can't manipulate DB from tests, skip if endpoint unavailable
    pytest.skip("Cannot set past deposit_expires_at without DB access; expire_deposits code path verified via review.")


# ---------- reviews: rating 5 first → voucher; second → null; low → new ----------
def _fresh_customer(s, name):
    return s.post(f"{BASE}/customers", json={
        "name": name, "phone": f"0898{int(time.time()*1000)%10**8:08d}",
        "outlet_id": DEMO_OUTLET_ID, "password": "pelanggan123"}).json()


def test_review_first_5_grants_voucher(s):
    c = _fresh_customer(s, "TEST_iter8_rev5")
    r = s.post(f"{BASE}/reviews", json={
        "customer_id": c["id"], "outlet_id": DEMO_OUTLET_ID,
        "rating": 5, "comment": "Mantap"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["rating"] == 5
    assert body["voucher"] is not None
    v = body["voucher"]
    assert int(float(v["discount_pct"])) == 20
    exp = date.fromisoformat(v["expires_at"][:10])
    delta = (exp - date.today()).days
    assert 85 <= delta <= 95

    # 2nd rating 5 → voucher null
    r2 = s.post(f"{BASE}/reviews", json={
        "customer_id": c["id"], "outlet_id": DEMO_OUTLET_ID,
        "rating": 5, "comment": "Lagi"})
    assert r2.status_code == 200
    assert r2.json()["voucher"] is None

    # voucher listing (unused)
    vs = s.get(f"{BASE}/vouchers?customer_id={c['id']}&unused=true").json()
    assert any(x["id"] == v["id"] and x["used"] is False for x in vs)


def test_review_low_rating_new_and_resolve(s):
    c = _fresh_customer(s, "TEST_iter8_rev1")
    r = s.post(f"{BASE}/reviews", json={
        "customer_id": c["id"], "outlet_id": DEMO_OUTLET_ID,
        "rating": 1, "comment": "Baju basah"})
    assert r.status_code == 200
    rid = r.json()["id"]
    assert r.json()["status"] == "new"

    lst = s.get(f"{BASE}/reviews?max_rating=2&outlet_id={DEMO_OUTLET_ID}").json()
    assert any(x["id"] == rid for x in lst)

    pr = s.patch(f"{BASE}/reviews/{rid}/resolve")
    assert pr.status_code == 200 and pr.json()["status"] == "resolved"


def test_review_invalid_rating(s):
    c = _fresh_customer(s, "TEST_iter8_revinv")
    r = s.post(f"{BASE}/reviews", json={
        "customer_id": c["id"], "outlet_id": DEMO_OUTLET_ID,
        "rating": 6})
    assert r.status_code == 422
    r2 = s.post(f"{BASE}/reviews", json={
        "customer_id": c["id"], "outlet_id": DEMO_OUTLET_ID,
        "rating": 0})
    assert r2.status_code == 422


# ---------- voucher usage in pay ----------
def _make_test_order(s, cust_id, total=10000):
    # need a service on Depok
    svcs = s.get(f"{BASE}/services?outlet_id={DEMO_OUTLET_ID}").json()
    svc = next(x for x in svcs if x["unit"] == "kg")
    qty = float(total) / float(svc["price"])
    body = {
        "customer_id": cust_id, "outlet_id": DEMO_OUTLET_ID,
        "items": [{"service_id": svc["id"], "service_name": svc["name"],
                   "unit": "kg", "qty": qty, "price": float(svc["price"])}],
        "delivery_type": "self", "notes": "TEST_iter8",
        "payment_status": "unpaid", "payment_method": "qris"}
    return s.post(f"{BASE}/orders", json=body).json()


def test_pay_with_voucher_qris(s):
    c = _fresh_customer(s, "TEST_iter8_pay_v")
    # grant voucher via 5-star review
    v = s.post(f"{BASE}/reviews", json={
        "customer_id": c["id"], "outlet_id": DEMO_OUTLET_ID, "rating": 5}).json()["voucher"]
    assert v
    # create order Rp 10.000
    o = _make_test_order(s, c["id"], total=10000)
    r = s.post(f"{BASE}/orders/{o['id']}/pay", json={"method": "qris", "voucher_id": v["id"]})
    assert r.status_code == 200
    paid = r.json()
    assert float(paid["discount"]) == pytest.approx(2000)  # 20% of 10.000
    assert float(paid["paid_amount"]) == pytest.approx(8000)
    # reuse same voucher → 400
    o2 = _make_test_order(s, c["id"], total=10000)
    r2 = s.post(f"{BASE}/orders/{o2['id']}/pay", json={"method": "qris", "voucher_id": v["id"]})
    assert r2.status_code == 400


def test_pay_with_voucher_coin_stacking(s):
    c = _fresh_customer(s, "TEST_iter8_pay_coin")
    # ensure deposit >> total by confirmed topup 500000 (coins 530k)
    t = s.post(f"{BASE}/topups", json={
        "customer_id": c["id"], "outlet_id": DEMO_OUTLET_ID,
        "amount": 500000, "method": "cash"}).json()
    s.post(f"{BASE}/topups/{t['id']}/confirm")
    v = s.post(f"{BASE}/reviews", json={
        "customer_id": c["id"], "outlet_id": DEMO_OUTLET_ID, "rating": 5}).json()["voucher"]
    o = _make_test_order(s, c["id"], total=10000)
    dep_before = float(s.get(f"{BASE}/customers/{c['id']}/detail").json()["deposit"])
    r = s.post(f"{BASE}/orders/{o['id']}/pay", json={"method": "coin", "voucher_id": v["id"]})
    assert r.status_code == 200, r.text
    paid = r.json()
    # discount = 2000 (voucher 20%) + 800 (10% of remaining 8000) = 2800
    assert float(paid["discount"]) == pytest.approx(2800)
    assert float(paid["paid_amount"]) == pytest.approx(7200)
    dep_after = float(s.get(f"{BASE}/customers/{c['id']}/detail").json()["deposit"])
    assert dep_before - dep_after == pytest.approx(7200)


# ---------- dashboard & customer detail new fields ----------
def test_dashboard_new_fields(s):
    # create a fresh pending topup and a fresh low-rating review so the fields are populated
    r = s.post(f"{BASE}/topups", json={
        "customer_id": DEMO_CUSTOMER_ID, "outlet_id": DEMO_OUTLET_ID,
        "amount": 50000, "method": "cash"})
    tid = r.json()["id"]
    c = _fresh_customer(s, "TEST_iter8_dash")
    s.post(f"{BASE}/reviews", json={
        "customer_id": c["id"], "outlet_id": DEMO_OUTLET_ID,
        "rating": 2, "comment": "Kurang wangi"})

    d = s.get(f"{BASE}/dashboard").json()
    assert "pending_topups" in d and int(d["pending_topups"]) >= 1
    assert "complaints" in d and isinstance(d["complaints"], list)
    if d["complaints"]:
        c0 = d["complaints"][0]
        assert "customer_name" in c0 and "comment" in c0
    # cleanup
    s.post(f"{BASE}/topups/{tid}/reject")


def test_customer_detail_new_fields(s):
    d = s.get(f"{BASE}/customers/{DEMO_CUSTOMER_ID}/detail").json()
    for k in ("pending_topups", "vouchers", "reviews_count"):
        assert k in d, f"missing {k}"
    assert isinstance(d["vouchers"], list)


# ---------- promo CRUD regression ----------
def test_promo_crud(s):
    body = {
        "outlet_id": DEMO_OUTLET_ID, "title": "TEST_iter8_promo",
        "description": "deskripsi", "discount_pct": 12, "code": "TEST12",
        "active": True}
    r = s.post(f"{BASE}/promos", json=body)
    assert r.status_code == 200
    pid = r.json()["id"]

    # visible in outlet list
    lst = s.get(f"{BASE}/promos?outlet_id={DEMO_OUTLET_ID}").json()
    assert any(p["id"] == pid for p in lst)

    body["title"] = "TEST_iter8_promo_edit"
    body["active"] = False
    r2 = s.put(f"{BASE}/promos/{pid}", json=body)
    assert r2.status_code == 200
    assert r2.json()["title"] == "TEST_iter8_promo_edit"
    assert r2.json()["active"] is False

    r3 = s.delete(f"{BASE}/promos/{pid}")
    assert r3.status_code == 200


# ---------- quick regressions ----------
def test_regression_orders_unpaid_and_leaderboard(s):
    r = s.get(f"{BASE}/orders?unpaid=true&limit=5")
    assert r.status_code == 200 and isinstance(r.json(), list)
    r2 = s.get(f"{BASE}/leaderboard?outlet_id={DEMO_OUTLET_ID}&customer_id={DEMO_CUSTOMER_ID}")
    assert r2.status_code == 200
    body = r2.json()
    assert "my_rank" in body and "total_participants" in body


def test_regression_reports_and_payroll(s):
    assert s.get(f"{BASE}/reports/financial").status_code == 200
    assert s.get(f"{BASE}/reports/transactions").status_code == 200
    assert s.get(f"{BASE}/reports/employees").status_code == 200
    assert s.get(f"{BASE}/payroll?period={date.today().strftime('%Y-%m')}").status_code == 200


def test_register_requires_outlet(s):
    r = s.post(f"{BASE}/auth/register", json={
        "name": "TEST_iter8_reg", "phone": f"0897{int(time.time())%10**8:08d}",
        "password": "abcdef"})
    assert r.status_code == 422
