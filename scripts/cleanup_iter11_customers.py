import asyncio
import os
from pathlib import Path

import asyncpg
from dotenv import load_dotenv


load_dotenv(Path("/app/backend/.env"))


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
        rows = await conn.fetch("select id, name from customers where name like 'TEST_iter11_%'")
        if not rows:
            print("No TEST_iter11 customers found")
            return
        ids = [r["id"] for r in rows]
        await conn.execute("delete from customers where id = any($1::uuid[])", ids)
        print(f"Deleted {len(ids)} TEST_iter11 customers")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
