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


async def _verify():
    conn = await asyncpg.connect(**DB_CFG, statement_cache_size=0)
    try:
        orders = await conn.fetchval("select count(*) from orders where coalesce(notes,'') like 'TEST_%'")
        work_logs = await conn.fetchval("""
            select count(*) from work_logs w
            join orders o on o.id=w.order_id
            where coalesce(o.notes,'') like 'TEST_%'
        """)
        transactions = await conn.fetchval("""
            select count(*) from transactions t
            join orders o on o.id=t.order_id
            where coalesce(o.notes,'') like 'TEST_%'
        """)
        order_items = await conn.fetchval("""
            select count(*) from order_items i
            join orders o on o.id=i.order_id
            where coalesce(o.notes,'') like 'TEST_%'
        """)
        customers = await conn.fetchval("select count(*) from customers where coalesce(name,'') like 'TEST_%'")
        kasbon = await conn.fetchval("select count(*) from kasbon where coalesce(note,'') like 'TEST_%'")
        print({
            "orders_TEST": int(orders or 0),
            "work_logs_TEST": int(work_logs or 0),
            "transactions_TEST": int(transactions or 0),
            "order_items_TEST": int(order_items or 0),
            "customers_TEST": int(customers or 0),
            "kasbon_TEST": int(kasbon or 0),
        })
    finally:
        await conn.close()


def main():
    asyncio.run(_verify())


if __name__ == "__main__":
    main()
