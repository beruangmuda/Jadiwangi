import React, { createContext, useContext, useEffect, useState } from "react";
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
  login: (role: Role, opts: { pin?: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  setOutlet: (id: string | null) => void;
  currentOutlet: () => Outlet | null;
};

const SESSION_KEY = "jw_session_v1";
const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<Session | null>(SESSION_KEY, null);
      if (saved) setSession(saved);
      setLoading(false);
    })();
  }, []);

  const persist = async (s: Session | null) => {
    setSession(s);
    if (s) await storage.setItem(SESSION_KEY, s as any);
    else await storage.removeItem(SESSION_KEY);
  };

  const login: AuthCtx["login"] = async (role, opts) => {
    const res = await api.post("/auth/login", { role, pin: opts.pin || "", phone: opts.phone || "" });
    let s: Session;
    if (role === "owner") {
      s = { role, name: res.name, outlets: res.outlets, currentOutletId: null };
    } else if (role === "pegawai") {
      s = { role, name: res.employee?.name, employee: res.employee, outlets: res.outlets, currentOutletId: res.employee?.outlet_id ?? null };
    } else {
      s = { role, name: res.customer?.name, customer: res.customer, currentOutletId: res.customer?.outlet_id ?? null };
    }
    await persist(s);
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
    <Ctx.Provider value={{ session, loading, login, logout, setOutlet, currentOutlet }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
