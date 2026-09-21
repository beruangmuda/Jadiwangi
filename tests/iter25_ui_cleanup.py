import asyncio
import json
import os
import uuid
from pathlib import Path

import asyncpg
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "backend" / ".env")

SEED_FILE = ROOT / "tests" / ".iter25_ui_seed.json"

DB_CFG = {
    "user": os.environ["SUPABASE_DB_USER"],
    "password": os.environ["SUPABASE_DB_PASSWORD"],
    "host": os.environ["SUPABASE_DB_HOST"],
    "port": int(os.environ["SUPABASE_DB_PORT"]),
    "database": os.environ["SUPABASE_DB_NAME"],
}


def _load_seed():
    if not SEED_FILE.exists():
        return {}
    try:
        return json.loads(SEED_FILE.read_text())
    except Exception:
        return {}


async def _cleanup_db(seed):
    conn = await asyncpg.connect(**DB_CFG, statement_cache_size=0)
    try:
        order_ids = [seed.get("unpaid_order_id"), seed.get("paid_order_id")]
        order_ids = [x for x in order_ids if x]
        if order_ids:
            uuids = [uuid.UUID(x) for x in order_ids]
            await conn.execute("delete from work_logs where order_id = any($1::uuid[])", uuids)
            await conn.execute("delete from transactions where order_id = any($1::uuid[])", uuids)
            await conn.execute("delete from order_items where order_id = any($1::uuid[])", uuids)
            await conn.execute("delete from orders where id = any($1::uuid[])", uuids)

        if seed.get("customer_id"):
            await conn.execute("delete from customers where id=$1::uuid", uuid.UUID(seed["customer_id"]))

        await conn.execute("delete from kasbon where note like 'TEST_iter25_ui_kasbon%'")
        await conn.execute("delete from work_logs where order_id in (select id from orders where notes like 'TEST_iter25_ui_%')")
        await conn.execute("delete from transactions where order_id in (select id from orders where notes like 'TEST_iter25_ui_%')")
        await conn.execute("delete from order_items where order_id in (select id from orders where notes like 'TEST_iter25_ui_%')")
        await conn.execute("delete from orders where notes like 'TEST_iter25_ui_%'")
        await conn.execute("delete from customers where name like 'TEST_iter25_ui_%'")
    finally:
        await conn.close()


def main():
    seed = _load_seed()
    asyncio.run(_cleanup_db(seed))
    if SEED_FILE.exists():
        SEED_FILE.unlink()
    print("iter25_ui_cleanup_done")


if __name__ == "__main__":
    main()
