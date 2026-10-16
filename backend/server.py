import io
import math
import os
import re
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated

import pandas as pd
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]
admin_email = os.environ["ADMIN_EMAIL"]
admin_password = os.environ["ADMIN_PASSWORD"]
jwt_secret = os.environ["JWT_SECRET_KEY"]

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]
app = FastAPI(title="Jadiwangi Customer Dashboard")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()
TOKEN_EXPIRY_HOURS = 12


class LoginInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    manager_name: str


class Customer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    phone: str
    last_transaction: str
    days_inactive: int
    transaction_count: int
    lifetime_value: float
    favorite_service: str
    status: str
    contact_status: str = "Belum dihubungi"
    usual_day: str = "Belum cukup data"
    usual_time: str = "Waktu belum tercatat"
    promo_suggestion: str = "Promo Kangen 10%"
    last_contacted_at: str | None = None
    can_draft_whatsapp: bool = True
    days_until_next_draft: int = 0


class DashboardData(BaseModel):
    customers: list[Customer]
    total_customers: int
    active_customers: int
    dormant_customers: int
    at_risk_value: float
    source_name: str
    updated_at: str


class ContactUpdate(BaseModel):
    contact_status: str = "Sudah dihubungi"


def create_token(email: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS)
    return jwt.encode({"sub": email, "exp": expires}, jwt_secret, algorithm="HS256")


async def manager_required(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> str:
    try:
        payload = jwt.decode(credentials.credentials, jwt_secret, algorithms=["HS256"])
        if payload.get("sub") != admin_email:
            raise JWTError("Akun tidak sesuai")
        return payload["sub"]
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesi tidak valid atau sudah berakhir.") from exc


def normalize_phone(value: object) -> str:
    digits = re.sub(r"\D", "", str(value or ""))
    if digits.startswith("0"):
        return "62" + digits[1:]
    if digits.startswith("8"):
        return "62" + digits
    return digits


def normalize_columns(frame: pd.DataFrame) -> dict[str, str]:
    normalized = {re.sub(r"[^a-z0-9]", "", str(column).lower()): column for column in frame.columns}
    aliases = {
        "name": ["nama", "namapelanggan", "customer", "customername", "pelanggan"],
        "phone": ["nohp", "nomorhp", "nomorhpwhatsapp", "nomorwhatsapp", "nohpwa", "whatsapp", "phone", "telepon", "nomorwa"],
        "date": ["tanggal", "tanggaltransaksi", "tanggalterakhir", "tanggalterakhircuci", "date", "transactiondate"],
        "value": ["total", "totalnilai", "totalnilaitransaksi", "nilai", "nominal", "omzet", "ltv", "harga"],
        "service": ["layanan", "service", "jenislaundry", "produk", "tipeservice"],
    }
    resolved = {}
    for key, options in aliases.items():
        resolved[key] = next((normalized[option] for option in options if option in normalized), None)
    if not resolved["name"] or not resolved["phone"] or not resolved["date"]:
        raise HTTPException(
            status_code=422,
            detail="Kolom wajib tidak ditemukan. Pastikan ada Nama Pelanggan, Nomor HP/WhatsApp, dan Tanggal Transaksi.",
        )
    return resolved


def customer_status(days_inactive: int) -> str:
    if days_inactive > 60:
        return "Kritis"
    if days_inactive >= 30:
        return "Waspada"
    if days_inactive >= 15:
        return "Mulai pasif"
    return "Aktif"


WEEKDAYS_ID = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]


def recommended_promo(service: str, count: int, value: float, days_inactive: int) -> str:
    service_name = service.lower()
    if count >= 12 or value >= 1_000_000:
        return "Promo VIP 20% Cuci Komplit"
    if any(keyword in service_name for keyword in ["bed", "selimut", "gorden", "karpet"]):
        return "Voucher Bed Cover 15%"
    if "express" in service_name:
        return "Gratis Antar-Jemput"
    if days_inactive >= 90:
        return "Voucher Kembali Rp15.000"
    return "Promo Kangen Diskon 10%"


def make_customer(
    customer_id: str,
    name: str,
    phone: str,
    latest: datetime,
    count: int,
    value: float,
    service: str,
    usual_day: str = "Belum cukup data",
    usual_time: str = "Waktu belum tercatat",
) -> dict:
    days = max(0, (datetime.now(timezone.utc).date() - latest.date()).days)
    return {
        "id": customer_id,
        "name": name,
        "phone": phone,
        "last_transaction": latest.date().isoformat(),
        "days_inactive": days,
        "transaction_count": count,
        "lifetime_value": round(value, 2),
        "favorite_service": service or "Laundry reguler",
        "status": customer_status(days),
        "contact_status": "Belum dihubungi",
        "usual_day": usual_day,
        "usual_time": usual_time,
        "promo_suggestion": recommended_promo(service or "Laundry reguler", count, value, days),
        "last_contacted_at": None,
    }


