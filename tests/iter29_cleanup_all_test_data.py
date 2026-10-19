"""Cleanup all TEST_ data artifacts created during automated testing."""

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
        await conn.execute("delete from transactions where order_id in (select id from orders where notes ilike 'TEST_%')")
        await conn.execute("delete from work_logs where order_id in (select id from orders where notes ilike 'TEST_%')")
        await conn.execute("delete from order_items where order_id in (select id from orders where notes ilike 'TEST_%')")
        await conn.execute("delete from topups where note ilike 'TEST_%'")
        await conn.execute("delete from reviews where comment ilike 'TEST_%'")
        await conn.execute("delete from kasbon where note ilike 'TEST_%'")
        deleted_orders = await conn.fetchval("with d as (delete from orders where notes ilike 'TEST_%' returning 1) select count(*) from d")
        deleted_customers = await conn.fetchval("with d as (delete from customers where name ilike 'TEST_%' returning 1) select count(*) from d")

        remaining_orders = await conn.fetchval("select count(*) from orders where notes ilike 'TEST_%'")
        remaining_customers = await conn.fetchval("select count(*) from customers where name ilike 'TEST_%'")
        print(
            f"deleted_orders={deleted_orders} deleted_customers={deleted_customers} "
            f"remaining_orders={remaining_orders} remaining_customers={remaining_customers}"
        )
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
