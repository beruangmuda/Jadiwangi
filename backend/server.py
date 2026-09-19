import os
import uuid
import random
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta, date
from decimal import Decimal
from typing import Optional, List

import asyncpg
from fastapi import FastAPI, APIRouter, HTTPException
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
    return {k: jsonable(val) for k, val in dict(row).items()}


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
    await seed_data()
    logger.info("Database ready.")


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


# Models
class LoginBody(BaseModel):
    role: str
    pin: str = ""
    phone: str = ""


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
    icon: str = "washing-machine"
    active: bool = True


class CustomerBody(BaseModel):
    name: str
    phone: str = ""
    email: str = ""
    deposit: float = 0
    outlet_id: Optional[str] = None


class EmployeeBody(BaseModel):
    name: str
    role_type: str = "admin"
    pin: str = "0000"
    outlet_id: Optional[str] = None
    active: bool = True
    permissions: dict = Field(default_factory=dict)


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


class StatusBody(BaseModel):
    status: str


class CancelBody(BaseModel):
    reason: str = ""


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
    async with pool.acquire() as conn:
        if body.role == "owner":
            pin = await conn.fetchval("select value from app_config where key='owner_pin'")
            if body.pin != (pin or "1234"):
                raise HTTPException(401, "PIN Owner salah")
            outlets = rows_to_list(await conn.fetch("select * from outlets order by created_at"))
            return {"role": "owner", "name": "Owner", "outlets": outlets}
        if body.role == "pegawai":
            emp = await conn.fetchrow("select * from employees where pin=$1 and active=true", body.pin)
            if not emp:
                raise HTTPException(401, "PIN Pegawai salah")
            outlets = rows_to_list(await conn.fetch("select * from outlets order by created_at"))
            return {"role": "pegawai", "employee": row_to_dict(emp), "outlets": outlets}
        if body.role == "pelanggan":
            key = body.phone or body.pin
            cust = await conn.fetchrow("select * from customers where phone=$1", key)
            if not cust:
                cust = await conn.fetchrow("select * from customers where phone like $1 order by created_at limit 1", f"%{key}")
            if not cust:
                raise HTTPException(401, "Nomor pelanggan tidak ditemukan")
            return {"role": "pelanggan", "customer": row_to_dict(cust)}
    raise HTTPException(400, "Peran tidak valid")


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


@api.get("/services")
async def list_services(include_inactive: bool = False):
    async with pool.acquire() as conn:
        q = "select * from services" + ("" if include_inactive else " where active=true") + " order by category, name"
        return rows_to_list(await conn.fetch(q))


@api.post("/services")
async def create_service(b: ServiceBody):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "insert into services(name,category,unit,price,icon,active) values($1,$2,$3,$4,$5,$6) returning *",
            b.name, b.category, b.unit, b.price, b.icon, b.active)
        return row_to_dict(row)


@api.put("/services/{sid}")
async def update_service(sid: str, b: ServiceBody):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "update services set name=$1,category=$2,unit=$3,price=$4,icon=$5,active=$6 where id=$7 returning *",
            b.name, b.category, b.unit, b.price, b.icon, b.active, sid)
        if not row:
            raise HTTPException(404, "Layanan tidak ditemukan")
        return row_to_dict(row)


@api.get("/customers")
async def list_customers(outlet_id: Optional[str] = None, q: Optional[str] = None):
    async with pool.acquire() as conn:
        clauses, args = [], []
        if outlet_id:
            args.append(outlet_id); clauses.append(f"outlet_id=${len(args)}")
        if q:
            args.append(f"%{q}%"); clauses.append(f"(name ilike ${len(args)} or phone ilike ${len(args)})")
        where = (" where " + " and ".join(clauses)) if clauses else ""
        rows = await conn.fetch(f"select * from customers{where} order by name", *args)
        return rows_to_list(rows)


@api.post("/customers")
async def create_customer(b: CustomerBody):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "insert into customers(name,phone,email,deposit,outlet_id) values($1,$2,$3,$4,$5) returning *",
            b.name, b.phone, b.email, b.deposit, b.outlet_id)
        return row_to_dict(row)


@api.put("/customers/{cid}")
async def update_customer(cid: str, b: CustomerBody):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "update customers set name=$1,phone=$2,email=$3,deposit=$4,outlet_id=$5 where id=$6 returning *",
            b.name, b.phone, b.email, b.deposit, b.outlet_id, cid)
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
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "insert into employees(name,role_type,pin,outlet_id,active,permissions) values($1,$2,$3,$4,$5,$6::jsonb) returning *",
            b.name, b.role_type, b.pin, b.outlet_id, b.active, json.dumps(b.permissions))
        return row_to_dict(row)


@api.put("/employees/{eid}")
async def update_employee(eid: str, b: EmployeeBody):
    import json
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "update employees set name=$1,role_type=$2,pin=$3,outlet_id=$4,active=$5,permissions=$6::jsonb where id=$7 returning *",
            b.name, b.role_type, b.pin, b.outlet_id, b.active, json.dumps(b.permissions), eid)
        if not row:
            raise HTTPException(404, "Pegawai tidak ditemukan")
        return row_to_dict(row)


async def enrich_orders(conn, rows):
    result = []
    for r in rows:
        d = row_to_dict(r)
        cust = await conn.fetchrow("select name,phone from customers where id=$1", r["customer_id"])
        d["customer_name"] = cust["name"] if cust else "-"
        d["customer_phone"] = cust["phone"] if cust else ""
        d["stage_label"] = STAGE_LABELS.get(r["status"], r["status"])
        due = r["due_at"]
        d["overdue"] = bool(due and due < now_utc() and r["status"] not in ("completed", "cancelled"))
        result.append(d)
    return result


