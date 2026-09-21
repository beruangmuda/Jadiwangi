import os
import uuid
import json
import random
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta, date
from decimal import Decimal
from typing import Optional, List

import asyncpg
import bcrypt
import requests
from starlette.concurrency import run_in_threadpool
from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("jadiwangi")

DB = dict(
    user=os.environ["SUPABASE_DB_USER"],
    password=os.environ["SUPABASE_DB_PASSWORD"],
    host=os.environ["SUPABASE_DB_HOST"],
    port=int(os.environ["SUPABASE_DB_PORT"]),
    database=os.environ["SUPABASE_DB_NAME"],
)

pool: Optional[asyncpg.Pool] = None

app = FastAPI(title="Jadiwangi App API")
api = APIRouter(prefix="/api")

PIPELINE = ["received", "washing", "drying", "ironing", "packing", "ready", "completed"]
STAGE_LABELS = {
    "requested": "Menunggu Ditimbang",
    "quoted": "Menunggu Persetujuan",
    "received": "Diterima",
    "washing": "Cuci",
    "drying": "Pengering",
    "ironing": "Setrika",
    "packing": "Lipat & Packing",
    "ready": "Siap Diambil",
    "completed": "Selesai",
    "cancelled": "Dibatalkan",
}
ACTIVE_STATUSES = ["washing", "drying", "ironing", "packing"]

SCHEMA = """
create extension if not exists pgcrypto;
create table if not exists app_config (key text primary key, value text not null);
create table if not exists outlets (
  id uuid primary key default gen_random_uuid(), name text not null, city text not null,
  address text default '', phone text default '', sla_hours int not null default 48,
  qris_url text default '', created_at timestamptz not null default now());
create table if not exists services (
  id uuid primary key default gen_random_uuid(), name text not null, category text not null default 'Cuci',
  unit text not null default 'kg', price numeric(12,2) not null default 0, icon text default 'washing-machine',
  active boolean not null default true, created_at timestamptz not null default now());
create table if not exists customers (
  id uuid primary key default gen_random_uuid(), name text not null, phone text default '',
  email text default '', deposit numeric(12,2) not null default 0, points int not null default 0,
  outlet_id uuid references outlets(id), created_at timestamptz not null default now());
create table if not exists employees (
  id uuid primary key default gen_random_uuid(), name text not null, role_type text not null default 'admin',
  pin text not null default '0000', outlet_id uuid references outlets(id), active boolean not null default true,
  permissions jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table if not exists orders (
  id uuid primary key default gen_random_uuid(), code text not null, customer_id uuid references customers(id),
  outlet_id uuid references outlets(id), status text not null default 'received', total numeric(12,2) not null default 0,
  weight_kg numeric(10,2) not null default 0, unit_qty int not null default 0,
  payment_status text not null default 'unpaid', payment_method text default 'qris',
  delivery_type text not null default 'self', notes text default '', created_by text default 'owner',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  due_at timestamptz, completed_at timestamptz, cancelled_at timestamptz, cancel_reason text default '');
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid references orders(id) on delete cascade,
  service_id uuid references services(id), service_name text not null, unit text not null default 'kg',
  qty numeric(10,2) not null default 1, price numeric(12,2) not null default 0, subtotal numeric(12,2) not null default 0);
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(), order_id uuid references orders(id),
  outlet_id uuid references outlets(id), amount numeric(12,2) not null default 0, type text not null default 'income',
  method text default 'qris', created_at timestamptz not null default now());
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(), outlet_id uuid references outlets(id),
  category text not null default 'Operasional', amount numeric(12,2) not null default 0, note text default '',
  created_by text default 'owner', created_at timestamptz not null default now());
create table if not exists adjustments (
  id uuid primary key default gen_random_uuid(), outlet_id uuid references outlets(id),
  amount numeric(12,2) not null default 0, direction text not null default 'in', reason text default '',
  created_at timestamptz not null default now());
create table if not exists kasbon (
  id uuid primary key default gen_random_uuid(), employee_id uuid references employees(id),
  employee_name text default '', outlet_id uuid references outlets(id), amount numeric(12,2) not null default 0,
  note text default '', status text not null default 'open', created_at timestamptz not null default now());
"""


def jsonable(v):
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, uuid.UUID):
        return str(v)
    return v


def row_to_dict(row) -> dict:
    return {k: jsonable(val) for k, val in dict(row).items() if k != "password_hash"}


def rows_to_list(rows) -> List[dict]:
    return [row_to_dict(r) for r in rows]


def now_utc():
    return datetime.now(timezone.utc)


@app.on_event("startup")
async def startup():
    global pool
    pool = await asyncpg.create_pool(**DB, statement_cache_size=0, min_size=1, max_size=5)
    async with pool.acquire() as conn:
        await conn.execute(SCHEMA)
        await conn.execute(MIGRATIONS)
    await seed_data()
    await reseed_pricelist()
    await ensure_credentials()
    await ensure_promos()
    try:
        await run_in_threadpool(init_storage)
        logger.info("Object storage ready.")
    except Exception as e:
        logger.warning("Object storage init failed: %s", e)
    logger.info("Database ready.")


MIGRATIONS = """
alter table employees add column if not exists username text;
alter table employees add column if not exists password_hash text;
alter table customers add column if not exists password_hash text;
create unique index if not exists employees_username_uq on employees (lower(username)) where username is not null;
alter table services add column if not exists outlet_id uuid references outlets(id);
alter table services add column if not exists price_express numeric(12,2);
alter table services add column if not exists duration text default '';
alter table services add column if not exists duration_express text default '';
alter table services add column if not exists min_kg numeric(10,2);
create table if not exists work_logs (
  id uuid primary key default gen_random_uuid(), order_id uuid references orders(id) on delete cascade,
  employee_id uuid references employees(id), employee_name text default '', outlet_id uuid references outlets(id),
  stage text not null, weight_kg numeric(10,2) not null default 0, created_at timestamptz not null default now());
alter table work_logs add column if not exists unit_qty numeric(10,2) not null default 0;
alter table employees add column if not exists gaji_pokok numeric(12,2) not null default 0;
alter table employees add column if not exists tunjangan_kasir numeric(12,2) not null default 0;
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(), employee_id uuid references employees(id),
  outlet_id uuid references outlets(id), day date not null, created_at timestamptz not null default now());
create unique index if not exists attendance_uq on attendance (employee_id, day);
create table if not exists payroll_manual (
  id uuid primary key default gen_random_uuid(), employee_id uuid references employees(id),
  period text not null, lembur_shifts int not null default 0, perjalanan_dinas numeric(12,2) not null default 0,
  note text default '');
create unique index if not exists payroll_manual_uq on payroll_manual (employee_id, period);
create index if not exists attendance_employee_day_idx on attendance (employee_id, day);
create index if not exists work_logs_employee_stage_created_idx on work_logs (employee_id, stage, created_at);
create index if not exists kasbon_employee_created_idx on kasbon (employee_id, created_at);
alter table customers add column if not exists address text default '';
alter table orders add column if not exists is_request boolean not null default false;
alter table orders add column if not exists picked_up_at timestamptz;
alter table orders add column if not exists delivered_at timestamptz;
alter table orders add column if not exists customer_confirmed_at timestamptz;
alter table orders add column if not exists photos jsonb not null default '[]'::jsonb;
alter table orders add column if not exists request_items jsonb not null default '[]';
alter table orders add column if not exists address text default '';
alter table orders add column if not exists express boolean not null default false;
alter table orders add column if not exists discount numeric(12,2) not null default 0;
alter table orders add column if not exists paid_amount numeric(12,2) not null default 0;
update orders set express=true where express=false and exists (
  select 1 from order_items oi where oi.order_id=orders.id and oi.service_name ilike '%(Express)%'
);
create table if not exists promos (
  id uuid primary key default gen_random_uuid(), outlet_id uuid references outlets(id),
  title text not null, description text default '', discount_pct numeric(5,2) not null default 0,
  code text default '', valid_until date, active boolean not null default true,
  created_at timestamptz not null default now());
alter table outlets add column if not exists review_url text default '';
alter table customers add column if not exists deposit_expires_at date;
create table if not exists topups (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  outlet_id uuid references outlets(id), amount numeric(12,2) not null,
  coins numeric(12,2) not null, method text not null default 'cash',
  status text not null default 'pending', note text default '',
  created_at timestamptz not null default now(), confirmed_at timestamptz);
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  outlet_id uuid references outlets(id), order_id uuid references orders(id) on delete set null,
  rating int not null, comment text default '', status text not null default 'new',
  reply text default '', created_at timestamptz not null default now(), resolved_at timestamptz);
create table if not exists vouchers (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  outlet_id uuid references outlets(id), title text not null,
  discount_pct numeric(5,2) not null default 0, reason text default '',
  used boolean not null default false, order_id uuid, expires_at date,
  created_at timestamptz not null default now());
update outlets set review_url='https://g.page/r/CUv3jO9Cz4aAEBM/review' where city='Depok' and coalesce(review_url,'')='';
update outlets set review_url='https://g.page/r/CT1ETVEE3zn5EBM/review' where city='Jakarta' and coalesce(review_url,'')='';
update outlets set review_url='https://g.page/r/CQUtr3hTOpEbEBM/review' where city='Bandung' and coalesce(review_url,'')='';
"""

MAX_BCRYPT_BYTES = 72


def _pw_bytes(password: str) -> bytes:
    value = (password or "").encode("utf-8")
    if len(value) > MAX_BCRYPT_BYTES:
        raise ValueError("Kata sandi maksimal 72 byte")
    return value


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_pw_bytes(password), bcrypt.gensalt(rounds=12)).decode("ascii")


def verify_password(password: str, password_hash: Optional[str]) -> bool:
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(_pw_bytes(password), password_hash.encode("ascii"))
    except (ValueError, UnicodeError):
        return False


async def ensure_credentials():
    """Idempotently give the owner, seeded employees and customers login credentials."""
    async with pool.acquire() as conn:
        # owner account (stored in app_config)
        has_owner = await conn.fetchval("select value from app_config where key='owner_username'")
        if not has_owner:
            oh = await run_in_threadpool(hash_password, "owner123")
            await conn.execute("insert into app_config(key,value) values('owner_username','owner') on conflict (key) do nothing")
            await conn.execute("insert into app_config(key,value) values('owner_pass_hash',$1) on conflict (key) do nothing", oh)

        # employees without username/password
        emps = await conn.fetch("select id, name from employees where username is null or password_hash is null")
        if emps:
            eh = await run_in_threadpool(hash_password, "pegawai123")
            for e in emps:
                uname = (e["name"] or "staff").split()[0].lower()
                # ensure uniqueness by appending suffix if needed
                exists = await conn.fetchval("select count(*) from employees where lower(username)=$1 and id<>$2", uname, e["id"])
                if exists:
                    uname = f"{uname}{str(e['id'])[:4]}"
                await conn.execute("update employees set username=$1, password_hash=$2 where id=$3", uname, eh, e["id"])

        # customers without password
        need = await conn.fetchval("select count(*) from customers where password_hash is null")
        if need:
            ch = await run_in_threadpool(hash_password, "pelanggan123")
            await conn.execute("update customers set password_hash=$1 where password_hash is null", ch)


async def ensure_promos():
    """Seed a couple of sample promos per outlet once (owner can manage them later)."""
    async with pool.acquire() as conn:
        n = await conn.fetchval("select count(*) from promos")
        if n:
            return
        outlets = await conn.fetch("select id, city from outlets")
        for o in outlets:
            await conn.execute(
                """insert into promos(outlet_id,title,description,discount_pct,code,valid_until)
                   values($1,$2,$3,$4,$5,current_date + 30)""",
                o["id"], "Diskon 15% Cuci Kering Setrika",
                "Berlaku untuk cuci kering setrika min. 5 kg, sekali pakai per pelanggan.", 15, "WANGI15")
            await conn.execute(
                """insert into promos(outlet_id,title,description,discount_pct,code,valid_until)
                   values($1,$2,$3,$4,$5,current_date + 60)""",
                o["id"], "Bayar pakai Coin, hemat 10%",
                "Setiap pembayaran memakai saldo coin otomatis dapat potongan 10%.", 10, "COIN10")


@app.on_event("shutdown")
async def shutdown():
    if pool:
        await pool.close()


