import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, Platform, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { Card, SectionHeader, Loading, EmptyState, PrimaryButton } from "@/src/components/ui";
import { rupiah, formatDateTime } from "@/src/format";
import { photoUrl } from "@/src/photos";
import { Image } from "expo-image";


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
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<any>(null);
  const [promoError, setPromoError] = useState("");

  const { data: bills, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["bills", customerId],
    queryFn: () => api.get(`/orders?customer_id=${customerId}&unpaid=true&limit=50`),
    enabled: !!customerId,
    refetchInterval: 15000,
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
    mutationFn: (oid: string) => api.post(`/orders/${oid}/pay`, { method, promo_code: promo?.code || null }),
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setOpenId(null); setError(""); setPromo(null); setPromoInput(""); setPromoError("");
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      qc.invalidateQueries({ queryKey: ["cust-detail"] });
    },
    onError: (e: any) => setError(e?.message || "Pembayaran gagal"),
  });

  const checkPromo = useMutation({
    mutationFn: () => api.get(`/promos/validate?code=${encodeURIComponent(promoInput.trim())}&outlet_id=${cust?.outlet_id}`),
    onSuccess: (p: any) => { setPromo(p); setPromoError(""); },
    onError: (e: any) => { setPromo(null); setPromoError(e?.message || "Kode promo tidak valid"); },
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
          <>
            <View style={styles.notif} testID="weighed-notif">
              <View style={styles.notifIcon}><Icon name="scale-balance" size={22} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitle}>{list.length} nota sudah ditimbang</Text>
                <Text style={styles.notifSub}>Pegawai Jadiwangi Laundry sudah menimbang laundrymu. Pilih cara bayar di bawah.</Text>
              </View>
            </View>
            {list.map((o: any) => {
            const open = openId === o.id;
            const total = Number(o.total);
            const promoCut = promo ? Math.round(total * Number(promo.discount_pct) / 100) : 0;
            const afterPromo = Math.max(0, total - promoCut);
            const coinCharge = Math.round(afterPromo * 0.9);
            const coinEnough = coin >= coinCharge;
            return (
              <Card key={o.id}>
                <Pressable
                  testID={`bill-${o.id}`}
                  onPress={() => { setOpenId(open ? null : o.id); setError(""); setPromo(null); setPromoInput(""); setPromoError(""); }}
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

                    {Array.isArray(detail?.photos) && detail.photos.length ? (
                      <View style={{ gap: spacing.sm }} testID="bill-photos">
                        <Text style={styles.label}>Foto Pakaian dari Pegawai</Text>
                        <View style={styles.photoRow}>
                          {detail.photos.map((p: string) => (
                            <Image key={p} source={{ uri: photoUrl(p) }} style={styles.photo} contentFit="cover" />
                          ))}
                        </View>
                      </View>
                    ) : null}

                    {/* Kode promo */}
                    <View style={{ gap: spacing.sm }}>
                      <Text style={styles.label}>Kode Promo</Text>
                      {promo ? (
                        <View style={styles.promoApplied} testID="promo-applied">
                          <Icon name="ticket-percent" size={18} color="#15803D" />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.promoAppliedTitle}>{promo.code} • -{Number(promo.discount_pct)}%</Text>
                            <Text style={styles.promoAppliedSub}>{promo.title} • potongan {rupiah(promoCut)}</Text>
                          </View>
                          <Pressable testID="promo-remove" onPress={() => { setPromo(null); setPromoInput(""); }} hitSlop={8}>
                            <Icon name="close-circle" size={20} color="#15803D" />
                          </Pressable>
                        </View>
                      ) : (
                        <>
                          <View style={styles.promoRow}>
                            <TextInput
                              testID="promo-input"
                              value={promoInput}
                              onChangeText={(t) => { setPromoInput(t.toUpperCase()); setPromoError(""); }}
                              placeholder="Masukkan kode promo"
                              placeholderTextColor={colors.muted}
                              autoCapitalize="characters"
                              style={styles.promoField}
                            />
                            <Pressable
                              testID="promo-apply"
                              disabled={promoInput.trim().length < 3 || checkPromo.isPending}
                              onPress={() => checkPromo.mutate()}
                              style={[styles.promoBtn, (promoInput.trim().length < 3 || checkPromo.isPending) && { opacity: 0.5 }]}
                            >
                              <Text style={styles.promoBtnText}>{checkPromo.isPending ? "Cek…" : "Pakai"}</Text>
                            </Pressable>
                          </View>
                          {promoError ? <Text style={styles.error} testID="promo-error">{promoError}</Text> : null}
                        </>
                      )}
                    </View>

                    <Text style={styles.label}>Pilih Cara Bayar</Text>

                    {/* Opsi 1 — JW Coin diskon 10% */}
                    <Pressable
                      testID={`method-coin-${o.id}`}
                      disabled={!coinEnough}
                      onPress={() => { setMethod("coin"); setError(""); }}
                      style={[styles.optCard, method === "coin" && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }, !coinEnough && { opacity: 0.5 }]}
                    >
                      <View style={[styles.optIcon, { backgroundColor: colors.brandPrimary }]}>
                        <Icon name="hand-coin" size={22} color={colors.onBrandPrimary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                          <Text style={styles.optTitle}>Bayar pakai JW Coin</Text>
                          <View style={styles.discBadge}><Text style={styles.discText}>-10%</Text></View>
                        </View>
                        <Text style={styles.optTotal}>{rupiah(coinCharge)}</Text>
                        <Text style={styles.muted}>
                          {coinEnough
                            ? `Hemat ${rupiah(afterPromo - coinCharge)}${promoCut ? ` + promo ${rupiah(promoCut)}` : ""} • Saldo ${coin.toLocaleString("id-ID")} coin`
                            : `Saldo coin kurang (punya ${coin.toLocaleString("id-ID")})`}
                        </Text>
                      </View>
                      <Icon name={method === "coin" ? "radiobox-marked" : "radiobox-blank"} size={20} color={method === "coin" ? colors.brandPrimary : colors.muted} />
                    </Pressable>

                    {/* Opsi 2 — QRIS / Cash */}
                    <Pressable
                      testID={`method-qriscash-${o.id}`}
                      onPress={() => { setMethod(method === "cash" ? "cash" : "qris"); setError(""); }}
                      style={[styles.optCard, method !== "coin" && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}
                    >
                      <View style={[styles.optIcon, { backgroundColor: colors.brand }]}>
                        <Icon name="qrcode-scan" size={22} color={colors.onBrand} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.optTitle}>Bayar QRIS / Cash</Text>
                        <Text style={styles.optTotal}>{rupiah(afterPromo)}</Text>
                        <Text style={styles.muted}>{promoCut ? `Sudah termasuk promo ${rupiah(promoCut)}` : "Bayar di outlet atau ke kurir, tanpa diskon"}</Text>
                      </View>
                      <Icon name={method !== "coin" ? "radiobox-marked" : "radiobox-blank"} size={20} color={method !== "coin" ? colors.brandPrimary : colors.muted} />
                    </Pressable>

                    {method !== "coin" ? (
                      <View style={styles.methodRow}>
                        {[{ key: "qris", label: "QRIS", icon: "qrcode-scan" }, { key: "cash", label: "Tunai", icon: "cash" }].map((m) => {
                          const on = method === m.key;
                          return (
                            <Pressable
                              key={m.key}
                              testID={`method-${m.key}`}
                              onPress={() => { setMethod(m.key); setError(""); }}
                              style={[styles.methodCard, on && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}
                            >
                              <Icon name={m.icon} size={18} color={on ? colors.brandPrimary : colors.muted} />
                              <Text style={[styles.methodLabel, on && { color: colors.brandPrimary }]}>{m.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}

                    <View style={styles.note}>
                      <Icon name="information-outline" size={16} color={colors.brand} />
                      <Text style={styles.noteText}>
                        {method === "coin"
                          ? `Coin terpakai ${coinCharge.toLocaleString("id-ID")} dari ${coin.toLocaleString("id-ID")} coin.`
                          : method === "qris"
                            ? "Scan QRIS Jadiwangi di outlet atau minta ke kasir, lalu tekan Bayar Sekarang."
                            : "Bayar tunai diawal atau setelah pakaian ditimbang."}
                      </Text>
                    </View>

                    {error ? <Text style={styles.error} testID="pay-error">{error}</Text> : null}

                    <PrimaryButton
                      label={`Bayar Sekarang • ${rupiah(method === "coin" ? coinCharge : afterPromo)}`}
                      icon="check-circle"
                      onPress={() => pay.mutate(o.id)}
                      loading={pay.isPending}
                      testID={`pay-${o.id}`}
                    />
                  </View>
                ) : null}
              </Card>
            );
            })}
          </>
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
  notif: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.brandTertiary, borderRadius: radius.lg, borderWidth: 1.5, borderColor: c.brandPrimary, padding: spacing.md },
  notifIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  notifTitle: { fontFamily: fonts.displayBold, fontSize: 15, color: c.onBrandTertiary },
  notifSub: { fontFamily: fonts.body, fontSize: 12, color: c.onBrandTertiary, marginTop: 2, lineHeight: 17 },
  optCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface },
  optIcon: { width: 44, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  optTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurface },
  optTotal: { fontFamily: fonts.displayBold, fontSize: 18, color: c.brandPrimary, marginTop: 2 },
  discBadge: { backgroundColor: "#DCFCE7", borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  discText: { fontFamily: fonts.bodyBold, fontSize: 11, color: "#15803D" },
  promoRow: { flexDirection: "row", gap: spacing.sm },
  promoField: { flex: 1, height: 46, borderRadius: radius.md, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface, paddingHorizontal: spacing.md, fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurface },
  promoBtn: { paddingHorizontal: spacing.lg, height: 46, borderRadius: radius.md, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  promoBtnText: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onBrandPrimary },
  promoApplied: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "#DCFCE7", borderRadius: radius.md, padding: spacing.md },
  promoAppliedTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: "#15803D" },
  promoAppliedSub: { fontFamily: fonts.body, fontSize: 12, color: "#15803D", marginTop: 1 },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  photo: { width: 84, height: 84, borderRadius: radius.md },
}));
