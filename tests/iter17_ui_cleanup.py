import json
import os
from pathlib import Path

import asyncpg
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "backend" / ".env")

SEED_FILE = ROOT / "tests" / ".iter17_ui_seed.json"

DB_CFG = {
    "user": os.environ["SUPABASE_DB_USER"],
    "password": os.environ["SUPABASE_DB_PASSWORD"],
    "host": os.environ["SUPABASE_DB_HOST"],
    "port": int(os.environ["SUPABASE_DB_PORT"]),
    "database": os.environ["SUPABASE_DB_NAME"],
}


async def _cleanup():
    conn = await asyncpg.connect(**DB_CFG, statement_cache_size=0)
    try:
        order_id = None
        customer_id = None
        if SEED_FILE.exists():
            data = json.loads(SEED_FILE.read_text())
            order_id = data.get("order_id")
            customer_id = data.get("customer_id")

        if order_id:
            await conn.execute("delete from work_logs where order_id=$1::uuid", order_id)
            await conn.execute("delete from transactions where order_id=$1::uuid", order_id)
            await conn.execute("delete from order_items where order_id=$1::uuid", order_id)
            await conn.execute("delete from orders where id=$1::uuid", order_id)

        if customer_id:
            await conn.execute("delete from customers where id=$1::uuid", customer_id)

        # Defensive cleanup
        await conn.execute("delete from work_logs where order_id in (select id from orders where notes like 'TEST_iter17_ui_seed%')")
        await conn.execute("delete from transactions where order_id in (select id from orders where notes like 'TEST_iter17_ui_seed%')")
        await conn.execute("delete from order_items where order_id in (select id from orders where notes like 'TEST_iter17_ui_seed%')")
        await conn.execute("delete from orders where notes like 'TEST_iter17_ui_seed%'")
        await conn.execute("delete from customers where name like 'TEST_iter17_ui_%'")
    finally:
        await conn.close()

    if SEED_FILE.exists():
        SEED_FILE.unlink()


if __name__ == "__main__":
    import asyncio

    asyncio.run(_cleanup())
    print('{"ok": true}')