async def seed_data():
    async with pool.acquire() as conn:
        done = await conn.fetchval("select value from app_config where key='seeded'")
        if done == "1":
            return
        logger.info("Seeding sample data (bulk)...")
        now = now_utc()

        # ---- outlets ----
        outlets_def = [
            ("Jadiwangi Pulomas", "Jakarta", "Jl. Pulomas Raya No. 12, Jakarta Timur", "021-4890123", 48),
            ("Jadiwangi Ujungberung", "Bandung", "Jl. Ujungberung No. 45, Bandung", "022-7801234", 36),
            ("Jadiwangi Kalimulya", "Depok", "Jl. Kalimulya No. 8, Cilodong, Depok", "021-8770456", 48),
        ]
        outlets = []  # (id, name, city, addr, phone, sla, qris, created)
        outlet_ids = []
        for name, city, addr, phone, sla in outlets_def:
            oid = uuid.uuid4(); outlet_ids.append(oid)
            outlets.append((oid, name, city, addr, phone, sla, "", now))
        await conn.copy_records_to_table(
            "outlets", records=outlets,
            columns=["id", "name", "city", "address", "phone", "sla_hours", "qris_url", "created_at"])

        # ---- services ----
        services_def = [
            ("Cuci Kering Lipat", "Cuci", "kg", 7000, "washing-machine"),
            ("Cuci Setrika", "Cuci", "kg", 10000, "tshirt-crew"),
            ("Setrika Saja", "Setrika", "kg", 6000, "iron"),
            ("Cuci Express 6 Jam", "Express", "kg", 15000, "lightning-bolt"),
            ("Bed Cover", "Satuan", "pcs", 35000, "bed"),
            ("Selimut", "Satuan", "pcs", 25000, "bed-king"),
            ("Sepatu", "Satuan", "pcs", 30000, "shoe-sneaker"),
            ("Jas / Gaun", "Satuan", "pcs", 45000, "hanger"),
        ]
        services = []
        service_ids = []
        for nm, cat, unit, price, icon in services_def:
            sid = uuid.uuid4()
            service_ids.append((sid, nm, unit, Decimal(price)))
            services.append((sid, nm, cat, unit, Decimal(price), icon, True, now))
        await conn.copy_records_to_table(
            "services", records=services,
            columns=["id", "name", "category", "unit", "price", "icon", "active", "created_at"])

        # ---- customers ----
        first = ["Budi", "Siti", "Andi", "Rina", "Dewi", "Agus", "Putri", "Rizky", "Maya", "Dodi",
                 "Nina", "Fajar", "Lestari", "Bayu", "Citra", "Hendra", "Wulan", "Eko", "Sari", "Tono",
                 "Indah", "Gilang", "Ratna", "Yusuf", "Vina"]
        last = ["Santoso", "Wijaya", "Pratama", "Kusuma", "Halim", "Saputra", "Nugroho", "Permata",
                "Lestari", "Utami", "Firmansyah", "Anggraini"]
        customers = []
        customer_ids = []
        points_by_cust = {}
        for i in range(25):
            cid = uuid.uuid4()
            nm = f"{random.choice(first)} {random.choice(last)}"
            phone = "08" + "".join([str(random.randint(0, 9)) for _ in range(10)])
            deposit = Decimal(random.choice([0, 0, 0, 25000, 50000, 100000, 150000]))
            oid = random.choice(outlet_ids)
            created = now - timedelta(days=random.randint(0, 150))
            customer_ids.append((cid, oid))
            points_by_cust[cid] = 0
            customers.append((cid, nm, phone, f"{nm.split()[0].lower()}{i}@mail.com", deposit, 0, oid, created))

        # ---- employees ----
        emp_def = [
            ("Andi Admin", "admin", "1111"), ("Sari Admin", "admin", "2222"),
            ("Joko Produksi", "produksi", "3333"), ("Wati Produksi", "produksi", "4444"),
            ("Dedi Kurir", "kurir", "5555"), ("Rudi Kurir", "kurir", "6666"),
        ]
        employees = []
        for idx, (nm, rt, pin) in enumerate(emp_def):
            employees.append((uuid.uuid4(), nm, rt, pin, outlet_ids[idx % 3], True,
                              '{"orders": true, "reports": false, "delivery": true}', now))
        await conn.copy_records_to_table(
            "employees", records=employees,
            columns=["id", "name", "role_type", "pin", "outlet_id", "active", "permissions", "created_at"])

        # ---- orders / items / transactions ----
        orders = []; items = []; txns = []
        code_seq = 1000
        for day_offset in range(30, -1, -1):
            day = now - timedelta(days=day_offset)
            n_orders = random.randint(6, 14) if day_offset == 0 else random.randint(3, 11)
            for _ in range(n_orders):
                cust_id, outlet_id = random.choice(customer_ids)
                sla = outlets_def[outlet_ids.index(outlet_id)][4]
                created = day.replace(hour=random.randint(8, 19), minute=random.randint(0, 59), second=0, microsecond=0)
                chosen = random.sample(service_ids, random.randint(1, 3))
                total = Decimal(0); weight = Decimal(0); unit_qty = 0
                oid = uuid.uuid4()
                for (sid, nm, unit, price) in chosen:
                    if unit == "kg":
                        qty = Decimal(random.choice([2, 3, 4, 5, 6, 7, 8])); weight += qty
                    else:
                        qty = Decimal(random.randint(1, 3)); unit_qty += int(qty)
                    subtotal = price * qty; total += subtotal
                    items.append((uuid.uuid4(), oid, sid, nm, unit, qty, price, subtotal))
                if day_offset == 0:
                    status = random.choice(["received", "washing", "drying", "ironing", "packing", "ready", "completed"])
                elif day_offset <= 2:
                    status = random.choice(["washing", "ironing", "packing", "ready", "ready", "completed", "completed"])
                else:
                    status = random.choices(["completed", "cancelled"], weights=[92, 8])[0]
                delivery = random.choices(["self", "delivery", "pickup"], weights=[60, 25, 15])[0]
                due_at = created + timedelta(hours=sla)
                paid = status == "completed" or random.random() < 0.6
                payment_status = "paid" if paid else "unpaid"
                completed_at = created + timedelta(hours=random.randint(max(1, sla - 6), sla + 30)) if status == "completed" else None
                cancelled_at = created + timedelta(hours=random.randint(1, 5)) if status == "cancelled" else None
                code_seq += 1
                code = f"JW-{created.strftime('%y%m%d')}-{code_seq}"
                orders.append((oid, code, cust_id, outlet_id, status, total, weight, unit_qty, payment_status,
                               "qris", delivery, "", "owner", created, created, due_at, completed_at, cancelled_at,
                               "Salah input" if status == "cancelled" else ""))
                if payment_status == "paid" and status != "cancelled":
                    txns.append((uuid.uuid4(), oid, outlet_id, total, "income", "qris", created))
                if status == "completed":
                    points_by_cust[cust_id] += int(total / Decimal(1000))

        # apply points into customers records
        customers = [(c[0], c[1], c[2], c[3], c[4], points_by_cust.get(c[0], 0), c[6], c[7]) for c in customers]
        await conn.copy_records_to_table(
            "customers", records=customers,
            columns=["id", "name", "phone", "email", "deposit", "points", "outlet_id", "created_at"])
        await conn.copy_records_to_table(
            "orders", records=orders,
            columns=["id", "code", "customer_id", "outlet_id", "status", "total", "weight_kg", "unit_qty",
                     "payment_status", "payment_method", "delivery_type", "notes", "created_by", "created_at",
                     "updated_at", "due_at", "completed_at", "cancelled_at", "cancel_reason"])
        await conn.copy_records_to_table(
            "order_items", records=items,
            columns=["id", "order_id", "service_id", "service_name", "unit", "qty", "price", "subtotal"])
        await conn.copy_records_to_table(
            "transactions", records=txns,
            columns=["id", "order_id", "outlet_id", "amount", "type", "method", "created_at"])

        # ---- expenses ----
        exp_cats = ["Deterjen & Pewangi", "Listrik & Air", "Gaji Harian", "Plastik & Packaging", "Perawatan Mesin", "Transport Kurir"]
        expenses = []
        for day_offset in range(30, -1, -1):
            if random.random() < 0.5:
                continue
            day = now - timedelta(days=day_offset)
            expenses.append((uuid.uuid4(), random.choice(outlet_ids), random.choice(exp_cats),
                             Decimal(random.choice([50000, 75000, 100000, 150000, 200000])), "", "owner", day))
        await conn.copy_records_to_table(
            "expenses", records=expenses,
            columns=["id", "outlet_id", "category", "amount", "note", "created_by", "created_at"])

        await conn.execute("insert into app_config(key,value) values('owner_pin','1234') on conflict (key) do nothing")
        await conn.execute("insert into app_config(key,value) values('seeded','1') on conflict (key) do update set value='1'")
        logger.info("Seeding complete.")


# ---------------------------------------------------------------------------
# Pricelist per outlet (Depok / Jakarta / Bandung) + reseed of sample data
# ---------------------------------------------------------------------------
PRICELIST_VERSION = "7"

# Common satuan durations
_D2 = ("2 Hari", "6 Jam")


def _pricelist_for(city: str):
    """Return list of service tuples for a given outlet city.
    Each tuple: (name, category, unit, price, price_express|None, duration, duration_express, min_kg|None, icon)
    """
    if city == "Depok":
        atasan = [
            ("Kemeja", 18000, 32000), ("Kebaya", 29000, 51000), ("Vest", 18000, 32000),
            ("Jas", 33000, 53000), ("Dress", 38000, 70000), ("Jaket", 30000, 53000),
            ("Selendang", 10000, 20000), ("Coat", 38000, 70000), ("Songket", 29000, 51000),
            ("Jubah / Toga", 45000, 89000), ("Seprei", 19000, 35000),
        ]
        bawahan = [("Celana", 18000, 32000), ("Rok", 18000, 32000)]
        ibadah = [("Mukena", 28000, 40000), ("Sarung", 16000, 30000), ("Sajadah", 18000, 35000)]
        data = {
            "kiloan": [
                ("Cuci Kering Setrika", 10000, 18000, 4, "tshirt-crew"),
                ("Cuci Lipat", 7500, 11000, 5, "washing-machine"),
                ("Setrika", 9000, 10500, 5, "iron"),
            ],
            "dettol": 1000,
            "bedcover": [("Single (100-120)", 40000, 55000), ("Queen (160-180)", 53000, 75000), ("Super XL (200)", 88000, None)],
            "selimut": [("Tipis", 20000, 34000), ("Tebal", 26000, 35000)],
            "bantal": [("Bantal", 40000, "2 Hari"), ("Guling", 40000, "2 Hari"), ("Bantal Leher", 20000, "2 Hari")],
            "boneka": [("Boneka Kecil", 25000, "3 Hari"), ("Boneka Besar", 36000, "3 Hari")],
            "atasan": atasan, "bawahan": bawahan, "ibadah": ibadah,
            "sepatu": [("Sepatu", 40000, "3 Hari"), ("Sandal", 22000, "2 Hari"), ("Tas", 27000, "2 Hari")],
            "karpet": [("Karpet Tipis", 25000), ("Karpet Tebal", 30000), ("Gorden", 16000), ("Vitrase Gorden", 10000)],
            "kasur": [("Kasur Palembang", 95000), ("Baby Car Seat", 100000), ("Stroller Anak", 100000)],
            "keset": 11000,
        }
    elif city == "Jakarta":
        atasan = [
            ("Kemeja", 19000, 34000), ("Kebaya", 29000, 53000), ("Vest", 19000, 34000),
            ("Jas", 33000, 53000), ("Dress", 57000, 89000), ("Jaket", 30000, 55000),
            ("Selendang", 15000, 23000), ("Coat", 38000, 70000), ("Jubah / Toga", 57000, 89000),
            ("Handuk", 19000, 35000), ("Sprei Set", 19000, 35000),
        ]
        bawahan = [("Celana", 23000, 34000), ("Rok", 19000, 32000), ("Songket", 29000, 53000)]
        ibadah = [("Mukena", 28000, 40000), ("Sarung", 16000, 30000), ("Sajadah", 18000, 34000)]
        data = {
            "kiloan": [
                ("Cuci Kering Setrika", 10500, 18000, 5, "tshirt-crew"),
                ("Cuci Lipat", 8000, 13000, 5, "washing-machine"),
                ("Setrika", 9000, 11000, 5, "iron"),
            ],
            "dettol": 1000,
            "bedcover": [("Single (100-120)", 40000, 65000), ("Queen (160-180)", 56000, 77000), ("Super XL (200)", 92000, None)],
            "selimut": [("Tipis", 26000, 35000), ("Tebal / Bulu", 33000, 55000)],
            "bantal": [("Bantal", 40000, "3 Hari"), ("Guling", 40000, "3 Hari"), ("Bantal Leher", 30000, "3 Hari")],
            "boneka": [("Boneka Kecil", 25000, "3 Hari"), ("Boneka Besar", 40000, "3 Hari")],
            "atasan": atasan, "bawahan": bawahan, "ibadah": ibadah,
            "sepatu": [("Sepatu", 40000, "3 Hari"), ("Sandal", 22000, "2 Hari"), ("Tas", 32000, "2 Hari")],
            "karpet": [("Karpet Tipis", 22000), ("Karpet Tebal", 26000), ("Gorden", 17000), ("Vitrase Gorden", 11000)],
            "kasur": [("Kasur Palembang", 80000), ("Baby Car Seat", 100000), ("Stroller Anak", 100000), ("Kasur Bayi", 55000)],
            "keset": 15000,
        }
    else:  # Bandung
        atasan = [
            ("Kemeja", 14500, 23000), ("Kebaya", 29000, 53000), ("Vest", 14500, 23000),
            ("Jas", 28000, 45000), ("Dress", 35000, 53000), ("Jaket", 30000, 45000),
            ("Selendang", 10000, 20000), ("Coat", 38000, 70000), ("Jubah / Toga", 30000, 45000),
            ("Handuk", 10000, 17000), ("Sprei Set", 15000, 25000),
        ]
        bawahan = [("Celana", 19000, 29000), ("Rok", 19000, 29000), ("Songket", 29000, 53000)]
        ibadah = [("Mukena", 10000, 18000), ("Sarung", 10000, 15000), ("Sajadah", 15000, 20000)]
        data = {
            "kiloan": [
                ("Cuci Kering Setrika", 6900, 12000, 3, "tshirt-crew"),
                ("Cuci Lipat", 5900, 7000, 3, "washing-machine"),
                ("Setrika", 6000, 8000, 5, "iron"),
            ],
            "dettol": 2000,
            "bedcover": [("Single (100-120)", 28000, 40000), ("Queen (160-180)", 40000, 65000), ("Super XL (200)", 80000, None)],
            "selimut": [("Tipis", 20000, 35000), ("Tebal / Bulu", 25000, 52000)],
            "bantal": [("Bantal", 30000, "3 Hari"), ("Guling", 30000, "3 Hari"), ("Bantal Leher", 20000, "3 Hari")],
            "boneka": [("Boneka Kecil", 20000, "3 Hari"), ("Boneka Besar", 32000, "3 Hari")],
            "atasan": atasan, "bawahan": bawahan, "ibadah": ibadah,
            "sepatu": [("Sepatu", 50000, "3 Hari"), ("Sandal", 30000, "2 Hari"), ("Tas", 38000, "2 Hari")],
            "karpet": [("Karpet Tipis", 21000), ("Karpet Tebal", 23000), ("Gorden", 14000), ("Vitrase Gorden", 10000)],
            "kasur": [("Kasur Palembang", 85000), ("Baby Car Seat", 80000), ("Stroller Anak", 80000), ("Kasur Bayi", 55000)],
            "keset": 15000,
        }

    out = []  # (name, category, unit, price, price_exp, dur, dur_exp, min_kg, icon)
    for nm, reg, exp, mkg, icon in data["kiloan"]:
        out.append((nm, "Kiloan", "kg", reg, exp, _D2[0], _D2[1], mkg, icon))
    out.append(("Add-on Dettol", "Add-on", "kg", data["dettol"], None, "", "", None, "shield-plus"))
    for nm, reg, exp in data["bedcover"]:
        out.append((f"Bed Cover {nm}", "Bed Cover", "pcs", reg, exp, _D2[0], (_D2[1] if exp else ""), None, "bed"))
    for nm, reg, exp in data["selimut"]:
        out.append((f"Selimut {nm}", "Selimut", "pcs", reg, exp, _D2[0], _D2[1], None, "bed-king"))
    for nm, price, dur in data["bantal"]:
        out.append((nm, "Bantal & Guling", "pcs", price, None, dur, "", None, "bed-empty"))
    for nm, price, dur in data["boneka"]:
        out.append((nm, "Boneka", "pcs", price, None, dur, "", None, "teddy-bear"))
    for nm, reg, exp in data["atasan"]:
        out.append((nm, "Atasan", "pcs", reg, exp, _D2[0], _D2[1], None, "tshirt-crew"))
    for nm, reg, exp in data["bawahan"]:
        out.append((nm, "Bawahan", "pcs", reg, exp, _D2[0], _D2[1], None, "hanger"))
    for nm, reg, exp in data["ibadah"]:
        out.append((nm, "Ibadah", "pcs", reg, exp, _D2[0], _D2[1], None, "hands-pray"))
    for nm, price, dur in data["sepatu"]:
        out.append((nm, "Sepatu & Tas", "pcs", price, None, dur, "", None, "shoe-sneaker"))
    for nm, price in data["karpet"]:
        out.append((nm, "Karpet & Gorden", "m", price, None, "7 Hari", "", None, "rug"))
    for nm, price in data["kasur"]:
        out.append((nm, "Kasur", "pcs", price, None, "7 Hari", "", None, "bed-double"))
    out.append(("Keset", "Lantai", "pcs", data["keset"], None, "2 Hari", "", None, "broom"))
    return out


