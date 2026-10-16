"""API tests for legacy-primary login compatibility and dashboard authorization."""

import os
import re
from pathlib import Path

import pytest
import requests


# Auth module: base URL + credentials loading
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")


def _read_text(path: str) -> str:
    file_path = Path(path)
    if not file_path.exists():
        pytest.skip(f"Required file missing: {path}")
    return file_path.read_text(encoding="utf-8")


def _load_primary_credentials() -> tuple[str, str]:
    text = _read_text("/app/memory/test_credentials.md")
    email_match = re.search(r"Email:\s*`([^`]+)`", text)
    password_match = re.search(r"(?:Kata sandi|Password):\s*`([^`]+)`", text)
    if not email_match or not password_match:
        pytest.skip("Primary credentials not found in /app/memory/test_credentials.md")
    return email_match.group(1).strip(), password_match.group(1).strip()


def _load_legacy_email() -> str:
    env_text = _read_text("/app/backend/.env")
    legacy_match = re.search(r"LEGACY_ADMIN_EMAIL\s*=\s*\"?([^\"\n]+)\"?", env_text)
    if legacy_match:
        return legacy_match.group(1).strip().lower()
    pytest.skip("LEGACY_ADMIN_EMAIL not found in /app/backend/.env")


PRIMARY_EMAIL, PRIMARY_PASSWORD = _load_primary_credentials()
LEGACY_EMAIL = _load_legacy_email()


@pytest.fixture(scope="session")
def api_base_url() -> str:
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL is not set")
    return BASE_URL.rstrip("/")


@pytest.fixture()
def api_client():
    session = requests.Session()
    session.headers.update({"Accept": "application/json"})
    return session


# Auth module: login endpoint acceptance checks
def test_login_primary_admin_success(api_client, api_base_url):
    response = api_client.post(
        f"{api_base_url}/api/auth/login",
        json={"email": PRIMARY_EMAIL, "password": PRIMARY_PASSWORD},
        timeout=30,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert data["manager_name"] == "Pengelola Jadiwangi"
    assert isinstance(data["access_token"], str) and len(data["access_token"]) > 20


def test_login_legacy_admin_success_and_returns_token(api_client, api_base_url):
    response = api_client.post(
        f"{api_base_url}/api/auth/login",
        json={"email": LEGACY_EMAIL, "password": PRIMARY_PASSWORD},
        timeout=30,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert data["manager_name"] == "Pengelola Jadiwangi"
    assert isinstance(data["access_token"], str) and len(data["access_token"]) > 20


def test_login_wrong_password_is_rejected(api_client, api_base_url):
    response = api_client.post(
        f"{api_base_url}/api/auth/login",
        json={"email": PRIMARY_EMAIL, "password": "WRONG_PASSWORD_2026"},
        timeout=30,
    )
    assert response.status_code == 401
    data = response.json()
    assert "detail" in data


# Integration module: token issued via legacy email must authorize dashboard access
def test_legacy_login_token_can_open_dashboard_and_maps_to_primary_identity(api_client, api_base_url):
    login_response = api_client.post(
        f"{api_base_url}/api/auth/login",
        json={"email": LEGACY_EMAIL, "password": PRIMARY_PASSWORD},
        timeout=30,
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    dashboard_response = api_client.get(
        f"{api_base_url}/api/dashboard?threshold=30",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    assert dashboard_response.status_code == 200
    dashboard_data = dashboard_response.json()
    assert isinstance(dashboard_data["total_customers"], int)
    assert "customers" in dashboard_data

    account_response = api_client.get(
        f"{api_base_url}/api/account",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    assert account_response.status_code == 200
    account_data = account_response.json()
    assert account_data["email"] == PRIMARY_EMAIL.lower()
