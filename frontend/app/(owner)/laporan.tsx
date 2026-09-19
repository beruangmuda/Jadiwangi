import React, { useState } from "react";
import { View, Text, ScrollView, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import dayjs from "dayjs";
import { fonts, makeStyles, radius, shadow, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { Card, ChipRow, SectionHeader, Loading, EmptyState, Pill } from "@/src/components/ui";
import { Segmented } from "@/src/components/form";
import { OutletSwitcher } from "@/src/components/OutletSwitcher";
import { BarChart } from "@/src/components/Chart";
import { rupiah, rupiahShort, kg, formatDate } from "@/src/format";

const TABS = [
  { key: "keuangan", label: "Keuangan" },
  { key: "transaksi", label: "Transaksi" },
  { key: "pegawai", label: "Pegawai" },
  { key: "pelanggan", label: "Pelanggan" },
];

const PERIODS = [
  { key: "hari", label: "Hari Ini" },
  { key: "minggu", label: "Minggu Ini" },
  { key: "bulan", label: "Bulan Ini" },
];

function rangeFor(period: string): { frm: string; to: string } {
  const to = dayjs().format("YYYY-MM-DD");
  if (period === "hari") return { frm: to, to };
  if (period === "minggu") return { frm: dayjs().startOf("week").format("YYYY-MM-DD"), to };
  return { frm: dayjs().startOf("month").format("YYYY-MM-DD"), to };
}

export default function Laporan() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [tab, setTab] = useState("keuangan");
  const [period, setPeriod] = useState("bulan");
  const outletId = session?.currentOutletId ?? null;
  const { frm, to } = rangeFor(period);
  const params = new URLSearchParams();
  if (outletId) params.set("outlet_id", outletId);
  params.set("frm", frm);
  params.set("to", to);
  const q = `?${params.toString()}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Laporan</Text>
        <OutletSwitcher />
      </View>
      <View style={styles.chipWrap}>
        <ChipRow items={TABS} value={tab} onChange={setTab} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"], gap: spacing.lg }}>
        <Segmented items={PERIODS} value={period} onChange={setPeriod} />
        {tab === "keuangan" && <Keuangan q={q} />}
        {tab === "transaksi" && <Transaksi q={q} />}
        {tab === "pegawai" && <Pegawai q={q} />}
        {tab === "pelanggan" && <Pelanggan q={q} />}
      </ScrollView>
    </View>
  );
}

function StatTile({ icon, label, value, tone = "brand" }: { icon: string; label: string; value: string; tone?: "brand" | "azure" | "success" | "error" | "warning" }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const map: any = { brand: colors.brand, azure: colors.brandPrimary, success: colors.success, error: colors.error, warning: colors.warning };
  return (
    <View style={styles.tile}>
      <View style={[styles.tileIcon, { backgroundColor: colors.surfaceSecondary }]}>
        <Icon name={icon} size={18} color={map[tone]} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, { color: map[tone] }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

function Keuangan({ q }: { q: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { data, isLoading } = useQuery({ queryKey: ["rep-fin", q], queryFn: () => api.get(`/reports/financial${q}`) });
  if (isLoading) return <Loading />;
  const bw = Math.min(width, 640) - spacing.lg * 4;
  return (
    <>
      <View style={styles.grid}>
        <StatTile icon="chart-line" label="Omzet" value={rupiah(data.omzet)} tone="brand" />
        <StatTile icon="cash-multiple" label="Pendapatan" value={rupiah(data.pendapatan)} tone="azure" />
        <StatTile icon="cash-minus" label="Pengeluaran" value={rupiah(data.pengeluaran)} tone="error" />
        <StatTile icon="hand-coin" label="Kasbon" value={rupiah(data.kasbon)} tone="warning" />
      </View>
      <Card>
        <SectionHeader title="Laba Bersih" />
        <Text style={[styles.bigMoney, { color: data.laba >= 0 ? colors.success : colors.error }]} numberOfLines={1} adjustsFontSizeToFit>{rupiah(data.laba)}</Text>
        <Text style={styles.hintMuted}>Pendapatan − Pengeluaran − Kasbon</Text>
      </Card>
      <Card>
        <SectionHeader title="Rincian Pengeluaran" />
        {(data.expense_breakdown || []).length === 0 ? (
          <EmptyState icon="cash-remove" title="Belum ada pengeluaran" />
        ) : (
          <>
            <BarChart width={bw} data={(data.expense_breakdown || []).map((e: any) => ({ label: e.category, value: e.total }))} color={colors.error} />
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              {(data.expense_breakdown || []).map((e: any) => (
                <View key={e.category} style={styles.lineRow}>
                  <Text style={styles.lineLabel}>{e.category}</Text>
                  <Text style={styles.lineValue}>{rupiah(e.total)}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Card>
    </>
  );
}

function Transaksi({ q }: { q: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { data, isLoading } = useQuery({ queryKey: ["rep-trx", q], queryFn: () => api.get(`/reports/transactions${q}`) });
  if (isLoading) return <Loading />;
  return (
    <>
      <View style={styles.grid}>
        <StatTile icon="receipt-text-check" label="Order Selesai/Aktif" value={String(data.total_orders)} tone="azure" />
        <StatTile icon="receipt-text-remove" label="Pembatalan" value={String(data.cancelled)} tone="error" />
      </View>
      <Card>
        <SectionHeader title="Nilai Transaksi" />
        <Text style={[styles.bigMoney, { color: colors.brandPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{rupiah(data.total_value)}</Text>
      </Card>
      <Card>
        <SectionHeader title="Transaksi Terbaru" />
        <View style={{ gap: spacing.md }}>
          {(data.recent || []).slice(0, 12).map((o: any, i: number) => (
            <View key={i} style={styles.lineRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineLabel}>{o.customer_name}</Text>
                <Text style={styles.lineSub}>{o.code} • {formatDate(o.created_at)}</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 3 }}>
                <Text style={styles.lineValue}>{rupiah(o.total)}</Text>
                <Pill label={o.payment_status === "paid" ? "Lunas" : "Belum"} tone={o.payment_status === "paid" ? "success" : "warning"} />
              </View>
            </View>
          ))}
        </View>
      </Card>
      <Card>
        <SectionHeader title="Pembatalan" />
        {(data.cancellations || []).length === 0 ? (
          <EmptyState icon="check-all" title="Tidak ada pembatalan" />
        ) : (
          <View style={{ gap: spacing.md }}>
            {(data.cancellations || []).map((o: any, i: number) => (
              <View key={i} style={styles.lineRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineLabel}>{o.customer_name}</Text>
                  <Text style={styles.lineSub}>{o.code} • {o.cancel_reason || "-"}</Text>
                </View>
                <Text style={[styles.lineValue, { color: colors.error }]}>{rupiah(o.total)}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    </>
  );
}

function Pegawai({ q }: { q: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { data, isLoading } = useQuery({ queryKey: ["rep-emp", q], queryFn: () => api.get(`/reports/employees${q}`) });
  if (isLoading) return <Loading />;
  const roleMeta: Record<string, { label: string; icon: string }> = {
    admin: { label: "Admin", icon: "clipboard-account" },
    produksi: { label: "Produksi", icon: "washing-machine" },
    kurir: { label: "Kurir", icon: "moped" },
  };
  return (
    <>
      <Card>
        <SectionHeader title="Statistik Produksi" />
        <View style={styles.grid}>
          <StatTile icon="scale-balance" label="Total Kiloan" value={kg(data.production.total_kg)} tone="brand" />
          <StatTile icon="washing-machine" label="Sudah Dicuci" value={kg(data.production.washed_kg)} tone="azure" />
          <StatTile icon="iron" label="Sudah Disetrika" value={kg(data.production.ironed_kg)} tone="warning" />
          <StatTile icon="package-variant-closed" label="Sudah Dipacking" value={kg(data.production.packed_kg)} tone="success" />
        </View>
      </Card>
      <Card>
        <View style={styles.lineRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="clipboard-text" size={18} color={colors.brand} />
            <Text style={styles.lineLabel}>Order dibuat (Admin)</Text>
          </View>
          <Text style={styles.lineValue}>{data.admin.orders_created}</Text>
        </View>
        <View style={[styles.lineRow, { marginTop: spacing.sm }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="truck-fast" size={18} color={colors.brandPrimary} />
            <Text style={styles.lineLabel}>Antar/Jemput (Kurir)</Text>
          </View>
          <Text style={styles.lineValue}>{data.kurir.deliveries}</Text>
        </View>
      </Card>
      {Object.keys(roleMeta).map((role) => (
        <Card key={role}>
          <SectionHeader title={roleMeta[role].label} />
          {(data.by_role[role] || []).length === 0 ? (
            <Text style={styles.hintMuted}>Belum ada pegawai.</Text>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {(data.by_role[role] || []).map((e: any) => (
                <View key={e.id} style={styles.empRow}>
                  <View style={styles.avatar}>
                    <Icon name={roleMeta[role].icon} size={18} color={colors.onBrandPrimary} />
                  </View>
                  <Text style={styles.lineLabel}>{e.name}</Text>
                  {e.active ? <Pill label="Aktif" tone="success" /> : <Pill label="Nonaktif" tone="neutral" />}
                </View>
              ))}
            </View>
          )}
        </Card>
      ))}
    </>
  );
}

function Pelanggan({ q }: { q: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { data, isLoading } = useQuery({ queryKey: ["rep-cust", q], queryFn: () => api.get(`/reports/customers${q}`) });
  if (isLoading) return <Loading />;
  const bw = Math.min(width, 640) - spacing.lg * 4;
  return (
    <>
      <View style={styles.grid}>
        <StatTile icon="account-group" label="Total Pelanggan" value={String(data.total)} tone="brand" />
        <StatTile icon="wallet" label="Total Deposit" value={rupiahShort((data.deposits || []).reduce((a: number, d: any) => a + d.deposit, 0))} tone="azure" />
      </View>
      <Card>
        <SectionHeader title="Pertumbuhan Pelanggan" />
        {(data.growth || []).length === 0 ? <EmptyState icon="account-plus" title="Belum ada data" /> : (
          <>
            <BarChart width={bw} data={(data.growth || []).map((g: any) => ({ label: g.month, value: g.count }))} color={colors.brand} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm }}>
              {(data.growth || []).map((g: any, i: number) => (
                <Pill key={i} label={`${g.month}: ${g.count}`} tone="brand" />
              ))}
            </View>
          </>
        )}
      </Card>
      <Card>
        <SectionHeader title="Top Pelanggan" />
        <View style={{ gap: spacing.md }}>
          {(data.top || []).map((c: any, i: number) => (
            <View key={i} style={styles.empRow}>
              <View style={[styles.rankBadge, i < 3 && { backgroundColor: colors.brand }]}>
                <Text style={[styles.rankText, i < 3 && { color: colors.onBrand }]}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineLabel}>{c.name}</Text>
                <Text style={styles.lineSub}>{c.orders}x • {c.points} poin</Text>
              </View>
              <Text style={styles.lineValue}>{rupiahShort(c.spend)}</Text>
            </View>
          ))}
        </View>
      </Card>
      <Card>
        <SectionHeader title="Saldo Deposit" />
        {(data.deposits || []).length === 0 ? <EmptyState icon="wallet-outline" title="Tidak ada deposit" /> : (
          <View style={{ gap: spacing.md }}>
            {(data.deposits || []).map((d: any, i: number) => (
              <View key={i} style={styles.lineRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineLabel}>{d.name}</Text>
                  <Text style={styles.lineSub}>{d.phone}</Text>
                </View>
                <Text style={[styles.lineValue, { color: colors.brandPrimary }]}>{rupiah(d.deposit)}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: c.surface },
  title: { fontFamily: fonts.displayBold, fontSize: 24, color: c.onSurface },
  chipWrap: { borderBottomWidth: 1, borderBottomColor: c.divider, paddingBottom: spacing.xs },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  tile: { flexGrow: 1, flexBasis: "45%", backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: c.border, gap: 6, ...shadow.card },
  tileIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  tileLabel: { fontFamily: fonts.bodySemi, fontSize: 12, color: c.muted },
  tileValue: { fontFamily: fonts.displayBold, fontSize: 18 },
  bigMoney: { fontFamily: fonts.displayBold, fontSize: 28 },
  hintMuted: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  lineRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  lineLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurface },
  lineSub: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  lineValue: { fontFamily: fonts.displayBold, fontSize: 14, color: c.onSurface },
  empRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  rankBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  rankText: { fontFamily: fonts.displayBold, fontSize: 14, color: c.brand },
}));