async def reseed_pricelist():
    """Wipe transactional + service data and load per-outlet pricelist with fresh sample orders."""
    async with pool.acquire() as conn:
        ver = await conn.fetchval("select value from app_config where key='pricelist_v'")
        if ver == PRICELIST_VERSION:
            return
        logger.info("Reseeding pricelist per outlet (version %s)...", PRICELIST_VERSION)
        now = now_utc()

        outlets = await conn.fetch("select id, city, sla_hours from outlets")
        if not outlets:
            return
        # wipe transactional + service data (keep outlets, customers, employees)
        await conn.execute("delete from work_logs")
        await conn.execute("delete from attendance")
        await conn.execute("delete from payroll_manual")
        await conn.execute("delete from order_items")
        await conn.execute("delete from transactions")
        await conn.execute("delete from orders")
        await conn.execute("delete from expenses")
        await conn.execute("delete from adjustments")
        await conn.execute("delete from services")

        # set example salary config on employees
        await conn.execute("update employees set gaji_pokok=1500000, tunjangan_kasir=300000 where role_type='admin'")
        await conn.execute("update employees set gaji_pokok=1200000, tunjangan_kasir=0 where role_type='produksi'")
        await conn.execute("update employees set gaji_pokok=1250000, tunjangan_kasir=0 where role_type='kurir'")

        # insert pricelist per outlet
        svc_records = []
        svc_by_outlet: dict = {}
        for o in outlets:
            oid = o["id"]
            svc_by_outlet[oid] = []
            for (nm, cat, unit, price, price_exp, dur, dur_exp, mkg, icon) in _pricelist_for(o["city"]):
                sid = uuid.uuid4()
                pe = Decimal(price_exp) if price_exp is not None else None
                mk = Decimal(mkg) if mkg is not None else None
                svc_records.append((sid, oid, nm, cat, unit, Decimal(price), pe, dur, dur_exp, mk, icon, True, now))
                svc_by_outlet[oid].append((sid, nm, unit, Decimal(price)))
        await conn.copy_records_to_table(
            "services", records=svc_records,
            columns=["id", "outlet_id", "name", "category", "unit", "price", "price_express",
                     "duration", "duration_express", "min_kg", "icon", "active", "created_at"])

        # regenerate sample orders per outlet using its own services
        cust_rows = await conn.fetch("select id, outlet_id from customers")
        cust_by_outlet: dict = {}
        for c in cust_rows:
            cust_by_outlet.setdefault(c["outlet_id"], []).append(c["id"])
        sla_by_outlet = {o["id"]: o["sla_hours"] for o in outlets}

        # produksi employees per outlet (for work-log attribution)
        prod_rows = await conn.fetch("select id, name, outlet_id from employees where role_type='produksi'")
        prod_by_outlet: dict = {}
        for e in prod_rows:
            prod_by_outlet.setdefault(e["outlet_id"], []).append((e["id"], e["name"]))
        kurir_rows = await conn.fetch("select id, name, outlet_id from employees where role_type='kurir'")
        kurir_by_outlet: dict = {}
        for e in kurir_rows:
            kurir_by_outlet.setdefault(e["outlet_id"], []).append((e["id"], e["name"]))

        orders = []; items = []; txns = []; wlogs = []
        methods = ["cash", "qris", "emoney"]
        points_by_cust: dict = {}
        code_seq = 1000
        for oid, custs in cust_by_outlet.items():
            svcs = svc_by_outlet.get(oid, [])
            if not custs or not svcs:
                continue
            sla = sla_by_outlet.get(oid, 48)
            for day_offset in range(30, -1, -1):
                day = now - timedelta(days=day_offset)
                n_orders = random.randint(3, 7) if day_offset == 0 else random.randint(1, 5)
                for _ in range(n_orders):
                    cust_id = random.choice(custs)
                    created = day.replace(hour=random.randint(8, 19), minute=random.randint(0, 59), second=0, microsecond=0)
                    chosen = random.sample(svcs, random.randint(1, 3))
                    total = Decimal(0); weight = Decimal(0); unit_qty = 0
                    ordid = uuid.uuid4()
                    for (sid, nm, unit, price) in chosen:
                        if unit == "kg":
                            qty = Decimal(random.choice([3, 4, 5, 6, 7, 8])); weight += qty
                        else:
                            qty = Decimal(random.randint(1, 3)); unit_qty += int(qty)
                        subtotal = price * qty; total += subtotal
                        items.append((uuid.uuid4(), ordid, sid, nm, unit, qty, price, subtotal))
                    if day_offset == 0:
                        status = random.choice(["received", "washing", "drying", "ironing", "packing", "ready", "completed"])
                    elif day_offset <= 2:
                        status = random.choice(["washing", "ironing", "packing", "ready", "ready", "completed", "completed"])
                    else:
                        status = random.choices(["completed", "cancelled"], weights=[92, 8])[0]
                    delivery = random.choices(["self", "delivery", "pickup"], weights=[60, 25, 15])[0]
                    due_at = created + timedelta(hours=sla)
                    paid = status == "completed" or random.random() < 0.6
                    payment_status = "paid" if paid else "unpaid"
                    completed_at = created + timedelta(hours=random.randint(max(1, sla - 6), sla + 30)) if status == "completed" else None
                    cancelled_at = created + timedelta(hours=random.randint(1, 5)) if status == "cancelled" else None
                    code_seq += 1
                    code = f"JW-{created.strftime('%y%m%d')}-{code_seq}"
                    pmethod = random.choice(methods)
                    orders.append((ordid, code, cust_id, oid, status, total, weight, unit_qty, payment_status,
                                   pmethod, delivery, "", "owner", created, created, due_at, completed_at, cancelled_at,
                                   "Salah input" if status == "cancelled" else ""))
                    if payment_status == "paid" and status != "cancelled":
                        txns.append((uuid.uuid4(), ordid, oid, total, "income", pmethod, created))
                    if status == "completed":
                        points_by_cust[cust_id] = points_by_cust.get(cust_id, 0) + int(total / Decimal(1000))
                        prods = prod_by_outlet.get(oid, [])
                        if prods and (weight > 0 or unit_qty > 0):
                            for stage in ("washing", "ironing"):
                                emp_id, emp_name = random.choice(prods)
                                wlogs.append((uuid.uuid4(), ordid, emp_id, emp_name, oid, stage, weight, unit_qty, completed_at or created))
                        kurs = kurir_by_outlet.get(oid, [])
                        if kurs and delivery in ("pickup", "delivery"):
                            emp_id, emp_name = random.choice(kurs)
                            wlogs.append((uuid.uuid4(), ordid, emp_id, emp_name, oid, "trip", Decimal(0), 0, completed_at or created))

        if orders:
            await conn.copy_records_to_table(
                "orders", records=orders,
                columns=["id", "code", "customer_id", "outlet_id", "status", "total", "weight_kg", "unit_qty",
                         "payment_status", "payment_method", "delivery_type", "notes", "created_by", "created_at",
                         "updated_at", "due_at", "completed_at", "cancelled_at", "cancel_reason"])
        if items:
            await conn.copy_records_to_table(
                "order_items", records=items,
                columns=["id", "order_id", "service_id", "service_name", "unit", "qty", "price", "subtotal"])
        if txns:
            await conn.copy_records_to_table(
                "transactions", records=txns,
                columns=["id", "order_id", "outlet_id", "amount", "type", "method", "created_at"])
        if wlogs:
            await conn.copy_records_to_table(
                "work_logs", records=wlogs,
                columns=["id", "order_id", "employee_id", "employee_name", "outlet_id", "stage", "weight_kg", "unit_qty", "created_at"])

        # sample attendance for current month (each employee ~20-26 days up to today)
        all_emps = await conn.fetch("select id, outlet_id from employees")
        att = []
        today_d = now.date()
        month_start = today_d.replace(day=1)
        days_so_far = (today_d - month_start).days + 1
        for e in all_emps:
            present = sorted(random.sample(range(days_so_far), min(days_so_far, random.randint(max(1, days_so_far - 4), days_so_far))))
            for off in present:
                att.append((uuid.uuid4(), e["id"], e["outlet_id"], month_start + timedelta(days=off)))
        if att:
            await conn.copy_records_to_table(
                "attendance", records=att,
                columns=["id", "employee_id", "outlet_id", "day"])

        # recompute customer points
        await conn.execute("update customers set points=0")
        for cid, pts in points_by_cust.items():
            await conn.execute("update customers set points=$1 where id=$2", pts, cid)

        # expenses
        exp_cats = ["Deterjen & Pewangi", "Listrik & Air", "Gaji Harian", "Plastik & Packaging", "Perawatan Mesin", "Transport Kurir"]
        expenses = []
        oids = [o["id"] for o in outlets]
        for day_offset in range(30, -1, -1):
            if random.random() < 0.5:
                continue
            day = now - timedelta(days=day_offset)
            expenses.append((uuid.uuid4(), random.choice(oids), random.choice(exp_cats),
                             Decimal(random.choice([50000, 75000, 100000, 150000, 200000])), "", "owner", day))
        if expenses:
            await conn.copy_records_to_table(
                "expenses", records=expenses,
                columns=["id", "outlet_id", "category", "amount", "note", "created_by", "created_at"])

        await conn.execute("insert into app_config(key,value) values('pricelist_v',$1) on conflict (key) do update set value=$1", PRICELIST_VERSION)
        logger.info("Pricelist reseed complete.")


# Models
class LoginBody(BaseModel):
    username: str
    password: str


class RegisterBody(BaseModel):
    name: str
    phone: str
    password: str
    email: str = ""
    outlet_id: Optional[str] = None


class OutletPickBody(BaseModel):
    outlet_id: str


class PayBody(BaseModel):
    method: str = "qris"
    voucher_id: Optional[str] = None
    promo_code: Optional[str] = None


class TopupBody(BaseModel):
    customer_id: str
    outlet_id: Optional[str] = None
    amount: float
    method: str = "cash"


class ReviewBody(BaseModel):
    customer_id: str
    outlet_id: Optional[str] = None
    order_id: Optional[str] = None
    rating: int
    comment: str = ""


class PromoBody(BaseModel):
    outlet_id: Optional[str] = None
    title: str
    description: str = ""
    discount_pct: float = 0
    code: str = ""
    valid_until: Optional[str] = None
    active: bool = True


class OutletBody(BaseModel):
    name: str
    city: str
    address: str = ""
    phone: str = ""
    sla_hours: int = 48
    qris_url: str = ""


class ServiceBody(BaseModel):
    name: str
    category: str = "Cuci"
    unit: str = "kg"
    price: float = 0
    price_express: Optional[float] = None
    duration: str = ""
    duration_express: str = ""
    min_kg: Optional[float] = None
    outlet_id: Optional[str] = None
    icon: str = "washing-machine"
    active: bool = True


class CustomerBody(BaseModel):
    name: str
    phone: str = ""
    email: str = ""
    address: str = ""
    deposit: float = 0
    outlet_id: Optional[str] = None
    password: str = ""


class EmployeeBody(BaseModel):
    name: str
    role_type: str = "admin"
    pin: str = "0000"
    username: str = ""
    password: str = ""
    outlet_id: Optional[str] = None
    active: bool = True
    gaji_pokok: float = 0
    tunjangan_kasir: float = 0
    permissions: dict = Field(default_factory=dict)


class PayrollManualBody(BaseModel):
    employee_id: str
    period: str
    lembur_shifts: int = 0
    perjalanan_dinas: float = 0


class KasbonBody(BaseModel):
    employee_id: str
    outlet_id: Optional[str] = None
    amount: float
    note: str = ""


class OrderItemIn(BaseModel):
    service_id: str
    service_name: str
    unit: str = "kg"
    qty: float = 1
    price: float = 0


class OrderBody(BaseModel):
    customer_id: str
    outlet_id: str
    items: List[OrderItemIn]
    delivery_type: str = "self"
    notes: str = ""
    payment_status: str = "unpaid"
    payment_method: str = "qris"
    created_by: str = "owner"
    express: bool = False


