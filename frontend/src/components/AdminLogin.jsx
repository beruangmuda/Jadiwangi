import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2, Lock } from "lucide-react";
import { LOGO_URL } from "@/data/laundry";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const fmtErr = (d) => {
  if (d == null) return "Terjadi kesalahan. Coba lagi.";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => (e && e.msg) || JSON.stringify(e)).join(" ");
  return d.msg || String(d);
};

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await axios.post(`${API}/auth/login`, { email, password }, { withCredentials: true });
      navigate("/admin/dashboard");
    } catch (err) {
      setError(fmtErr(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full bg-white border border-purple-200 rounded-xl px-4 py-3 text-sm text-[#1E1329] focus:outline-none focus:ring-2 focus:ring-[#7E22CE]/40 focus:border-[#7E22CE] transition";

  return (
    <div data-testid="admin-login-page" className="min-h-screen bg-[#FAF7FD] flex items-center justify-center px-5 relative overflow-hidden">
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#E9D5FF] blur-3xl opacity-70" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-[#F3E8FF] blur-3xl opacity-80" />
      <div className="relative w-full max-w-md bg-white/95 rounded-3xl border border-purple-100 shadow-[0_20px_50px_rgba(88,28,135,0.15)] p-8 lg:p-10">
        <div className="flex flex-col items-center text-center mb-8">
          <img src={LOGO_URL} alt="Jadiwangi Laundry" className="h-14 w-auto mb-4" />
          <h1 className="font-display text-2xl sm:text-3xl text-[#1E1329]">Area Pengelola</h1>
          <p className="mt-1.5 text-sm text-[#645B72]">Khusus pemilik Jadiwangi Laundry</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="admin-email" className="block text-xs font-mono-accent uppercase tracking-widest text-[#581C87] mb-2">Email</label>
            <input
              id="admin-email"
              data-testid="admin-login-email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="email@jadiwangi.id"
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="block text-xs font-mono-accent uppercase tracking-widest text-[#581C87] mb-2">Password</label>
            <input
              id="admin-password"
              data-testid="admin-login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p data-testid="admin-login-error" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}
          <button
            data-testid="admin-login-submit"
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2.5 bg-[#7E22CE] hover:bg-[#581C87] disabled:opacity-70 text-white font-semibold px-6 py-3.5 rounded-full transition-colors duration-300"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
            Masuk ke Dashboard
          </button>
        </form>
        <a href="/" data-testid="admin-login-back" className="mt-6 block text-center text-sm text-[#645B72] hover:text-[#7E22CE] transition-colors">
          ← Kembali ke beranda
        </a>
      </div>
    </div>
  );
}
