"""Cleanup iter15 UI setup orders and related rows."""

import json
import os
import uuid
from pathlib import Path

import asyncpg
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "backend" / ".env")

DB_CFG = {
    "user": os.environ["SUPABASE_DB_USER"],
    "password": os.environ["SUPABASE_DB_PASSWORD"],
    "host": os.environ["SUPABASE_DB_HOST"],
    "port": int(os.environ["SUPABASE_DB_PORT"]),
    "database": os.environ["SUPABASE_DB_NAME"],
}


async def cleanup():
    path = ROOT / "tests" / "iter15_ui_data.json"
    if not path.exists():
        print("No iter15_ui_data.json found")
        return

    data = json.loads(path.read_text(encoding="utf-8"))
    ids = [data.get("requested_order_id"), data.get("quoted_order_id")]
    order_ids = [uuid.UUID(x) for x in ids if x]
    if not order_ids:
        print("No order IDs to cleanup")
        return

    conn = await asyncpg.connect(**DB_CFG, statement_cache_size=0)
    try:
        await conn.execute("delete from work_logs where order_id = any($1::uuid[])", order_ids)
        await conn.execute("delete from transactions where order_id = any($1::uuid[])", order_ids)
        await conn.execute("delete from order_items where order_id = any($1::uuid[])", order_ids)
        await conn.execute("delete from orders where id = any($1::uuid[])", order_ids)
    finally:
        await conn.close()

    path.unlink(missing_ok=True)
    print("Cleanup completed")


if __name__ == "__main__":
    import asyncio

    asyncio.run(cleanup())
