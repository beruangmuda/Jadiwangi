import React, { createContext, useContext, useEffect, useState } from "react";
import Constants from "expo-constants";
import { storage } from "@/src/utils/storage";
import { api } from "@/src/api";

export type Role = "owner" | "pegawai" | "pelanggan";

export type Outlet = {
  id: string;
  name: string;
  city: string;
  address?: string;
  phone?: string;
  sla_hours?: number;
  qris_url?: string;
};

export type Session = {
  role: Role;
  name?: string;
  employee?: any;
  customer?: any;
  outlets?: Outlet[];
  currentOutletId: string | null; // null = Semua Outlet (owner)
};

type AuthCtx = {
  session: Session | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (name: string, phone: string, password: string, outletId: string) => Promise<void>;
  logout: () => Promise<void>;
  updateCustomer: (patch: any) => void;
  setOutlet: (id: string | null) => void;
  currentOutlet: () => Outlet | null;
};

const SESSION_KEY = "jw_session_v1";
const VERSION_KEY = "jw_app_version";
// Versi sistem — sesi tetap tersimpan (selalu login di perangkat ini),
// kecuali versi ini berubah (ada update sistem) → pengguna diminta login ulang.
const APP_VERSION = Constants.expoConfig?.version || "1.0.0";
const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const savedVersion = await storage.getItem<string | null>(VERSION_KEY, null);
      if (savedVersion !== APP_VERSION) {
        // Ada update sistem → bersihkan sesi lama & paksa login ulang.
        await storage.removeItem(SESSION_KEY);
        await storage.setItem(VERSION_KEY, APP_VERSION as any);
        setLoading(false);
        return;
      }
      const saved = await storage.getItem<Session | null>(SESSION_KEY, null);
      if (saved) setSession(saved);
      setLoading(false);
    })();
  }, []);

  const persist = async (s: Session | null) => {
    setSession(s);
    if (s) {
      await storage.setItem(SESSION_KEY, s as any);
      await storage.setItem(VERSION_KEY, APP_VERSION as any);
    } else {
      await storage.removeItem(SESSION_KEY);
    }
  };

  const sessionFromRes = (res: any): Session => {
    if (res.role === "owner") {
      return { role: "owner", name: res.name, outlets: res.outlets, currentOutletId: null };
    } else if (res.role === "pegawai") {
      return { role: "pegawai", name: res.employee?.name, employee: res.employee, outlets: res.outlets, currentOutletId: res.employee?.outlet_id ?? null };
    }
    return { role: "pelanggan", name: res.customer?.name, customer: res.customer, currentOutletId: res.customer?.outlet_id ?? null };
  };

  const login: AuthCtx["login"] = async (username, password) => {
    const res = await api.post("/auth/login", { username, password });
    await persist(sessionFromRes(res));
  };

  const register: AuthCtx["register"] = async (name, phone, password, outletId) => {
    const res = await api.post("/auth/register", { name, phone, password, outlet_id: outletId });
    await persist(sessionFromRes(res));
  };

  const updateCustomer = (patch: any) => {
    if (!session) return;
    const customer = { ...(session.customer || {}), ...patch };
    persist({ ...session, customer, currentOutletId: customer.outlet_id ?? session.currentOutletId });
  };

  const logout = async () => {
    await persist(null);
  };

  const setOutlet = (id: string | null) => {
    if (!session) return;
    const s = { ...session, currentOutletId: id };
    persist(s);
  };

  const currentOutlet = () => {
    if (!session || !session.outlets || !session.currentOutletId) return null;
    return session.outlets.find((o) => o.id === session.currentOutletId) || null;
  };

  return (
    <Ctx.Provider value={{ session, loading, login, register, logout, updateCustomer, setOutlet, currentOutlet }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
