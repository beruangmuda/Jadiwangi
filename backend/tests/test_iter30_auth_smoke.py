"""Iter30 auth smoke: login endpoint returns 200 for owner/pegawai/pelanggan credentials."""

import os
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / "frontend" / ".env")

BASE_URL = (os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("EXPO_BACKEND_URL/EXPO_PUBLIC_BACKEND_URL tidak ditemukan")

API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def api_client():
    """Auth module: shared requests client for login smoke checks."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.mark.parametrize(
    "username,password,expected_role",
    [
        ("owner", "owner123", "owner"),
        ("Pegawai", "pegawai123", "pegawai"),
        ("Pelanggan", "pelanggan123", "pelanggan"),
    ],
)
def test_auth_login_smoke_roles(api_client, username, password, expected_role):
    response = api_client.post(
        f"{API}/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200, response.text

    data = response.json()
    assert data.get("role") == expected_role
