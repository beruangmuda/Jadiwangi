import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Modal, TextInput, Platform, Alert, LayoutAnimation, UIManager, Linking } from "react-native";
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
import { saveCustomerDeviceContact } from "@/src/deviceContacts";
import { buildReceiptWhatsAppUrl } from "@/src/whatsapp";

type Cart = Record<string, { service: any; qty: number }>;

const DELIVERY = [
  { key: "self", label: "Datang", icon: "storefront" },
  { key: "pickup", label: "Jemput", icon: "moped" },
  { key: "delivery", label: "Antar", icon: "truck-fast" },
];
const PAYMENT_LABELS: Record<string, string> = { cash: "Tunai", qris: "QRIS", emoney: "E-Money", deposit: "Deposit" };

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
  const [newCustomer, setNewCustomer] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: "", phone: "", address: "" });
  const [customerError, setCustomerError] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({ Kiloan: true });
  const [qrisOpen, setQrisOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<any>(null);
  const [payError, setPayError] = useState("");
  const [payMethod, setPayMethod] = useState<"cash" | "qris" | "emoney">("qris");
  const [speeds, setSpeeds] = useState<Record<string, "regular" | "express">>({});

  const { data: services, isLoading: loadingSvc } = useQuery({
    queryKey: ["services", outletId],
    queryFn: () => api.get(`/services?outlet_id=${outletId}`),
    enabled: !!outletId,
  });
  const { data: customers } = useQuery({
    queryKey: ["customers", outletId, search],
    queryFn: () => api.get(`/customers?outlet_id=${outletId}${search ? `&q=${encodeURIComponent(search)}` : ""}`),
    enabled: pickerOpen,
  });

  const createCustomer = useMutation({
    mutationFn: () => api.post("/customers", { ...newCustomerForm, outlet_id: outletId }),
    onSuccess: async (created) => {
      const contact = await saveCustomerDeviceContact(created.name, created.phone, created.address);
      const notice = contact === "saved"
        ? "Pelanggan dan kontak ponsel berhasil disimpan."
        : contact === "denied"
          ? "Pelanggan tersimpan. Izin kontak belum diberikan, sehingga kontak ponsel tidak dibuat."
          : "Pelanggan tersimpan dan siap dikirimi nota WhatsApp.";
      setCustomer(created);
      setNewCustomerForm({ name: "", phone: "", address: "" });
      setNewCustomer(false);
      setPickerOpen(false);
      setCustomerError("");
      qc.invalidateQueries({ queryKey: ["customers"] });
      Alert.alert("Pelanggan tersimpan", notice);
    },
    onError: async (e: any) => {
      const message = e?.message || "Pelanggan belum dapat disimpan";
      if (message.includes("sudah terdaftar")) {
        try {
          const existing = await api.get(`/customers?outlet_id=${outletId}&q=${encodeURIComponent(newCustomerForm.phone)}`);
          if (existing?.[0]) {
            setCustomer(existing[0]);
            setNewCustomer(false);
            setPickerOpen(false);
            setCustomerError("");
            Alert.alert("Pelanggan sudah ada", "Data pelanggan lama dipilih agar tidak terjadi nomor WhatsApp ganda.");
            return;
          }
        } catch { /* tampilkan pesan awal bila pencarian fallback gagal */ }
      }
      setCustomerError(message);
    },
  });

  const priceOf = useCallback((svc: any) =>
    speeds[svc.id] === "express" && svc.price_express != null ? Number(svc.price_express) : Number(svc.price), [speeds]);

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    (services || []).forEach((s: any) => {
      (map[s.category] = map[s.category] || []).push(s);
    });
    return Object.entries(map);
  }, [services]);

  const total = useMemo(
    () => Object.values(cart).reduce((sum, c) => sum + priceOf(c.service) * c.qty, 0),
    [cart, priceOf]
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
      const min = svc.unit === "kg" && Number(svc.min_kg) > 0 ? Number(svc.min_kg) : 1;
      const next = delta > 0 ? (cur === 0 ? min : cur + delta) : (cur <= min ? 0 : cur + delta);
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
        express: Object.values(cart).some((c) => speeds[c.service.id] === "express"),
        items: Object.values(cart).map((c) => ({
          service_id: c.service.id,
          service_name: speeds[c.service.id] === "express" ? `${c.service.name} (Express)` : c.service.name,
          unit: c.service.unit,
          qty: c.qty,
          price: priceOf(c.service),
        })),
      }),
    onSuccess: (createdOrder: any, variables) => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      setQrisOpen(false);
      if (variables.paid) setReceiptOrder({ ...createdOrder, receipt_method: variables.method });
      else router.back();
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

  useEffect(() => {
    if (Platform.OS === "android") UIManager.setLayoutAnimationEnabledExperimental?.(true);
  }, []);

  const toggleCategory = (category: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const canProceed = !!customer && !!outletId && Object.keys(cart).length > 0;
  const outletName = outlets.find((o) => o.id === outletId)?.name || session?.customer?.name || "Outlet";
  const receiptUrl = receiptOrder ? buildReceiptWhatsAppUrl({
    phone: receiptOrder.customer_phone || customer?.phone,
    code: receiptOrder.code,
    customerName: receiptOrder.customer_name || customer?.name || "Pelanggan",
    itemLines: Object.values(cart).map((c) => `• ${c.service.name}${speeds[c.service.id] === "express" ? " (Express)" : ""} ${c.qty} ${c.service.unit}: ${rupiah(priceOf(c.service) * c.qty)}`),
    total: rupiah(receiptOrder.total),
    payment: `Lunas via ${PAYMENT_LABELS[receiptOrder.receipt_method || receiptOrder.payment_method] || "Pembayaran"}`,
    status: receiptOrder.stage_label || "Diterima",
  }) : null;
  const finishReceipt = () => { setReceiptOrder(null); router.back(); };

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
                  <Pressable testID={`cat-accordion-${cat}`} onPress={() => toggleCategory(cat)} style={styles.catHeader}>
                    <View style={styles.catTitleRow}>
                      <Icon name={expandedCategories[cat] ? "chevron-up" : "chevron-down"} size={20} color={colors.brand} />
                      <Text style={styles.catTitle}>{cat}</Text>
                    </View>
                    <Text style={styles.catCount}>{list.length} layanan</Text>
                  </Pressable>
                  {expandedCategories[cat] ? list.map((svc: any) => {
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
                          <Pressable testID={`service-card-${svc.id}`} onPress={() => setQty(svc, 1)} style={styles.serviceSelect}>
                            <Text style={styles.svcName}>{svc.name}</Text>
                            <Text style={styles.svcPrice}>{rupiah(shownPrice)}/{svc.unit}{dur ? ` • ${dur}` : ""}</Text>
                            {svc.min_kg ? <Text style={styles.minBadge}>Minimal {Number(svc.min_kg)} kg</Text> : null}
                          </Pressable>
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
                            <Text testID={`service-qty-${svc.id}`} style={styles.qty}>{qty}</Text>
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
                  }) : null}
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
        <View style={styles.pickerOverlay} pointerEvents="box-none">
          <View collapsable={false} style={[styles.pickerSheet, { paddingBottom: insets.bottom + spacing.md, flex: 1, maxHeight: "80%" }]}>
            <View style={styles.pickerHead}>
              <Text style={styles.pickerTitle}>Pilih Pelanggan</Text>
              <Pressable testID="close-customer-picker" onPress={() => setPickerOpen(false)} hitSlop={10}><Icon name="close" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <View style={{ flex: 1 }}>
            {newCustomer ? (
              <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md, paddingTop: spacing.sm }}>
                <View style={styles.newCustomerNotice}><Icon name="contacts" size={20} color={colors.brand} /><Text style={styles.newCustomerNoticeText}>Simpan nomor WhatsApp agar bukti nota mudah dikirim. Kontak ponsel dibuat setelah izin diberikan.</Text></View>
                <View style={{ gap: spacing.xs }}><Text style={styles.fieldLabel}>Nama pelanggan</Text><TextInput testID="input-new-cust-name" value={newCustomerForm.name} onChangeText={(name) => setNewCustomerForm({ ...newCustomerForm, name })} placeholder="Nama lengkap" placeholderTextColor={colors.muted} style={styles.input} /></View>
                <View style={{ gap: spacing.xs }}><Text style={styles.fieldLabel}>Nomor WhatsApp</Text><TextInput testID="input-new-cust-phone" value={newCustomerForm.phone} onChangeText={(phone) => setNewCustomerForm({ ...newCustomerForm, phone })} placeholder="0812 3456 7890" placeholderTextColor={colors.muted} keyboardType="phone-pad" style={styles.input} /></View>
                <View style={{ gap: spacing.xs }}><Text style={styles.fieldLabel}>Alamat (opsional)</Text><TextInput testID="input-new-cust-address" value={newCustomerForm.address} onChangeText={(address) => setNewCustomerForm({ ...newCustomerForm, address })} placeholder="Alamat pelanggan" placeholderTextColor={colors.muted} multiline style={[styles.input, styles.addressInput]} /></View>
                {customerError ? <Text testID="new-customer-error" style={styles.customerError}>{customerError}</Text> : null}
                <View style={styles.newCustomerActions}>
                  <Pressable testID="cancel-new-customer" onPress={() => { setNewCustomer(false); setCustomerError(""); }} style={styles.cancelNewCustomer}><Text style={styles.cancelNewCustomerText}>Kembali</Text></Pressable>
                  <PrimaryButton label="Simpan Pelanggan" icon="account-plus" onPress={() => createCustomer.mutate()} loading={createCustomer.isPending} disabled={!newCustomerForm.name.trim() || !newCustomerForm.phone.trim()} testID="btn-save-new-customer" style={{ flex: 1 }} />
                </View>
              </ScrollView>
            ) : <View style={{ flex: 1 }}>
              <View style={styles.searchBox}><Icon name="magnify" size={20} color={colors.muted} /><TextInput testID="customer-search" value={search} onChangeText={setSearch} placeholder="Cari nama / no HP" placeholderTextColor={colors.muted} style={styles.searchInput} /></View>
              <Pressable testID="btn-new-customer" onPress={() => { setNewCustomer(true); setCustomerError(""); }} style={styles.newCustomerBtn}><Icon name="account-plus" size={20} color={colors.onBrandPrimary} /><Text style={styles.newCustomerBtnText}>Pelanggan Baru</Text></Pressable>
              <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.xs, paddingTop: spacing.sm }}>
                {(customers || []).map((c: any) => <Pressable key={c.id} testID={`cust-opt-${c.id}`} onPress={() => { setCustomer(c); setPickerOpen(false); }} style={styles.custOpt}><View style={styles.custAvatar}><Text style={styles.custInitial}>{c.name?.[0]}</Text></View><View style={{ flex: 1 }}><Text style={styles.svcName}>{c.name}</Text><Text style={styles.svcPrice}>{c.phone}</Text></View></Pressable>)}
                {(customers || []).length === 0 ? <EmptyState icon="account-off" title="Tidak ditemukan" /> : null}
              </ScrollView>
            </View>}
            </View>
          </View>
        </View>
      </Modal>

      {/* QRIS sheet */}
      <Modal visible={qrisOpen} animationType="slide" transparent onRequestClose={() => setQrisOpen(false)}>
        <View style={styles.qrisOverlay} pointerEvents="box-none">
          <View collapsable={false} style={[styles.qrisSheet, { paddingBottom: insets.bottom + spacing.lg, flex: 1, maxHeight: "80%" }]}>
            <View style={styles.grabber} />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.paymentContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.qrisTitle}>Pembayaran</Text>
            <Text style={styles.qrisSub}>{outletName}</Text>
            {payMethod === "qris" ? <View style={styles.qrBox}><Icon name="qrcode" size={180} color={colors.onSurface} /><View style={styles.qrisLogo}><Text style={styles.qrisLogoText}>QRIS</Text></View></View> : <View style={styles.paymentVisual}><Icon name={payMethod === "cash" ? "cash" : "wallet"} size={58} color={colors.brandPrimary} /><Text style={styles.paymentVisualText}>{PAYMENT_LABELS[payMethod]}</Text></View>}
            <Text style={styles.qrisAmount}>{rupiah(total)}</Text>
            <View style={[styles.payMethodRow, { width: "100%" }]}>
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
            </ScrollView>
            <View style={styles.paymentActions}>
            <PrimaryButton label="Konfirmasi Sudah Bayar" icon="check-decagram" onPress={() => { setPayError(""); create.mutate({ paid: true, method: payMethod }); }} loading={create.isPending} testID="confirm-paid" />
            {canDeposit ? (
              <PrimaryButton label={`Bayar dari Deposit (${rupiah(deposit)})`} icon="wallet" tone="lavender" onPress={() => { setPayError(""); create.mutate({ paid: true, method: "deposit" }); }} loading={create.isPending} testID="pay-deposit" />
            ) : deposit > 0 ? (
              <Text style={styles.depositNote}>Saldo deposit {rupiah(deposit)} • tidak cukup untuk order ini</Text>
            ) : null}
            <Pressable testID="cancel-payment" onPress={() => { setPayError(""); setQrisOpen(false); }} style={styles.cancelPayment}>
              <Icon name="close-circle-outline" size={18} color={colors.error} />
              <Text style={styles.cancelPaymentText}>Batal Transaksi</Text>
            </Pressable>
            <Pressable testID="pay-later" onPress={() => { setPayError(""); create.mutate({ paid: false, method: "qris" }); }} style={styles.later}>
              <Text style={styles.laterText}>Simpan, Bayar Nanti</Text>
            </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!receiptOrder} animationType="slide" transparent onRequestClose={finishReceipt}>
        <View style={styles.qrisOverlay} pointerEvents="box-none">
          <View collapsable={false} style={[styles.qrisSheet, { paddingBottom: insets.bottom + spacing.lg, flex: 1, maxHeight: "80%" }]}>
            <View style={styles.grabber} />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.receiptContent} keyboardShouldPersistTaps="handled">
            <View style={styles.receiptSuccessIcon}><Icon name="check-decagram" size={38} color="#15803D" /></View>
            <Text style={styles.qrisTitle}>Pembayaran Berhasil</Text>
            <Text testID="payment-success" style={styles.qrisSub}>Nota {receiptOrder?.code} sudah lunas via {PAYMENT_LABELS[receiptOrder?.receipt_method || receiptOrder?.payment_method] || "pembayaran"}. Kirimkan struk sekarang agar pelanggan tidak lupa menerima bukti pembayaran.</Text>
            </ScrollView>
            <View style={styles.paymentActions}>
            <PrimaryButton label="Kirim Struk via WhatsApp" icon="whatsapp" tone="lavender" onPress={() => { if (receiptUrl) Linking.openURL(receiptUrl); }} disabled={!receiptUrl} testID="btn-send-whatsapp-receipt" />
            <Pressable testID="receipt-finish" onPress={finishReceipt} style={styles.later}><Text style={styles.laterText}>Selesai</Text></Pressable>
            </View>
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
  catHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: c.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 13, marginTop: spacing.xs },
  catTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  catTitle: { fontFamily: fonts.displayBold, fontSize: 14, color: c.brand, textTransform: "uppercase", letterSpacing: 0.5 },
  catCount: { fontFamily: fonts.bodySemi, fontSize: 12, color: c.muted },
  speedRow: { flexDirection: "row", gap: 6, marginTop: 2 },
  speedPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  speedText: { fontFamily: fonts.bodyBold, fontSize: 11, color: c.onSurfaceSecondary },
  svcIcon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  svcName: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurface },
  svcPrice: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  serviceSelect: { minHeight: 44, justifyContent: "center", gap: 2 },
  minBadge: { alignSelf: "flex-start", marginTop: 2, backgroundColor: "#FEF3C7", color: "#92400E", overflow: "hidden", borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 3, fontFamily: fonts.bodyBold, fontSize: 11 },
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
  newCustomerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, minHeight: 48, marginTop: spacing.sm, backgroundColor: c.brandPrimary, borderRadius: radius.md },
  newCustomerBtnText: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onBrandPrimary },
  newCustomerNotice: { flexDirection: "row", gap: spacing.sm, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  newCustomerNoticeText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: c.onSurfaceSecondary, lineHeight: 18 },
  fieldLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurfaceSecondary },
  addressInput: { minHeight: 86, textAlignVertical: "top" },
  customerError: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.error },
  newCustomerActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  cancelNewCustomer: { minHeight: 48, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: c.surfaceSecondary },
  cancelNewCustomerText: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurfaceSecondary },
  custOpt: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: c.surfaceSecondary },
  custAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.brand, alignItems: "center", justifyContent: "center" },
  custInitial: { fontFamily: fonts.displayBold, fontSize: 16, color: c.onBrand },
  qrisOverlay: { flex: 1, backgroundColor: "rgba(30,26,52,0.55)", justifyContent: "flex-end" },
  qrisSheet: { backgroundColor: c.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, alignItems: "stretch", gap: spacing.md },
  grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: c.border, marginBottom: spacing.sm },
  qrisTitle: { fontFamily: fonts.displayBold, fontSize: 20, color: c.onSurface, textAlign: "center" },
  qrisSub: { fontFamily: fonts.body, fontSize: 13, color: c.muted, textAlign: "center" },
  qrBox: { width: 220, height: 220, alignSelf: "center", borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 2, borderColor: c.border, alignItems: "center", justifyContent: "center", marginVertical: spacing.sm },
  paymentVisual: { alignSelf: "center", width: 170, height: 170, borderRadius: 85, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center", gap: spacing.sm, marginVertical: spacing.sm },
  paymentVisualText: { fontFamily: fonts.displayBold, fontSize: 18, color: c.brandPrimary },
  qrisLogo: { position: "absolute", backgroundColor: c.surface, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  qrisLogoText: { fontFamily: fonts.displayBold, fontSize: 16, color: c.error },
  receiptSuccessIcon: { alignSelf: "center", width: 70, height: 70, borderRadius: 35, backgroundColor: "#DCFCE7", alignItems: "center", justifyContent: "center" },
  qrisAmount: { fontFamily: fonts.displayBold, fontSize: 28, color: c.brandPrimary },
  payMethodRow: { flexDirection: "row", gap: spacing.sm, alignSelf: "stretch" },
  payMethodBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  payMethodText: { fontFamily: fonts.bodyBold, fontSize: 12, color: c.onSurfaceSecondary },
  paymentContent: { gap: spacing.md, paddingBottom: spacing.sm },
  receiptContent: { flexGrow: 1, justifyContent: "center", gap: spacing.md, paddingBottom: spacing.sm },
  paymentActions: { gap: spacing.sm, paddingTop: spacing.sm },
  later: { paddingVertical: spacing.sm },
  laterText: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.muted },
  cancelPayment: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: radius.md, backgroundColor: "#FFE4E6" },
  cancelPaymentText: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.error },
  payError: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.error, textAlign: "center" },
  depositNote: { fontFamily: fonts.body, fontSize: 12, color: c.muted, textAlign: "center" },
}));
