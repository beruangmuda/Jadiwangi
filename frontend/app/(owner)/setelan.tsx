import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, shadow, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { Logo, Card } from "@/src/components/ui";
import { OutletSwitcher } from "@/src/components/OutletSwitcher";

type Item = { icon: string; label: string; desc: string; route: string; tone?: string };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Data & Master",
    items: [
      { icon: "account-group", label: "Database Pelanggan", desc: "Kelola & pantau riwayat pelanggan", route: "/manage/pelanggan" },
      { icon: "tshirt-crew", label: "Produk & Layanan", desc: "Kelola layanan & harga", route: "/manage/produk" },
      { icon: "account-hard-hat", label: "Pegawai & Hak Akses", desc: "Tambah pegawai & atur akses", route: "/manage/pegawai" },
      { icon: "store-edit", label: "Edit Outlet", desc: "Informasi 3 cabang", route: "/manage/outlet" },
    ],
  },
  {
    title: "Pelanggan & Promosi",
    items: [
      { icon: "tag-multiple", label: "Promo & Voucher", desc: "Buat & hentikan promo per outlet", route: "/manage/promo" },
      { icon: "hand-coin", label: "Konfirmasi Top-up Coin", desc: "Setujui isi saldo pelanggan", route: "/manage/topup" },
      { icon: "message-alert", label: "Pengaduan & Ulasan", desc: "Keluhan bintang 1-2 & semua ulasan", route: "/manage/pengaduan" },
    ],
  },
  {
    title: "Keuangan",
    items: [
      { icon: "cash-minus", label: "Pencatatan Pengeluaran", desc: "Catat biaya operasional", route: "/manage/pengeluaran" },
      { icon: "cash-sync", label: "Koreksi Keuangan", desc: "Penyesuaian saldo kas", route: "/manage/koreksi" },
    ],
  },
];

export default function Setelan() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout, currentOutlet } = useAuth();
  const outlet = currentOutlet();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Logo size={40} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"], gap: spacing.lg }}>
        <Text style={styles.title}>Setelan</Text>

        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View style={styles.outletIcon}>
                <Icon name="map-marker-radius" size={22} color={colors.onBrandPrimary} />
              </View>
              <View>
                <Text style={styles.outletName}>{outlet ? outlet.name : "Semua Outlet"}</Text>
                <Text style={styles.outletCity}>{outlet ? outlet.city : "Gabungan cabang"}</Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <OutletSwitcher />
          </View>
        </Card>

        {GROUPS.map((g) => (
          <View key={g.title} style={{ gap: spacing.sm }}>
            <Text style={styles.groupTitle}>{g.title}</Text>
            <View style={styles.menuCard}>
              {g.items.map((it, i) => (
                <Pressable
                  key={it.route}
                  testID={`menu-${it.route}`}
                  onPress={() => router.push(it.route as any)}
                  style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { backgroundColor: colors.surfaceSecondary }]}
                >
                  <View style={styles.rowIcon}>
                    <Icon name={it.icon} size={20} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{it.label}</Text>
                    <Text style={styles.rowDesc}>{it.desc}</Text>
                  </View>
                  <Icon name="chevron-right" size={22} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Pressable testID="logout-btn" onPress={async () => { await logout(); router.replace("/login"); }} style={({ pressed }) => [styles.logout, pressed && { opacity: 0.8 }]}>
          <Icon name="logout" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Keluar</Text>
        </Pressable>
        <Text style={styles.version}>Jadiwangi App • v1.0 • ESTD 2021</Text>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.divider },
  title: { fontFamily: fonts.displayBold, fontSize: 24, color: c.onSurface },
  outletIcon: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: c.brand, alignItems: "center", justifyContent: "center" },
  outletName: { fontFamily: fonts.displayBold, fontSize: 16, color: c.onSurface },
  outletCity: { fontFamily: fonts.body, fontSize: 13, color: c.muted },
  groupTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.muted, textTransform: "uppercase", letterSpacing: 0.5, marginLeft: spacing.xs },
  menuCard: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, overflow: "hidden", ...shadow.card },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  rowBorder: { borderTopWidth: 1, borderTopColor: c.divider },
  rowIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurface },
  rowDesc: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FFE4E6", borderRadius: radius.md, paddingVertical: 15 },
  logoutText: { fontFamily: fonts.displayBold, fontSize: 15, color: c.error },
  version: { fontFamily: fonts.body, fontSize: 12, color: c.muted, textAlign: "center" },
}));