@api.get("/orders")
async def list_orders(outlet_id: Optional[str] = None, status: Optional[str] = None, active: bool = False, limit: int = 100):
    async with pool.acquire() as conn:
        clauses, args = [], []
        if outlet_id:
            args.append(outlet_id); clauses.append(f"outlet_id=${len(args)}")
        if status:
            args.append(status); clauses.append(f"status=${len(args)}")
        if active:
            clauses.append("status in ('received','washing','drying','ironing','packing','ready')")
        where = (" where " + " and ".join(clauses)) if clauses else ""
        args.append(limit)
        rows = await conn.fetch(f"select * from orders{where} order by created_at desc limit ${len(args)}", *args)
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


@api.post("/orders")
async def create_order(b: OrderBody):
    async with pool.acquire() as conn:
        outlet = await conn.fetchrow("select * from outlets where id=$1", b.outlet_id)
        if not outlet:
            raise HTTPException(404, "Outlet tidak ditemukan")
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
                   payment_status,payment_method,delivery_type,notes,created_by,created_at,updated_at,due_at)
                   values($1,$2,$3,'received',$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13) returning id""",
                code, b.customer_id, b.outlet_id, total, weight, unit_qty, b.payment_status, b.payment_method,
                b.delivery_type, b.notes, b.created_by, created, due)
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


@api.post("/orders/{oid}/advance")
async def advance_status(oid: str):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("select * from orders where id=$1", oid)
        if not row:
            raise HTTPException(404, "Order tidak ditemukan")
        cur = row["status"]
        if cur in ("completed", "cancelled") or cur not in PIPELINE:
            raise HTTPException(400, "Order tidak dapat dilanjutkan")
        nxt = PIPELINE[PIPELINE.index(cur) + 1]
        completed_at = now_utc() if nxt == "completed" else None
        row = await conn.fetchrow(
            "update orders set status=$1, updated_at=now(), completed_at=coalesce($2,completed_at) where id=$3 returning *",
            nxt, completed_at, oid)
        if nxt == "completed":
            await conn.execute("update customers set points = points + $1 where id=$2",
                               int(float(row["total"]) / 1000), row["customer_id"])
        return (await enrich_orders(conn, [row]))[0]


@api.post("/orders/{oid}/pay")
async def pay_order(oid: str):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("select * from orders where id=$1", oid)
        if not row:
            raise HTTPException(404, "Order tidak ditemukan")
        if row["payment_status"] == "paid":
            return (await enrich_orders(conn, [row]))[0]
        await conn.execute("update orders set payment_status='paid', updated_at=now() where id=$1", oid)
        await conn.execute(
            "insert into transactions(order_id,outlet_id,amount,type,method) values($1,$2,$3,'income',$4)",
            oid, row["outlet_id"], row["total"], row["payment_method"])
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
                from orders where created_at::date = now()::date and status <> 'cancelled'{oand}""", *oargs)
        pendapatan = await conn.fetchval(
            f"""select coalesce(sum(amount),0) from transactions
                where created_at::date = now()::date and type='income'{oand}""", *oargs)

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

        return {
            "today": {"orders": int(today["orders"]), "kg": float(today["kg"]), "pcs": int(today["pcs"]),
                      "customers": int(today["customers"]), "omzet": float(today["omzet"]),
                      "pendapatan": float(pendapatan or 0)},
            "trend": trend,
            "queue": {"in_progress": int(in_progress or 0), "ready": int(ready or 0), "overdue": int(overdue or 0)},
            "top_services": [{"name": r["service_name"], "count": int(r["cnt"]), "revenue": float(r["revenue"])} for r in top],
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

        return {
            "omzet": float(omzet or 0), "pendapatan": float(pendapatan or 0),
            "pengeluaran": float(pengeluaran or 0), "kasbon": float(kasbon or 0),
            "laba": float(pendapatan or 0) - float(pengeluaran or 0) - float(kasbon or 0),
            "expense_breakdown": [{"category": r["category"], "total": float(r["total"])} for r in exp_break],
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
        return {"total_orders": int(total_orders or 0), "cancelled": int(cancelled or 0),
                "total_value": float(value or 0), "recent": rows_to_list(recent), "cancellations": rows_to_list(cancels)}


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
        return {
            "by_role": by_role,
            "production": {"total_kg": float(total_kg or 0), "washed_kg": float(washed or 0),
                           "ironed_kg": float(ironed or 0), "packed_kg": float(packed or 0)},
            "admin": {"orders_created": int(orders_created or 0)},
            "kurir": {"deliveries": int(deliveries or 0)},
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


@api.get("/leaderboard")
async def leaderboard(outlet_id: Optional[str] = None, customer_id: Optional[str] = None):
    async with pool.acquire() as conn:
        oclause = " where outlet_id=$1" if outlet_id else ""
        oargs = [outlet_id] if outlet_id else []
        rows = await conn.fetch(
            f"""select id,name,points,
                (select coalesce(sum(total),0) from orders o where o.customer_id=customers.id and o.status<>'cancelled') as spend,
                (select count(*) from orders o where o.customer_id=customers.id and o.status<>'cancelled') as orders
                from customers{oclause} order by points desc limit 50""", *oargs)
        ranking = []
        my_rank = None
        for i, r in enumerate(rows):
            entry = {"rank": i + 1, "id": str(r["id"]), "name": r["name"], "points": int(r["points"]),
                     "spend": float(r["spend"]), "orders": int(r["orders"])}
            ranking.append(entry)
            if customer_id and str(r["id"]) == customer_id:
                my_rank = entry
        return {"ranking": ranking, "my_rank": my_rank}


@api.get("/")
async def root():
    return {"app": "Jadiwangi App API", "status": "ok"}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
