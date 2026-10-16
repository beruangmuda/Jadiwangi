"""API tests for dashboard upload merge behavior, chronological parsing, and outlet mapping."""

import io
import os
import re
from pathlib import Path

import pytest
import requests


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")


def _load_test_credentials() -> tuple[str, str]:
    """Read auth credentials from shared memory file."""
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


@pytest.fixture(scope="module")
def api_base_url():
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL is not set")
    return BASE_URL.rstrip("/")


@pytest.fixture(scope="module")
def api_client():
    session = requests.Session()
    session.headers.update({"Accept": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_headers(api_client, api_base_url):
    login = api_client.post(
        f"{api_base_url}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    if login.status_code != 200:
        pytest.skip("Login failed with credentials from /app/memory/test_credentials.md")
    token = login.json().get("access_token")
    assert isinstance(token, str) and len(token) > 20
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def restore_sample_after_each_test(api_client, api_base_url, auth_headers):
    """Restore sample data after each test to keep dashboard state clean."""
    yield
    response = api_client.post(f"{api_base_url}/api/dashboard/sample", headers=auth_headers, timeout=30)
    assert response.status_code == 200
    assert response.json().get("source_name") == "Data contoh Jadiwangi"


def _upload_csv(api_client, api_base_url, auth_headers, filename: str, content: str):
    files = {"file": (filename, io.BytesIO(content.encode("utf-8")), "text/csv")}
    return api_client.post(
        f"{api_base_url}/api/dashboard/upload",
        headers={"Authorization": auth_headers["Authorization"]},
        files=files,
        timeout=30,
    )


# Upload merge module checks
def test_first_upload_from_sample_creates_real_dataset_without_sample_mix(api_client, api_base_url, auth_headers):
    seed = api_client.post(f"{api_base_url}/api/dashboard/sample", headers=auth_headers, timeout=30)
    assert seed.status_code == 200
    assert seed.json()["total_customers"] == 11

    csv_content = (
        "Nama Pelanggan,Nomor WhatsApp,Tanggal Transaksi,Total,Layanan,Outlet\n"
        "TEST A,081200000001,2025-01-01,100000,Cuci Reguler,Pulomas\n"
        "TEST B,081200000002,2025-01-02,200000,Express,Ujungberung\n"
    )
    upload = _upload_csv(api_client, api_base_url, auth_headers, "first.csv", csv_content)
    assert upload.status_code == 200
    data = upload.json()
    assert data["source_name"] == "Database gabungan • 1 file"
    assert data["total_customers"] == 2
    names = {row["name"] for row in data["customers"]}
    assert names == {"TEST A", "TEST B"}


def test_second_upload_adds_unique_customers_to_merged_database(api_client, api_base_url, auth_headers):
    file_1 = (
        "Nama Pelanggan,Nomor WhatsApp,Tanggal Transaksi,Total,Layanan,Outlet\n"
        "TEST A,081200000001,2025-01-01,100000,Cuci Reguler,Pulomas\n"
    )
    first = _upload_csv(api_client, api_base_url, auth_headers, "first.csv", file_1)
    assert first.status_code == 200
    assert first.json()["total_customers"] == 1

    file_2 = (
        "Nama Pelanggan,Nomor WhatsApp,Tanggal Transaksi,Total,Layanan,Outlet\n"
        "TEST C,081200000003,2025-01-03,250000,Cuci Komplit,Kalimulya\n"
    )
    second = _upload_csv(api_client, api_base_url, auth_headers, "second.csv", file_2)
    assert second.status_code == 200
    data = second.json()
    assert data["source_name"] == "Database gabungan • 2 file"
    assert data["total_customers"] == 2
    names = {row["name"] for row in data["customers"]}
    assert names == {"TEST A", "TEST C"}


def test_duplicate_whatsapp_updates_only_when_incoming_transaction_is_newer(api_client, api_base_url, auth_headers):
    base = (
        "Nama Pelanggan,Nomor WhatsApp,Tanggal Transaksi,Total,Layanan,Outlet\n"
        "TEST ALIA,081200000004,2025-01-10,120000,Cuci Reguler,Pulomas\n"
    )
    first = _upload_csv(api_client, api_base_url, auth_headers, "base.csv", base)
    assert first.status_code == 200

    newer = (
        "Nama Pelanggan,Nomor WhatsApp,Tanggal Transaksi,Total,Layanan,Outlet\n"
        "TEST ALIA BARU,081200000004,2025-02-15,300000,Express,Ujungberung\n"
    )
    second = _upload_csv(api_client, api_base_url, auth_headers, "newer.csv", newer)
    assert second.status_code == 200
    rows = second.json()["customers"]
    target = next(item for item in rows if item["name"] == "TEST ALIA BARU")
    assert target["name"] == "TEST ALIA BARU"
    assert target["last_transaction"] == "2025-02-15"
    assert target["lifetime_value"] == 300000
    assert target["favorite_service"] == "Express"
    assert target["outlet"] == "Ujungberung"


def test_duplicate_whatsapp_does_not_overwrite_when_incoming_transaction_is_older(api_client, api_base_url, auth_headers):
    newer = (
        "Nama Pelanggan,Nomor WhatsApp,Tanggal Transaksi,Total,Layanan,Outlet\n"
        "TEST BIMA BARU,081200000005,2025-02-20,500000,Cuci Komplit,Kalimulya\n"
    )
    first = _upload_csv(api_client, api_base_url, auth_headers, "newer.csv", newer)
    assert first.status_code == 200

    older = (
        "Nama Pelanggan,Nomor WhatsApp,Tanggal Transaksi,Total,Layanan,Outlet\n"
        "TEST BIMA LAMA,081200000005,2025-01-01,100000,Reguler,Pulomas\n"
    )
    second = _upload_csv(api_client, api_base_url, auth_headers, "older.csv", older)
    assert second.status_code == 200
    rows = second.json()["customers"]
    target = next(item for item in rows if item["name"] == "TEST BIMA BARU")
    assert target["name"] == "TEST BIMA BARU"
    assert target["last_transaction"] == "2025-02-20"
    assert target["lifetime_value"] == 500000
    assert target["outlet"] == "Kalimulya"


def test_iso_and_timestamp_dates_are_parsed_in_correct_chronological_order(api_client, api_base_url, auth_headers):
    csv_content = (
        "Nama Pelanggan,Nomor WhatsApp,Tanggal Transaksi,Total,Layanan,Outlet\n"
        "TEST CHRONO,081200000006,2025-01-02,90000,Cuci Reguler,Pulomas\n"
        "TEST CHRONO,081200000006,2025-02-01 09:00,110000,Cuci Reguler,Ujungberung\n"
        "TEST CHRONO,081200000006,2025-01-31 23:59,130000,Cuci Reguler,Kalimulya\n"
    )
    upload = _upload_csv(api_client, api_base_url, auth_headers, "chrono.csv", csv_content)
    assert upload.status_code == 200
    rows = upload.json()["customers"]
    target = next(item for item in rows if item["name"] == "TEST CHRONO")
    assert target["last_transaction"] == "2025-02-01"
    assert target["outlet"] == "Pulomas"


def test_outlet_aliases_are_mapped_and_returned_on_dashboard_endpoint(api_client, api_base_url, auth_headers):
    csv_content = (
        "Nama Pelanggan,Nomor WhatsApp,Tanggal Transaksi,Total,Layanan,Cabang\n"
        "TEST OUTLET,081200000007,2025-01-11,150000,Cuci Reguler,Pulomas Timur\n"
    )
    upload = _upload_csv(api_client, api_base_url, auth_headers, "outlet.csv", csv_content)
    assert upload.status_code == 200

    dashboard = api_client.get(f"{api_base_url}/api/dashboard?threshold=1", headers=auth_headers, timeout=30)
    assert dashboard.status_code == 200
    rows = dashboard.json()["customers"]
    target = next(item for item in rows if item["name"] == "TEST OUTLET")
    assert target["outlet"] == "Pulomas Timur"
