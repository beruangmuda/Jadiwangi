"""Iteration 5 tests: payroll endpoint, payroll_manual upsert, attendance-on-login,
employee gaji/tunjangan persistence, and reports/employees (no wage/upah field)."""
import os
import uuid
from datetime import date
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://wangi-dashboard.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

DEPOK = "e5fc0b12-25f5-4be2-a117-6fea0df032da"
PERIOD = date.today().strftime("%Y-%m")


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _get_emp(sess, username):
    """Fetch employee record by username via /employees."""
    emps = sess.get(f"{API}/employees").json()
    return next((e for e in emps if (e.get("username") or "").lower() == username.lower()), None)


# ---------- Payroll response shape ----------
class TestPayrollShape:
    def test_payroll_returns_employees_with_all_fields(self, s):
        r = s.get(f"{API}/payroll", params={"outlet_id": DEPOK, "period": PERIOD})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["period"] == PERIOD
        assert isinstance(data["employees"], list)
        assert len(data["employees"]) > 0
        keys = {"employee_id", "name", "role", "outlet_name", "period",
                "gaji_pokok", "tunjangan_kasir", "kehadiran", "lembur_shifts",
                "uang_makan", "wash_kg", "wash_pcs", "iron_kg", "iron_pcs",
                "bonus_cuci", "bonus_setrika", "trips", "antar_jemput",
                "perjalanan_dinas", "kasbon", "total"}
        for emp in data["employees"]:
            missing = keys - set(emp.keys())
            assert not missing, f"missing keys {missing} for emp {emp.get('name')}"

    def test_payroll_total_formula(self, s):
        r = s.get(f"{API}/payroll", params={"outlet_id": DEPOK, "period": PERIOD})
        data = r.json()
        for emp in data["employees"]:
            expected_uang_makan = 15000 * (emp["kehadiran"] + emp["lembur_shifts"])
            assert emp["uang_makan"] == expected_uang_makan, \
                f"{emp['name']}: uang_makan {emp['uang_makan']} vs expected {expected_uang_makan}"
            expected_total = round(
                emp["gaji_pokok"] + emp["tunjangan_kasir"] + emp["uang_makan"]
                + emp["bonus_cuci"] + emp["bonus_setrika"] + emp["antar_jemput"]
                + emp["perjalanan_dinas"] - emp["kasbon"])
            assert emp["total"] == expected_total, \
                f"{emp['name']}: total {emp['total']} vs formula {expected_total}"

    def test_payroll_bonus_formulas(self, s):
        r = s.get(f"{API}/payroll", params={"outlet_id": DEPOK, "period": PERIOD})
        data = r.json()
        for emp in data["employees"]:
            expected_bc = round(((emp["wash_kg"]) + (emp["wash_pcs"] * 5)) / 10 * 3000)
            expected_bs = round((emp["iron_kg"] + emp["iron_pcs"]) * 1000)
            assert emp["bonus_cuci"] == expected_bc
            assert emp["bonus_setrika"] == expected_bs
            expected_aj = 5000 * emp["trips"]
            assert emp["antar_jemput"] == expected_aj


# ---------- Manual upsert ----------
class TestPayrollManualUpsert:
    def test_upsert_reflects_in_next_payroll(self, s):
        # get Joko
        joko = _get_emp(s, "joko")
        assert joko, "joko not found"
        before = s.get(f"{API}/payroll", params={"outlet_id": DEPOK, "period": PERIOD}).json()
        joko_before = next(e for e in before["employees"] if e["employee_id"] == joko["id"])

        # set lembur=4, perjalanan=200000
        r = s.post(f"{API}/payroll/manual", json={
            "employee_id": joko["id"], "period": PERIOD,
            "lembur_shifts": 4, "perjalanan_dinas": 200000,
        })
        assert r.status_code == 200, r.text
        row = r.json()
        assert int(row["lembur_shifts"]) == 4
        assert float(row["perjalanan_dinas"]) == 200000

        after = s.get(f"{API}/payroll", params={"outlet_id": DEPOK, "period": PERIOD}).json()
        joko_after = next(e for e in after["employees"] if e["employee_id"] == joko["id"])
        assert joko_after["lembur_shifts"] == 4
        assert joko_after["perjalanan_dinas"] == 200000
        # uang_makan increases: 15000 * (kehadiran + 4)
        assert joko_after["uang_makan"] == 15000 * (joko_after["kehadiran"] + 4)
        # totals must differ (unless before also had lembur=4 & pd=200000, very unlikely)
        assert joko_after["total"] != joko_before["total"] or (
            joko_before["lembur_shifts"] == 4 and joko_before["perjalanan_dinas"] == 200000)

    def test_upsert_idempotent(self, s):
        joko = _get_emp(s, "joko")
        # write again -> same values, same id
        r1 = s.post(f"{API}/payroll/manual", json={
            "employee_id": joko["id"], "period": PERIOD,
            "lembur_shifts": 3, "perjalanan_dinas": 150000})
        r2 = s.post(f"{API}/payroll/manual", json={
            "employee_id": joko["id"], "period": PERIOD,
            "lembur_shifts": 3, "perjalanan_dinas": 150000})
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json()["id"] == r2.json()["id"]


