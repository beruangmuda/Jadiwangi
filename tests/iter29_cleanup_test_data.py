"""Cleanup TEST_iter29 records from orders and related tables."""

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
        await conn.execute("delete from transactions where order_id in (select id from orders where notes like 'TEST_iter29_%')")
        await conn.execute("delete from work_logs where order_id in (select id from orders where notes like 'TEST_iter29_%')")
        await conn.execute("delete from order_items where order_id in (select id from orders where notes like 'TEST_iter29_%')")
        deleted_orders = await conn.fetchval("with d as (delete from orders where notes like 'TEST_iter29_%' returning 1) select count(*) from d")
        remaining = await conn.fetchval("select count(*) from orders where notes like 'TEST_iter29_%'")
        print(f"deleted_orders={deleted_orders} remaining_orders={remaining}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
