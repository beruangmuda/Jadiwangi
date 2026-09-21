"""Cleanup helper: delete API-created kasbon records with note prefix TEST_ for recent periods."""

import os
from datetime import date
from pathlib import Path

import requests
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "frontend" / ".env")

BASE_URL = (os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("EXPO_BACKEND_URL/EXPO_PUBLIC_BACKEND_URL missing")

API = f"{BASE_URL}/api"


def month_str(offset: int) -> str:
    d = date.today().replace(day=15)
    y = d.year
    m = d.month - offset
    while m <= 0:
        y -= 1
        m += 12
    return f"{y}-{m:02d}"


def main() -> None:
    deleted = 0
    scanned = 0
    for offset in range(0, 3):
        period = month_str(offset)
        res = requests.get(f"{API}/kasbon", params={"period": period}, timeout=30)
        res.raise_for_status()
        rows = res.json()
        scanned += len(rows)
        for row in rows:
            note = str(row.get("note") or "")
            if not note.startswith("TEST_"):
                continue
            kid = row.get("id")
            if not kid:
                continue
            dres = requests.delete(f"{API}/kasbon/{kid}", timeout=30)
            if dres.status_code == 200:
                deleted += 1
    print(f"Scanned kasbon rows: {scanned}; deleted TEST_ rows: {deleted}")


if __name__ == "__main__":
    main()
