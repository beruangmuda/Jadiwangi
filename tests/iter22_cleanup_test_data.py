"""Cleanup TEST_iter22 kasbon records created during targeted regression."""

import os
from pathlib import Path

import requests
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "frontend" / ".env")

BASE_URL = (os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("EXPO_BACKEND_URL/EXPO_PUBLIC_BACKEND_URL missing")

API = f"{BASE_URL}/api"


def main() -> None:
    period = "2026-01"
    rows = requests.get(f"{API}/kasbon", params={"period": period}, timeout=30)
    rows.raise_for_status()
    all_rows = rows.json()
    targets = [r for r in all_rows if str(r.get("note", "")).startswith("TEST_iter22")]
    deleted = 0
    for row in targets:
        kid = row.get("id")
        if not kid:
            continue
        res = requests.delete(f"{API}/kasbon/{kid}", timeout=30)
        if res.status_code == 200:
            deleted += 1
    print(f"Deleted TEST_iter22 kasbon rows: {deleted}")


if __name__ == "__main__":
    main()
