"""Iter22 backend regression: kasbon multi-entry/date filtering and payroll deduction period logic."""

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
    """HTTP module: shared session for auth and kasbon/payroll endpoints."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def owner_context(api_client):
    """Auth module: owner credentials from /app/memory/test_credentials.md."""
    login = api_client.post(f"{API}/auth/login", json={"username": "owner", "password": "owner123"})
    if login.status_code != 200:
        pytest.skip(f"Owner login failed: {login.status_code} {login.text}")
    payload = login.json()
    outlets = payload.get("outlets") or []
    if not outlets:
        pytest.skip("No outlet available in owner session")
    return {"outlet_id": outlets[0]["id"]}


@pytest.fixture(scope="module")
def employee_context(api_client, owner_context):
    """Employee module: choose active employee in tested outlet."""
    employees = api_client.get(f"{API}/employees", params={"outlet_id": owner_context["outlet_id"]})
    assert employees.status_code == 200, employees.text
    rows = employees.json()
    assert rows, "No employee in selected outlet"
    employee = rows[0]
    return {"employee_id": employee["id"], "outlet_id": owner_context["outlet_id"]}


@pytest.fixture(scope="module")
def kasbon_cleanup(api_client):
    """Cleanup module: remove TEST_ kasbon records created by this suite."""
    created_ids = []
    yield created_ids
    for kid in created_ids:
        api_client.delete(f"{API}/kasbon/{kid}")


def _payroll_kasbon_for_employee(api_client, outlet_id: str, employee_id: str, period: str) -> float:
    response = api_client.get(f"{API}/payroll", params={"outlet_id": outlet_id, "period": period})
    assert response.status_code == 200, response.text
    rows = response.json().get("employees") or []
    employee = next((r for r in rows if r.get("employee_id") == employee_id), None)
    assert employee is not None, f"Employee {employee_id} missing from payroll response"
    return float(employee.get("kasbon") or 0)


def _create_kasbon(api_client, employee_id: str, outlet_id: str, amount: int, kasbon_date: str, note: str) -> dict:
    response = api_client.post(
        f"{API}/kasbon",
        json={
            "employee_id": employee_id,
            "outlet_id": outlet_id,
            "amount": amount,
            "note": note,
            "kasbon_date": kasbon_date,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


class TestKasbonDateAndPayroll:
    """Kasbon/payroll module: verify repeated entries, date persistence, and period-scoped payroll sums."""

    def test_multiple_kasbon_saved_and_visible_with_dates(self, api_client, employee_context, kasbon_cleanup):
        today = date.today()
        period = today.strftime("%Y-%m")
        first_date = today.replace(day=1).strftime("%Y-%m-%d")
        second_day = 2 if today.day != 1 else 3
        second_date = today.replace(day=second_day).strftime("%Y-%m-%d")
        note_prefix = f"TEST_iter22_multi_{uuid.uuid4().hex[:8]}"

        first = _create_kasbon(
            api_client,
            employee_context["employee_id"],
            employee_context["outlet_id"],
            12000,
            first_date,
            f"{note_prefix}_1",
        )
        second = _create_kasbon(
            api_client,
            employee_context["employee_id"],
            employee_context["outlet_id"],
            18000,
            second_date,
            f"{note_prefix}_2",
        )
        kasbon_cleanup.extend([first["id"], second["id"]])

        listing = api_client.get(
            f"{API}/kasbon",
            params={
                "employee_id": employee_context["employee_id"],
                "outlet_id": employee_context["outlet_id"],
                "period": period,
            },
        )
        assert listing.status_code == 200, listing.text
        rows = listing.json()
        by_id = {r["id"]: r for r in rows}
        assert first["id"] in by_id and second["id"] in by_id
        assert by_id[first["id"]]["kasbon_date"] == first_date
        assert by_id[second["id"]]["kasbon_date"] == second_date

    def test_payroll_uses_kasbon_date_and_excludes_out_of_period_entry(self, api_client, employee_context, kasbon_cleanup):
        today = date.today()
        current_period = today.strftime("%Y-%m")
        prior_month_date = (today.replace(day=1) - timedelta(days=1)).replace(day=15)

        baseline = _payroll_kasbon_for_employee(
            api_client,
            employee_context["outlet_id"],
            employee_context["employee_id"],
            current_period,
        )

        out_period = _create_kasbon(
            api_client,
            employee_context["employee_id"],
            employee_context["outlet_id"],
            25000,
            prior_month_date.strftime("%Y-%m-%d"),
            f"TEST_iter22_out_period_{uuid.uuid4().hex[:8]}",
        )
        kasbon_cleanup.append(out_period["id"])

        after = _payroll_kasbon_for_employee(
            api_client,
            employee_context["outlet_id"],
            employee_context["employee_id"],
            current_period,
        )

        assert after == baseline
