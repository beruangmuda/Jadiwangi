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


async def main():
    conn = await asyncpg.connect(**DB_CFG, statement_cache_size=0)
    try:
        await conn.execute("delete from work_logs where order_id in (select id from orders where notes like 'TEST_iter19_%')")
        await conn.execute("delete from transactions where order_id in (select id from orders where notes like 'TEST_iter19_%')")
        await conn.execute("delete from order_items where order_id in (select id from orders where notes like 'TEST_iter19_%')")
        await conn.execute("delete from orders where notes like 'TEST_iter19_%'")
        await conn.execute("delete from customers where name like 'TEST_iter19_%'")
        print("cleanup_done")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
