"""API tests for auth, dashboard analytics, contact update, and CSV upload flows."""

import io
import os

import pytest
import requests


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
ADMIN_EMAIL = "admin@jadiwangilaundry.com"
ADMIN_PASSWORD = "Jadiwangi2026!"


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
    response = api_client.post(
        f"{api_base_url}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    if response.status_code != 200:
        pytest.skip(f"Login failed for test credential: {response.status_code} {response.text}")
    data = response.json()
    assert data.get("token_type") == "bearer"
    assert data.get("manager_name") == "Pengelola Jadiwangi"
    assert isinstance(data.get("access_token"), str) and len(data["access_token"]) > 20
    return data["access_token"]


@pytest.fixture()
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# Auth module checks
def test_login_success(api_client, api_base_url):
    response = api_client.post(
        f"{api_base_url}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["manager_name"] == "Pengelola Jadiwangi"


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
    assert data["source_name"] == "test_transaksi.csv"
    names = [row["name"] for row in data["customers"]]
    assert "TEST Budi" in names


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
