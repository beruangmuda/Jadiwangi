#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"
##     -message: "ITERATION 10 FIX: Mengganti normalisasi WhatsApp duplikat dengan helper murni src/whatsapp.ts. Helper menangani 08..., 8..., +62..., dan 62... serta selalu membangun pesan struk yang berisi kode, pelanggan, rincian, total, pembayaran, dan status."
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

## user_problem_statement: "Sortir antrian Diterima/Cuci/Pengering/Setrika/Antar Jemput harus cepat. Kasbon dapat dicatat beberapa kali dengan tanggal untuk perhitungan gaji. Card Dikerjakan adalah indikator pasif tanpa kotak, berbeda dari Transaksi Hari Ini dan Siap Diambil."

## backend:
##   - task: "Kasbon pegawai: pencatatan dan potongan otomatis gaji per bulan"
##     implemented: true
##     working: true
##     file: "backend/server.py"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: false
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Endpoint GET/POST /api/kasbon ditambahkan. Kasbon tervalidasi > Rp0 dan langsung terbaca oleh GET /api/payroll pada bulan pencatatan."
##         -working: true
##         -agent: "testing"
##         -comment: "Kasbon invalid 422, pengurangan payroll tepat nominal, list period/outlet, dan cleanup DELETE semuanya PASS (iterasi 10)."
##   - task: "Pricelist per outlet + services schema (outlet_id, price_express, duration, duration_express, min_kg)"
##     implemented: true
##     working: true
##     file: "backend/server.py"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Reseed pricelist_v=3. /services?outlet_id= returns Depok 41, Jakarta 43, Bandung 43. Order create with express price verified via curl (18000x5=90000)."
##   - task: "Pelanggan baru dari Buat Order Pegawai: nomor WhatsApp kanonis dan anti-duplikasi"
##     implemented: true
##     working: true
##     file: "backend/server.py"
##     stuck_count: 1
##     priority: "high"
##     needs_retesting: false
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "POST /api/customers kini memvalidasi nama dan nomor Indonesia, menyimpan +62 canonical, memeriksa duplikasi lintas format, serta memvalidasi outlet. Curl: create 200 dengan +62 dan duplicate 409 PASS; data uji dibersihkan."
##         -working: true
##         -agent: "testing"
##         -comment: "Iterasi 11: pytest 4/4 PASS untuk canonical +62, invalid 422, dan duplikasi lintas format 409. Semua pelanggan TEST_iter11 dibersihkan."
##         -working: false
##         -agent: "user"
##         -comment: "Pengguna melaporkan tambah pelanggan baru masih error/tidak dapat disimpan."
##         -working: "NA"
##         -agent: "main"
##         -comment: "Perbaikan: saat nomor sudah ada, app mencari nomor lintas format dan otomatis memilih pelanggan lama. Simpan pelanggan baru dari UI diuji PASS."
##         -working: true
##         -agent: "main"
##         -comment: "Setelah stabilisasi layout modal, form pelanggan baru kembali diuji pada mobile web dan input dapat disentuh/disimpan normal."

