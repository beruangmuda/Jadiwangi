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

export default function SiapDiambil() {
  const styles = useStyles(); const { colors } = useTheme(); const router = useRouter(); const qc = useQueryClient(); const { session } = useAuth(); const outletId = session?.currentOutletId;
  const { data, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["ready-orders", outletId], queryFn: () => api.get(`/orders?status=ready&sort=fifo${outletId ? `&outlet_id=${outletId}` : ""}`) });
  const orders = data || [];
  const closeOrder = useMutation({
    mutationFn: (id: string) => api.post(`/orders/${id}/advance`, { employee_id: session?.employee?.id, employee_name: session?.name || "" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["ready-orders", outletId] });
      const previous = qc.getQueryData<any[]>(["ready-orders", outletId]);
      qc.setQueryData<any[]>(["ready-orders", outletId], (current) => (current || []).filter((order) => order.id !== id));
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) qc.setQueryData(["ready-orders", outletId], context.previous);
    },
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["ready-orders", outletId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["ready-orders", outletId] }),
  });
  return <View style={{ flex: 1, backgroundColor: colors.surface }}>
    <StackHeader title="Siap Diambil" subtitle={`${orders.length} order menunggu pelanggan`} />
    {isLoading ? <Loading /> : <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}>
      <View style={styles.notice}><Icon name="basket-check" size={22} color="#15803D" /><Text style={styles.noticeText}>Laundry sudah selesai dipacking dan siap diserahkan kepada pelanggan.</Text></View>
      {orders.length === 0 ? <EmptyState icon="basket-off" title="Belum ada order siap diambil" subtitle="Order yang selesai dipacking akan muncul di sini." /> : orders.map((o: any) => <View key={o.id} style={styles.card}><Pressable testID={`ready-order-${o.code}`} onPress={() => router.push(`/order-detail/${o.id}`)} style={styles.orderInfo}><View style={styles.cardTop}><View style={styles.avatar}><Icon name="package-variant-closed" size={21} color={colors.onBrandPrimary} /></View><View style={{ flex: 1 }}><Text style={styles.customer}>{o.customer_name}</Text><Text style={styles.code}>{o.code}</Text></View><Pill label="Siap Diambil" tone="success" /></View><View style={styles.divider} /><Text style={styles.items}>{o.items_summary || "Rincian laundry"}</Text><View style={styles.cardBottom}><Text style={styles.phone}>{o.customer_phone || "Nomor pelanggan"}</Text><Text style={styles.total}>{rupiah(o.total)}</Text></View></Pressable><Pressable testID={`complete-ready-${o.code}`} onPress={() => closeOrder.mutate(o.id)} disabled={closeOrder.isPending} style={({ pressed }) => [styles.completeBtn, pressed && { opacity: 0.8 }]}><Icon name="check-decagram" size={17} color="#fff" /><Text style={styles.completeText}>Sudah Diambil</Text></Pressable></View>)}</ScrollView>}
  </View>;
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.lg, paddingBottom: spacing["3xl"], gap: spacing.md }, notice: { flexDirection: "row", gap: spacing.sm, backgroundColor: "#DCFCE7", borderRadius: radius.md, padding: spacing.md }, noticeText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: "#166534", lineHeight: 18 },
  card: { gap: spacing.sm, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, padding: spacing.md, ...shadow.card }, orderInfo: { gap: spacing.sm, minHeight: 44 }, cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" }, customer: { fontFamily: fonts.displayBold, fontSize: 16, color: c.onSurface }, code: { marginTop: 2, fontFamily: fonts.body, fontSize: 12, color: c.muted }, divider: { height: 1, backgroundColor: c.divider }, items: { fontFamily: fonts.body, fontSize: 13, color: c.onSurfaceSecondary, lineHeight: 18 }, cardBottom: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }, phone: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 12, color: c.muted }, total: { fontFamily: fonts.displayBold, fontSize: 15, color: c.brandPrimary }, completeBtn: { minHeight: 46, borderRadius: radius.md, backgroundColor: c.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm }, completeText: { fontFamily: fonts.bodyBold, fontSize: 14, color: "#fff" },
}));