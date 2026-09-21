"""Iter23 regression: payroll 200 + period-scoped kasbon aggregation with multiple dated entries."""

import os
import uuid
from datetime import date, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / "frontend" / ".env")

BASE_URL = (os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("EXPO_BACKEND_URL/EXPO_PUBLIC_BACKEND_URL missing")

API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def api_client():
    """HTTP module: shared session for payroll/kasbon regression checks."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def owner_outlet(api_client):
    """Auth module: owner login to resolve one outlet for targeted payroll tests."""
    login = api_client.post(f"{API}/auth/login", json={"username": "owner", "password": "owner123"})
    if login.status_code != 200:
        pytest.skip(f"Owner login failed: {login.status_code} {login.text}")
    outlets = login.json().get("outlets") or []
    if not outlets:
        pytest.skip("No outlet returned in owner session")
    return outlets[0]["id"]


@pytest.fixture(scope="module")
def target_employee(api_client, owner_outlet):
    """Employee module: choose one employee in selected outlet for deterministic payroll assertion."""
    res = api_client.get(f"{API}/employees", params={"outlet_id": owner_outlet})
    assert res.status_code == 200, res.text
    rows = res.json()
    assert rows, "No employees in selected outlet"
    return rows[0]["id"]


@pytest.fixture(scope="module")
def cleanup_ids(api_client):
    """Cleanup module: remove TEST_iter23 kasbon rows created by this suite."""
    ids = []
    yield ids
    for kid in ids:
        api_client.delete(f"{API}/kasbon/{kid}")


def _employee_kasbon_from_payroll(api_client, outlet_id: str, employee_id: str, period: str) -> float:
    res = api_client.get(f"{API}/payroll", params={"outlet_id": outlet_id, "period": period})
    assert res.status_code == 200, res.text
    payload = res.json()
    rows = payload.get("employees") or []
    row = next((r for r in rows if r.get("employee_id") == employee_id), None)
    assert row, f"Employee {employee_id} not present in payroll response"
    return float(row.get("kasbon") or 0)


def _create_kasbon(api_client, employee_id: str, outlet_id: str, amount: int, kasbon_date: str, note: str) -> str:
    res = api_client.post(
        f"{API}/kasbon",
        json={
            "employee_id": employee_id,
            "outlet_id": outlet_id,
            "amount": amount,
            "note": note,
            "kasbon_date": kasbon_date,
        },
    )
    assert res.status_code == 200, res.text
    return res.json()["id"]


class TestPayrollKasbonRegression:
    """Payroll/Kasbon module: validates same-period sum only and no 500 on GET /payroll."""

    def test_get_payroll_200_and_period_scoped_kasbon_sum(self, api_client, owner_outlet, target_employee, cleanup_ids):
        today = date.today()
        current_period = today.strftime("%Y-%m")
        in_period_1 = today.replace(day=1).strftime("%Y-%m-%d")
        in_period_2 = today.replace(day=min(2, today.day)).strftime("%Y-%m-%d")
        outside_period = (today.replace(day=1) - timedelta(days=1)).strftime("%Y-%m-%d")

        baseline = _employee_kasbon_from_payroll(api_client, owner_outlet, target_employee, current_period)

        tag = uuid.uuid4().hex[:8]
        id1 = _create_kasbon(api_client, target_employee, owner_outlet, 11000, in_period_1, f"TEST_iter23_{tag}_1")
        id2 = _create_kasbon(api_client, target_employee, owner_outlet, 19000, in_period_2, f"TEST_iter23_{tag}_2")
        id3 = _create_kasbon(api_client, target_employee, owner_outlet, 23000, outside_period, f"TEST_iter23_{tag}_out")
        cleanup_ids.extend([id1, id2, id3])

        after = _employee_kasbon_from_payroll(api_client, owner_outlet, target_employee, current_period)
        assert after == baseline + 30000