## frontend:
##   - task: "Struk order yang dibagikan langsung ke WhatsApp pelanggan"
##     implemented: true
##     working: true
##     file: "frontend/app/order-detail/[id].tsx, frontend/src/components/OrdersPipeline.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: false
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Tombol Kirim Struk WhatsApp tersedia pada detail kartu order owner/pegawai dan detail order; pesan berisi nota, pelanggan, rincian, total, pembayaran, dan status."
##         -working: true
##         -agent: "main"
##         -comment: "Helper diuji untuk 08..., 8..., +62..., dan 62...; URL wa.me serta seluruh isi struk wajib valid."
##         -working: "NA"
##         -agent: "main"
##         -comment: "Atas permintaan pengguna, tombol struk dipindahkan dari detail/antrian ke modal sukses setelah QRIS lunas. UI modal dan CTA WhatsApp diuji PASS."
##         -working: true
##         -agent: "main"
##         -comment: "Modal QRIS kembali diuji setelah perbaikan layout; opsi QRIS dan Konfirmasi Sudah Bayar langsung dapat disentuh. CTA struk sesudah sukses telah diuji sebelumnya."
##         -working: "NA"
##         -agent: "main"
##         -comment: "Diperluas: modal kirim struk kini muncul setelah pembayaran Tunai, QRIS, E-Money, maupun Deposit. Uji E-Money PASS."
##         -working: true
##         -agent: "testing"
##         -comment: "Iterasi 13 backend PASS: unpaid→paid via cash/qris/emoney."
##         -working: true
##         -agent: "main"
##         -comment: "Setelah perbaikan layout modal, E-Money, Konfirmasi, dan CTA tetap terjangkau di layar ponsel."
##   - task: "Pembatalan transaksi sebelum order dibuat"
##     implemented: true
##     working: true
##     file: "frontend/app/order-baru.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: false
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Tombol Batal Transaksi pada modal pembayaran hanya menutup form dan tidak menjalankan POST /orders. Uji UI PASS."
##         -working: true
##         -agent: "main"
##         -comment: "Setelah modal dibatasi/scrollable, tombol Batal Transaksi kembali diuji dan langsung mengembalikan ke form order tanpa membuat nota."
##   - task: "Timeline proses laundry dan daftar Siap Diambil Pegawai"
##     implemented: true
##     working: true
##     file: "frontend/app/proses/[id].tsx, frontend/app/siap-diambil.tsx, frontend/src/components/OrdersPipeline.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: false
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Aksi Ke Packing kini membuka timeline. Penyelesaian Packing mengubah status ke ready dan berpindah ke daftar Siap Diambil; dashboard card juga membuka daftar tersebut. Uji Setrika → Packing → Siap Diambil PASS."
##         -working: true
##         -agent: "testing"
##         -comment: "Iterasi 13 backend PASS: ironing→packing→ready dan GET status=ready memuat order."
##         -working: "NA"
##         -agent: "main"
##         -comment: "Perbaikan: status ready dikeluarkan dari antrian aktif; daftar Siap Diambil memiliki tombol Sudah Diambil yang mengadvance order ke completed. Uji UI dan backend PASS, data uji dihapus."
##         -working: true
##         -agent: "main"
##         -comment: "Setelah perbaikan optimistic update, UI mobile web membuktikan card langsung hilang dan GET detail mengonfirmasi status completed."
##   - task: "Antar Jemput menggunakan kartu layanan dan minimum order Buat Order"
##     implemented: true
##     working: true
##     file: "frontend/app/timbang/[id].tsx, backend/server.py"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: false
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Layar timbang sekarang memakai accordion kategori, kartu layanan, Regular/Express, minimum order otomatis, dan tombol foto. Server memvalidasi layanan milik outlet, status aktif, unit, serta minimum kg pada create/weigh agar aturan owner tidak dapat dilewati."
##         -working: true
##         -agent: "main"
##         -comment: "Perbaikan pasca iterasi 14: semua permintaan, termasuk pickup belum dikonfirmasi, kini punya aksi Timbang Pakaian & Foto. UI membuktikan route timbang dan accordion layanan terbuka."
##   - task: "Menu catat kasbon pada Gaji Pegawai"
##     implemented: true
##     working: true
##     file: "frontend/app/(owner)/gaji.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: false
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Tombol Catat Kasbon dan form nominal/catatan ditambahkan ke rincian setiap pegawai pada tab Gaji."
##         -working: true
##         -agent: "testing"
##         -comment: "Login owner, halaman Gaji, modal Catat Kasbon, dan semua field/CTA terverifikasi PASS (iterasi 10)."
##   - task: "Buat Order: services per outlet, grouped by category, Reguler/Express toggle"
##     implemented: true
##     working: true
##     file: "frontend/app/order-baru.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: false
##         -agent: "user"
##         -comment: "Order express baru tidak masuk ke antrian Express hari ini."
##         -working: "NA"
##         -agent: "main"
##         -comment: "Perbaikan: OrderBody dan insert orders kini menyimpan express=true; migrasi juga memperbaiki order lama bertanda '(Express)'. Order uji terbukti muncul pada queue speed=express lalu dibersihkan."
##         -working: true
##         -agent: "testing"
##         -comment: "Iterasi 12 backend PASS: express=true tersimpan dan muncul pada queue Express hari ini."
##   - task: "Kartu Transaksi Hari Ini Pegawai membuka detail nota"
##     implemented: true
##     working: true
##     file: "frontend/app/(employee)/index.tsx, frontend/app/hari-ini.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: false
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Kartu Transaksi Hari Ini membuka daftar order hari ini dan setiap kartu order membuka Detail Pesanan. Screenshot alur PASS."
##         -working: true
##         -agent: "testing"
##         -comment: "Iterasi 12: kartu ringkasan membuka daftar dan klik card menuju /order-detail/[id] PASS."
##   - task: "Produk & Layanan: outlet tabs, dual price display, full edit form"
##     implemented: true
##     working: "NA"
##     file: "frontend/app/manage/produk.tsx"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##   - task: "Buat Order Pegawai: pelanggan baru, kontak perangkat, kategori accordion, dan minimum order"
##     implemented: true
##     working: true
##     file: "frontend/app/order-baru.tsx, frontend/src/deviceContacts.ts, frontend/app.json"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: false
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Pelanggan Baru memiliki input nama/WA/alamat dan memilih pelanggan baru setelah API sukses. Kontak perangkat disimpan setelah izin Android/iOS (fallback aman untuk web/izin ditolak). Layanan dikategorikan accordion, kartu clickable, dan layanan kiloan langsung snap ke minimum. Screenshot web PASS untuk form dan minimum 4 kg."
##         -working: true
##         -agent: "testing"
##         -comment: "Iterasi 11: alur pelanggan baru, save web tanpa crash native contacts, accordion Add-on, minimum 4 kg, dan minus menghapus item semuanya PASS."
##   - task: "Owner: kartu layanan clickable di Produk & Layanan"
##     implemented: true
##     working: true
##     file: "frontend/app/manage/produk.tsx"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: false
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Seluruh kartu layanan owner dapat diketuk untuk membuka Edit Layanan; form memuat harga reguler/express, kategori, durasi, dan min kg. Screenshot owner PASS."
##         -working: true
##         -agent: "testing"
##         -comment: "Iterasi 11: owner membuka kartu layanan ke modal Edit Layanan dan field kategori/harga/minimum kg terverifikasi PASS."
##   - task: "Pelacakan pegawai per tahap produksi dan agregasi kiloan payroll"
##     implemented: true
##     working: true
##     file: "backend/server.py"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: false
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "advance sekarang mencatat satu pegawai pada tahap Cuci, Pengering, Setrika, dan Lipat & Packing. GET order mengembalikan stage_workers; payroll mengagregasi kg/pcs pada semua tahap. Uji API: empat tahap oleh Joko, payroll per tahap, dan cleanup order uji PASS."
##   - task: "Proteksi penyerahan order belum lunas"
##     implemented: true
##     working: true
##     file: "backend/server.py, frontend/app/siap-diambil.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: false
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Endpoint advance menolak ready→completed bila belum paid (400). UI daftar Siap Diambil mengunci tombol serta menampilkan peringatan pembayaran."
##   - task: "Rincian kasbon, indikator Dikerjakan, dan warna trend per outlet"
##     implemented: true
##     working: true
##     file: "frontend/app/(owner)/gaji.tsx, frontend/app/(employee)/index.tsx, frontend/src/components/Chart.tsx"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: false
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Gaji menampilkan kasbon per tanggal/catatan, rincian kerja kiloan tiap tahap, Dikerjakan dipusatkan sebagai indikator pasif, dan warna grafik berbeda untuk Pulomas/Ujungberung/Kalimulya."
##   - task: "Pembayaran langsung dari kartu Siap Diambil belum lunas"
##     implemented: true
##     working: true
##     file: "frontend/app/siap-diambil.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: false
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Order ready yang belum lunas kini memiliki Bayar Sekarang inline menggunakan kartu Konfirmasi Pembayaran yang sama (Tunai/QRIS/E-Money/JW Coin). Uji manual E-Money mengubah payment_status menjadi paid dan mengaktifkan Sudah Diambil; data uji dibersihkan."
##   - task: "Kalender tanggal kasbon dan format gaji ringkas"
##     implemented: true
##     working: true
##     file: "frontend/app/(owner)/gaji.tsx"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: false
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Rincian kerja kiloan dikembalikan ke Bonus Cuci/Bonus Setrika. Input tanggal kasbon manual diganti kalender bulan ringkas, lengkap dengan navigasi bulan dan pemilihan hari. Screenshot mobile PASS."
##   - task: "Nama petugas tahap proses dan status pembayaran antrian ringkas"
##     implemented: true
##     working: "NA"
##     file: "frontend/app/proses/[id].tsx, frontend/src/components/OrdersPipeline.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Timeline langsung mengisi Dikerjakan oleh [nama] secara optimistis saat tahap produksi diklik, lalu merefresh data server. Kartu antrian hanya menampilkan Lunas/Belum Lunas; kartu pembayaran tetap hanya di Siap Diambil. Order uji membuktikan Cuci oleh Joko Produksi tampil di timeline."
##   - task: "Pembukaan kartu proses dan ringkasan pegawai lebih cepat"
##     implemented: true
##     working: "NA"
##     file: "frontend/src/components/OrdersPipeline.tsx, frontend/app/(employee)/index.tsx, frontend/src/orderSync.ts"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Data order dipanaskan ke cache sebelum route Proses dibuka; dashboard Pegawai memprefetch Siap Diambil dan Transaksi Hari Ini. Uji mobile membuka timeline dari kartu dalam 77 ms."
##   - task: "Atribusi pegawai lintas tahap dan cache ringkasan malam"
##     implemented: true
##     working: true
##     file: "frontend/app/proses/[id].tsx, frontend/src/summaryCache.ts, frontend/app/(employee)/index.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: false
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Tahap Cuci/Pengering/Setrika/Packing langsung diberi nama pegawai login dan boleh berbeda per tahap. Ringkasan Dashboard, Gaji, dan Kasbon memakai cache hingga pukul 21.00 Asia/Jakarta; transaksi order/pembayaran tetap dikirim langsung. Indikator Dikerjakan dipindahkan menjadi pill ringkas terpisah."
##   - task: "Pembayaran pelanggan Midtrans Snap Sandbox"
##     implemented: true
##     working: true
##     file: "backend/server.py, backend/.env, frontend/app/(customer)/bayar.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: false
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Snap dibuat backend dari nominal order database; metode dibatasi gopay, bni_va, bri_va, cimb_va, echannel, permata_va. Webhook SHA-512 memverifikasi signature, nominal, settlement/capture, lalu memasukkan transaksi idempoten. Secret Sandbox masih kosong, sehingga live Sandbox E2E tertunda. Uji konfigurasi memastikan endpoint menolak aman HTTP 503 tanpa Secret dan data test dibersihkan."

