import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2, LogOut } from "lucide-react";
import { LOGO_URL, OUTLETS } from "@/data/laundry";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TYPE_LABELS = {
  wa_click: "Klik Order WA",
  calc_order: "Order dari Kalkulator",
  detect_location: "Deteksi Lokasi",
  app_notify: "Minat Notifikasi App",
  kemitraan_click: "Minat Kemitraan",
};
const label = (t) => TYPE_LABELS[t] || t;

export default function AdminDashboard() {
  const [state, setState] = useState(null); // null=loading, false=unauth, object=data
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        await axios.get(`${API}/auth/me`, { withCredentials: true });
        const { data } = await axios.get(`${API}/admin/stats`, { withCredentials: true });
        setState(data);
      } catch {
        setState(false);
      }
    })();
  }, []);

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch { /* lanjut */ }
    navigate("/admin");
  };

  if (state === false) {
    navigate("/admin");
    return null;
  }

  return (
    <div data-testid="admin-dashboard" className="min-h-screen bg-[#FAF7FD]">
      <header className="backdrop-blur-xl bg-white/85 border-b border-purple-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Jadiwangi Laundry" className="h-9 w-auto" />
            <span className="text-xs font-mono-accent uppercase tracking-widest text-[#581C87]">Dashboard Pengelola</span>
          </div>
          <button
            data-testid="admin-logout-btn"
            onClick={logout}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#581C87] hover:text-[#7E22CE] border border-purple-200 rounded-full px-4 py-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Keluar
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-10">
        {state === null ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-[#7E22CE]" />
          </div>
        ) : (
          <>
            <h1 className="font-display text-3xl text-[#1E1329] mb-8">Analisis Landing Page</h1>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              <div data-testid="stat-total" className="bg-white rounded-2xl border border-purple-100 p-5 shadow-sm">
                <p className="text-xs font-mono-accent uppercase tracking-widest text-[#645B72]">Total Interaksi</p>
                <p className="font-display text-4xl text-[#7E22CE] mt-2">{state.total}</p>
              </div>
              {Object.entries(state.by_type).map(([t, n]) => (
                <div key={t} data-testid={`stat-${t}`} className="bg-white rounded-2xl border border-purple-100 p-5 shadow-sm">
                  <p className="text-xs font-mono-accent uppercase tracking-widest text-[#645B72]">{label(t)}</p>
                  <p className="font-display text-4xl text-[#1E1329] mt-2">{n}</p>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-purple-100 p-6 shadow-sm">
                <h2 className="font-display text-xl text-[#1E1329] mb-5">Klik Order WA per Outlet</h2>
                <div className="space-y-4">
                  {OUTLETS.map((o) => {
                    const n = state.by_outlet[o.id] || 0;
                    const max = Math.max(1, ...OUTLETS.map((x) => state.by_outlet[x.id] || 0));
                    return (
                      <div key={o.id} data-testid={`stat-outlet-${o.id}`}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="text-[#1E1329] font-medium">{o.label}</span>
                          <span className="font-semibold text-[#7E22CE]">{n}</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-purple-50 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-[#7E22CE] to-[#4C1D95]" style={{ width: `${(n / max) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-purple-100 p-6 shadow-sm">
                <h2 className="font-display text-xl text-[#1E1329] mb-5">Aktivitas Terbaru</h2>
                {state.recent.length === 0 ? (
                  <p className="text-sm text-[#645B72]">Belum ada aktivitas tercatat.</p>
                ) : (
                  <ul className="divide-y divide-purple-50">
                    {state.recent.map((e, i) => (
                      <li key={i} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                        <span className="text-[#1E1329]">
                          {label(e.type)}
                          {e.outlet && <span className="text-[#645B72]"> · {e.outlet}</span>}
                        </span>
                        <span className="text-xs text-[#645B72] whitespace-nowrap">
                          {new Date(e.ts).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
