"""Cleanup TEST_ data for iter27 and previous test leftovers."""

from __future__ import annotations

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


async def main() -> None:
    conn = await asyncpg.connect(**DB_CFG, statement_cache_size=0)
    try:
        await conn.execute("delete from work_logs where order_id in (select id from orders where notes like 'TEST_%')")
        await conn.execute("delete from transactions where order_id in (select id from orders where notes like 'TEST_%')")
        await conn.execute("delete from order_items where order_id in (select id from orders where notes like 'TEST_%')")
        await conn.execute("delete from orders where notes like 'TEST_%' or code like 'TEST_%'")
        await conn.execute("delete from customers where name like 'TEST_%' or phone like '%TEST_%'")
        await conn.execute("delete from kasbon where note like 'TEST_%' or employee_name like 'TEST_%'")

        remaining = {
            "orders": await conn.fetchval("select count(*) from orders where notes like 'TEST_%' or code like 'TEST_%'"),
            "customers": await conn.fetchval("select count(*) from customers where name like 'TEST_%' or phone like '%TEST_%'"),
            "work_logs": await conn.fetchval("select count(*) from work_logs w join orders o on o.id=w.order_id where o.notes like 'TEST_%'"),
            "transactions": await conn.fetchval("select count(*) from transactions t join orders o on o.id=t.order_id where o.notes like 'TEST_%'"),
            "order_items": await conn.fetchval("select count(*) from order_items i join orders o on o.id=i.order_id where o.notes like 'TEST_%'"),
            "kasbon": await conn.fetchval("select count(*) from kasbon where note like 'TEST_%' or employee_name like 'TEST_%'"),
        }
        print(remaining)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