## test_plan:
##   current_focus:
##     - "Verifikasi pengguna pada perangkat native untuk hasil capture kamera fisik"
##   test_all: true
##   test_priority: "high_first"

## agent_communication:
##     -agent: "main"
##     -message: "ITERATION 10: Menambahkan GET/POST /api/kasbon dan UI Catat Kasbon per pegawai pada tab Gaji. Nominal kasbon yang dicatat bulan ini otomatis mengurangi total payroll bulan ini. Menambahkan tombol Kirim Struk WhatsApp pada detail kartu antrian owner/pegawai dan pada halaman detail order untuk sesi staf."
##     -agent: "main"
##     -message: "ITERATION 10 COMPLETE: Normalisasi WhatsApp sudah disatukan dan diuji, data kasbon/pegawai uji sudah dibersihkan, serta backend dan UI fitur baru tervalidasi."
##     -agent: "main"
##     -message: "ITERATION 11: Menambahkan pelanggan baru pada Buat Order Pegawai (nama/WA/alamat), simpan kontak perangkat via expo-contacts setelah API sukses, validasi backend nomor +62 & anti-duplikasi, layanan accordion dengan snap minimum order, serta kartu Produk & Layanan owner yang dapat diketuk. Semua data uji pelanggan dan layanan yang ditemukan telah dibersihkan."
##     -agent: "main"
##     -message: "ITERATION 11 COMPLETE: Testing agent melaporkan backend 4/4 PASS dan semua skenario UI PASS. Guard platform kontak, izin Android/iOS, dan fallback web tervalidasi; data test pelanggan serta layanan lama telah dibersihkan."
##     -agent: "main"
##     -message: "ITERATION 12: Menangani laporan pengguna. Nomor pelanggan duplikat kini otomatis memilih pelanggan lama, express benar-benar tersimpan pada order dan masuk queue Express, kartu Transaksi Hari Ini membuka daftar lalu detail nota, dan CTA struk WhatsApp hanya tampil pada modal sukses setelah QRIS lunas. Data uji express/pelanggan/order dibersihkan."
##     -agent: "main"
##     -message: "ITERATION 12 COMPLETE: Tester mengonfirmasi backend customer/express dan detail Transaksi PASS. Modal customer/QRIS lalu distabilkan berdasarkan RCA; pengujian ulang mobile web PASS untuk input pelanggan dan pilihan QRIS."
##     -agent: "main"
##     -message: "ITERATION 13: Struk WhatsApp diperluas ke Tunai/E-Money/Deposit, Batal Transaksi ditambahkan sebelum order dibuat, timeline proses laundry dan layar Siap Diambil ditambahkan. Uji manual E-Money receipt, cancel payment, dan Setrika→Packing→Siap Diambil PASS; data uji dibersihkan."
##     -agent: "main"
##     -message: "ITERATION 13 COMPLETE: Backend payment/timeline 4/4 PASS. RCA memperbaiki modal pembayaran layar kecil dengan scroll area dan footer aksi sticky; uji ulang E-Money, Konfirmasi, dan Batal Transaksi pada ponsel PASS."
##     -agent: "main"
##     -message: "ITERATION 14: Ready order dipisahkan dari antrian aktif dan ditutup lewat tombol Sudah Diambil di daftar Siap Diambil. Antar Jemput/Timbang kini menggunakan kartu layanan ber-kategori dengan minimum order sama seperti Buat Order, sambil mempertahankan kamera/galeri bukti. Validasi server minimum layanan juga ditambahkan."
##     -agent: "main"
##     -message: "ITERATION 14 COMPLETE: Backend test 4/4 PASS. Tindak lanjut frontend: tindakan timbang tersedia langsung untuk request pickup dan daftar Siap Diambil memakai optimistic update. Screenshot membuktikan kedua alur; status completion diverifikasi API dan semua data uji dibersihkan."
##     -agent: "main"
##     -message: "CLEANUP FINAL: Menghapus 43 order dan 10 pelanggan bertanda TEST_ dari pengujian lama, termasuk transaksi, work log, serta item terkait. Pemeriksaan akhir menyatakan 0 order/pelanggan TEST_ tersisa."
##     -agent: "main"
##     -message: "ITERATION 18 COMPLETE: Laporan Owner semua status, kamera in-app, nota pelanggan langsung Bayar, tanggal/detail Kurir, dan auto-cancel request 14 hari telah diterapkan. Iterasi 15 menemukan photo-camera tidak terjangkau; tombol dipindahkan di atas daftar layanan. Retest iterasi 16 PASS untuk backend 4/4 dan seluruh alur UI terkait. Cleanup akhir: 0 order/pelanggan TEST_ tersisa."
##     -agent: "main"
##     -message: "ITERATION 8: (1) TrendChart now has Y-axis rupiah labels at 0/25/50/75/100% and X-axis day ticks; dashboard title 'Trend <bulan Indonesia>'. (2) Dashboard 'X pelanggan' badge is pressable -> /hari-ini screen listing today's orders/notes (GET /orders?today=true). Owner can cancel a nota (reason) via POST /orders/{id}/cancel; employees CANNOT (OrdersPipeline canCancel=false in employee index, and /hari-ini hides cancel unless session.role==owner). (3) Dashboard adds Top 3 Pelanggan bulan ini (name, kg, spend) from GET /dashboard top_customers. (4) Setelan > Database Pelanggan (/manage/pelanggan) fully reworked: search, add/edit (name, phone, ADDRESS, email, deposit, outlet), list with per-customer stats (total_kg, tx_count, total_spend), and detail modal (GET /customers/{id}/detail) showing address, points, deposit, total kiloan, jumlah transaksi, total belanja, transaksi pertama & terakhir, riwayat 10 order. Backend: added address column to customers, aggregates in list_customers, /customers/{id}/detail, today filter, top_customers. Owner owner/owner123, produksi joko/pegawai123. Please test /hari-ini owner cancel + employee cannot cancel, customer DB CRUD+detail, dashboard top_customers, and no regressions."
##     -agent: "main"
##     -message: "ITERATION 23 COMPLETE: placeholder/prefetch mempercepat filter antrian, kasbon_date mendukung pencatatan berkali-kali per tanggal, dan indikator Dikerjakan pasif tanpa border. Iterasi 22 menemukan payroll 500 karena kolom tertukar; diperbaiki. Retest iterasi 23 PASS untuk payroll, kasbon lintas periode, Gaji Owner, sortir, Antar Jemput, serta indikator dashboard."
##     -agent: "main"
##     -message: "ITERATION 24: Menambahkan stage_workers pada order untuk Cuci/Pengering/Setrika/Packing, agregasi semua tahap pada payroll, UI payroll per tahap dan riwayat kasbon per tanggal. Order ready belum lunas terkunci UI dan divalidasi API (400). Trend memakai palet unik per outlet; indikator Dikerjakan dipusatkan. Perlu retest backend dan frontend."
##     -agent: "main"
##     -message: "ITERATION 24 FIX VERIFIED: Retest backend 2/2 PASS. Stabilitas Siap Diambil diperbaiki dengan menunggu outlet aktif sebelum query dan refetch saat halaman dipasang; screenshot login Pegawai→Siap Diambil PASS. Grafik trend memakai key per outlet dan gradient unik; screenshot membuktikan warna Kalimulya (#7C3AED/#2563EB) berubah ke Pulomas (#0F766E/#0EA5E9)."
##     -agent: "main"
##     -message: "ITERATION 25: Menambahkan Bayar Sekarang inline untuk ready/unpaid dengan kartu metode pembayaran yang sama, lalu mengaktifkan Sudah Diambil setelah lunas. Rincian Gaji kembali ringkas (Bonus Cuci/Setrika) dan tanggal kasbon kini memakai kalender kecil. Perlu retest UI dan pembayaran API."
##     -agent: "main"
##     -message: "ITERATION 25 FIX VERIFIED: Gaji kini mengambil outlet langsung dari session/OutletSwitcher sehingga tidak dapat memakai outlet lokal yang stale; kondisi outlet belum siap menampilkan Loading, bukan Belum ada pegawai. Sheet kasbon menjadi scrollable dan menerima tap saat keyboard aktif. Screenshot membuktikan daftar 7 pegawai, Bonus Cuci/Setrika ringkas, dan kalender memilih 01 October 2026."
##     -agent: "main"
##     -message: "ITERATION 26: Timeline proses kini mengisi nama petugas secara optimistis lalu sinkron ke server, kartu antrian hanya memiliki status Lunas/Belum Lunas, dan cache dipanaskan sebelum membuka Proses/Siap Diambil/Transaksi. Uji lokal: timeline Cuci oleh Joko Produksi tampil, status Belum Lunas ringkas tanpa Konfirmasi Pembayaran, dan proses terbuka 77 ms. Perlu retest." 
##     -agent: "main"
##     -message: "ITERATION 27: Transaksi tetap realtime, sedangkan Dashboard Owner/Pegawai, Gaji, dan Kasbon memakai stale cache hingga 21.00 Asia/Jakarta. Label tahap petugas mendapat visual account-check yang lebih jelas dan indikator Dikerjakan menjadi pill ringkas terpisah. Perlu retest atribusi pekerja berbeda per tahap dan cache UI."
##     -agent: "main"
##     -message: "ITERATION 27 FIX VERIFIED: Retest 27 backend 3/3 dan frontend stage/queue/ready PASS. Owner Dashboard sempat skeleton intermittent saat login; login sekarang menyetel sesi langsung tanpa menunggu penyimpanan perangkat dan dashboard menunggu sesi siap sambil mempertahankan data cache. Screenshot login Owner menampilkan KPI dashboard PASS."
##     -agent: "main"
##     -message: "ITERATION 28: Midtrans Snap Sandbox disiapkan untuk pelanggan. Backend membuat Snap dari total server, menolak tanpa MIDTRANS_SERVER_KEY, menyimpan status provider, dan webhook HTTPS idempoten hanya menandai paid saat settlement/capture tervalidasi. UI pelanggan menampilkan GoPay/QRIS utama serta VA BNI/BRI/CIMB/Mandiri/Permata. Menunggu Secret Sandbox untuk uji E2E."
##     -agent: "main"
##     -message: "ITERATION 28 FIX VERIFIED: Testing agent menemukan OpenAPI backend tidak terbuka pada jalur publik. Ditambahkan /api/openapi.json tanpa informasi rahasia; curl lokal dan preview publik memverifikasi endpoint Snap, webhook, dan payment-status. Sandbox checkout/webhook E2E tetap menunggu Secret Sandbox sesuai rencana."
##     -agent: "main"
##     -message: "ITERATION 28 SANDBOX VERIFIED: Setelah Secret Sandbox diisi, POST Snap berhasil membentuk redirect URL app.sandbox.midtrans.com serta menyimpan pending. Notifikasi settlement bertanda tangan valid dikirim melalui URL webhook HTTPS publik dua kali; order menjadi paid dan transaksi pendapatan tetap satu (idempoten). Semua order/transaksi TEST dibersihkan."