# ---------- Employee gaji/tunjangan persistence ----------
class TestEmployeeSalaryFields:
    def test_create_and_update_gaji(self, s):
        outlets = s.get(f"{API}/outlets").json()
        oid = outlets[0]["id"]
        uname = f"test_{uuid.uuid4().hex[:6]}"
        body = {
            "name": f"TEST_{uname}", "role_type": "admin", "pin": "1234",
            "username": uname, "password": "pegawai123",
            "outlet_id": oid, "active": True,
            "gaji_pokok": 1750000, "tunjangan_kasir": 250000,
            "permissions": {"orders": True},
        }
        r = s.post(f"{API}/employees", json=body)
        assert r.status_code == 200, r.text
        created = r.json()
        eid = created["id"]
        assert float(created["gaji_pokok"]) == 1750000
        assert float(created["tunjangan_kasir"]) == 250000

        # update: change salary
        upd = dict(body, gaji_pokok=2000000, tunjangan_kasir=400000, password="")
        r2 = s.put(f"{API}/employees/{eid}", json=upd)
        assert r2.status_code == 200, r2.text
        u = r2.json()
        assert float(u["gaji_pokok"]) == 2000000
        assert float(u["tunjangan_kasir"]) == 400000

        # GET verify persistence
        emps = s.get(f"{API}/employees").json()
        got = next((e for e in emps if e["id"] == eid), None)
        assert got is not None
        assert float(got["gaji_pokok"]) == 2000000
        assert float(got["tunjangan_kasir"]) == 400000

        # cleanup: deactivate + delete
        s.delete(f"{API}/employees/{eid}")


# ---------- Attendance on login ----------
class TestAttendanceOnLogin:
    def test_login_creates_attendance_today(self, s):
        joko = _get_emp(s, "joko")
        assert joko, "joko not found"

        # snapshot current kehadiran
        pre = s.get(f"{API}/payroll", params={"outlet_id": DEPOK, "period": PERIOD}).json()
        joko_pre = next(e for e in pre["employees"] if e["employee_id"] == joko["id"])
        pre_kehadiran = joko_pre["kehadiran"]

        # login joko
        r = s.post(f"{API}/auth/login", json={"username": "joko", "password": "pegawai123"})
        assert r.status_code == 200, r.text
        assert r.json().get("role") == "pegawai"

        # kehadiran must be >= pre_kehadiran, and at least 1 (today)
        post = s.get(f"{API}/payroll", params={"outlet_id": DEPOK, "period": PERIOD}).json()
        joko_post = next(e for e in post["employees"] if e["employee_id"] == joko["id"])
        assert joko_post["kehadiran"] >= max(1, pre_kehadiran), \
            f"kehadiran should include today: pre={pre_kehadiran} post={joko_post['kehadiran']}"

    def test_login_idempotent_per_day(self, s):
        # login twice more, kehadiran should NOT keep incrementing
        s.post(f"{API}/auth/login", json={"username": "joko", "password": "pegawai123"})
        p1 = s.get(f"{API}/payroll", params={"outlet_id": DEPOK, "period": PERIOD}).json()
        k1 = next(e for e in p1["employees"] if (e.get("name") or "").lower().startswith("joko"))["kehadiran"]
        s.post(f"{API}/auth/login", json={"username": "joko", "password": "pegawai123"})
        p2 = s.get(f"{API}/payroll", params={"outlet_id": DEPOK, "period": PERIOD}).json()
        k2 = next(e for e in p2["employees"] if (e.get("name") or "").lower().startswith("joko"))["kehadiran"]
        assert k1 == k2, f"kehadiran incremented on same-day login: {k1} -> {k2}"


