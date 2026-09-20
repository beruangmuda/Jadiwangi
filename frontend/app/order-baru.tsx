import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Modal, TextInput, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, shadow, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { PrimaryButton, Loading, EmptyState, BodyText } from "@/src/components/ui";
import { rupiah, kg } from "@/src/format";

type Cart = Record<string, { service: any; qty: number }>;

const DELIVERY = [
  { key: "self", label: "Datang", icon: "storefront" },
  { key: "pickup", label: "Jemput", icon: "moped" },
  { key: "delivery", label: "Antar", icon: "truck-fast" },
];

export default function OrderBaru() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();

  const isCustomer = session?.role === "pelanggan";
  const outlets = session?.outlets || [];

  const [outletId, setOutletId] = useState<string>(
    isCustomer ? session?.customer?.outlet_id : session?.currentOutletId || outlets[0]?.id || ""
  );
  const [customer, setCustomer] = useState<any>(isCustomer ? session?.customer : null);
  const [cart, setCart] = useState<Cart>({});
  const [delivery, setDelivery] = useState("self");
  const [notes, setNotes] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [qrisOpen, setQrisOpen] = useState(false);
  const [payError, setPayError] = useState("");
  const [payMethod, setPayMethod] = useState<"cash" | "qris" | "emoney">("qris");
  const [speeds, setSpeeds] = useState<Record<string, "regular" | "express">>({});

  const { data: services, isLoading: loadingSvc } = useQuery({
    queryKey: ["services", outletId],
    queryFn: () => api.get(`/services?outlet_id=${outletId}`),
    enabled: !!outletId,
  });
  const { data: customers } = useQuery({
    queryKey: ["customers", search],
    queryFn: () => api.get(`/customers${search ? `?q=${encodeURIComponent(search)}` : ""}`),
    enabled: pickerOpen,
  });

  const priceOf = (svc: any) =>
    speeds[svc.id] === "express" && svc.price_express != null ? Number(svc.price_express) : Number(svc.price);

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    (services || []).forEach((s: any) => {
      (map[s.category] = map[s.category] || []).push(s);
    });
    return Object.entries(map);
  }, [services]);

  const total = useMemo(
    () => Object.values(cart).reduce((sum, c) => sum + priceOf(c.service) * c.qty, 0),
    [cart, speeds]
  );
  const totalKg = useMemo(
    () => Object.values(cart).reduce((s, c) => (c.service.unit === "kg" ? s + c.qty : s), 0),
    [cart]
  );

  const setSpeed = (svc: any, speed: "regular" | "express") => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSpeeds((p) => ({ ...p, [svc.id]: speed }));
  };

  const setQty = (svc: any, delta: number) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setCart((prev) => {
      const cur = prev[svc.id]?.qty || 0;
      const next = Math.max(0, cur + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[svc.id];
      else copy[svc.id] = { service: svc, qty: next };
      return copy;
    });
  };

  const create = useMutation({
    mutationFn: ({ paid, method }: { paid: boolean; method: string }) =>
      api.post("/orders", {
        customer_id: customer.id,
        outlet_id: outletId,
        delivery_type: delivery,
        notes,
        payment_status: paid ? "paid" : "unpaid",
        payment_method: method,
        created_by: session?.role || "owner",
        items: Object.values(cart).map((c) => ({
          service_id: c.service.id,
          service_name: speeds[c.service.id] === "express" ? `${c.service.name} (Express)` : c.service.name,
          unit: c.service.unit,
          qty: c.qty,
          price: priceOf(c.service),
        })),
      }),
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      setQrisOpen(false);
      router.back();
    },
    onError: (e: any) => {
      setPayError(e?.message || "Pembayaran gagal");
    },
  });

  const deposit = Number(customer?.deposit || 0);
  const canDeposit = deposit >= total && total > 0;

  useEffect(() => {
    setCart({});
    setSpeeds({});
  }, [outletId]);

  const canProceed = !!customer && !!outletId && Object.keys(cart).length > 0;
  const outletName = outlets.find((o) => o.id === outletId)?.name || session?.customer?.name || "Outlet";

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Buat Order</Text>
        <Pressable testID="close-order" onPress={() => router.back()} hitSlop={10} style={styles.closeBtn}>
          <Icon name="close" size={22} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160, gap: spacing.lg }}>
        {/* Outlet */}
        {!isCustomer && (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.label}>Outlet</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {outlets.map((o) => {
                const active = o.id === outletId;
                return (
                  <Pressable key={o.id} testID={`outlet-pick-${o.city}`} onPress={() => setOutletId(o.id)} style={[styles.outletChip, active && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                    <Text style={[styles.outletChipText, active && { color: colors.onBrandPrimary }]}>{o.name.replace("Jadiwangi ", "")}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Customer */}
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.label}>Pelanggan</Text>
          {isCustomer ? (
            <View style={styles.custBox}>
              <Icon name="account-heart" size={20} color={colors.brand} />
              <Text style={styles.custName}>{session?.customer?.name}</Text>
            </View>
          ) : (
            <Pressable testID="pick-customer" onPress={() => setPickerOpen(true)} style={styles.custBox}>
              <Icon name={customer ? "account-check" : "account-search"} size={20} color={colors.brand} />
              <Text style={[styles.custName, !customer && { color: colors.muted }]}>{customer ? customer.name : "Pilih pelanggan"}</Text>
              <Icon name="chevron-down" size={20} color={colors.muted} />
            </Pressable>
          )}
        </View>

        {/* Services */}
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.label}>Layanan</Text>
          {loadingSvc ? (
            <Loading />
          ) : (
            <View style={{ gap: spacing.lg }}>
              {grouped.map(([cat, list]) => (
                <View key={cat} style={{ gap: spacing.sm }}>
                  <Text style={styles.catHeader}>{cat}</Text>
                  {list.map((svc: any) => {
                    const qty = cart[svc.id]?.qty || 0;
                    const speed = speeds[svc.id] || "regular";
                    const hasExpress = svc.price_express != null;
                    const shownPrice = priceOf(svc);
                    const dur = speed === "express" && svc.duration_express ? svc.duration_express : svc.duration;
                    return (
                      <View key={svc.id} style={[styles.svcRow, qty > 0 && { borderColor: colors.brandPrimary }]}>
                        <View style={styles.svcIcon}>
                          <Icon name={svc.icon} size={20} color={colors.brand} />
                        </View>
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={styles.svcName}>{svc.name}</Text>
                          <Text style={styles.svcPrice}>
                            {rupiah(shownPrice)}/{svc.unit}
                            {svc.min_kg ? ` • min ${Number(svc.min_kg)} kg` : ""}
                            {dur ? ` • ${dur}` : ""}
                          </Text>
                          {hasExpress ? (
                            <View style={styles.speedRow}>
                              {(["regular", "express"] as const).map((sp) => {
                                const on = speed === sp;
                                return (
                                  <Pressable
                                    key={sp}
                                    testID={`speed-${svc.id}-${sp}`}
                                    onPress={() => setSpeed(svc, sp)}
                                    style={[styles.speedPill, on && { backgroundColor: sp === "express" ? colors.error : colors.brandPrimary, borderColor: sp === "express" ? colors.error : colors.brandPrimary }]}
                                  >
                                    <Text style={[styles.speedText, on && { color: colors.onBrandPrimary }]}>
                                      {sp === "express" ? "Express" : "Reguler"}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          ) : null}
                        </View>
                        {qty > 0 ? (
                          <View style={styles.stepper}>
                            <Pressable testID={`minus-${svc.id}`} onPress={() => setQty(svc, -1)} style={styles.stepBtn}>
                              <Icon name="minus" size={18} color={colors.onBrandPrimary} />
                            </Pressable>
                            <Text style={styles.qty}>{qty}</Text>
                            <Pressable testID={`plus-${svc.id}`} onPress={() => setQty(svc, 1)} style={styles.stepBtn}>
                              <Icon name="plus" size={18} color={colors.onBrandPrimary} />
                            </Pressable>
                          </View>
                        ) : (
                          <Pressable testID={`add-${svc.id}`} onPress={() => setQty(svc, 1)} style={styles.addBtn}>
                            <Icon name="plus" size={20} color={colors.brandPrimary} />
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Delivery */}
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.label}>Pengambilan</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {DELIVERY.map((d) => {
              const active = d.key === delivery;
              return (
                <Pressable key={d.key} testID={`delivery-${d.key}`} onPress={() => setDelivery(d.key)} style={[styles.delBtn, active && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                  <Icon name={d.icon} size={18} color={active ? colors.onBrandPrimary : colors.brand} />
                  <Text style={[styles.delText, active && { color: colors.onBrandPrimary }]}>{d.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Notes */}
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.label}>Catatan (opsional)</Text>
          <TextInput
            testID="notes-input"
            value={notes}
            onChangeText={setNotes}
            placeholder="Contoh: pisahkan pakaian putih"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>
      </ScrollView>

      {/* Sticky total bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.totalLabel}>{totalKg > 0 ? kg(totalKg) : `${Object.keys(cart).length} item`}</Text>
          <Text style={styles.totalValue}>{rupiah(total)}</Text>
        </View>
        <PrimaryButton label="Lanjut Bayar" icon="arrow-right-bold" onPress={() => { setPayError(""); setQrisOpen(true); }} disabled={!canProceed} testID="proceed-payment" style={{ flex: 1 }} />
      </View>

      {/* Customer picker */}
      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + spacing.md, maxHeight: "80%" }]}>
            <View style={styles.pickerHead}>
              <Text style={styles.pickerTitle}>Pilih Pelanggan</Text>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={10}><Icon name="close" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <View style={styles.searchBox}>
              <Icon name="magnify" size={20} color={colors.muted} />
              <TextInput testID="customer-search" value={search} onChangeText={setSearch} placeholder="Cari nama / no HP" placeholderTextColor={colors.muted} style={styles.searchInput} />
            </View>
            <ScrollView contentContainerStyle={{ gap: spacing.xs, paddingTop: spacing.sm }}>
              {(customers || []).map((c: any) => (
                <Pressable key={c.id} testID={`cust-opt-${c.id}`} onPress={() => { setCustomer(c); setPickerOpen(false); }} style={styles.custOpt}>
                  <View style={styles.custAvatar}><Text style={styles.custInitial}>{c.name?.[0]}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.svcName}>{c.name}</Text>
                    <Text style={styles.svcPrice}>{c.phone}</Text>
                  </View>
                </Pressable>
              ))}
              {(customers || []).length === 0 ? <EmptyState icon="account-off" title="Tidak ditemukan" /> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* QRIS sheet */}
      <Modal visible={qrisOpen} animationType="slide" transparent onRequestClose={() => setQrisOpen(false)}>
        <View style={styles.qrisOverlay}>
          <View style={[styles.qrisSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.grabber} />
            <Text style={styles.qrisTitle}>Pembayaran QRIS</Text>
            <Text style={styles.qrisSub}>{outletName}</Text>
            <View style={styles.qrBox}>
              <Icon name="qrcode" size={180} color={colors.onSurface} />
              <View style={styles.qrisLogo}><Text style={styles.qrisLogoText}>QRIS</Text></View>
            </View>
            <Text style={styles.qrisAmount}>{rupiah(total)}</Text>
            <View style={styles.payMethodRow}>
              {([["cash", "Tunai", "cash"], ["qris", "QRIS", "qrcode"], ["emoney", "E-Money", "wallet"]] as const).map(([key, label, icon]) => {
                const on = payMethod === key;
                return (
                  <Pressable key={key} testID={`paymethod-${key}`} onPress={() => setPayMethod(key)} style={[styles.payMethodBtn, on && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                    <Icon name={icon} size={18} color={on ? colors.onBrandPrimary : colors.brand} />
                    <Text style={[styles.payMethodText, on && { color: colors.onBrandPrimary }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <BodyText muted style={{ textAlign: "center" }}>
              {payMethod === "qris" ? "Scan QR di atas dengan e-wallet / m-banking, lalu konfirmasi." : payMethod === "cash" ? "Terima pembayaran tunai, lalu konfirmasi." : "Terima pembayaran e-money, lalu konfirmasi."}
            </BodyText>
            {payError ? <Text style={styles.payError} testID="pay-error">{payError}</Text> : null}
            <PrimaryButton label="Konfirmasi Sudah Bayar" icon="check-decagram" onPress={() => { setPayError(""); create.mutate({ paid: true, method: payMethod }); }} loading={create.isPending} testID="confirm-paid" />
            {canDeposit ? (
              <PrimaryButton label={`Bayar dari Deposit (${rupiah(deposit)})`} icon="wallet" tone="lavender" onPress={() => { setPayError(""); create.mutate({ paid: true, method: "deposit" }); }} loading={create.isPending} testID="pay-deposit" />
            ) : deposit > 0 ? (
              <Text style={styles.depositNote}>Saldo deposit {rupiah(deposit)} • tidak cukup untuk order ini</Text>
            ) : null}
            <Pressable testID="pay-later" onPress={() => { setPayError(""); create.mutate({ paid: false, method: "qris" }); }} style={styles.later}>
              <Text style={styles.laterText}>Simpan, Bayar Nanti</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  title: { fontFamily: fonts.displayBold, fontSize: 20, color: c.onSurface },
  closeBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurfaceSecondary },
  outletChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  outletChipText: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurfaceSecondary },
  custBox: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md },
  custName: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurface },
  svcRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md },
  catHeader: { fontFamily: fonts.displayBold, fontSize: 14, color: c.brand, textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.xs },
  speedRow: { flexDirection: "row", gap: 6, marginTop: 2 },
  speedPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  speedText: { fontFamily: fonts.bodyBold, fontSize: 11, color: c.onSurfaceSecondary },
  svcIcon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  svcName: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurface },
  svcPrice: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  addBtn: { width: 40, height: 40, borderRadius: radius.sm, borderWidth: 1.5, borderColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stepBtn: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  qty: { fontFamily: fonts.displayBold, fontSize: 16, color: c.onSurface, minWidth: 24, textAlign: "center" },
  delBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  delText: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurfaceSecondary },
  input: { backgroundColor: c.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 13, fontFamily: fonts.body, fontSize: 14, color: c.onSurface },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border, paddingHorizontal: spacing.lg, paddingTop: spacing.md, ...shadow.soft },
  totalLabel: { fontFamily: fonts.bodySemi, fontSize: 12, color: c.muted },
  totalValue: { fontFamily: fonts.displayBold, fontSize: 22, color: c.onSurface },
  pickerOverlay: { flex: 1, backgroundColor: "rgba(30,26,52,0.45)", justifyContent: "flex-end" },
  pickerSheet: { backgroundColor: c.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  pickerHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  pickerTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: c.onSurface },
  searchBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, paddingVertical: 12, fontFamily: fonts.body, fontSize: 14, color: c.onSurface },
  custOpt: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: c.surfaceSecondary },
  custAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.brand, alignItems: "center", justifyContent: "center" },
  custInitial: { fontFamily: fonts.displayBold, fontSize: 16, color: c.onBrand },
  qrisOverlay: { flex: 1, backgroundColor: "rgba(30,26,52,0.55)", justifyContent: "flex-end" },
  qrisSheet: { backgroundColor: c.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, alignItems: "center", gap: spacing.md },
  grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: c.border, marginBottom: spacing.sm },
  qrisTitle: { fontFamily: fonts.displayBold, fontSize: 20, color: c.onSurface },
  qrisSub: { fontFamily: fonts.body, fontSize: 13, color: c.muted },
  qrBox: { width: 220, height: 220, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 2, borderColor: c.border, alignItems: "center", justifyContent: "center", marginVertical: spacing.sm },
  qrisLogo: { position: "absolute", backgroundColor: c.surface, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  qrisLogoText: { fontFamily: fonts.displayBold, fontSize: 16, color: c.error },
  qrisAmount: { fontFamily: fonts.displayBold, fontSize: 28, color: c.brandPrimary },
  payMethodRow: { flexDirection: "row", gap: spacing.sm, alignSelf: "stretch" },
  payMethodBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  payMethodText: { fontFamily: fonts.bodyBold, fontSize: 12, color: c.onSurfaceSecondary },
  later: { paddingVertical: spacing.sm },
  laterText: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.muted },
  payError: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.error, textAlign: "center" },
  depositNote: { fontFamily: fonts.body, fontSize: 12, color: c.muted, textAlign: "center" },
}));
