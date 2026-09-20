import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { Card, SectionHeader, Loading, EmptyState, PrimaryButton } from "@/src/components/ui";
import { rupiah, formatDateTime } from "@/src/format";

const METHODS = [
  { key: "qris", label: "QRIS", icon: "qrcode-scan" },
  { key: "cash", label: "Tunai", icon: "cash" },
  { key: "coin", label: "Coin (-10%)", icon: "hand-coin" },
];

export default function Bayar() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { session } = useAuth();
  const cust = session?.customer;
  const customerId = cust?.id;

  const [openId, setOpenId] = useState<string | null>(null);
  const [method, setMethod] = useState("qris");
  const [error, setError] = useState("");

  const { data: bills, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["bills", customerId],
    queryFn: () => api.get(`/orders?customer_id=${customerId}&unpaid=true&limit=50`),
    enabled: !!customerId,
  });

  const { data: detail } = useQuery({
    queryKey: ["order-detail", openId],
    queryFn: () => api.get(`/orders/${openId}`),
    enabled: !!openId,
  });

  const { data: wallet } = useQuery({
    queryKey: ["cust-detail", customerId],
    queryFn: () => api.get(`/customers/${customerId}/detail`),
    enabled: !!customerId,
  });
  const coin = Number(wallet?.deposit ?? 0);

  const pay = useMutation({
    mutationFn: (oid: string) => api.post(`/orders/${oid}/pay`, { method }),
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setOpenId(null); setError("");
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      qc.invalidateQueries({ queryKey: ["cust-detail"] });
    },
    onError: (e: any) => setError(e?.message || "Pembayaran gagal"),
  });

  const approve = useMutation({
    mutationFn: (oid: string) => api.patch(`/orders/${oid}/status`, { status: "received" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      qc.invalidateQueries({ queryKey: ["order-detail"] });
    },
  });

  const list = bills || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.headerTitle}>Bayar</Text>
        <Text style={styles.headerSub}>{coin.toLocaleString("id-ID")} coin</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"], gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
      >
        {isLoading ? <Loading /> : list.length === 0 ? (
          <Card>
            <EmptyState icon="receipt" title="Belum ada tagihan" subtitle="Nota akan muncul di sini setelah pegawai menimbang laundry kamu." />
          </Card>
        ) : (
          list.map((o: any) => {
            const open = openId === o.id;
            const total = Number(o.total);
            const coinCharge = Math.round(total * 0.9);
            const needApproval = o.status === "quoted";
            return (
              <Card key={o.id}>
                <Pressable
                  testID={`bill-${o.id}`}
                  onPress={() => { setOpenId(open ? null : o.id); setError(""); }}
                  style={styles.billHead}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.billCode}>{o.code}</Text>
                    <Text style={styles.billMeta}>{formatDateTime(o.created_at)} • {o.stage_label}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.billTotal}>{rupiah(total)}</Text>
                    <Text style={styles.billToggle}>{open ? "Tutup" : "Lihat nota"}</Text>
                  </View>
                </Pressable>

                {open ? (
                  <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                    <View style={styles.divider} />
                    <SectionHeader title="Rincian" />
                    {!detail ? (
                      <Loading />
                    ) : (detail?.items || []).length === 0 ? (
                      <Text style={styles.muted}>Belum ada rincian item.</Text>
                    ) : (
                      (detail?.items || []).map((it: any) => (
                        <View key={it.id} style={styles.itemRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemName}>{it.service_name}</Text>
                            <Text style={styles.muted}>{Number(it.qty)} {it.unit} × {rupiah(Number(it.price))}</Text>
                          </View>
                          <Text style={styles.itemSub}>{rupiah(Number(it.subtotal))}</Text>
                        </View>
                      ))
                    )}
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Total</Text>
                      <Text style={styles.totalValue}>{rupiah(total)}</Text>
                    </View>

                    {needApproval ? (
                      <PrimaryButton
                        label="Setujui Nota"
                        icon="check-decagram"
                        onPress={() => approve.mutate(o.id)}
                        loading={approve.isPending}
                        testID={`approve-${o.id}`}
                      />
                    ) : null}

                    <Text style={styles.label}>Metode Pembayaran</Text>
                    <View style={styles.methodRow}>
                      {METHODS.map((m) => {
                        const on = method === m.key;
                        const disabled = m.key === "coin" && coin < coinCharge;
                        return (
                          <Pressable
                            key={m.key}
                            testID={`method-${m.key}`}
                            disabled={disabled}
                            onPress={() => { setMethod(m.key); setError(""); }}
                            style={[styles.methodCard, on && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }, disabled && { opacity: 0.45 }]}
                          >
                            <Icon name={m.icon} size={20} color={on ? colors.brandPrimary : colors.muted} />
                            <Text style={[styles.methodLabel, on && { color: colors.brandPrimary }]}>{m.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {method === "coin" ? (
                      <View style={styles.note}>
                        <Icon name="information-outline" size={16} color={colors.brand} />
                        <Text style={styles.noteText}>
                          Diskon 10% = {rupiah(total - coinCharge)}. Coin terpakai {coinCharge.toLocaleString("id-ID")} dari {coin.toLocaleString("id-ID")}.
                        </Text>
                      </View>
                    ) : method === "qris" ? (
                      <View style={styles.note}>
                        <Icon name="qrcode-scan" size={16} color={colors.brand} />
                        <Text style={styles.noteText}>Scan QRIS Jadiwangi di outlet / minta ke kasir, lalu tekan Bayar Sekarang.</Text>
                      </View>
                    ) : (
                      <View style={styles.note}>
                        <Icon name="cash" size={16} color={colors.brand} />
                        <Text style={styles.noteText}>Bayar tunai saat laundry diambil atau diantar kurir.</Text>
                      </View>
                    )}

                    {error ? <Text style={styles.error} testID="pay-error">{error}</Text> : null}

                    <PrimaryButton
                      label={`Bayar Sekarang • ${rupiah(method === "coin" ? coinCharge : total)}`}
                      icon="check-circle"
                      onPress={() => pay.mutate(o.id)}
                      loading={pay.isPending}
                      testID={`pay-${o.id}`}
                    />
                  </View>
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.divider, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  headerTitle: { fontFamily: fonts.displayBold, fontSize: 22, color: c.onSurface },
  headerSub: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.brandPrimary },
  billHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  billCode: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurface },
  billMeta: { fontFamily: fonts.body, fontSize: 12, color: c.muted, marginTop: 2 },
  billTotal: { fontFamily: fonts.displayBold, fontSize: 16, color: c.onSurface },
  billToggle: { fontFamily: fonts.bodyBold, fontSize: 11, color: c.brandPrimary, marginTop: 2 },
  divider: { height: 1, backgroundColor: c.divider },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  itemName: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurface },
  itemSub: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurface },
  muted: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: c.divider, paddingTop: spacing.sm },
  totalLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurfaceSecondary },
  totalValue: { fontFamily: fonts.displayBold, fontSize: 18, color: c.brandPrimary },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurfaceSecondary },
  methodRow: { flexDirection: "row", gap: spacing.sm },
  methodCard: { flex: 1, alignItems: "center", gap: 6, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface },
  methodLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: c.onSurfaceSecondary, textAlign: "center" },
  note: { flexDirection: "row", gap: spacing.sm, backgroundColor: c.brandTertiary, borderRadius: radius.md, padding: spacing.md },
  noteText: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: c.onBrandTertiary, lineHeight: 17 },
  error: { fontFamily: fonts.bodyBold, fontSize: 12, color: c.error, textAlign: "center" },
}));
