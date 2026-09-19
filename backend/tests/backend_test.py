"""Jadiwangi App backend tests."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://wangi-dashboard.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------- Auth ----------
class TestAuth:
    def test_owner_login(self, s):
        r = s.post(f"{API}/auth/login", json={"role": "owner", "pin": "1234"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["role"] == "owner"
        assert isinstance(d.get("outlets"), list) and len(d["outlets"]) == 3

    def test_owner_wrong_pin(self, s):
        r = s.post(f"{API}/auth/login", json={"role": "owner", "pin": "0000"})
        assert r.status_code == 401

    def test_pegawai_produksi(self, s):
        r = s.post(f"{API}/auth/login", json={"role": "pegawai", "pin": "3333"})
        assert r.status_code == 200
        d = r.json()
        assert d["employee"]["role_type"] == "produksi"

    def test_pegawai_kurir(self, s):
        r = s.post(f"{API}/auth/login", json={"role": "pegawai", "pin": "5555"})
        assert r.status_code == 200
        assert r.json()["employee"]["role_type"] == "kurir"

    def test_pegawai_wrong_pin(self, s):
        r = s.post(f"{API}/auth/login", json={"role": "pegawai", "pin": "9999"})
        assert r.status_code == 401

    def test_pelanggan_login_last4(self, s):
        cs = s.get(f"{API}/customers").json()
        assert cs, "no customers seeded"
        last4 = cs[0]["phone"][-4:]
        r = s.post(f"{API}/auth/login", json={"role": "pelanggan", "phone": last4})
        assert r.status_code == 200
        assert "customer" in r.json()

    def test_pelanggan_not_found(self, s):
        r = s.post(f"{API}/auth/login", json={"role": "pelanggan", "phone": "zzzz"})
        assert r.status_code == 401


# ---------- Outlets / Services / Customers / Employees ----------
class TestMasterData:
    def test_outlets(self, s):
        r = s.get(f"{API}/outlets")
        assert r.status_code == 200
        assert len(r.json()) == 3

    def test_outlet_update(self, s):
        outs = s.get(f"{API}/outlets").json()
        o = outs[0]
        body = {"name": o["name"], "city": o["city"], "address": o["address"],
                "phone": o["phone"], "sla_hours": o["sla_hours"], "qris_url": o.get("qris_url") or ""}
        r = s.put(f"{API}/outlets/{o['id']}", json=body)
        assert r.status_code == 200

    def test_services_list(self, s):
        r = s.get(f"{API}/services")
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_services_include_inactive(self, s):
        r = s.get(f"{API}/services", params={"include_inactive": "true"})
        assert r.status_code == 200

    def test_service_create_update(self, s):
        name = f"TEST_Svc_{uuid.uuid4().hex[:6]}"
        r = s.post(f"{API}/services", json={"name": name, "category": "Cuci", "unit": "kg", "price": 8000, "icon": "washing-machine", "active": True})
        assert r.status_code == 200
        sid = r.json()["id"]
        r2 = s.put(f"{API}/services/{sid}", json={"name": name, "category": "Cuci", "unit": "kg", "price": 9500, "icon": "washing-machine", "active": False})
        assert r2.status_code == 200
        assert float(r2.json()["price"]) == 9500.0
        assert r2.json()["active"] is False

    def test_customers_search(self, s):
        cs = s.get(f"{API}/customers").json()
        assert cs
        q = cs[0]["name"].split()[0]
        r = s.get(f"{API}/customers", params={"q": q})
        assert r.status_code == 200
        assert any(q.lower() in c["name"].lower() for c in r.json())

    def test_customer_create(self, s):
        outs = s.get(f"{API}/outlets").json()
        r = s.post(f"{API}/customers", json={"name": "TEST_Cust", "phone": "081200009999", "email": "t@e.com", "deposit": 0, "outlet_id": outs[0]["id"]})
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Cust"

    def test_employees(self, s):
        r = s.get(f"{API}/employees")
        assert r.status_code == 200
        assert len(r.json()) >= 6

    def test_employee_create_update(self, s):
        outs = s.get(f"{API}/outlets").json()
        r = s.post(f"{API}/employees", json={"name": "TEST_Emp", "role_type": "admin", "pin": "9911",
                                              "outlet_id": outs[0]["id"], "active": True,
                                              "permissions": {"orders": True, "reports": False}})
        assert r.status_code == 200, r.text
        eid = r.json()["id"]
        r2 = s.put(f"{API}/employees/{eid}", json={"name": "TEST_Emp2", "role_type": "admin", "pin": "9912",
                                                    "outlet_id": outs[0]["id"], "active": False,
                                                    "permissions": {"orders": False}})
        assert r2.status_code == 200
        assert r2.json()["name"] == "TEST_Emp2"


# ---------- Dashboard ----------
class TestDashboard:
    def test_dashboard(self, s):
        r = s.get(f"{API}/dashboard")
        assert r.status_code == 200
        d = r.json()
        for k in ("today", "trend", "queue", "top_services"):
            assert k in d
        assert set(d["today"].keys()) >= {"orders", "kg", "pcs", "customers", "omzet", "pendapatan"}
        assert set(d["queue"].keys()) >= {"in_progress", "ready", "overdue"}
        assert isinstance(d["trend"], list) and len(d["trend"]) >= 1

    def test_dashboard_outlet_filter(self, s):
        outs = s.get(f"{API}/outlets").json()
        r = s.get(f"{API}/dashboard", params={"outlet_id": outs[0]["id"]})
        assert r.status_code == 200


# ---------- Orders ----------
class TestOrderLifecycle:
    def test_list_active(self, s):
        r = s.get(f"{API}/orders", params={"active": "true"})
        assert r.status_code == 200
        for o in r.json():
            assert o["status"] in ("received", "washing", "drying", "ironing", "packing", "ready")

    def test_full_lifecycle(self, s):
        outs = s.get(f"{API}/outlets").json()
        custs = s.get(f"{API}/customers").json()
        svcs = s.get(f"{API}/services").json()
        outlet = outs[0]; cust = custs[0]; svc = svcs[0]
        body = {
            "customer_id": cust["id"], "outlet_id": outlet["id"],
            "items": [{"service_id": svc["id"], "service_name": svc["name"], "unit": svc["unit"], "qty": 3, "price": float(svc["price"])}],
            "delivery_type": "self", "notes": "TEST",
        }
        r = s.post(f"{API}/orders", json=body)
        assert r.status_code == 200, r.text
        oid = r.json()["id"]
        assert float(r.json()["total"]) == 3 * float(svc["price"])

        # GET verify persist
        rg = s.get(f"{API}/orders/{oid}")
        assert rg.status_code == 200
        assert rg.json()["status"] == "received"
        assert len(rg.json()["items"]) == 1

        # advance -> washing
        ra = s.post(f"{API}/orders/{oid}/advance")
        assert ra.status_code == 200
        assert ra.json()["status"] == "washing"

        # pay
        rp = s.post(f"{API}/orders/{oid}/pay")
        assert rp.status_code == 200
        assert rp.json()["payment_status"] == "paid"

        # advance through pipeline
        for _ in range(5):
            s.post(f"{API}/orders/{oid}/advance")
        final = s.get(f"{API}/orders/{oid}").json()
        assert final["status"] == "completed"

    def test_cancel_order(self, s):
        outs = s.get(f"{API}/outlets").json()
        custs = s.get(f"{API}/customers").json()
        svcs = s.get(f"{API}/services").json()
        body = {
            "customer_id": custs[0]["id"], "outlet_id": outs[0]["id"],
            "items": [{"service_id": svcs[0]["id"], "service_name": svcs[0]["name"], "unit": svcs[0]["unit"], "qty": 2, "price": float(svcs[0]["price"])}],
        }
        oid = s.post(f"{API}/orders", json=body).json()["id"]
        r = s.post(f"{API}/orders/{oid}/cancel", json={"reason": "TEST cancel"})
        assert r.status_code == 200
        assert r.json()["status"] == "cancelled"


# ---------- Reports ----------
class TestReports:
    def test_financial(self, s):
        r = s.get(f"{API}/reports/financial")
        assert r.status_code == 200
        d = r.json()
        for k in ("omzet", "pendapatan", "pengeluaran", "kasbon", "laba", "expense_breakdown"):
            assert k in d

    def test_transactions(self, s):
        r = s.get(f"{API}/reports/transactions")
        assert r.status_code == 200
        d = r.json()
        for k in ("total_orders", "cancelled", "total_value", "recent", "cancellations"):
            assert k in d

    def test_employees_report(self, s):
        r = s.get(f"{API}/reports/employees")
        assert r.status_code == 200
        d = r.json()
        assert "by_role" in d and "production" in d

    def test_customers_report(self, s):
        r = s.get(f"{API}/reports/customers")
        assert r.status_code == 200
        d = r.json()
        assert "total" in d and "growth" in d and "top" in d


# ---------- Expenses / Adjustments / Leaderboard ----------
class TestFinance:
    def test_expenses(self, s):
        outs = s.get(f"{API}/outlets").json()
        r = s.post(f"{API}/expenses", json={"outlet_id": outs[0]["id"], "category": "TEST", "amount": 12345, "note": "TEST_expense"})
        assert r.status_code == 200
        lst = s.get(f"{API}/expenses").json()
        assert any(e.get("note") == "TEST_expense" for e in lst)

    def test_adjustments(self, s):
        outs = s.get(f"{API}/outlets").json()
        r = s.post(f"{API}/adjustments", json={"outlet_id": outs[0]["id"], "amount": 5000, "direction": "in", "reason": "TEST_adj"})
        assert r.status_code == 200
        lst = s.get(f"{API}/adjustments").json()
        assert any(a.get("reason") == "TEST_adj" for a in lst)

    def test_leaderboard(self, s):
        custs = s.get(f"{API}/customers").json()
        cid = custs[0]["id"]
        r = s.get(f"{API}/leaderboard", params={"customer_id": cid})
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["ranking"], list)
