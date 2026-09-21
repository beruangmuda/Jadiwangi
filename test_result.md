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

## user_problem_statement: "Tambahkan struk yang dapat dikirim ke WhatsApp pelanggan dari detail pesanan, serta pencatatan kasbon pegawai yang otomatis dipotong dari gaji bulanan."

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
##     working: "NA"
##     file: "frontend/app/order-baru.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##   - task: "Produk & Layanan: outlet tabs, dual price display, full edit form"
##     implemented: true
##     working: "NA"
##     file: "frontend/app/manage/produk.tsx"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true

## test_plan:
##   current_focus:
##     - "Verifikasi pengguna terhadap alur kasbon dan pengiriman struk WhatsApp"
##   test_all: true
##   test_priority: "high_first"

## agent_communication:
##     -agent: "main"
##     -message: "ITERATION 10: Menambahkan GET/POST /api/kasbon dan UI Catat Kasbon per pegawai pada tab Gaji. Nominal kasbon yang dicatat bulan ini otomatis mengurangi total payroll bulan ini. Menambahkan tombol Kirim Struk WhatsApp pada detail kartu antrian owner/pegawai dan pada halaman detail order untuk sesi staf."
##     -agent: "main"
##     -message: "ITERATION 10 COMPLETE: Normalisasi WhatsApp sudah disatukan dan diuji, data kasbon/pegawai uji sudah dibersihkan, serta backend dan UI fitur baru tervalidasi."
##     -agent: "main"
##     -message: "ITERATION 8: (1) TrendChart now has Y-axis rupiah labels at 0/25/50/75/100% and X-axis day ticks; dashboard title 'Trend <bulan Indonesia>'. (2) Dashboard 'X pelanggan' badge is pressable -> /hari-ini screen listing today's orders/notes (GET /orders?today=true). Owner can cancel a nota (reason) via POST /orders/{id}/cancel; employees CANNOT (OrdersPipeline canCancel=false in employee index, and /hari-ini hides cancel unless session.role==owner). (3) Dashboard adds Top 3 Pelanggan bulan ini (name, kg, spend) from GET /dashboard top_customers. (4) Setelan > Database Pelanggan (/manage/pelanggan) fully reworked: search, add/edit (name, phone, ADDRESS, email, deposit, outlet), list with per-customer stats (total_kg, tx_count, total_spend), and detail modal (GET /customers/{id}/detail) showing address, points, deposit, total kiloan, jumlah transaksi, total belanja, transaksi pertama & terakhir, riwayat 10 order. Backend: added address column to customers, aggregates in list_customers, /customers/{id}/detail, today filter, top_customers. Owner owner/owner123, produksi joko/pegawai123. Please test /hari-ini owner cancel + employee cannot cancel, customer DB CRUD+detail, dashboard top_customers, and no regressions."