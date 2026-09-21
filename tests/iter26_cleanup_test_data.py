import asyncio
import os
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


async def _cleanup_test_data():
    conn = await asyncpg.connect(**DB_CFG, statement_cache_size=0)
    try:
        await conn.execute("delete from kasbon where coalesce(note,'') like 'TEST_%'")
        await conn.execute("delete from work_logs where order_id in (select id from orders where coalesce(notes,'') like 'TEST_%')")
        await conn.execute("delete from transactions where order_id in (select id from orders where coalesce(notes,'') like 'TEST_%')")
        await conn.execute("delete from order_items where order_id in (select id from orders where coalesce(notes,'') like 'TEST_%')")
        await conn.execute("delete from orders where coalesce(notes,'') like 'TEST_%'")
        await conn.execute("delete from customers where coalesce(name,'') like 'TEST_%'")
    finally:
        await conn.close()


def main():
    asyncio.run(_cleanup_test_data())
    print("iter26_cleanup_test_data_done")


if __name__ == "__main__":
    main()
