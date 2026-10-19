"""Cleanup TEST_iter28 data from Supabase Postgres."""

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
        await conn.execute("delete from transactions where order_id in (select id from orders where notes like 'TEST_iter28_%')")
        await conn.execute("delete from order_items where order_id in (select id from orders where notes like 'TEST_iter28_%')")
        await conn.execute("delete from work_logs where order_id in (select id from orders where notes like 'TEST_iter28_%')")
        await conn.execute("delete from orders where notes like 'TEST_iter28_%'")
        await conn.execute("delete from customers where name like 'TEST_iter28_%'")

        orders_left = await conn.fetchval("select count(*) from orders where notes like 'TEST_iter28_%'")
        customers_left = await conn.fetchval("select count(*) from customers where name like 'TEST_iter28_%'")
        print(f"orders_left={orders_left}")
        print(f"customers_left={customers_left}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
