import asyncio
import os
from pathlib import Path

import asyncpg
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "backend" / ".env")


async def main():
    conn = await asyncpg.connect(
        user=os.environ["SUPABASE_DB_USER"],
        password=os.environ["SUPABASE_DB_PASSWORD"],
        host=os.environ["SUPABASE_DB_HOST"],
        port=int(os.environ["SUPABASE_DB_PORT"]),
        database=os.environ["SUPABASE_DB_NAME"],
        statement_cache_size=0,
    )
    try:
        await conn.execute(
            """
            delete from transactions
            where order_id in (
              select id from orders
              where notes like 'TEST_iter12_%' or notes like 'TEST_UI_iter12%'
            )
            """
        )
        await conn.execute(
            """
            delete from order_items
            where order_id in (
              select id from orders
              where notes like 'TEST_iter12_%' or notes like 'TEST_UI_iter12%'
            )
            """
        )
        await conn.execute(
            "delete from orders where notes like 'TEST_iter12_%' or notes like 'TEST_UI_iter12%'"
        )
        await conn.execute(
            "delete from customers where name like 'TEST_iter12_%' or name like 'TEST_UI_iter12_%' or name like 'TEST_UI_DUP_%'"
        )
        print("Iter12 cleanup complete")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