# ---------- Trip work_log for kurir on pickup/delivery advance ----------
class TestTripWorkLog:
    def test_kurir_advance_pickup_creates_trip(self, s):
        # get kurir rudi
        rudi = _get_emp(s, "rudi")
        assert rudi, "rudi not found"

        # fetch trips before
        before = s.get(f"{API}/payroll", params={"outlet_id": DEPOK, "period": PERIOD}).json()
        rudi_before = next((e for e in before["employees"] if e["employee_id"] == rudi["id"]), None)
        assert rudi_before is not None
        trips_before = rudi_before["trips"]

        # Create a pickup order at Depok
        cs = s.get(f"{API}/customers").json()
        cust = next((c for c in cs if c.get("outlet_id") == DEPOK), cs[0])
        svcs = s.get(f"{API}/services", params={"outlet_id": DEPOK}).json()
        svc = svcs[0]
        body = {
            "customer_id": cust["id"], "outlet_id": DEPOK,
            "items": [{"service_id": svc["id"], "service_name": svc["name"],
                       "unit": svc["unit"], "qty": 3, "price": float(svc["price"])}],
            "delivery_type": "pickup",
            "notes": "TEST_iter5_trip",
        }
        r = s.post(f"{API}/orders", json=body)
        assert r.status_code == 200, r.text
        oid = r.json()["id"]

        # Advance received -> washing with rudi (kurir) so a 'trip' log gets inserted
        adv = s.post(f"{API}/orders/{oid}/advance",
                     json={"employee_id": rudi["id"], "employee_name": rudi["name"]})
        assert adv.status_code == 200, adv.text

        after = s.get(f"{API}/payroll", params={"outlet_id": DEPOK, "period": PERIOD}).json()
        rudi_after = next(e for e in after["employees"] if e["employee_id"] == rudi["id"])
        assert rudi_after["trips"] == trips_before + 1, \
            f"trips did not increment: before={trips_before} after={rudi_after['trips']}"
        assert rudi_after["antar_jemput"] == 5000 * rudi_after["trips"]

    def test_trip_not_duplicated_per_order(self, s):
        """Advancing same order again with the same kurir should NOT create another trip row."""
        rudi = _get_emp(s, "rudi")
        # Create another pickup order
        cs = s.get(f"{API}/customers").json()
        cust = next((c for c in cs if c.get("outlet_id") == DEPOK), cs[0])
        svcs = s.get(f"{API}/services", params={"outlet_id": DEPOK}).json()
        svc = svcs[0]
        body = {
            "customer_id": cust["id"], "outlet_id": DEPOK,
            "items": [{"service_id": svc["id"], "service_name": svc["name"],
                       "unit": svc["unit"], "qty": 2, "price": float(svc["price"])}],
            "delivery_type": "pickup",
            "notes": "TEST_iter5_trip_dup",
        }
        oid = s.post(f"{API}/orders", json=body).json()["id"]

        before = s.get(f"{API}/payroll", params={"outlet_id": DEPOK, "period": PERIOD}).json()
        t0 = next(e for e in before["employees"] if e["employee_id"] == rudi["id"])["trips"]
        # advance twice: received->washing then washing->drying (rudi both times)
        s.post(f"{API}/orders/{oid}/advance", json={"employee_id": rudi["id"], "employee_name": rudi["name"]})
        s.post(f"{API}/orders/{oid}/advance", json={"employee_id": rudi["id"], "employee_name": rudi["name"]})
        after = s.get(f"{API}/payroll", params={"outlet_id": DEPOK, "period": PERIOD}).json()
        t1 = next(e for e in after["employees"] if e["employee_id"] == rudi["id"])["trips"]
        # Trips should have increased by exactly 1 (one new order), not 2
        assert t1 - t0 == 1, f"expected +1 trip for new order, got +{t1 - t0}"


# ---------- Reports/employees: no upah/wage field ----------
class TestReportsEmployeesNoWage:
    def test_per_employee_has_no_wage(self, s):
        today = date.today().isoformat()
        r = s.get(f"{API}/reports/employees", params={"outlet_id": DEPOK, "frm": today, "to": today})
        assert r.status_code == 200, r.text
        data = r.json()
        for row in data.get("per_employee", []):
            for banned in ("wage", "upah", "wage_rate", "wage_per_kg", "wage_amount"):
                assert banned not in row, f"unexpected field {banned} in {row}"
            # must have wash_kg, iron_kg, notes
            assert "wash_kg" in row and "iron_kg" in row and "notes" in row