class StatusBody(BaseModel):
    status: str


class CancelBody(BaseModel):
    reason: str = ""


class RequestItem(BaseModel):
    category: str
    qty: float = 1


class OrderRequestBody(BaseModel):
    customer_id: str
    outlet_id: str
    categories: List[RequestItem]
    delivery_type: str = "self"
    address: str = ""
    notes: str = ""


class AdvanceBody(BaseModel):
    employee_id: Optional[str] = None
    employee_name: str = ""


class WeighBody(BaseModel):
    items: List[OrderItemIn]
    express: bool = False
    employee_id: Optional[str] = None
    employee_name: str = ""
    notes: Optional[str] = None
    photos: List[str] = Field(default_factory=list)


class TripBody(BaseModel):
    type: str = "pickup"
    employee_id: Optional[str] = None
    employee_name: str = ""


class ExpenseBody(BaseModel):
    outlet_id: str
    category: str = "Operasional"
    amount: float = 0
    note: str = ""


class AdjustmentBody(BaseModel):
    outlet_id: str
    amount: float = 0
    direction: str = "in"
    reason: str = ""


@api.post("/auth/login")
async def login(body: LoginBody):
    uname = (body.username or "").strip().lower()
    async with pool.acquire() as conn:
        # owner
        owner_user = await conn.fetchval("select value from app_config where key='owner_username'")
        owner_hash = await conn.fetchval("select value from app_config where key='owner_pass_hash'")
        if owner_user and uname == owner_user.lower():
            if await run_in_threadpool(verify_password, body.password, owner_hash):
                outlets = rows_to_list(await conn.fetch("select * from outlets order by created_at"))
                return {"role": "owner", "name": "Owner", "outlets": outlets}
            raise HTTPException(401, "Username atau kata sandi salah")

        # pegawai
        emp = await conn.fetchrow("select * from employees where lower(username)=$1 and active=true", uname)
        if emp and await run_in_threadpool(verify_password, body.password, emp["password_hash"]):
            # catat kehadiran hari ini (1 login/hari = 1 shift hadir)
            await conn.execute(
                "insert into attendance(employee_id,outlet_id,day) values($1,$2,(now() at time zone 'Asia/Jakarta')::date) on conflict (employee_id, day) do nothing",
                emp["id"], emp["outlet_id"])
            outlets = rows_to_list(await conn.fetch("select * from outlets order by created_at"))
            return {"role": "pegawai", "employee": row_to_dict(emp), "outlets": outlets}

        # pelanggan (username = phone, case-insensitive)
        cust = await conn.fetchrow("select * from customers where lower(phone)=lower($1)", body.username.strip())
        if cust and await run_in_threadpool(verify_password, body.password, cust["password_hash"]):
            return {"role": "pelanggan", "customer": row_to_dict(cust)}

    raise HTTPException(401, "Username atau kata sandi salah")


@api.post("/auth/register")
async def register(body: RegisterBody):
    phone = (body.phone or "").strip()
    if len(phone) < 7:
        raise HTTPException(422, "Nomor HP tidak valid")
    if len(body.password) < 6:
        raise HTTPException(422, "Kata sandi minimal 6 karakter")
    try:
        pw = await run_in_threadpool(hash_password, body.password)
    except ValueError as e:
        raise HTTPException(422, str(e))
    async with pool.acquire() as conn:
        exists = await conn.fetchval("select count(*) from customers where phone=$1", phone)
        if exists:
            raise HTTPException(409, "Nomor HP sudah terdaftar")
        outlet = None
        if body.outlet_id:
            outlet = await conn.fetchval("select id from outlets where id=$1", body.outlet_id)
        if not outlet:
            raise HTTPException(422, "Pilih outlet terlebih dahulu")
        row = await conn.fetchrow(
            "insert into customers(name,phone,email,outlet_id,password_hash) values($1,$2,$3,$4,$5) returning *",
            body.name.strip(), phone, body.email, outlet, pw)
        return {"role": "pelanggan", "customer": row_to_dict(row)}


@api.patch("/customers/{cid}/outlet")
async def pick_customer_outlet(cid: str, b: OutletPickBody):
    async with pool.acquire() as conn:
        outlet = await conn.fetchval("select id from outlets where id=$1", b.outlet_id)
        if not outlet:
            raise HTTPException(404, "Outlet tidak ditemukan")
        row = await conn.fetchrow("update customers set outlet_id=$1 where id=$2 returning *", outlet, cid)
        if not row:
            raise HTTPException(404, "Pelanggan tidak ditemukan")
        return row_to_dict(row)


@api.get("/promos")
async def list_promos(outlet_id: Optional[str] = None):
    async with pool.acquire() as conn:
        clauses = ["active=true", "(valid_until is null or valid_until >= current_date)"]
        args = []
        if outlet_id:
            args.append(outlet_id)
            clauses.append(f"(outlet_id=${len(args)} or outlet_id is null)")
        rows = await conn.fetch(
            f"select * from promos where {' and '.join(clauses)} order by created_at desc", *args)
        return rows_to_list(rows)


@api.get("/promos/validate")
async def validate_promo(code: str, outlet_id: Optional[str] = None):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """select * from promos where lower(code)=lower($1) and active=true
               and (valid_until is null or valid_until >= current_date)
               and ($2::uuid is null or outlet_id is null or outlet_id=$2::uuid)
               order by created_at desc limit 1""", code.strip(), outlet_id)
        if not row:
            raise HTTPException(404, "Kode promo tidak ditemukan atau sudah kedaluwarsa")
        return row_to_dict(row)


@api.post("/promos")
async def create_promo(b: PromoBody):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """insert into promos(outlet_id,title,description,discount_pct,code,valid_until,active)
               values($1,$2,$3,$4,$5,$6,$7) returning *""",
            b.outlet_id, b.title, b.description, b.discount_pct, b.code, _to_date(b.valid_until), b.active)
        return row_to_dict(row)


@api.put("/promos/{pid}")
async def update_promo(pid: str, b: PromoBody):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """update promos set outlet_id=$1,title=$2,description=$3,discount_pct=$4,code=$5,
               valid_until=$6,active=$7 where id=$8 returning *""",
            b.outlet_id, b.title, b.description, b.discount_pct, b.code, _to_date(b.valid_until), b.active, pid)
        if not row:
            raise HTTPException(404, "Promo tidak ditemukan")
        return row_to_dict(row)


@api.delete("/promos/{pid}")
async def delete_promo(pid: str):
    async with pool.acquire() as conn:
        await conn.execute("delete from promos where id=$1", pid)
        return {"ok": True}


@api.get("/outlets")
async def list_outlets():
    async with pool.acquire() as conn:
        return rows_to_list(await conn.fetch("select * from outlets order by created_at"))


@api.post("/outlets")
async def create_outlet(b: OutletBody):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "insert into outlets(name,city,address,phone,sla_hours,qris_url) values($1,$2,$3,$4,$5,$6) returning *",
            b.name, b.city, b.address, b.phone, b.sla_hours, b.qris_url)
        return row_to_dict(row)


@api.put("/outlets/{oid}")
async def update_outlet(oid: str, b: OutletBody):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "update outlets set name=$1,city=$2,address=$3,phone=$4,sla_hours=$5,qris_url=$6 where id=$7 returning *",
            b.name, b.city, b.address, b.phone, b.sla_hours, b.qris_url, oid)
        if not row:
            raise HTTPException(404, "Outlet tidak ditemukan")
        return row_to_dict(row)


CATEGORY_ORDER = ["Kiloan", "Add-on", "Bed Cover", "Selimut", "Bantal & Guling", "Boneka",
                  "Atasan", "Bawahan", "Ibadah", "Sepatu & Tas", "Karpet & Gorden", "Kasur", "Lantai"]


@api.get("/services")
async def list_services(include_inactive: bool = False, outlet_id: Optional[str] = None):
    async with pool.acquire() as conn:
        clauses = []
        args = []
        if not include_inactive:
            clauses.append("active=true")
        if outlet_id:
            args.append(outlet_id)
            clauses.append(f"outlet_id=${len(args)}")
        where = (" where " + " and ".join(clauses)) if clauses else ""
        rows = rows_to_list(await conn.fetch(f"select * from services{where}", *args))
    rows.sort(key=lambda r: (CATEGORY_ORDER.index(r["category"]) if r["category"] in CATEGORY_ORDER else 99, r["name"]))
    return rows


@api.post("/services")
async def create_service(b: ServiceBody):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """insert into services(name,category,unit,price,price_express,duration,duration_express,min_kg,outlet_id,icon,active)
               values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *""",
            b.name, b.category, b.unit, b.price, b.price_express, b.duration, b.duration_express,
            b.min_kg, b.outlet_id, b.icon, b.active)
        return row_to_dict(row)


@api.put("/services/{sid}")
async def update_service(sid: str, b: ServiceBody):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """update services set name=$1,category=$2,unit=$3,price=$4,price_express=$5,duration=$6,
               duration_express=$7,min_kg=$8,outlet_id=$9,icon=$10,active=$11 where id=$12 returning *""",
            b.name, b.category, b.unit, b.price, b.price_express, b.duration, b.duration_express,
            b.min_kg, b.outlet_id, b.icon, b.active, sid)
        if not row:
            raise HTTPException(404, "Layanan tidak ditemukan")
        return row_to_dict(row)


@api.get("/customers")
async def list_customers(outlet_id: Optional[str] = None, q: Optional[str] = None):
    async with pool.acquire() as conn:
        clauses, args = [], []
        if outlet_id:
            args.append(outlet_id); clauses.append(f"c.outlet_id=${len(args)}")
        if q:
            args.append(f"%{q}%")
            text_idx = len(args)
            digits = "".join(ch for ch in q if ch.isdigit())
            if digits.startswith("0"):
                digits = "62" + digits[1:]
            elif digits.startswith("8"):
                digits = "62" + digits
            if digits:
                args.append(digits)
                clauses.append(f"(c.name ilike ${text_idx} or c.phone ilike ${text_idx} or regexp_replace(c.phone, '[^0-9]', '', 'g')=${len(args)})")
            else:
                clauses.append(f"(c.name ilike ${text_idx} or c.phone ilike ${text_idx})")
        where = (" where " + " and ".join(clauses)) if clauses else ""
        rows = await conn.fetch(
            f"""select c.*, o.name as outlet_name,
                   coalesce(s.total_kg,0) as total_kg, coalesce(s.tx_count,0) as tx_count,
                   coalesce(s.total_spend,0) as total_spend, s.first_order, s.last_order
                from customers c
                left join outlets o on o.id=c.outlet_id
                left join (
                  select customer_id, sum(weight_kg) total_kg, count(*) tx_count, sum(total) total_spend,
                         min(created_at) first_order, max(created_at) last_order
                  from orders where status<>'cancelled' group by customer_id
                ) s on s.customer_id=c.id{where}
                order by coalesce(s.total_spend,0) desc, c.name""", *args)
        return rows_to_list(rows)


@api.get("/customers/{cid}/detail")
async def customer_detail(cid: str):
    async with pool.acquire() as conn:
        await expire_deposits(conn)
        c = await conn.fetchrow("select * from customers where id=$1", cid)
        if not c:
            raise HTTPException(404, "Pelanggan tidak ditemukan")
        d = row_to_dict(c)
        s = await conn.fetchrow(
            """select coalesce(sum(weight_kg),0) total_kg, count(*) tx_count, coalesce(sum(total),0) total_spend,
                   min(created_at) first_order, max(created_at) last_order
               from orders where customer_id=$1 and status<>'cancelled'""", cid)
        d.update({"total_kg": float(s["total_kg"]), "tx_count": int(s["tx_count"]),
                  "total_spend": float(s["total_spend"]),
                  "first_order": s["first_order"].isoformat() if s["first_order"] else None,
                  "last_order": s["last_order"].isoformat() if s["last_order"] else None})
        recent = await conn.fetch(
            "select code,total,status,weight_kg,unit_qty,created_at from orders where customer_id=$1 order by created_at desc limit 10", cid)
        d["recent_orders"] = rows_to_list(recent)
        d["pending_topups"] = int(await conn.fetchval(
            "select count(*) from topups where customer_id=$1 and status='pending'", cid) or 0)
        vouchers = await conn.fetch(
            """select * from vouchers where customer_id=$1 and used=false
               and (expires_at is null or expires_at >= current_date) order by created_at desc""", cid)
        d["vouchers"] = rows_to_list(vouchers)
        d["reviews_count"] = int(await conn.fetchval(
            "select count(*) from reviews where customer_id=$1", cid) or 0)
        return d


@api.post("/customers")
async def create_customer(b: CustomerBody):
    name = (b.name or "").strip()
    digits = "".join(ch for ch in (b.phone or "") if ch.isdigit())
    if digits.startswith("0"):
        digits = "62" + digits[1:]
    elif digits.startswith("8"):
        digits = "62" + digits
    if not name:
        raise HTTPException(422, "Nama pelanggan wajib diisi")
    if not digits.startswith("62") or len(digits) < 10 or len(digits) > 15:
        raise HTTPException(422, "Nomor WhatsApp Indonesia tidak valid")
    phone = f"+{digits}"
    pw = await run_in_threadpool(hash_password, b.password or "pelanggan123")
    async with pool.acquire() as conn:
        exists = await conn.fetchval(
            """select id from customers
               where regexp_replace(phone, '[^0-9]', '', 'g') = any($1::text[])
               limit 1""", [digits, "0" + digits[2:]])
        if exists:
            raise HTTPException(409, "Nomor WhatsApp sudah terdaftar sebagai pelanggan")
        outlet_id = b.outlet_id
        if outlet_id and not await conn.fetchval("select id from outlets where id=$1", outlet_id):
            raise HTTPException(404, "Outlet tidak ditemukan")
        row = await conn.fetchrow(
            "insert into customers(name,phone,email,address,deposit,outlet_id,password_hash) values($1,$2,$3,$4,$5,$6,$7) returning *",
            name, phone, b.email, (b.address or "").strip(), b.deposit, outlet_id, pw)
        return row_to_dict(row)


