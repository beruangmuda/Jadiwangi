"""Iter10 - Kasbon and payroll deduction integration tests."""

import os
from datetime import datetime

import pytest
import requests


BASE_URL = os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
if not BASE_URL:
    raise RuntimeError("EXPO_BACKEND_URL or EXPO_PUBLIC_BACKEND_URL is required for tests")
API = f"{BASE_URL.rstrip('/')}/api"


@pytest.fixture(scope="session")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def kasbon_cleanup(api_client):
    created_ids = []
    yield created_ids
    for kid in created_ids:
        try:
            api_client.delete(f"{API}/kasbon/{kid}", timeout=30)
        except Exception:
            pass


@pytest.fixture(scope="session")
def payroll_context(api_client):
    period = datetime.now().strftime("%Y-%m")
    payroll = api_client.get(f"{API}/payroll", params={"period": period}, timeout=30)
    assert payroll.status_code == 200, payroll.text
    data = payroll.json()
    employees = data.get("employees", [])
    assert employees, "No employees in payroll response"

    target = employees[0]
    emps = api_client.get(f"{API}/employees", timeout=30)
    assert emps.status_code == 200, emps.text
    employee_row = next((e for e in emps.json() if e["id"] == target["employee_id"]), None)
    assert employee_row, "Target payroll employee not found in /employees"

    outlets = api_client.get(f"{API}/outlets", timeout=30)
    assert outlets.status_code == 200, outlets.text
    outlet_name_to_id = {o["name"]: o["id"] for o in outlets.json()}
    outlet_id = outlet_name_to_id.get(target["outlet_name"])
    assert outlet_id, f"Outlet id not resolved for {target['outlet_name']}"

    return {
        "period": period,
        "employee_id": target["employee_id"],
        "employee_name": target["name"],
        "outlet_id": outlet_id,
    }


# Kasbon validation endpoint behavior
def test_post_kasbon_rejects_non_positive_amount(api_client, payroll_context):
    payload = {
        "employee_id": payroll_context["employee_id"],
        "outlet_id": payroll_context["outlet_id"],
        "amount": 0,
        "note": "TEST_iter10_non_positive",
    }
    response = api_client.post(f"{API}/kasbon", json=payload, timeout=30)
    assert response.status_code == 422
    assert "Nominal kasbon" in response.text


# Kasbon create/delete should impact payroll total exactly by kasbon amount
def test_kasbon_create_affects_payroll_and_delete_restores(api_client, payroll_context, kasbon_cleanup):
    period = payroll_context["period"]
    outlet_id = payroll_context["outlet_id"]
    employee_id = payroll_context["employee_id"]
    amount = 100000

    before = api_client.get(
        f"{API}/payroll",
        params={"period": period, "outlet_id": outlet_id},
        timeout=30,
    )
    assert before.status_code == 200, before.text
    before_emp = next(e for e in before.json()["employees"] if e["employee_id"] == employee_id)
    before_total = float(before_emp["total"])

    create_payload = {
        "employee_id": employee_id,
        "outlet_id": outlet_id,
        "amount": amount,
        "note": "TEST_iter10_kasbon_payroll_deduction",
    }
    created = api_client.post(f"{API}/kasbon", json=create_payload, timeout=30)
    assert created.status_code == 200, created.text
    kasbon = created.json()
    kasbon_cleanup.append(kasbon["id"])
    assert kasbon["employee_id"] == employee_id
    assert float(kasbon["amount"]) == float(amount)

    after_create = api_client.get(
        f"{API}/payroll",
        params={"period": period, "outlet_id": outlet_id},
        timeout=30,
    )
    assert after_create.status_code == 200, after_create.text
    after_emp = next(e for e in after_create.json()["employees"] if e["employee_id"] == employee_id)
    after_total = float(after_emp["total"])
    assert after_total == before_total - amount

    listed = api_client.get(
        f"{API}/kasbon",
        params={"period": period, "outlet_id": outlet_id},
        timeout=30,
    )
    assert listed.status_code == 200, listed.text
    ids = {row["id"] for row in listed.json()}
    assert kasbon["id"] in ids

    deleted = api_client.delete(f"{API}/kasbon/{kasbon['id']}", timeout=30)
    assert deleted.status_code == 200, deleted.text
    kasbon_cleanup.remove(kasbon["id"])

    after_delete = api_client.get(
        f"{API}/payroll",
        params={"period": period, "outlet_id": outlet_id},
        timeout=30,
    )
    assert after_delete.status_code == 200, after_delete.text
    restored_emp = next(e for e in after_delete.json()["employees"] if e["employee_id"] == employee_id)
    restored_total = float(restored_emp["total"])
    assert restored_total == before_total
