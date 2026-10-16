"""API tests for account settings, auth guard, and password reset privacy behavior."""

import os
import re
from pathlib import Path

import pytest
import requests


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
FALLBACK_EMAIL = os.environ.get("REVIEW_REQUIRED_EMAIL")
FALLBACK_PASSWORD = os.environ.get("REVIEW_REQUIRED_PASSWORD")


def _load_test_credentials() -> tuple[str, str]:
    """Read test credentials from shared memory file."""
    cred_file = Path("/app/memory/test_credentials.md")
    if not cred_file.exists():
        pytest.skip("/app/memory/test_credentials.md is missing")
    text = cred_file.read_text(encoding="utf-8")
    email_match = re.search(r"Email:\s*`([^`]+)`", text)
    password_match = re.search(r"(?:Kata sandi|Password):\s*`([^`]+)`", text)
    if not email_match or not password_match:
        pytest.skip("Test credentials not found in /app/memory/test_credentials.md")
    return email_match.group(1), password_match.group(1)


MEMORY_EMAIL, MEMORY_PASSWORD = _load_test_credentials()
REVIEW_EMAIL = "praditop@gmail.com"
REVIEW_PASSWORD = "Jadiwangi2026!"


def _credential_candidates() -> list[tuple[str, str]]:
    candidates = [(MEMORY_EMAIL, MEMORY_PASSWORD)]
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
            assert isinstance(data.get("access_token"), str) and len(data["access_token"]) > 20
            return data["access_token"]
    pytest.skip("Login failed for all available test credentials")


@pytest.fixture()
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# Auth/login compatibility checks
def test_login_with_review_requested_admin_credentials(api_client, api_base_url):
    response = api_client.post(
        f"{api_base_url}/api/auth/login",
        json={"email": REVIEW_EMAIL, "password": REVIEW_PASSWORD},
        timeout=30,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert data["manager_name"] == "Pengelola Jadiwangi"


# Account settings endpoint checks
def test_get_account_requires_jwt(api_client, api_base_url):
    response = api_client.get(f"{api_base_url}/api/account", timeout=30)
    assert response.status_code in (401, 403)


def test_get_account_returns_manager_email(api_client, api_base_url, auth_headers):
    response = api_client.get(f"{api_base_url}/api/account", headers=auth_headers, timeout=30)
    assert response.status_code == 200
    data = response.json()
    assert data["manager_name"] == "Pengelola Jadiwangi"
    assert isinstance(data["email"], str) and "@" in data["email"]


def test_patch_account_password_requires_jwt(api_client, api_base_url):
    response = api_client.patch(
        f"{api_base_url}/api/account/password",
        json={"new_password": "12345678"},
        timeout=30,
    )
    assert response.status_code in (401, 403)


def test_patch_account_password_rejects_short_password(api_client, api_base_url, auth_headers):
    response = api_client.patch(
        f"{api_base_url}/api/account/password",
        headers={**auth_headers, "Content-Type": "application/json"},
        json={"new_password": "1234567"},
        timeout=30,
    )
    assert response.status_code == 422
    detail = response.json().get("detail")
    assert isinstance(detail, list)


# Forgot-password privacy checks
def test_request_password_reset_unknown_email_does_not_disclose_registration(api_client, api_base_url):
    response = api_client.post(
        f"{api_base_url}/api/auth/request-password-reset",
        json={"email": "not-registered-xyz@jadiwangi-example.com"},
        timeout=30,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Jika email terdaftar, tautan atur ulang telah dikirim."