@api.put("/customers/{cid}")
async def update_customer(cid: str, b: CustomerBody):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "update customers set name=$1,phone=$2,email=$3,address=$4,deposit=$5,outlet_id=$6 where id=$7 returning *",
            b.name, b.phone, b.email, b.address, b.deposit, b.outlet_id, cid)
        if not row:
            raise HTTPException(404, "Pelanggan tidak ditemukan")
        return row_to_dict(row)


@api.get("/employees")
async def list_employees(outlet_id: Optional[str] = None):
    async with pool.acquire() as conn:
        if outlet_id:
            rows = await conn.fetch("select * from employees where outlet_id=$1 order by role_type,name", outlet_id)
        else:
            rows = await conn.fetch("select * from employees order by role_type,name")
        return rows_to_list(rows)


@api.post("/employees")
async def create_employee(b: EmployeeBody):
    import json
    username = (b.username or (b.name or "staff").split()[0]).strip().lower()
    pw = await run_in_threadpool(hash_password, b.password or "pegawai123")
    async with pool.acquire() as conn:
        dup = await conn.fetchval("select count(*) from employees where lower(username)=$1", username)
        if dup:
            username = f"{username}{str(uuid.uuid4())[:4]}"
        row = await conn.fetchrow(
            "insert into employees(name,role_type,pin,username,password_hash,outlet_id,active,gaji_pokok,tunjangan_kasir,permissions) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) returning *",
            b.name, b.role_type, b.pin, username, pw, b.outlet_id, b.active, b.gaji_pokok, b.tunjangan_kasir, json.dumps(b.permissions))
        return row_to_dict(row)


@api.put("/employees/{eid}")
async def update_employee(eid: str, b: EmployeeBody):
    import json
    async with pool.acquire() as conn:
        username = (b.username or (b.name or "staff").split()[0]).strip().lower()
        if b.password:
            pw = await run_in_threadpool(hash_password, b.password)
            row = await conn.fetchrow(
                "update employees set name=$1,role_type=$2,pin=$3,username=$4,password_hash=$5,outlet_id=$6,active=$7,gaji_pokok=$8,tunjangan_kasir=$9,permissions=$10::jsonb where id=$11 returning *",
                b.name, b.role_type, b.pin, username, pw, b.outlet_id, b.active, b.gaji_pokok, b.tunjangan_kasir, json.dumps(b.permissions), eid)
        else:
            row = await conn.fetchrow(
                "update employees set name=$1,role_type=$2,pin=$3,username=$4,outlet_id=$5,active=$6,gaji_pokok=$7,tunjangan_kasir=$8,permissions=$9::jsonb where id=$10 returning *",
                b.name, b.role_type, b.pin, username, b.outlet_id, b.active, b.gaji_pokok, b.tunjangan_kasir, json.dumps(b.permissions), eid)
        if not row:
            raise HTTPException(404, "Pegawai tidak ditemukan")
        return row_to_dict(row)


async def enrich_orders(conn, rows):
    ids = [r["id"] for r in rows]
    cust_ids = list({r["customer_id"] for r in rows if r["customer_id"]})
    customers = {}
    if cust_ids:
        for c in await conn.fetch("select id,name,phone from customers where id = any($1::uuid[])", cust_ids):
            customers[c["id"]] = c
    summaries: dict = {}
    if ids:
        for i in await conn.fetch(
                "select order_id, service_name, qty, unit from order_items where order_id = any($1::uuid[])", ids):
            summaries.setdefault(i["order_id"], []).append(
                f"{i['service_name']} {float(i['qty']):g} {i['unit']}")
    result = []
    for r in rows:
        d = row_to_dict(r)
        for key in ("request_items", "photos"):
            v = d.get(key)
            if isinstance(v, str):
                try:
                    d[key] = json.loads(v) if v else []
                except ValueError:
                    d[key] = []
            elif v is None:
                d[key] = []
        cust = customers.get(r["customer_id"])
        d["customer_name"] = cust["name"] if cust else "-"
        d["customer_phone"] = cust["phone"] if cust else ""
        d["stage_label"] = STAGE_LABELS.get(r["status"], r["status"])
        due = r["due_at"]
        d["overdue"] = bool(due and due < now_utc() and r["status"] not in ("completed", "cancelled"))
        d["items_summary"] = ", ".join(summaries.get(r["id"], []))
        result.append(d)
    return result


@api.get("/orders")
async def list_orders(outlet_id: Optional[str] = None, customer_id: Optional[str] = None, status: Optional[str] = None, active: bool = False, today: bool = False, queue: bool = False, unpaid: bool = False, speed: Optional[str] = None, sort: Optional[str] = None, limit: int = 100):
    async with pool.acquire() as conn:
        clauses, args = [], []
        if unpaid:
            clauses.append("payment_status='unpaid' and status<>'cancelled' and total > 0")
        if outlet_id:
            args.append(outlet_id); clauses.append(f"outlet_id=${len(args)}")
        if customer_id:
            args.append(customer_id); clauses.append(f"customer_id=${len(args)}")
        if status:
            args.append(status); clauses.append(f"status=${len(args)}")
        if active:
            clauses.append("status in ('received','washing','drying','ironing','packing')")
        if today:
            clauses.append("(created_at at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date")
        if queue:
            clauses.append("((created_at at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date"
                           " or status in ('requested','quoted','received','washing','drying','ironing','packing','ready'))")
        if speed == "express":
            clauses.append("express = true")
        elif speed == "regular":
            clauses.append("express = false")
        where = (" where " + " and ".join(clauses)) if clauses else ""
        order_by = "express desc, created_at asc" if sort == "fifo" else "created_at desc"
        args.append(limit)
        rows = await conn.fetch(f"select * from orders{where} order by {order_by} limit ${len(args)}", *args)
        return await enrich_orders(conn, rows)


@api.get("/orders/{oid}")
async def get_order(oid: str):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("select * from orders where id=$1", oid)
        if not row:
            raise HTTPException(404, "Order tidak ditemukan")
        d = (await enrich_orders(conn, [row]))[0]
        items = await conn.fetch("select * from order_items where order_id=$1", oid)
        d["items"] = rows_to_list(items)
        return d


@api.post("/orders/request")
async def create_order_request(b: OrderRequestBody):
    """Customer initial request (no weight/price yet). Employee will weigh & quote."""
    import json
    async with pool.acquire() as conn:
        outlet = await conn.fetchrow("select * from outlets where id=$1", b.outlet_id)
        if not outlet:
            raise HTTPException(404, "Outlet tidak ditemukan")
        if not b.categories:
            raise HTTPException(400, "Pilih minimal satu layanan")
        created = now_utc()
        due = created + timedelta(hours=outlet["sla_hours"])
        code = f"JW-{created.strftime('%y%m%d')}-{random.randint(1000,9999)}"
        req = [{"category": c.category, "qty": float(c.qty)} for c in b.categories]
        oid = await conn.fetchval(
            """insert into orders(code,customer_id,outlet_id,status,total,weight_kg,unit_qty,
               payment_status,payment_method,delivery_type,notes,address,is_request,request_items,
               created_by,created_at,updated_at,due_at)
               values($1,$2,$3,'requested',0,0,0,'unpaid','',$4,$5,$6,true,$7::jsonb,'customer',$8,$8,$9) returning id""",
            code, b.customer_id, b.outlet_id, b.delivery_type, b.notes, b.address, json.dumps(req), created, due)
        row = await conn.fetchrow("select * from orders where id=$1", oid)
        return (await enrich_orders(conn, [row]))[0]


async def validate_service_items(conn, outlet_id, items: List[OrderItemIn]):
    """Enforce owner-managed service, outlet, and minimum quantity rules."""
    if not items:
        raise HTTPException(422, "Minimal 1 layanan wajib dipilih")
    service_ids = [item.service_id for item in items]
    rows = await conn.fetch(
        "select id,name,unit,min_kg,active from services where outlet_id=$1 and id=any($2::uuid[])",
        outlet_id, service_ids)
    services = {str(row["id"]): row for row in rows}
    if len(services) != len(set(service_ids)):
        raise HTTPException(422, "Layanan tidak tersedia untuk outlet ini")
    for item in items:
        service = services.get(item.service_id)
        qty = Decimal(str(item.qty))
        if not service or not service["active"] or qty <= 0 or item.unit != service["unit"]:
            raise HTTPException(422, f"Jumlah untuk {service['name'] if service else 'layanan'} tidak valid")
        if item.unit == "kg" and service["min_kg"] is not None and qty < service["min_kg"]:
            raise HTTPException(422, f"{service['name']} minimal {float(service['min_kg']):g} kg")


@api.post("/orders")
async def create_order(b: OrderBody):
    async with pool.acquire() as conn:
        outlet = await conn.fetchrow("select * from outlets where id=$1", b.outlet_id)
        if not outlet:
            raise HTTPException(404, "Outlet tidak ditemukan")
        await validate_service_items(conn, b.outlet_id, b.items)
        total = Decimal(0); weight = Decimal(0); unit_qty = 0
        for it in b.items:
            sub = Decimal(str(it.price)) * Decimal(str(it.qty)); total += sub
            if it.unit == "kg":
                weight += Decimal(str(it.qty))
            else:
                unit_qty += int(it.qty)
        created = now_utc()
        due = created + timedelta(hours=outlet["sla_hours"])
        code = f"JW-{created.strftime('%y%m%d')}-{random.randint(1000,9999)}"
        if b.payment_status == "paid" and b.payment_method == "deposit":
            cust = await conn.fetchrow("select deposit from customers where id=$1", b.customer_id)
            if not cust or float(cust["deposit"]) < float(total):
                raise HTTPException(400, "Saldo deposit tidak cukup")
        async with conn.transaction():
            oid = await conn.fetchval(
                """insert into orders(code,customer_id,outlet_id,status,total,weight_kg,unit_qty,
                   payment_status,payment_method,delivery_type,notes,created_by,express,created_at,updated_at,due_at)
                   values($1,$2,$3,'received',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13,$14) returning id""",
                code, b.customer_id, b.outlet_id, total, weight, unit_qty, b.payment_status, b.payment_method,
                b.delivery_type, b.notes, b.created_by, b.express, created, due)
            for it in b.items:
                sub = Decimal(str(it.price)) * Decimal(str(it.qty))
                await conn.execute(
                    "insert into order_items(order_id,service_id,service_name,unit,qty,price,subtotal) values($1,$2,$3,$4,$5,$6,$7)",
                    oid, it.service_id, it.service_name, it.unit, it.qty, it.price, sub)
            if b.payment_status == "paid":
                if b.payment_method == "deposit":
                    await conn.execute("update customers set deposit = deposit - $1 where id=$2", total, b.customer_id)
                await conn.execute(
                    "insert into transactions(order_id,outlet_id,amount,type,method) values($1,$2,$3,'income',$4)",
                    oid, b.outlet_id, total, b.payment_method)
        row = await conn.fetchrow("select * from orders where id=$1", oid)
        return (await enrich_orders(conn, [row]))[0]


@api.patch("/orders/{oid}/status")
async def update_status(oid: str, b: StatusBody):
    if b.status not in STAGE_LABELS:
        raise HTTPException(400, "Status tidak valid")
    async with pool.acquire() as conn:
        completed_at = now_utc() if b.status == "completed" else None
        row = await conn.fetchrow(
            "update orders set status=$1, updated_at=now(), completed_at=coalesce($2,completed_at) where id=$3 returning *",
            b.status, completed_at, oid)
        if not row:
            raise HTTPException(404, "Order tidak ditemukan")
        if b.status == "completed":
            await conn.execute("update customers set points = points + $1 where id=$2",
                               int(float(row["total"]) / 1000), row["customer_id"])
        return (await enrich_orders(conn, [row]))[0]


@api.post("/orders/{oid}/weigh")
async def weigh_order(oid: str, b: WeighBody):
    """Pegawai menimbang & menetapkan harga final → nota dikirim ke pelanggan (status 'quoted')."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow("select * from orders where id=$1", oid)
        if not row:
            raise HTTPException(404, "Order tidak ditemukan")
        if not b.items:
            raise HTTPException(422, "Minimal 1 item layanan")
        await validate_service_items(conn, row["outlet_id"], b.items)
        total = Decimal(0); weight = Decimal(0); unit_qty = 0
        for it in b.items:
            sub = Decimal(str(it.qty)) * Decimal(str(it.price))
            total += sub
            if it.unit == "kg":
                weight += Decimal(str(it.qty))
            else:
                unit_qty += int(it.qty)
        async with conn.transaction():
            await conn.execute("delete from order_items where order_id=$1", oid)
            for it in b.items:
                sub = Decimal(str(it.qty)) * Decimal(str(it.price))
                await conn.execute(
                    """insert into order_items(order_id,service_id,service_name,unit,qty,price,subtotal)
                       values($1,$2,$3,$4,$5,$6,$7)""",
                    oid, it.service_id, it.service_name, it.unit, it.qty, it.price, sub)
            await conn.execute(
                """update orders set total=$1, weight_kg=$2, unit_qty=$3, express=$4,
                   is_request=false, status='quoted', notes=coalesce($5, notes),
                   photos=$6::jsonb, updated_at=now()
                   where id=$7""",
                total, weight, unit_qty, b.express, b.notes, json.dumps(b.photos), oid)
        row = await conn.fetchrow("select * from orders where id=$1", oid)
        return (await enrich_orders(conn, [row]))[0]


@api.post("/orders/{oid}/trip")
async def record_trip(oid: str, b: TripBody):
    """Kurir konfirmasi penjemputan / pengantaran. Trip tercatat untuk perhitungan gaji."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow("select * from orders where id=$1", oid)
        if not row:
            raise HTTPException(404, "Order tidak ditemukan")
        field = "picked_up_at" if b.type == "pickup" else "delivered_at"
        async with conn.transaction():
            await conn.execute(f"update orders set {field}=now(), updated_at=now() where id=$1", oid)
            if b.employee_id:
                exists = await conn.fetchval(
                    "select 1 from work_logs where order_id=$1 and employee_id=$2 and stage='trip'", oid, b.employee_id)
                if not exists:
                    await conn.execute(
                        """insert into work_logs(order_id,employee_id,employee_name,outlet_id,stage,weight_kg,unit_qty)
                           values($1,$2,$3,$4,'trip',0,0)""",
                        oid, b.employee_id, b.employee_name, row["outlet_id"])
        row = await conn.fetchrow("select * from orders where id=$1", oid)
        return (await enrich_orders(conn, [row]))[0]


