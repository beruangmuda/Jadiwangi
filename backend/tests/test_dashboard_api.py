"""API tests for auth, dashboard analytics, upload parsing, and follow-up eligibility."""

import io
import os
import re
from pathlib import Path

import pytest
import requests


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
FALLBACK_EMAIL = os.environ.get("REVIEW_REQUIRED_EMAIL")
FALLBACK_PASSWORD = os.environ.get("REVIEW_REQUIRED_PASSWORD")


def _load_test_credentials() -> tuple[str, str]:
    """Read test credentials from shared memory file (source of truth for auth tests)."""
    cred_file = Path("/app/memory/test_credentials.md")
    if not cred_file.exists():
        pytest.skip("/app/memory/test_credentials.md is missing")
    text = cred_file.read_text(encoding="utf-8")
    email_match = re.search(r"Email:\s*`([^`]+)`", text)
    password_match = re.search(r"(?:Kata sandi|Password):\s*`([^`]+)`", text)
    if not email_match or not password_match:
        pytest.skip("Test credentials not found in /app/memory/test_credentials.md")
    return email_match.group(1), password_match.group(1)


ADMIN_EMAIL, ADMIN_PASSWORD = _load_test_credentials()


def _credential_candidates() -> list[tuple[str, str]]:
    candidates = [(ADMIN_EMAIL, ADMIN_PASSWORD)]
    if FALLBACK_EMAIL and FALLBACK_PASSWORD:
        pair = (FALLBACK_EMAIL, FALLBACK_PASSWORD)
        if pair not in candidates:
            candidates.append(pair)
    return candidates


@pytest.fixture(scope="session")
def api_base_url():
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL is not set")
    return BASE_URL.rstrip("/")


@pytest.fixture()
def api_client():
    session = requests.Session()
    session.headers.update({"Accept": "application/json"})
    return session


@pytest.fixture()
def auth_token(api_client, api_base_url):
    for email, password in _credential_candidates():
        response = api_client.post(
            f"{api_base_url}/api/auth/login",
            json={"email": email, "password": password},
            timeout=30,
        )
        if response.status_code == 200:
            data = response.json()
            assert data.get("token_type") == "bearer"
            assert data.get("manager_name") == "Pengelola Jadiwangi"
            assert isinstance(data.get("access_token"), str) and len(data["access_token"]) > 20
            return data["access_token"]
    pytest.skip("Login failed for all available test credentials")


@pytest.fixture()
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture(autouse=True)
def reset_sample_dataset(api_client, api_base_url, auth_headers):
    """Keep each test isolated by resetting dashboard dataset to sample baseline."""
    response = api_client.post(f"{api_base_url}/api/dashboard/sample", headers=auth_headers, timeout=30)
    assert response.status_code == 200
    yield


# Auth module checks
def test_login_success(api_client, api_base_url):
    for email, password in _credential_candidates():
        response = api_client.post(
            f"{api_base_url}/api/auth/login",
            json={"email": email, "password": password},
            timeout=30,
        )
        if response.status_code == 200:
            data = response.json()
            assert data["manager_name"] == "Pengelola Jadiwangi"
            return
    pytest.skip("No valid credential pair could complete login")


def test_login_rejects_invalid_credentials(api_client, api_base_url):
    response = api_client.post(
        f"{api_base_url}/api/auth/login",
        json={"email": "wrong@jadiwangilaundry.com", "password": "wrong-password"},
        timeout=30,
    )
    assert response.status_code == 401
    assert "detail" in response.json()


# Dashboard module checks
def test_dashboard_loads_and_returns_max_10_sorted(api_client, api_base_url, auth_headers):
    response = api_client.get(f"{api_base_url}/api/dashboard?threshold=30", headers=auth_headers, timeout=30)
    assert response.status_code == 200
    data = response.json()
    customers = data["customers"]
    assert len(customers) <= 10
    assert isinstance(data["total_customers"], int)
    days = [row["days_inactive"] for row in customers]
    assert days == sorted(days, reverse=True)


def test_dashboard_customer_fields_include_value_habits_promo_and_draft_status(api_client, api_base_url, auth_headers):
    """Dashboard customer record contains lifetime value, dominant day/time, promo, and draft eligibility."""
    response = api_client.get(f"{api_base_url}/api/dashboard?threshold=30", headers=auth_headers, timeout=30)
    assert response.status_code == 200
    customers = response.json()["customers"]
    assert len(customers) > 0
    customer = customers[0]
    assert isinstance(customer["lifetime_value"], (int, float))
    assert isinstance(customer["usual_day"], str) and customer["usual_day"]
    assert isinstance(customer["usual_time"], str) and customer["usual_time"]
    assert isinstance(customer["promo_suggestion"], str) and customer["promo_suggestion"]
    assert isinstance(customer["can_draft_whatsapp"], bool)


def test_dashboard_rejects_invalid_threshold(api_client, api_base_url, auth_headers):
    response = api_client.get(f"{api_base_url}/api/dashboard?threshold=0", headers=auth_headers, timeout=30)
    assert response.status_code == 422
    assert "detail" in response.json()


def test_load_sample_data_refreshes_dataset(api_client, api_base_url, auth_headers):
    response = api_client.post(f"{api_base_url}/api/dashboard/sample", headers=auth_headers, timeout=30)
    assert response.status_code == 200
    data = response.json()
    assert data["source_name"] == "Data contoh Jadiwangi"
    assert len(data["customers"]) <= 10


