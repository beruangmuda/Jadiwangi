# Auth Testing — Jadiwangi Laundry

## Kredensial Admin
- Email: admin@jadiwangi.id
- Password: Jadiwangi@2026
- Role: admin (satu-satunya akun, milik pemilik)
- Halaman login: /admin → dashboard: /admin/dashboard

## Endpoint
- POST /api/auth/login {email, password} — set httpOnly cookies access_token (60 mnt) & refresh_token (7 hari). 5x gagal = kunci 15 menit.
- POST /api/auth/logout — hapus cookies
- GET /api/auth/me — butuh cookie/Bearer
- GET /api/admin/stats — butuh auth; total, by_type, by_outlet, recent
- POST /api/track {type, outlet?} — publik, untuk tracking interaksi landing

## Tes cepat
```
curl -c c.txt -X POST $API/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@jadiwangi.id","password":"Jadiwangi@2026"}'
curl -b c.txt $API/api/auth/me
curl -b c.txt $API/api/admin/stats
```
Ganti password: ubah ADMIN_PASSWORD di backend/.env lalu restart backend — hash di MongoDB otomatis diperbarui saat startup (seed_admin idempoten).