@api.post("/orders/{oid}/confirm-receipt")
async def confirm_receipt(oid: str):
    """Pelanggan mengonfirmasi laundry sudah diterima."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "update orders set customer_confirmed_at=now(), updated_at=now() where id=$1 returning *", oid)
        if not row:
            raise HTTPException(404, "Order tidak ditemukan")
        return (await enrich_orders(conn, [row]))[0]


@api.post("/orders/{oid}/advance")
async def advance_status(oid: str, b: Optional[AdvanceBody] = None):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("select * from orders where id=$1", oid)
        if not row:
            raise HTTPException(404, "Order tidak ditemukan")
        cur = row["status"]
        if cur in ("completed", "cancelled") or cur not in PIPELINE:
            raise HTTPException(400, "Order tidak dapat dilanjutkan")
        nxt = PIPELINE[PIPELINE.index(cur) + 1]
        completed_at = now_utc() if nxt == "completed" else None
        # attribute the completed stage (cur) to the employee who finished it
        if b and b.employee_id:
            if cur in ("washing", "drying", "ironing", "packing"):
                await conn.execute(
                    """insert into work_logs(order_id,employee_id,employee_name,outlet_id,stage,weight_kg,unit_qty)
                       values($1,$2,$3,$4,$5,$6,$7)""",
                    oid, b.employee_id, b.employee_name, row["outlet_id"], cur, row["weight_kg"], row["unit_qty"])
            if row["delivery_type"] in ("pickup", "delivery"):
                # 1 trip per order per employee (dedup on distinct order in reports)
                exists = await conn.fetchval(
                    "select 1 from work_logs where order_id=$1 and employee_id=$2 and stage='trip'", oid, b.employee_id)
                if not exists:
                    await conn.execute(
                        """insert into work_logs(order_id,employee_id,employee_name,outlet_id,stage,weight_kg,unit_qty)
                           values($1,$2,$3,$4,'trip',0,0)""",
                        oid, b.employee_id, b.employee_name, row["outlet_id"])
        row = await conn.fetchrow(
            "update orders set status=$1, updated_at=now(), completed_at=coalesce($2,completed_at) where id=$3 returning *",
            nxt, completed_at, oid)
        if nxt == "completed":
            await conn.execute("update customers set points = points + $1 where id=$2",
                               int(float(row["total"]) / 1000), row["customer_id"])
        return (await enrich_orders(conn, [row]))[0]


@api.post("/orders/{oid}/pay")
async def pay_order(oid: str, b: Optional[PayBody] = None):
    method = (b.method if b else "qris") or "qris"
    voucher_id = b.voucher_id if b else None
    promo_code = (b.promo_code or "").strip() if b else ""
    async with pool.acquire() as conn:
        await expire_deposits(conn)
        row = await conn.fetchrow("select * from orders where id=$1", oid)
        if not row:
            raise HTTPException(404, "Order tidak ditemukan")
        if row["payment_status"] == "paid":
            return (await enrich_orders(conn, [row]))[0]
        total = Decimal(str(row["total"]))
        discount = Decimal(0)
        if promo_code:
            promo = await conn.fetchrow(
                """select * from promos where lower(code)=lower($1) and active=true
                   and (valid_until is null or valid_until >= current_date)
                   and (outlet_id is null or outlet_id=$2)
                   order by created_at desc limit 1""", promo_code, row["outlet_id"])
            if not promo:
                raise HTTPException(400, "Kode promo tidak valid")
            discount += (total * Decimal(str(promo["discount_pct"])) / Decimal(100)).quantize(Decimal("1"))
        voucher = None
        if voucher_id:
            voucher = await conn.fetchrow(
                """select * from vouchers where id=$1 and customer_id=$2 and used=false
                   and (expires_at is null or expires_at >= current_date)""", voucher_id, row["customer_id"])
            if not voucher:
                raise HTTPException(400, "Voucher tidak valid atau sudah dipakai")
            discount += (total * Decimal(str(voucher["discount_pct"])) / Decimal(100)).quantize(Decimal("1"))
        if discount > total:
            discount = total
        if method == "coin":
            discount += ((total - discount) * Decimal("0.10")).quantize(Decimal("1"))
            charged = total - discount
            cust = await conn.fetchrow("select deposit from customers where id=$1", row["customer_id"])
            if not cust or Decimal(str(cust["deposit"])) < charged:
                raise HTTPException(400, "Saldo coin tidak cukup")
        else:
            charged = total - discount
        async with conn.transaction():
            if method == "coin":
                await conn.execute("update customers set deposit = deposit - $1 where id=$2", charged, row["customer_id"])
            if voucher:
                await conn.execute("update vouchers set used=true, order_id=$1 where id=$2", oid, voucher["id"])
            await conn.execute(
                """update orders set payment_status='paid', payment_method=$1, discount=$2,
                   paid_amount=$3, updated_at=now() where id=$4""",
                method, discount, charged, oid)
            await conn.execute(
                "insert into transactions(order_id,outlet_id,amount,type,method) values($1,$2,$3,'income',$4)",
                oid, row["outlet_id"], charged, method)
        row = await conn.fetchrow("select * from orders where id=$1", oid)
        return (await enrich_orders(conn, [row]))[0]


@api.post("/orders/{oid}/cancel")
async def cancel_order(oid: str, b: CancelBody):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "update orders set status='cancelled', cancelled_at=now(), cancel_reason=$1, updated_at=now() where id=$2 returning *",
            b.reason, oid)
        if not row:
            raise HTTPException(404, "Order tidak ditemukan")
        return (await enrich_orders(conn, [row]))[0]


@api.get("/dashboard")
async def dashboard(outlet_id: Optional[str] = None):
    async with pool.acquire() as conn:
        oargs = [outlet_id] if outlet_id else []
        oand = " and outlet_id=$1" if outlet_id else ""

        today = await conn.fetchrow(
            f"""select coalesce(count(*),0) as orders, coalesce(sum(weight_kg),0) as kg,
                   coalesce(sum(unit_qty),0) as pcs, coalesce(count(distinct customer_id),0) as customers,
                   coalesce(sum(total),0) as omzet
                from orders where (created_at at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date and status <> 'cancelled'{oand}""", *oargs)
        pendapatan = await conn.fetchval(
            f"""select coalesce(sum(amount),0) from transactions
                where (created_at at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date and type='income'{oand}""", *oargs)

        trend_rows = await conn.fetch(
            f"""select created_at::date as d, coalesce(sum(total),0) as omzet from orders
                where date_trunc('month',created_at)=date_trunc('month',now()) and status <> 'cancelled'{oand}
                group by d order by d""", *oargs)
        income_rows = await conn.fetch(
            f"""select created_at::date as d, coalesce(sum(amount),0) as pendapatan from transactions
                where date_trunc('month',created_at)=date_trunc('month',now()) and type='income'{oand}
                group by d order by d""", *oargs)
        omz_map = {r["d"].isoformat(): float(r["omzet"]) for r in trend_rows}
        inc_map = {r["d"].isoformat(): float(r["pendapatan"]) for r in income_rows}
        trend = []
        today_d = now_utc().date()
        cur = today_d.replace(day=1)
        while cur <= today_d:
            key = cur.isoformat()
            trend.append({"date": key, "day": cur.day, "omzet": omz_map.get(key, 0.0), "pendapatan": inc_map.get(key, 0.0)})
            cur += timedelta(days=1)

        in_progress = await conn.fetchval(
            f"select count(*) from orders where status = any($1::text[]){' and outlet_id=$2' if outlet_id else ''}",
            ACTIVE_STATUSES, *oargs)
        ready = await conn.fetchval(f"select count(*) from orders where status='ready'{oand}", *oargs)
        overdue = await conn.fetchval(
            f"select count(*) from orders where due_at < now() and status not in ('completed','cancelled'){oand}", *oargs)

        top = await conn.fetch(
            f"""select oi.service_name, count(*) as cnt, coalesce(sum(oi.subtotal),0) as revenue
                from order_items oi join orders o on o.id=oi.order_id
                where date_trunc('month',o.created_at)=date_trunc('month',now()) and o.status <> 'cancelled'
                {' and o.outlet_id=$1' if outlet_id else ''}
                group by oi.service_name order by cnt desc limit 5""", *oargs)

        top_cust = await conn.fetch(
            f"""select c.name, coalesce(sum(o.weight_kg),0) as kg, coalesce(sum(o.total),0) as spend,
                   count(*) as orders
                from orders o join customers c on c.id=o.customer_id
                where date_trunc('month',o.created_at)=date_trunc('month',now()) and o.status <> 'cancelled'
                {' and o.outlet_id=$1' if outlet_id else ''}
                group by c.id, c.name order by spend desc limit 3""", *oargs)

        complaints = await conn.fetch(
            f"""select r.id, r.rating, r.comment, r.created_at, c.name as customer_name
                from reviews r left join customers c on c.id=r.customer_id
                where r.rating <= 2 and r.status='new'{' and r.outlet_id=$1' if outlet_id else ''}
                order by r.created_at desc limit 5""", *oargs)
        pending_topups = await conn.fetchval(
            f"select count(*) from topups where status='pending'{oand}", *oargs)

        return {
            "today": {"orders": int(today["orders"]), "kg": float(today["kg"]), "pcs": int(today["pcs"]),
                      "customers": int(today["customers"]), "omzet": float(today["omzet"]),
                      "pendapatan": float(pendapatan or 0)},
            "trend": trend,
            "queue": {"in_progress": int(in_progress or 0), "ready": int(ready or 0), "overdue": int(overdue or 0)},
            "top_services": [{"name": r["service_name"], "count": int(r["cnt"]), "revenue": float(r["revenue"])} for r in top],
            "top_customers": [{"name": r["name"], "kg": float(r["kg"]), "spend": float(r["spend"]), "orders": int(r["orders"])} for r in top_cust],
            "complaints": rows_to_list(complaints),
            "pending_topups": int(pending_topups or 0),
        }


def _to_date(s):
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        raise HTTPException(400, "Format tanggal tidak valid (YYYY-MM-DD)")


def date_filter(field, outlet_id, frm, to, args):
    clauses = []
    if outlet_id:
        args.append(outlet_id); clauses.append(f"outlet_id=${len(args)}")
    if frm:
        args.append(frm); clauses.append(f"{field}::date >= ${len(args)}::date")
    if to:
        args.append(to); clauses.append(f"{field}::date <= ${len(args)}::date")
    return clauses


@api.get("/reports/financial")
async def report_financial(outlet_id: Optional[str] = None, frm: Optional[str] = None, to: Optional[str] = None):
    frm = _to_date(frm); to = _to_date(to)
    async with pool.acquire() as conn:
        args = []
        cl = date_filter("created_at", outlet_id, frm, to, args)
        base = " and ".join(cl + ["status <> 'cancelled'"])
        omzet = await conn.fetchval(f"select coalesce(sum(total),0) from orders where {base}", *args)

        args2 = []
        cl2 = date_filter("created_at", outlet_id, frm, to, args2)
        cl2.append("type='income'")
        w2 = " where " + " and ".join(cl2)
        pendapatan = await conn.fetchval(f"select coalesce(sum(amount),0) from transactions{w2}", *args2)

        args3 = []
        cl3 = date_filter("created_at", outlet_id, frm, to, args3)
        w3 = (" where " + " and ".join(cl3)) if cl3 else ""
        pengeluaran = await conn.fetchval(f"select coalesce(sum(amount),0) from expenses{w3}", *args3)
        exp_break = await conn.fetch(
            f"select category, coalesce(sum(amount),0) as total from expenses{w3} group by category order by total desc", *args3)

        args4 = []
        cl4 = date_filter("created_at", outlet_id, frm, to, args4)
        w4 = (" where " + " and ".join(cl4)) if cl4 else ""
        kasbon = await conn.fetchval(f"select coalesce(sum(amount),0) from kasbon{w4}", *args4)

        # income breakdown by payment method
        argsM = []
        clM = date_filter("created_at", outlet_id, frm, to, argsM)
        clM.append("type='income'")
        wM = " where " + " and ".join(clM)
        method_rows = await conn.fetch(
            f"select method, coalesce(sum(amount),0) as total, count(*) as cnt from transactions{wM} group by method", *argsM)
        method_labels = {"cash": "Tunai", "qris": "QRIS", "emoney": "E-Money", "deposit": "Saldo Deposit"}
        by_method = {"cash": 0.0, "qris": 0.0, "emoney": 0.0, "deposit": 0.0}
        for r in method_rows:
            by_method[r["method"]] = float(r["total"]) if r["method"] in by_method else by_method.get(r["method"], 0.0) + float(r["total"])
        income_by_method = [
            {"method": m, "label": method_labels.get(m, m), "total": by_method.get(m, 0.0)}
            for m in ["cash", "qris", "emoney", "deposit"]
        ]

        return {
            "omzet": float(omzet or 0), "pendapatan": float(pendapatan or 0),
            "pengeluaran": float(pengeluaran or 0), "kasbon": float(kasbon or 0),
            "laba": float(pendapatan or 0) - float(pengeluaran or 0) - float(kasbon or 0),
            "expense_breakdown": [{"category": r["category"], "total": float(r["total"])} for r in exp_break],
            "income_by_method": income_by_method,
        }


@api.get("/reports/transactions")
async def report_transactions(outlet_id: Optional[str] = None, frm: Optional[str] = None, to: Optional[str] = None):
    frm = _to_date(frm); to = _to_date(to)
    async with pool.acquire() as conn:
        args = []; parts = []
        if outlet_id:
            args.append(outlet_id); parts.append(f"outlet_id=${len(args)}")
        if frm:
            args.append(frm); parts.append(f"created_at::date >= ${len(args)}::date")
        if to:
            args.append(to); parts.append(f"created_at::date <= ${len(args)}::date")
        base = (" and " + " and ".join(parts)) if parts else ""
        total_orders = await conn.fetchval(f"select count(*) from orders where status <> 'cancelled'{base}", *args)
        cancelled = await conn.fetchval(f"select count(*) from orders where status = 'cancelled'{base}", *args)
        value = await conn.fetchval(f"select coalesce(sum(total),0) from orders where status <> 'cancelled'{base}", *args)

        argsO = []; partsO = []
        if outlet_id:
            argsO.append(outlet_id); partsO.append(f"o.outlet_id=${len(argsO)}")
        if frm:
            argsO.append(frm); partsO.append(f"o.created_at::date >= ${len(argsO)}::date")
        if to:
            argsO.append(to); partsO.append(f"o.created_at::date <= ${len(argsO)}::date")
        baseO = (" and " + " and ".join(partsO)) if partsO else ""
        recent = await conn.fetch(
            f"""select o.code,o.total,o.status,o.created_at,o.payment_status,c.name as customer_name
                from orders o left join customers c on c.id=o.customer_id
                where 1=1{baseO} order by o.created_at desc limit 30""", *argsO)
        cancels = await conn.fetch(
            f"""select o.code,o.total,o.cancel_reason,o.cancelled_at,c.name as customer_name
                from orders o left join customers c on c.id=o.customer_id
                where o.status='cancelled'{baseO} order by o.cancelled_at desc limit 20""", *argsO)

        # quantity breakdown by unit from order_items (kg / pcs / meter)
        unit_rows = await conn.fetch(
            f"""select oi.unit, coalesce(sum(oi.qty),0) as qty
                from order_items oi join orders o on o.id=oi.order_id
                where o.status <> 'cancelled'{baseO} group by oi.unit""", *argsO)
        um = {r["unit"]: float(r["qty"]) for r in unit_rows}
        return {"total_orders": int(total_orders or 0), "cancelled": int(cancelled or 0),
                "total_value": float(value or 0),
                "total_kg": um.get("kg", 0.0), "total_pcs": um.get("pcs", 0.0), "total_m": um.get("m", 0.0),
                "recent": rows_to_list(recent), "cancellations": rows_to_list(cancels)}


@api.get("/reports/employees")
async def report_employees(outlet_id: Optional[str] = None, frm: Optional[str] = None, to: Optional[str] = None):
    frm = _to_date(frm); to = _to_date(to)
    async with pool.acquire() as conn:
        oclause = " where outlet_id=$1" if outlet_id else ""
        oargs_emp = [outlet_id] if outlet_id else []
        emps = await conn.fetch(f"select * from employees{oclause} order by role_type,name", *oargs_emp)
        by_role = {"admin": [], "produksi": [], "kurir": []}
        for e in emps:
            by_role.setdefault(e["role_type"], []).append(row_to_dict(e))

        args = []; parts = []
        if outlet_id:
            args.append(outlet_id); parts.append(f"outlet_id=${len(args)}")
        if frm:
            args.append(frm); parts.append(f"created_at::date >= ${len(args)}::date")
        if to:
            args.append(to); parts.append(f"created_at::date <= ${len(args)}::date")
        dc = (" and " + " and ".join(parts)) if parts else ""
        total_kg = await conn.fetchval(f"select coalesce(sum(weight_kg),0) from orders where status <> 'cancelled'{dc}", *args)
        washed = await conn.fetchval(
            f"select coalesce(sum(weight_kg),0) from orders where status in ('drying','ironing','packing','ready','completed'){dc}", *args)
        ironed = await conn.fetchval(
            f"select coalesce(sum(weight_kg),0) from orders where status in ('packing','ready','completed'){dc}", *args)
        packed = await conn.fetchval(
            f"select coalesce(sum(weight_kg),0) from orders where status in ('ready','completed'){dc}", *args)
        deliveries = await conn.fetchval(
            f"select count(*) from orders where delivery_type in ('delivery','pickup'){dc}", *args)
        orders_created = await conn.fetchval(f"select count(*) from orders where 1=1{dc}", *args)

        # per-employee production from work_logs (for kiloan-based payroll)
        wargs = []; wparts = []
        if outlet_id:
            wargs.append(outlet_id); wparts.append(f"w.outlet_id=${len(wargs)}")
        if frm:
            wargs.append(frm); wparts.append(f"w.created_at::date >= ${len(wargs)}::date")
        if to:
            wargs.append(to); wparts.append(f"w.created_at::date <= ${len(wargs)}::date")
        wwhere = (" where " + " and ".join(wparts)) if wparts else ""
        prod_rows = await conn.fetch(
            f"""select w.employee_id, w.employee_name,
                   coalesce(sum(w.weight_kg) filter (where w.stage='washing'),0) as wash_kg,
                   coalesce(sum(w.weight_kg) filter (where w.stage='ironing'),0) as iron_kg,
                   count(distinct w.order_id) as notes
                from work_logs w{wwhere}
                group by w.employee_id, w.employee_name
                order by (coalesce(sum(w.weight_kg) filter (where w.stage='washing'),0)
                        + coalesce(sum(w.weight_kg) filter (where w.stage='ironing'),0)) desc""", *wargs)
        per_employee = [
            {"employee_id": str(r["employee_id"]) if r["employee_id"] else None, "name": r["employee_name"] or "-",
             "wash_kg": float(r["wash_kg"]), "iron_kg": float(r["iron_kg"]),
             "total_kg": float(r["wash_kg"]) + float(r["iron_kg"]), "notes": int(r["notes"])}
            for r in prod_rows
        ]
        return {
            "by_role": by_role,
            "production": {"total_kg": float(total_kg or 0), "washed_kg": float(washed or 0),
                           "ironed_kg": float(ironed or 0), "packed_kg": float(packed or 0)},
            "admin": {"orders_created": int(orders_created or 0)},
            "kurir": {"deliveries": int(deliveries or 0)},
            "per_employee": per_employee,
        }


@api.get("/reports/customers")
async def report_customers(outlet_id: Optional[str] = None, frm: Optional[str] = None, to: Optional[str] = None):
    frm = _to_date(frm); to = _to_date(to)
    async with pool.acquire() as conn:
        oclause = " where outlet_id=$1" if outlet_id else ""
        oargs = [outlet_id] if outlet_id else []
        total = await conn.fetchval(f"select count(*) from customers{oclause}", *oargs)
        growth = await conn.fetch(
            f"""select to_char(date_trunc('month',created_at),'Mon') as month, date_trunc('month',created_at) as m, count(*) as cnt
                from customers{oclause} group by m order by m""", *oargs)

        # top customers with order-date filter applied to the join
        args = []; join_conds = ["o.status<>'cancelled'"]; where_conds = []
        if outlet_id:
            args.append(outlet_id); where_conds.append(f"c.outlet_id=${len(args)}")
        if frm:
            args.append(frm); join_conds.append(f"o.created_at::date >= ${len(args)}::date")
        if to:
            args.append(to); join_conds.append(f"o.created_at::date <= ${len(args)}::date")
        join_clause = " and ".join(join_conds)
        where_clause = (" where " + " and ".join(where_conds)) if where_conds else ""
        top = await conn.fetch(
            f"""select c.name, c.phone, c.points, coalesce(sum(o.total),0) as spend, count(o.id) as orders
                from customers c left join orders o on o.customer_id=c.id and {join_clause}
                {where_clause}
                group by c.id,c.name,c.phone,c.points order by spend desc limit 10""", *args)
        deposits = await conn.fetch(
            f"select name,phone,deposit from customers where {('outlet_id=$1 and ' if outlet_id else '')}deposit > 0 order by deposit desc limit 20",
            *oargs)
        return {
            "total": int(total or 0),
            "growth": [{"month": r["month"], "count": int(r["cnt"])} for r in growth],
            "top": [{"name": r["name"], "phone": r["phone"], "points": int(r["points"]),
                     "spend": float(r["spend"]), "orders": int(r["orders"])} for r in top],
            "deposits": rows_to_list(deposits),
        }


def _period_range(period: Optional[str]):
    """period 'YYYY-MM' → (first_day, last_day) dates. Defaults to current month."""
    if not period:
        d = now_utc().date()
    else:
        try:
            d = datetime.strptime(period + "-01", "%Y-%m-%d").date()
        except (ValueError, TypeError):
            raise HTTPException(400, "Format periode tidak valid (YYYY-MM)")
    frm = d.replace(day=1)
    nxt = (frm.replace(day=28) + timedelta(days=4)).replace(day=1)
    to = nxt - timedelta(days=1)
    return frm, to


@api.get("/payroll")
async def payroll(outlet_id: Optional[str] = None, period: Optional[str] = None):
    frm, to = _period_range(period)
    period_str = frm.strftime("%Y-%m")
    async with pool.acquire() as conn:
        if outlet_id:
            emps = await conn.fetch("select * from employees where outlet_id=$1 order by role_type,name", outlet_id)
        else:
            emps = await conn.fetch("select * from employees order by role_type,name")
        if not emps:
            return {"period": period_str, "employees": []}
        employee_ids = [e["id"] for e in emps]
        outlets = {str(o["id"]): o["name"] for o in await conn.fetch("select id,name from outlets")}
        role_labels = {"admin": "Admin", "produksi": "Produksi", "kurir": "Kurir"}
        attendance_rows = await conn.fetch(
            """select employee_id, count(*) as count from attendance
               where employee_id = any($1::uuid[]) and day >= $2 and day <= $3 group by employee_id""",
            employee_ids, frm, to)
        manual_rows = await conn.fetch(
            """select employee_id, lembur_shifts, perjalanan_dinas from payroll_manual
               where employee_id = any($1::uuid[]) and period=$2""", employee_ids, period_str)
        work_rows = await conn.fetch(
            """select employee_id,
                 coalesce(sum(weight_kg) filter (where stage='washing'),0) as wash_kg,
                 coalesce(sum(unit_qty) filter (where stage='washing'),0) as wash_pcs,
                 coalesce(sum(weight_kg) filter (where stage='ironing'),0) as iron_kg,
                 coalesce(sum(unit_qty) filter (where stage='ironing'),0) as iron_pcs,
                 count(distinct order_id) filter (where stage='trip') as trips
               from work_logs
               where employee_id = any($1::uuid[])
                 and (created_at at time zone 'Asia/Jakarta')::date >= $2
                 and (created_at at time zone 'Asia/Jakarta')::date <= $3
               group by employee_id""", employee_ids, frm, to)
        kasbon_rows = await conn.fetch(
            """select employee_id, coalesce(sum(amount),0) as amount from kasbon
               where employee_id = any($1::uuid[])
                 and (created_at at time zone 'Asia/Jakarta')::date >= $2
                 and (created_at at time zone 'Asia/Jakarta')::date <= $3
               group by employee_id""", employee_ids, frm, to)
        attendance_by_employee = {r["employee_id"]: int(r["count"]) for r in attendance_rows}
        manual_by_employee = {r["employee_id"]: r for r in manual_rows}
        work_by_employee = {r["employee_id"]: r for r in work_rows}
        kasbon_by_employee = {r["employee_id"]: float(r["amount"]) for r in kasbon_rows}
        result = []
        for e in emps:
            eid = e["id"]
            kehadiran = attendance_by_employee.get(eid, 0)
            man = manual_by_employee.get(eid)
            lembur = int(man["lembur_shifts"]) if man else 0
            perjalanan = float(man["perjalanan_dinas"]) if man else 0.0
            work = work_by_employee.get(eid)
            wash_kg = float(work["wash_kg"]) if work else 0.0
            wash_pcs = float(work["wash_pcs"]) if work else 0.0
            iron_kg = float(work["iron_kg"]) if work else 0.0
            iron_pcs = float(work["iron_pcs"]) if work else 0.0
            trips = int(work["trips"] or 0) if work else 0
            gaji_pokok = float(e["gaji_pokok"] or 0)
            tunjangan = float(e["tunjangan_kasir"] or 0)
            uang_makan = 15000 * (int(kehadiran) + lembur)
            bonus_cuci = ((wash_kg) + (wash_pcs * 5)) / 10 * 3000
            bonus_setrika = (iron_kg + iron_pcs) * 1000
            antar_jemput = 5000 * int(trips)
            kasbon = kasbon_by_employee.get(eid, 0.0)
            total = gaji_pokok + tunjangan + uang_makan + bonus_cuci + bonus_setrika + antar_jemput + perjalanan - kasbon
            result.append({
                "employee_id": str(eid), "name": e["name"], "role": role_labels.get(e["role_type"], e["role_type"]),
                "outlet_name": outlets.get(str(e["outlet_id"]), "-"), "period": period_str,
                "gaji_pokok": gaji_pokok, "tunjangan_kasir": tunjangan,
                "kehadiran": int(kehadiran), "lembur_shifts": lembur, "uang_makan": uang_makan,
                "wash_kg": wash_kg, "wash_pcs": wash_pcs, "iron_kg": iron_kg, "iron_pcs": iron_pcs,
                "bonus_cuci": round(bonus_cuci), "bonus_setrika": round(bonus_setrika),
                "trips": int(trips), "antar_jemput": antar_jemput,
                "perjalanan_dinas": perjalanan, "kasbon": kasbon, "total": round(total),
            })
        return {"period": period_str, "employees": result}


@api.post("/payroll/manual")
async def payroll_manual(b: PayrollManualBody):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """insert into payroll_manual(employee_id,period,lembur_shifts,perjalanan_dinas)
               values($1,$2,$3,$4)
               on conflict (employee_id, period) do update set lembur_shifts=$3, perjalanan_dinas=$4
               returning *""",
            b.employee_id, b.period, b.lembur_shifts, b.perjalanan_dinas)
        return row_to_dict(row)


@api.get("/kasbon")
async def list_kasbon(outlet_id: Optional[str] = None, employee_id: Optional[str] = None, period: Optional[str] = None):
    frm, to = _period_range(period)
    async with pool.acquire() as conn:
        args, clauses = [frm, to], ["(k.created_at at time zone 'Asia/Jakarta')::date >= $1", "(k.created_at at time zone 'Asia/Jakarta')::date <= $2"]
        if outlet_id:
            args.append(outlet_id)
            clauses.append(f"k.outlet_id=${len(args)}")
        if employee_id:
            args.append(employee_id)
            clauses.append(f"k.employee_id=${len(args)}")
        rows = await conn.fetch(
            f"""select k.*, e.name as employee_name, o.name as outlet_name
                from kasbon k join employees e on e.id=k.employee_id
                left join outlets o on o.id=k.outlet_id
                where {' and '.join(clauses)} order by k.created_at desc""", *args)
        return rows_to_list(rows)


@api.post("/kasbon")
async def create_kasbon(b: KasbonBody):
    if b.amount <= 0:
        raise HTTPException(422, "Nominal kasbon harus lebih dari Rp0")
    async with pool.acquire() as conn:
        emp = await conn.fetchrow("select id,name,outlet_id from employees where id=$1 and active=true", b.employee_id)
        if not emp:
            raise HTTPException(404, "Pegawai tidak ditemukan atau tidak aktif")
        outlet_id = b.outlet_id or emp["outlet_id"]
        row = await conn.fetchrow(
            """insert into kasbon(employee_id,employee_name,outlet_id,amount,note)
               values($1,$2,$3,$4,$5) returning *""",
            emp["id"], emp["name"], outlet_id, b.amount, b.note.strip())
        return row_to_dict(row)


@api.delete("/kasbon/{kid}")
async def delete_kasbon(kid: str):
    async with pool.acquire() as conn:
        deleted = await conn.fetchval("delete from kasbon where id=$1 returning id", kid)
        if not deleted:
            raise HTTPException(404, "Catatan kasbon tidak ditemukan")
        return {"ok": True}


@api.get("/expenses")
async def list_expenses(outlet_id: Optional[str] = None):
    async with pool.acquire() as conn:
        if outlet_id:
            rows = await conn.fetch("select * from expenses where outlet_id=$1 order by created_at desc limit 60", outlet_id)
        else:
            rows = await conn.fetch("select * from expenses order by created_at desc limit 60")
        return rows_to_list(rows)


@api.post("/expenses")
async def create_expense(b: ExpenseBody):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "insert into expenses(outlet_id,category,amount,note) values($1,$2,$3,$4) returning *",
            b.outlet_id, b.category, b.amount, b.note)
        return row_to_dict(row)


@api.post("/adjustments")
async def create_adjustment(b: AdjustmentBody):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "insert into adjustments(outlet_id,amount,direction,reason) values($1,$2,$3,$4) returning *",
            b.outlet_id, b.amount, b.direction, b.reason)
        return row_to_dict(row)


@api.get("/adjustments")
async def list_adjustments(outlet_id: Optional[str] = None):
    async with pool.acquire() as conn:
        if outlet_id:
            rows = await conn.fetch("select * from adjustments where outlet_id=$1 order by created_at desc limit 60", outlet_id)
        else:
            rows = await conn.fetch("select * from adjustments order by created_at desc limit 60")
        return rows_to_list(rows)


POINTS_RULE = {"kg": 1, "bedcover": 1, "satuan": 2, "express_bonus": 2}


def _mask_name(name: str) -> str:
    parts = (name or "?").split()
    return " ".join([(p[0] + "•" * max(2, len(p) - 1)) for p in parts[:2]])


@api.get("/leaderboard")
async def leaderboard(outlet_id: Optional[str] = None, customer_id: Optional[str] = None):
    """Poin: 1 kg = 1 poin, 1 satuan = 2 poin, Bed Cover = 1 poin, order express bonus 2 poin."""
    async with pool.acquire() as conn:
        oclause = " where c.outlet_id=$1" if outlet_id else ""
        oargs = [outlet_id] if outlet_id else []
        rows = await conn.fetch(
            f"""select c.id, c.name,
                   coalesce(i.pts,0) + coalesce(o.exp_pts,0) as points,
                   coalesce(o.total_kg,0) as total_kg, coalesce(o.orders,0) as orders
                from customers c
                left join (
                  select o.customer_id,
                         sum(case when oi.unit='kg' then oi.qty
                                  when oi.service_name ilike 'Bed Cover%' then oi.qty
                                  else oi.qty * 2 end) as pts
                  from order_items oi join orders o on o.id=oi.order_id
                  where o.status<>'cancelled' group by o.customer_id
                ) i on i.customer_id=c.id
                left join (
                  select customer_id, sum(weight_kg) as total_kg, count(*) as orders,
                         sum(case when express then 2 else 0 end) as exp_pts
                  from orders where status<>'cancelled' group by customer_id
                ) o on o.customer_id=c.id{oclause}
                order by points desc, total_kg desc""", *oargs)
        ranking = []
        my_rank = None
        for i, r in enumerate(rows):
            is_me = customer_id and str(r["id"]) == customer_id
            entry = {"rank": i + 1, "id": str(r["id"]),
                     "name": r["name"] if is_me else _mask_name(r["name"]),
                     "is_me": bool(is_me),
                     "points": int(float(r["points"] or 0)),
                     "total_kg": float(r["total_kg"] or 0),
                     "orders": int(r["orders"] or 0)}
            ranking.append(entry)
            if is_me:
                my_rank = entry
        return {"ranking": ranking[:20], "my_rank": my_rank, "total_participants": len(ranking),
                "rules": POINTS_RULE}


TOPUP_PACKAGES = [
    {"amount": 50000, "coins": 50000, "bonus": 0},
    {"amount": 100000, "coins": 100000, "bonus": 0},
    {"amount": 250000, "coins": 250000, "bonus": 0},
    {"amount": 500000, "coins": 530000, "bonus": 30000},
]
FIRST_REVIEW_VOUCHER_PCT = 20


async def expire_deposits(conn):
    """Coin hangus 3 bulan sejak top-up/transaksi terakhir."""
    await conn.execute(
        "update customers set deposit=0, deposit_expires_at=null "
        "where deposit_expires_at is not null and deposit_expires_at < current_date and deposit > 0")


@api.get("/topup/packages")
async def topup_packages():
    return TOPUP_PACKAGES


@api.post("/topups")
async def create_topup(b: TopupBody):
    pkg = next((p for p in TOPUP_PACKAGES if float(p["amount"]) == float(b.amount)), None)
    if not pkg:
        raise HTTPException(422, "Paket top-up tidak tersedia")
    async with pool.acquire() as conn:
        cust = await conn.fetchrow("select id, outlet_id from customers where id=$1", b.customer_id)
        if not cust:
            raise HTTPException(404, "Pelanggan tidak ditemukan")
        row = await conn.fetchrow(
            """insert into topups(customer_id,outlet_id,amount,coins,method,status)
               values($1,$2,$3,$4,$5,'pending') returning *""",
            b.customer_id, b.outlet_id or cust["outlet_id"], pkg["amount"], pkg["coins"], b.method)
        return row_to_dict(row)


@api.get("/topups")
async def list_topups(outlet_id: Optional[str] = None, customer_id: Optional[str] = None,
                      status: Optional[str] = None, limit: int = 100):
    async with pool.acquire() as conn:
        clauses, args = [], []
        if outlet_id:
            args.append(outlet_id); clauses.append(f"t.outlet_id=${len(args)}")
        if customer_id:
            args.append(customer_id); clauses.append(f"t.customer_id=${len(args)}")
        if status:
            args.append(status); clauses.append(f"t.status=${len(args)}")
        where = (" where " + " and ".join(clauses)) if clauses else ""
        args.append(limit)
        rows = await conn.fetch(
            f"""select t.*, c.name as customer_name, c.phone as customer_phone, o.name as outlet_name
                from topups t left join customers c on c.id=t.customer_id
                left join outlets o on o.id=t.outlet_id{where}
                order by t.created_at desc limit ${len(args)}""", *args)
        return rows_to_list(rows)


@api.post("/topups/{tid}/confirm")
async def confirm_topup(tid: str):
    async with pool.acquire() as conn:
        t = await conn.fetchrow("select * from topups where id=$1", tid)
        if not t:
            raise HTTPException(404, "Top-up tidak ditemukan")
        if t["status"] == "confirmed":
            return row_to_dict(t)
        async with conn.transaction():
            await conn.execute(
                """update customers set deposit = deposit + $1,
                   deposit_expires_at = (current_date + interval '3 months')::date where id=$2""",
                t["coins"], t["customer_id"])
            await conn.execute(
                "update topups set status='confirmed', confirmed_at=now() where id=$1", tid)
            await conn.execute(
                "insert into transactions(outlet_id,amount,type,method) values($1,$2,'deposit',$3)",
                t["outlet_id"], t["amount"], t["method"])
        row = await conn.fetchrow("select * from topups where id=$1", tid)
        return row_to_dict(row)


@api.post("/topups/{tid}/reject")
async def reject_topup(tid: str):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "update topups set status='rejected', confirmed_at=now() where id=$1 and status='pending' returning *", tid)
        if not row:
            raise HTTPException(404, "Top-up tidak ditemukan / sudah diproses")
        return row_to_dict(row)


@api.get("/vouchers")
async def list_vouchers(customer_id: Optional[str] = None, unused: bool = False):
    async with pool.acquire() as conn:
        clauses, args = [], []
        if customer_id:
            args.append(customer_id); clauses.append(f"customer_id=${len(args)}")
        if unused:
            clauses.append("used=false and (expires_at is null or expires_at >= current_date)")
        where = (" where " + " and ".join(clauses)) if clauses else ""
        rows = await conn.fetch(f"select * from vouchers{where} order by created_at desc", *args)
        return rows_to_list(rows)


@api.post("/reviews")
async def create_review(b: ReviewBody):
    if b.rating < 1 or b.rating > 5:
        raise HTTPException(422, "Rating harus 1-5")
    async with pool.acquire() as conn:
        cust = await conn.fetchrow("select id, outlet_id, name from customers where id=$1", b.customer_id)
        if not cust:
            raise HTTPException(404, "Pelanggan tidak ditemukan")
        prev = await conn.fetchval("select count(*) from reviews where customer_id=$1", b.customer_id)
        status = "new" if b.rating <= 2 else "done"
        row = await conn.fetchrow(
            """insert into reviews(customer_id,outlet_id,order_id,rating,comment,status)
               values($1,$2,$3,$4,$5,$6) returning *""",
            b.customer_id, b.outlet_id or cust["outlet_id"], b.order_id, b.rating, b.comment, status)
        voucher = None
        if b.rating == 5 and not prev:
            v = await conn.fetchrow(
                """insert into vouchers(customer_id,outlet_id,title,discount_pct,reason,expires_at)
                   values($1,$2,$3,$4,$5,(current_date + interval '3 months')::date) returning *""",
                b.customer_id, b.outlet_id or cust["outlet_id"],
                f"Diskon {FIRST_REVIEW_VOUCHER_PCT}% Order Berikutnya", FIRST_REVIEW_VOUCHER_PCT,
                "Hadiah ulasan 5 bintang pertama")
            voucher = row_to_dict(v)
        out = row_to_dict(row)
        out["voucher"] = voucher
        return out


@api.get("/reviews")
async def list_reviews(outlet_id: Optional[str] = None, customer_id: Optional[str] = None,
                       max_rating: Optional[int] = None, status: Optional[str] = None):
    async with pool.acquire() as conn:
        clauses, args = [], []
        if outlet_id:
            args.append(outlet_id); clauses.append(f"r.outlet_id=${len(args)}")
        if customer_id:
            args.append(customer_id); clauses.append(f"r.customer_id=${len(args)}")
        if max_rating:
            args.append(max_rating); clauses.append(f"r.rating <= ${len(args)}")
        if status:
            args.append(status); clauses.append(f"r.status=${len(args)}")
        where = (" where " + " and ".join(clauses)) if clauses else ""
        rows = await conn.fetch(
            f"""select r.*, c.name as customer_name, c.phone as customer_phone, o.name as outlet_name
                from reviews r left join customers c on c.id=r.customer_id
                left join outlets o on o.id=r.outlet_id{where}
                order by r.created_at desc limit 100""", *args)
        return rows_to_list(rows)


@api.patch("/reviews/{rid}/resolve")
async def resolve_review(rid: str):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "update reviews set status='resolved', resolved_at=now() where id=$1 returning *", rid)
        if not row:
            raise HTTPException(404, "Ulasan tidak ditemukan")
        return row_to_dict(row)


STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "jadiwangi-app"
storage_key: Optional[str] = None


def init_storage():
    """Call once; returns a reusable storage_key."""
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


@api.post("/upload")
async def upload_file(file: UploadFile = File(...), folder: str = Form("orders")):
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(413, "Ukuran file maksimal 8 MB")
    ext = (file.filename or "foto.jpg").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp", "heic"):
        ext = "jpg"
    path = f"{APP_NAME}/uploads/{folder}/{uuid.uuid4()}.{ext}"
    try:
        await run_in_threadpool(put_object, path, data, file.content_type or "image/jpeg")
    except requests.HTTPError as e:
        code = e.response.status_code if e.response is not None else 500
        if code == 402:
            raise HTTPException(402, "Kuota penyimpanan habis. Hubungi owner.")
        raise HTTPException(502, "Gagal mengunggah foto, coba lagi.")
    return {"path": path, "url": f"/api/files/{path}"}


@api.get("/files/{path:path}")
async def serve_file(path: str):
    try:
        content, ctype = await run_in_threadpool(get_object, path)
    except Exception:
        raise HTTPException(404, "Berkas tidak ditemukan")
    return Response(content=content, media_type=ctype, headers={"Cache-Control": "public, max-age=86400"})


@api.get("/")
async def root():
    return {"app": "Jadiwangi App API", "status": "ok"}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