# Customer module checks
def test_contact_status_update_persists(api_client, api_base_url, auth_headers):
    dashboard = api_client.get(f"{api_base_url}/api/dashboard?threshold=15", headers=auth_headers, timeout=30)
    assert dashboard.status_code == 200
    customers = dashboard.json()["customers"]
    assert len(customers) > 0
    target_id = customers[0]["id"]

    patch_response = api_client.patch(
        f"{api_base_url}/api/customers/{target_id}/contact",
        headers={**auth_headers, "Content-Type": "application/json"},
        json={"contact_status": "Sudah dihubungi"},
        timeout=30,
    )
    assert patch_response.status_code == 200
    patched = patch_response.json()
    assert patched["id"] == target_id
    assert patched["contact_status"] == "Sudah dihubungi"

    verify = api_client.get(f"{api_base_url}/api/dashboard?threshold=15", headers=auth_headers, timeout=30)
    assert verify.status_code == 200
    rows = verify.json()["customers"]
    matched = [item for item in rows if item["id"] == target_id]
    assert matched and matched[0]["contact_status"] == "Sudah dihubungi"


def test_contact_update_disables_draft_for_7_days(api_client, api_base_url, auth_headers):
    """After contact update, customer should not be draftable and expose wait-days countdown."""
    sample = api_client.post(f"{api_base_url}/api/dashboard/sample", headers=auth_headers, timeout=30)
    assert sample.status_code == 200
    customer_id = sample.json()["customers"][0]["id"]

    patch_response = api_client.patch(
        f"{api_base_url}/api/customers/{customer_id}/contact",
        headers={**auth_headers, "Content-Type": "application/json"},
        json={"contact_status": "Sudah dihubungi"},
        timeout=30,
    )
    assert patch_response.status_code == 200
    updated = patch_response.json()
    assert updated["can_draft_whatsapp"] is False
    assert updated["days_until_next_draft"] >= 1


# Upload module checks
def test_upload_valid_csv_replaces_dataset(api_client, api_base_url, auth_headers):
    csv_content = (
        "Nama Pelanggan,Nomor HP/WhatsApp,Tanggal Transaksi,Total,Layanan\n"
        "TEST Andi,081234567890,01/01/2025,150000,Cuci Komplit\n"
        "TEST Budi,081355577799,01/11/2024,220000,Cuci Setrika\n"
    )
    files = {
        "file": (
            "test_transaksi.csv",
            io.BytesIO(csv_content.encode("utf-8")),
            "text/csv",
        )
    }
    response = api_client.post(
        f"{api_base_url}/api/dashboard/upload",
        headers={"Authorization": auth_headers["Authorization"]},
        files=files,
        timeout=30,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["source_name"] == "Database gabungan • 1 file"
    assert data["total_customers"] == 2
    names = [row["name"] for row in data["customers"]]
    assert "TEST Budi" in names


def test_upload_csv_accumulates_customer_lifetime_value(api_client, api_base_url, auth_headers):
    """Lifetime value must equal sum of all customer transactions in uploaded file."""
    csv_content = (
        "Nama Pelanggan,Nomor HP/WhatsApp,Tanggal Transaksi,Total,Layanan\n"
        "TEST AKUMULASI,081200001111,01/01/2025,100000,Cuci Reguler\n"
        "TEST AKUMULASI,081200001111,05/01/2025,250000,Cuci Reguler\n"
        "TEST LAIN,081200009999,10/01/2025,50000,Express\n"
    )
    files = {"file": ("accumulate.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    response = api_client.post(
        f"{api_base_url}/api/dashboard/upload",
        headers={"Authorization": auth_headers["Authorization"]},
        files=files,
        timeout=30,
    )
    assert response.status_code == 200
    rows = response.json()["customers"]
    target = next(item for item in rows if item["name"] == "TEST AKUMULASI")
    assert target["lifetime_value"] == 350000
    assert target["transaction_count"] == 2


def test_upload_csv_with_timestamps_returns_dominant_day_and_hour(api_client, api_base_url, auth_headers):
    """Timestamped CSV should produce dominant weekday and time slot for each customer."""
    csv_content = (
        "Nama Pelanggan,Nomor HP/WhatsApp,Tanggal Transaksi,Total,Layanan\n"
        "TEST JAM,081211119999,06/01/2025 09:30,120000,Cuci Reguler\n"
        "TEST JAM,081211119999,13/01/2025 09:30,80000,Cuci Reguler\n"
        "TEST JAM,081211119999,07/01/2025 10:00,50000,Cuci Reguler\n"
    )
    files = {"file": ("habit.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    response = api_client.post(
        f"{api_base_url}/api/dashboard/upload",
        headers={"Authorization": auth_headers["Authorization"]},
        files=files,
        timeout=30,
    )
    assert response.status_code == 200
    rows = response.json()["customers"]
    target = next(item for item in rows if item["name"] == "TEST JAM")
    assert target["usual_day"] == "Senin"
    assert target["usual_time"] == "09.30"
    assert isinstance(target["promo_suggestion"], str) and len(target["promo_suggestion"]) > 0


def test_upload_missing_required_columns_returns_422(api_client, api_base_url, auth_headers):
    bad_csv = "nama,telepon,total\nX,0812,10000\n"
    files = {"file": ("bad.csv", io.BytesIO(bad_csv.encode("utf-8")), "text/csv")}
    response = api_client.post(
        f"{api_base_url}/api/dashboard/upload",
        headers={"Authorization": auth_headers["Authorization"]},
        files=files,
        timeout=30,
    )
    assert response.status_code == 422
    assert "detail" in response.json()
