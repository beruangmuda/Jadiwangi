import React from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { StackHeader } from "@/src/components/form";
import { Icon } from "@/src/components/Icon";
import { EmptyState, Loading, Pill } from "@/src/components/ui";
import { fonts, makeStyles, radius, shadow, spacing, useTheme } from "@/src/theme";
import { rupiah } from "@/src/format";

const PAYMENT_METHODS = [
  { key: "cash", label: "Tunai", icon: "cash" },
  { key: "qris", label: "QRIS", icon: "qrcode-scan" },
  { key: "emoney", label: "E-Money", icon: "wallet" },
  { key: "coin", label: "JW Coin", icon: "hand-coin" },
];

export default function SiapDiambil() {
  const styles = useStyles(); const { colors } = useTheme(); const router = useRouter(); const qc = useQueryClient(); const { session } = useAuth(); const outletId = session?.currentOutletId;
  const [paymentOrderId, setPaymentOrderId] = React.useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = React.useState("cash");
  const [paymentError, setPaymentError] = React.useState("");
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["ready-orders", outletId],
    queryFn: () => api.get(`/orders?status=ready&sort=fifo&outlet_id=${outletId}`),
    enabled: !!outletId,
    refetchOnMount: "always",
  });
  const orders = data || [];
  const closeOrder = useMutation({
    mutationFn: (id: string) => api.post(`/orders/${id}/advance`, { employee_id: session?.employee?.id, employee_name: session?.name || "" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["ready-orders", outletId] });
      const previous = qc.getQueryData<any[]>(["ready-orders", outletId]);
      const previousDashboard = qc.getQueryData<any>(["dashboard", outletId]);
      qc.setQueryData<any[]>(["ready-orders", outletId], (current) => (current || []).filter((order) => order.id !== id));
      qc.setQueryData<any>(["dashboard", outletId], (dashboard) => dashboard?.queue ? { ...dashboard, queue: { ...dashboard.queue, ready: Math.max(0, (dashboard.queue.ready || 0) - 1) } } : dashboard);
      return { previous, previousDashboard };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) qc.setQueryData(["ready-orders", outletId], context.previous);
      if (context?.previousDashboard) qc.setQueryData(["dashboard", outletId], context.previousDashboard);
    },
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["ready-orders", outletId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard", outletId] });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["ready-orders", outletId] }),
  });
  const payOrder = useMutation({
    mutationFn: (orderId: string) => api.post(`/orders/${orderId}/pay`, { method: paymentMethod }),
    onMutate: async (orderId) => {
      await qc.cancelQueries({ queryKey: ["ready-orders", outletId] });
      const previous = qc.getQueryData<any[]>(["ready-orders", outletId]);
      setPaymentOrderId(null); setPaymentError("");
      qc.setQueryData<any[]>(["ready-orders", outletId], (items) => (items || []).map((order) => order.id === orderId ? { ...order, payment_status: "paid", payment_method: paymentMethod } : order));
      return { previous, orderId };
    },
    onSuccess: (updated: any) => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.setQueryData<any[]>(["ready-orders", outletId], (items) => (items || []).map((order) => order.id === updated.id ? { ...order, ...updated } : order));
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard", outletId] });
    },
    onError: (error: any, _orderId, context) => {
      if (context?.previous) qc.setQueryData(["ready-orders", outletId], context.previous);
      setPaymentOrderId(context?.orderId || null);
      setPaymentError(error?.message || "Pembayaran belum dapat dikonfirmasi");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["ready-orders", outletId] }),
  });
  return <View style={{ flex: 1, backgroundColor: colors.surface }}>
    <StackHeader title="Siap Diambil" subtitle={`${orders.length} order menunggu pelanggan`} />
    {isLoading && !!outletId ? <Loading /> : <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}>
      <View style={styles.notice}><Icon name="basket-check" size={22} color="#15803D" /><Text style={styles.noticeText}>Laundry sudah selesai dipacking dan siap diserahkan kepada pelanggan.</Text></View>
      {orders.length === 0 ? <EmptyState icon="basket-off" title="Belum ada order siap diambil" subtitle="Order yang selesai dipacking akan muncul di sini." /> : orders.map((o: any) => {
        const unpaid = o.payment_status !== "paid";
        const disabled = unpaid || closeOrder.isPending;
        const paymentOpen = paymentOrderId === o.id;
        const coinCharge = Math.round(Number(o.total) * 0.9);
        return <View key={o.id} style={styles.card}><Pressable testID={`ready-order-${o.code}`} onPress={() => router.push(`/order-detail/${o.id}`)} style={styles.orderInfo}><View style={styles.cardTop}><View style={styles.avatar}><Icon name="package-variant-closed" size={21} color={colors.onBrandPrimary} /></View><View style={{ flex: 1 }}><Text style={styles.customer}>{o.customer_name}</Text><Text style={styles.code}>{o.code}</Text></View><Pill label="Siap Diambil" tone="success" /></View><View style={styles.divider} /><Text style={styles.items}>{o.items_summary || "Rincian laundry"}</Text><View style={styles.cardBottom}><Text style={styles.phone}>{o.customer_phone || "Nomor pelanggan"}</Text><Text style={styles.total}>{rupiah(o.total)}</Text></View></Pressable>{unpaid ? <><View testID={`ready-payment-warning-${o.code}`} style={styles.unpaidNotice}><Icon name="lock-outline" size={15} color="#B91C1C" /><Text style={styles.unpaidText}>Belum lunas — serahkan setelah pembayaran dikonfirmasi.</Text></View><Pressable testID={`open-ready-payment-${o.code}`} onPress={() => { setPaymentOrderId(paymentOpen ? null : o.id); setPaymentMethod("cash"); setPaymentError(""); }} style={styles.payNowBtn}><Icon name="cash-register" size={17} color={colors.onBrand} /><Text style={styles.payNowText}>Bayar Sekarang</Text><Icon name={paymentOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.onBrand} /></Pressable>{paymentOpen ? <View testID={`ready-payment-card-${o.code}`} style={styles.paymentCard}><Text style={styles.paymentTitle}>Konfirmasi Pembayaran</Text><View style={styles.methodRow}>{PAYMENT_METHODS.map((method) => { const selected = paymentMethod === method.key; return <Pressable key={method.key} testID={`ready-pay-method-${method.key}-${o.code}`} onPress={() => { setPaymentMethod(method.key); setPaymentError(""); }} style={[styles.methodCard, selected && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}><Icon name={method.icon} size={16} color={selected ? colors.brandPrimary : colors.muted} /><Text style={[styles.methodLabel, selected && { color: colors.brandPrimary }]}>{method.label}</Text></Pressable>; })}</View>{paymentMethod === "coin" ? <Text testID={`ready-coin-hint-${o.code}`} style={styles.paymentHint}>Saldo JW Coin terpotong {coinCharge.toLocaleString("id-ID")} coin (diskon 10%).</Text> : null}{paymentError ? <Text testID={`ready-pay-error-${o.code}`} style={styles.paymentError}>{paymentError}</Text> : null}<Pressable testID={`ready-pay-${o.code}`} onPress={() => payOrder.mutate(o.id)} disabled={payOrder.isPending} style={[styles.confirmPayBtn, payOrder.isPending && { opacity: 0.6 }]}><Icon name="cash-check" size={17} color={colors.onBrandPrimary} /><Text style={styles.confirmPayText}>Tandai Lunas • {rupiah(paymentMethod === "coin" ? coinCharge : o.total)}</Text></Pressable></View> : null}</> : null}<Pressable testID={`complete-ready-${o.code}`} onPress={() => closeOrder.mutate(o.id)} disabled={disabled} style={({ pressed }) => [styles.completeBtn, unpaid && styles.lockedBtn, pressed && !disabled && { opacity: 0.8 }]}><Icon name={unpaid ? "lock-outline" : "check-decagram"} size={17} color="#fff" /><Text style={styles.completeText}>{unpaid ? "Menunggu Pembayaran" : "Sudah Diambil"}</Text></Pressable></View>;
      })}</ScrollView>}
  </View>;
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.lg, paddingBottom: spacing["3xl"], gap: spacing.md }, notice: { flexDirection: "row", gap: spacing.sm, backgroundColor: "#DCFCE7", borderRadius: radius.md, padding: spacing.md }, noticeText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: "#166534", lineHeight: 18 },
  card: { gap: spacing.sm, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, padding: spacing.md, ...shadow.card }, orderInfo: { gap: spacing.sm, minHeight: 44 }, cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" }, customer: { fontFamily: fonts.displayBold, fontSize: 16, color: c.onSurface }, code: { marginTop: 2, fontFamily: fonts.body, fontSize: 12, color: c.muted }, divider: { height: 1, backgroundColor: c.divider }, items: { fontFamily: fonts.body, fontSize: 13, color: c.onSurfaceSecondary, lineHeight: 18 }, cardBottom: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }, phone: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 12, color: c.muted }, total: { fontFamily: fonts.displayBold, fontSize: 15, color: c.brandPrimary }, unpaidNotice: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFF1F2", borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 7 }, unpaidText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 12, color: "#B91C1C" }, payNowBtn: { minHeight: 46, borderRadius: radius.md, backgroundColor: c.brand, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, payNowText: { flex: 1, textAlign: "center", fontFamily: fonts.bodyBold, fontSize: 14, color: c.onBrand }, paymentCard: { gap: spacing.sm, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, padding: spacing.sm }, paymentTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurface }, methodRow: { flexDirection: "row", gap: 6 }, methodCard: { flex: 1, minHeight: 54, alignItems: "center", justifyContent: "center", gap: 3, borderRadius: radius.sm, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface }, methodLabel: { fontFamily: fonts.bodyBold, fontSize: 10, color: c.onSurfaceSecondary }, paymentHint: { fontFamily: fonts.body, fontSize: 11, color: c.muted }, paymentError: { fontFamily: fonts.bodyBold, fontSize: 12, color: c.error }, confirmPayBtn: { minHeight: 46, borderRadius: radius.md, backgroundColor: c.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, confirmPayText: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onBrandPrimary }, completeBtn: { minHeight: 46, borderRadius: radius.md, backgroundColor: c.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm }, lockedBtn: { backgroundColor: "#9CA3AF" }, completeText: { fontFamily: fonts.bodyBold, fontSize: 14, color: "#fff" },
}));