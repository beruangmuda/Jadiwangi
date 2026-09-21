import React from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, shadow, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { OrdersPipeline } from "@/src/components/OrdersPipeline";
import { kg } from "@/src/format";

export default function EmployeeHome() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, logout } = useAuth();
  const outletId = session?.currentOutletId ?? null;

  const { data } = useQuery({
    queryKey: ["dashboard", outletId],
    queryFn: () => api.get(`/dashboard${outletId ? `?outlet_id=${outletId}` : ""}`),
  });
  const t = data?.today;
  const queue = data?.queue;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 }}>
          <View style={styles.avatar}><Icon name="account-hard-hat" size={22} color={colors.onBrandPrimary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>{session?.name || "Pegawai"}</Text>
            <Text style={styles.role}>{session?.employee?.role_type === "produksi" ? "Produksi" : session?.employee?.role_type === "kurir" ? "Kurir" : "Admin"}</Text>
          </View>
        </View>
        <Pressable testID="employee-topup" onPress={() => router.push("/manage/topup")} hitSlop={10} style={styles.coinBtn}>
          <Icon name="hand-coin" size={20} color={colors.brandPrimary} />
        </Pressable>
        <Pressable testID="logout-btn" onPress={async () => { await logout(); router.replace("/login"); }} hitSlop={10} style={styles.logoutBtn}>
          <Icon name="logout" size={20} color={colors.error} />
        </Pressable>
      </View>

      <View style={styles.statStrip}>
        <Stat icon="receipt-text" label="Transaksi Hari Ini" value={String(t?.orders ?? 0)} sub={kg(t?.kg)} onPress={() => router.push("/hari-ini")} testID="today-orders-card" />
        <Stat icon="progress-wrench" label="Dikerjakan" value={String(queue?.in_progress ?? 0)} />
        <Stat icon="basket-check" label="Siap Diambil" value={String(queue?.ready ?? 0)} onPress={() => router.push("/siap-diambil")} testID="ready-orders-card" />
      </View>

      <OrdersPipeline outletId={outletId} employeeId={session?.employee?.id} employeeName={session?.name} canCancel={false} todayOnly />

      <Pressable
        testID="btn-terima-order"
        onPress={() => router.push("/order-baru")}
        style={({ pressed }) => [styles.fab, { bottom: spacing.lg }, pressed && { transform: [{ scale: 0.95 }] }]}
      >
        <Icon name="plus" size={24} color={colors.onBrandPrimary} />
        <Text style={styles.fabText}>Terima Order</Text>
      </Pressable>
    </View>
  );
}

function Stat({ icon, label, value, sub, onPress, testID }: { icon: string; label: string; value: string; sub?: string; onPress?: () => void; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.stat, pressed && onPress && { opacity: 0.75 }]}>
      <Icon name={icon} size={18} color={colors.brand} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: c.surface },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brand, alignItems: "center", justifyContent: "center" },
  hello: { fontFamily: fonts.displayBold, fontSize: 18, color: c.onSurface },
  role: { fontFamily: fonts.bodySemi, fontSize: 13, color: c.muted },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFE4E6", alignItems: "center", justifyContent: "center" },
  coinBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center", marginRight: spacing.sm },
  statStrip: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  stat: { flex: 1, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md, gap: 2, ...shadow.card },
  statValue: { fontFamily: fonts.displayBold, fontSize: 22, color: c.onSurface },
  statLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: c.muted },
  statSub: { fontFamily: fonts.bodyBold, fontSize: 11, color: c.brand },
  fab: { position: "absolute", right: spacing.lg, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.brandPrimary, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: 20, ...shadow.soft },
  fabText: { fontFamily: fonts.displayBold, fontSize: 15, color: c.onBrandPrimary },
}));
