import React, { useState } from "react";
import { View, Text, Pressable, Platform, ScrollView } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { Card, PrimaryButton, Loading, Pill, SectionHeader } from "@/src/components/ui";
import { StackHeader, Segmented } from "@/src/components/form";
import { rupiah, formatDateTime } from "@/src/format";

export default function TopupCoin() {
  const styles = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { session } = useAuth();
  const cust = session?.customer;

  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState("cash");
  const [done, setDone] = useState(false);

  const { data: packages, isLoading } = useQuery({ queryKey: ["topup-packages"], queryFn: () => api.get("/topup/packages") });
  const { data: detail } = useQuery({
    queryKey: ["cust-detail", cust?.id],
    queryFn: () => api.get(`/customers/${cust?.id}/detail`),
    enabled: !!cust?.id,
  });
  const { data: history } = useQuery({
    queryKey: ["my-topups", cust?.id],
    queryFn: () => api.get(`/topups?customer_id=${cust?.id}`),
    enabled: !!cust?.id,
  });

  const create = useMutation({
    mutationFn: () => api.post("/topups", { customer_id: cust?.id, outlet_id: cust?.outlet_id, amount, method }),
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDone(true); setAmount(null);
      qc.invalidateQueries({ queryKey: ["my-topups"] });
      qc.invalidateQueries({ queryKey: ["cust-detail"] });
    },
  });

  const coin = Number(detail?.deposit ?? 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Isi JW Coin" subtitle="1 Rupiah = 1 Coin" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["3xl"] }}>
        <Card style={{ gap: spacing.sm }}>
          <Text style={styles.label}>Saldo JW Coin Kamu</Text>
          <Text style={styles.balance} testID="topup-balance">{coin.toLocaleString("id-ID")} coin</Text>
          <Text style={styles.hint}>
            Setara {rupiah(coin)}. Bayar laundry pakai coin otomatis hemat 10%.
            {detail?.deposit_expires_at ? ` Berlaku s.d. ${detail.deposit_expires_at}.` : " Coin berlaku 3 bulan sejak top-up terakhir."}
          </Text>
        </Card>

        {done ? (
          <Card style={{ gap: spacing.sm }} testID="topup-success">
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Icon name="clock-check-outline" size={22} color={colors.brandPrimary} />
              <Text style={styles.successTitle}>Permintaan top-up terkirim</Text>
            </View>
            <Text style={styles.hint}>Bayar di outlet (tunai/QRIS). Saldo masuk setelah pegawai/owner mengonfirmasi.</Text>
            <PrimaryButton label="Isi Lagi" icon="plus" tone="lavender" onPress={() => setDone(false)} />
          </Card>
        ) : (
          <Card style={{ gap: spacing.md }}>
            <SectionHeader title="Pilih Paket" />
            {isLoading ? <Loading /> : (
              <View style={{ gap: spacing.sm }}>
                {(packages || []).map((p: any) => {
                  const on = amount === p.amount;
                  return (
                    <Pressable
                      key={p.amount}
                      testID={`pkg-${p.amount}`}
                      onPress={() => setAmount(p.amount)}
                      style={[styles.pkg, on && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}
                    >
                      <View style={[styles.pkgIcon, on && { backgroundColor: colors.brandPrimary }]}>
                        <Icon name="hand-coin" size={20} color={on ? colors.onBrandPrimary : colors.brand} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pkgAmount}>{rupiah(p.amount)}</Text>
                        <Text style={styles.hint}>Dapat {Number(p.coins).toLocaleString("id-ID")} coin</Text>
                      </View>
                      {p.bonus ? <Pill label={`+${Number(p.bonus).toLocaleString("id-ID")} bonus`} tone="success" /> : null}
                      <Icon name={on ? "radiobox-marked" : "radiobox-blank"} size={20} color={on ? colors.brandPrimary : colors.muted} />
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View style={{ gap: spacing.xs }}>
              <Text style={styles.label}>Cara Bayar di Outlet</Text>
              <Segmented items={[{ key: "cash", label: "Tunai" }, { key: "qris", label: "QRIS" }]} value={method} onChange={setMethod} />
            </View>

            <View style={styles.note}>
              <Icon name="information-outline" size={16} color={colors.brand} />
              <Text style={styles.noteText}>Saldo masuk setelah pegawai/owner mengonfirmasi pembayaranmu di outlet.</Text>
            </View>

            <PrimaryButton
              label={amount ? `Ajukan Top-up ${rupiah(amount)}` : "Pilih paket dulu"}
              icon="send"
              onPress={() => create.mutate()}
              loading={create.isPending}
              disabled={!amount}
              testID="submit-topup"
            />
          </Card>
        )}

        <Text style={styles.sectionTitle}>Riwayat Top-up</Text>
        {(history || []).length === 0 ? (
          <Text style={styles.hint}>Belum ada riwayat top-up.</Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {(history || []).map((h: any) => (
              <View key={h.id} style={styles.row} testID={`topup-${h.id}`}>
                <View style={styles.rowIcon}><Icon name="hand-coin" size={18} color={colors.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{rupiah(h.amount)} → {Number(h.coins).toLocaleString("id-ID")} coin</Text>
                  <Text style={styles.hint}>{formatDateTime(h.created_at)} • {h.method === "cash" ? "Tunai" : "QRIS"}</Text>
                </View>
                <Pill
                  label={h.status === "confirmed" ? "Masuk" : h.status === "rejected" ? "Ditolak" : "Menunggu"}
                  tone={h.status === "confirmed" ? "success" : h.status === "rejected" ? "error" : "warning"}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurfaceSecondary },
  balance: { fontFamily: fonts.displayBold, fontSize: 28, color: c.brandPrimary },
  hint: { fontFamily: fonts.body, fontSize: 12, color: c.muted, lineHeight: 17 },
  successTitle: { fontFamily: fonts.displayBold, fontSize: 16, color: c.onSurface },
  pkg: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface },
  pkgIcon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  pkgAmount: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurface },
  note: { flexDirection: "row", gap: spacing.sm, backgroundColor: c.brandTertiary, borderRadius: radius.md, padding: spacing.md },
  noteText: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: c.onBrandTertiary, lineHeight: 17 },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 17, color: c.onSurface },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md },
  rowIcon: { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurface },
}));