def aggregate_transactions(frame: pd.DataFrame) -> list[dict]:
    mapping = normalize_columns(frame)
    grouped: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for _, row in frame.iterrows():
        name = str(row.get(mapping["name"], "")).strip()
        phone = normalize_phone(row.get(mapping["phone"], ""))
        date = pd.to_datetime(row.get(mapping["date"]), errors="coerce", dayfirst=True)
        if not name or not phone or pd.isna(date):
            continue
        raw_value = row.get(mapping["value"], 0) if mapping["value"] else 0
        value = pd.to_numeric(str(raw_value).replace("Rp", "").replace(".", "").replace(",", "."), errors="coerce")
        service = str(row.get(mapping["service"], "Laundry reguler")).strip() if mapping["service"] else "Laundry reguler"
        timestamp = date.to_pydatetime()
        timestamp = timestamp.replace(tzinfo=timezone.utc) if timestamp.tzinfo is None else timestamp.astimezone(timezone.utc)
        time_label = f"{timestamp.hour:02d}.{timestamp.minute:02d}" if (timestamp.hour or timestamp.minute or timestamp.second) else "Waktu belum tercatat"
        grouped[(name, phone)].append({
            "date": timestamp,
            "value": 0 if pd.isna(value) else float(value),
            "service": service,
            "day": WEEKDAYS_ID[timestamp.weekday()],
            "time": time_label,
        })

    customers = []
    for index, ((name, phone), rows) in enumerate(grouped.items(), start=1):
        latest = max(item["date"] for item in rows)
        favorite = Counter(item["service"] for item in rows if item["service"]).most_common(1)
        usual_day = Counter(item["day"] for item in rows).most_common(1)[0][0]
        known_times = [item["time"] for item in rows if item["time"] != "Waktu belum tercatat"]
        usual_time = Counter(known_times).most_common(1)[0][0] if known_times else "Waktu belum tercatat"
        customers.append(make_customer(
            f"CUST-{index:03d}", name, phone, latest, len(rows), sum(item["value"] for item in rows),
            favorite[0][0] if favorite else "Laundry reguler", usual_day, usual_time,
        ))
    if not customers:
        raise HTTPException(status_code=422, detail="Tidak ada transaksi valid yang dapat dibaca dari file ini.")
    return customers


def sample_customers() -> list[dict]:
    today = datetime.now(timezone.utc)
    rows = [
        ("Ibu Ratna Sari", "081288921102", 138, 14, 845000, "Cuci Setrika Reguler", "Sabtu", "09.30"),
        ("Pak Hendra Wijaya", "085691223450", 122, 9, 620000, "Cuci Kering Lipat Express", "Jumat", "18.00"),
        ("dr. Maya Anggraini", "087781290311", 114, 22, 1450000, "Dry Clean & Jas Spesial", "Rabu", "17.30"),
        ("Budi Santoso", "081399451209", 100, 18, 910000, "Paket Bulanan Kiloan", "Minggu", "10.00"),
        ("Ibu Fenny Kusuma", "081804291823", 87, 7, 480000, "Bed Cover & Selimut", "Sabtu", "11.00"),
        ("Reza Rahardian", "085718290034", 71, 11, 730000, "Cuci Sepatu & Setrika Uap", "Kamis", "19.00"),
        ("Ibu Linda Maryani", "081219842231", 57, 15, 1120000, "Cuci Komplit", "Minggu", "09.00"),
        ("Agus Prayitno", "081599823412", 47, 6, 340000, "Cuci Lipat Hemat", "Selasa", "18.30"),
        ("Siti Nurhaliza", "087812904832", 39, 13, 890000, "Cuci Boneka & Gorden", "Sabtu", "13.00"),
        ("Kevin Pratama", "081387654321", 33, 8, 520000, "Cuci Kiloan Express", "Jumat", "17.00"),
        ("Nadia Putri", "081311222333", 10, 4, 215000, "Cuci Setrika Reguler", "Minggu", "10.30"),
    ]
    return [make_customer(f"CUST-{index:03d}", name, normalize_phone(phone), today - timedelta(days=days), count, value, service, usual_day, usual_time) for index, (name, phone, days, count, value, service, usual_day, usual_time) in enumerate(rows, start=1)]


async def save_customers(customers: list[dict], source_name: str) -> None:
    await db.customer_sets.delete_many({"owner": admin_email})
    await db.customer_sets.insert_one({
        "owner": admin_email,
        "customers": customers,
        "source_name": source_name,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })


async def get_dataset() -> dict:
    document = await db.customer_sets.find_one({"owner": admin_email}, {"_id": 0})
    if document:
        return document
    customers = sample_customers()
    await save_customers(customers, "Data contoh Jadiwangi")
    return {"customers": customers, "source_name": "Data contoh Jadiwangi", "updated_at": datetime.now(timezone.utc).isoformat()}


def enrich_contact_window(customer: dict) -> dict:
    result = customer.copy()
    contacted_at = result.get("last_contacted_at")
    if not contacted_at:
        result.update({"can_draft_whatsapp": True, "days_until_next_draft": 0})
        return result
    try:
        last_contact = datetime.fromisoformat(contacted_at)
        last_contact = last_contact.replace(tzinfo=timezone.utc) if last_contact.tzinfo is None else last_contact.astimezone(timezone.utc)
        remaining = (last_contact + timedelta(days=7)) - datetime.now(timezone.utc)
        if remaining.total_seconds() > 0:
            result.update({"can_draft_whatsapp": False, "days_until_next_draft": max(1, math.ceil(remaining.total_seconds() / 86_400))})
            return result
    except (TypeError, ValueError):
        pass
    result.update({"can_draft_whatsapp": True, "days_until_next_draft": 0})
    return result


def dashboard_response(dataset: dict, threshold: int) -> DashboardData:
    customers = [Customer(**enrich_contact_window(row)) for row in dataset.get("customers", [])]
    dormant = [item for item in customers if item.days_inactive >= threshold]
    sorted_customers = sorted(dormant, key=lambda item: (-item.days_inactive, -item.lifetime_value))[:10]
    return DashboardData(
        customers=sorted_customers,
        total_customers=len(customers),
        active_customers=len([item for item in customers if item.days_inactive < 15]),
        dormant_customers=len(dormant),
        at_risk_value=sum(item.lifetime_value for item in dormant),
        source_name=dataset.get("source_name", "Data transaksi"),
        updated_at=dataset.get("updated_at", datetime.now(timezone.utc).isoformat()),
    )


@api_router.get("/")
async def root():
    return {"message": "Jadiwangi dashboard aktif"}


@api_router.post("/auth/login", response_model=TokenResponse)
async def login(input_data: LoginInput):
    if input_data.email.lower() != admin_email.lower() or input_data.password != admin_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email atau kata sandi tidak sesuai.")
    return TokenResponse(access_token=create_token(admin_email), manager_name="Pengelola Jadiwangi")


@api_router.get("/dashboard", response_model=DashboardData)
async def get_dashboard(threshold: int = 30, _: str = Depends(manager_required)):
    if threshold < 1 or threshold > 730:
        raise HTTPException(status_code=422, detail="Ambang hari harus antara 1 hingga 730.")
    return dashboard_response(await get_dataset(), threshold)


@api_router.post("/dashboard/sample", response_model=DashboardData)
async def load_sample(_: str = Depends(manager_required)):
    customers = sample_customers()
    await save_customers(customers, "Data contoh Jadiwangi")
    return dashboard_response(await get_dataset(), 30)


@api_router.post("/dashboard/upload", response_model=DashboardData)
async def upload_transactions(file: UploadFile = File(...), _: str = Depends(manager_required)):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".csv", ".xlsx", ".xls"}:
        raise HTTPException(status_code=422, detail="Format file belum didukung. Gunakan CSV, XLS, atau XLSX.")
    content = await file.read()
    try:
        frame = pd.read_csv(io.BytesIO(content)) if suffix == ".csv" else pd.read_excel(io.BytesIO(content))
    except Exception as exc:
        raise HTTPException(status_code=422, detail="File tidak dapat dibaca. Periksa format dan isi file.") from exc
    customers = aggregate_transactions(frame)
    await save_customers(customers, file.filename or "Data transaksi")
    return dashboard_response(await get_dataset(), 30)


@api_router.patch("/customers/{customer_id}/contact", response_model=Customer)
async def mark_contacted(customer_id: str, payload: ContactUpdate, _: str = Depends(manager_required)):
    dataset = await get_dataset()
    updated = None
    for customer in dataset["customers"]:
        if customer["id"] == customer_id:
            customer["contact_status"] = payload.contact_status
            customer["last_contacted_at"] = datetime.now(timezone.utc).isoformat()
            updated = enrich_contact_window(customer)
            break
    if not updated:
        raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan.")
    await save_customers(dataset["customers"], dataset.get("source_name", "Data transaksi"))
    return Customer(**updated)


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()