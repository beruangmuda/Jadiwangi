"""Iteration 4 tests: Financial income_by_method, transactions kg/pcs/m,
employees per_employee, order payment_method (cash/qris/emoney),
and order advance work_log attribution."""
import os
import uuid
from datetime import date
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://wangi-dashboard.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

DEPOK_OID = "e5fc0b12-25f5-4be2-a117-6fea0df032da"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------- Financial: income_by_method with date range ----------
class TestFinancialByMethod:
    def test_income_by_method_shape_and_labels(self, s):
        r = s.get(f"{API}/reports/financial")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "income_by_method" in d
        arr = d["income_by_method"]
        assert isinstance(arr, list)
        methods = [x["method"] for x in arr]
        # order must be cash, qris, emoney, deposit
        assert methods == ["cash", "qris", "emoney", "deposit"]
        labels = {x["method"]: x["label"] for x in arr}
        assert labels["cash"] == "Tunai"
        assert labels["qris"] == "QRIS"
        assert labels["emoney"] == "E-Money"
        assert labels["deposit"] == "Saldo Deposit"
        for x in arr:
            assert isinstance(x["total"], (int, float))

    def test_financial_respects_frm_to(self, s):
        today = date.today().isoformat()
        r = s.get(f"{API}/reports/financial", params={"frm": today, "to": today})
        assert r.status_code == 200
        d = r.json()
        assert "income_by_method" in d
        # far-future range -> 0s
        r2 = s.get(f"{API}/reports/financial", params={"frm": "2099-01-01", "to": "2099-01-02"})
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["omzet"] == 0
        assert d2["pendapatan"] == 0
        for x in d2["income_by_method"]:
            assert x["total"] == 0

    def test_financial_outlet_filter(self, s):
        r = s.get(f"{API}/reports/financial", params={"outlet_id": DEPOK_OID})
        assert r.status_code == 200
        assert "income_by_method" in r.json()


# ---------- Transactions kg / pcs / m ----------
class TestTransactionsReport:
    def test_transactions_totals_shape(self, s):
        r = s.get(f"{API}/reports/transactions")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("total_orders", "cancelled", "total_value", "total_kg", "total_pcs", "total_m",
                  "recent", "cancellations"):
            assert k in d
        assert isinstance(d["total_kg"], (int, float))
        assert isinstance(d["total_pcs"], (int, float))
        assert isinstance(d["total_m"], (int, float))
        assert isinstance(d["recent"], list)


# ---------- Employees per_employee ----------
class TestEmployeeReport:
    def test_per_employee_shape(self, s):
        r = s.get(f"{API}/reports/employees")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "per_employee" in d
        assert isinstance(d["per_employee"], list)
        if d["per_employee"]:
            row = d["per_employee"][0]
            for k in ("name", "wash_kg", "iron_kg", "total_kg", "notes"):
                assert k in row, f"missing {k}"


# ---------- Order create with payment_method cash/qris/emoney ----------
class TestOrderPaymentMethod:
    @pytest.mark.parametrize("method", ["cash", "qris", "emoney"])
    def test_create_order_with_method(self, s, method):
        oid = DEPOK_OID
        svcs = s.get(f"{API}/services", params={"outlet_id": oid}).json()
        svc = svcs[0]
        cs = s.get(f"{API}/customers").json()
        cust = next((c for c in cs if c.get("outlet_id") == oid), cs[0])
        body = {
            "customer_id": cust["id"], "outlet_id": oid,
            "items": [{"service_id": svc["id"], "service_name": svc["name"],
                       "unit": svc["unit"], "qty": 3, "price": float(svc["price"])}],
            "payment_status": "paid",
            "payment_method": method,
            "notes": f"TEST_{method}",
        }
        r = s.post(f"{API}/orders", json=body)
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["payment_method"] == method
        # GET back to verify persistence
        got = s.get(f"{API}/orders/{order['id']}").json()
        assert got["payment_method"] == method


# ---------- Order advance with employee attribution -> work_log ----------
class TestAdvanceAttribution:
    def test_advance_out_of_washing_credits_employee(self, s):
        oid = DEPOK_OID
        # Login as joko (produksi Depok) to get employee id
        rlog = s.post(f"{API}/auth/login", json={"username": "joko", "password": "pegawai123"})
        assert rlog.status_code == 200, rlog.text
        udata = rlog.json()
        emp = udata.get("employee") or {}
        emp_id = emp.get("id")
        emp_name = emp.get("name") or "Joko"
        assert emp_id, f"login payload missing id: {udata}"

        # Fetch kiloan service (kg)
        svcs = s.get(f"{API}/services", params={"outlet_id": oid}).json()
        kilo = next((x for x in svcs if x.get("unit") == "kg"), svcs[0])
        cs = s.get(f"{API}/customers").json()
        cust = next((c for c in cs if c.get("outlet_id") == oid), cs[0])

        # Baseline wash_kg for this employee
        before = s.get(f"{API}/reports/employees").json()["per_employee"]
        prev = next((r for r in before if r["name"].lower() == emp_name.lower()), None)
        prev_wash = float(prev["wash_kg"]) if prev else 0.0

        weight = 7
        body = {
            "customer_id": cust["id"], "outlet_id": oid,
            "items": [{"service_id": kilo["id"], "service_name": kilo["name"],
                       "unit": "kg", "qty": weight, "price": float(kilo["price"])}],
            "notes": "TEST_advance_attribution",
        }
        r = s.post(f"{API}/orders", json=body)
        assert r.status_code == 200, r.text
        order = r.json()
        order_id = order["id"]

        # Advance received -> washing (no attribution yet, still fine to pass employee)
        r1 = s.post(f"{API}/orders/{order_id}/advance",
                    json={"employee_id": emp_id, "employee_name": emp_name})
        assert r1.status_code == 200, r1.text
        # advance out of washing -> drying: this should insert work_log crediting Joko
        r2 = s.post(f"{API}/orders/{order_id}/advance",
                    json={"employee_id": emp_id, "employee_name": emp_name})
        assert r2.status_code == 200, r2.text
        assert r2.json()["status"] in ("drying", "ironing", "packing", "ready", "completed")

        # Verify report_employees now shows +weight in wash_kg
        after = s.get(f"{API}/reports/employees").json()["per_employee"]
        cur = next((r for r in after if r["name"].lower() == emp_name.lower()), None)
        assert cur is not None, "employee row missing"
        cur_wash = float(cur["wash_kg"])
        assert cur_wash - prev_wash >= weight - 0.001, \
            f"wash_kg did not increase by >= {weight}: before={prev_wash} after={cur_wash}"
