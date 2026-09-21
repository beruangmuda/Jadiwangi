import React from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { StackHeader } from "@/src/components/form";
import { Icon } from "@/src/components/Icon";
import { EmptyState, Loading, Pill } from "@/src/components/ui";
import { fonts, makeStyles, radius, shadow, spacing, useTheme } from "@/src/theme";
import { rupiah } from "@/src/format";

export default function SiapDiambil() {
  const styles = useStyles(); const { colors } = useTheme(); const router = useRouter(); const { session } = useAuth(); const outletId = session?.currentOutletId;
  const { data, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["ready-orders", outletId], queryFn: () => api.get(`/orders?status=ready&sort=fifo${outletId ? `&outlet_id=${outletId}` : ""}`) });
  const orders = data || [];
  return <View style={{ flex: 1, backgroundColor: colors.surface }}>
    <StackHeader title="Siap Diambil" subtitle={`${orders.length} order menunggu pelanggan`} />
    {isLoading ? <Loading /> : <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}>
      <View style={styles.notice}><Icon name="basket-check" size={22} color="#15803D" /><Text style={styles.noticeText}>Laundry sudah selesai dipacking dan siap diserahkan kepada pelanggan.</Text></View>
      {orders.length === 0 ? <EmptyState icon="basket-off" title="Belum ada order siap diambil" subtitle="Order yang selesai dipacking akan muncul di sini." /> : orders.map((o: any) => <Pressable key={o.id} testID={`ready-order-${o.code}`} onPress={() => router.push(`/order-detail/${o.id}`)} style={styles.card}><View style={styles.cardTop}><View style={styles.avatar}><Icon name="package-variant-closed" size={21} color={colors.onBrandPrimary} /></View><View style={{ flex: 1 }}><Text style={styles.customer}>{o.customer_name}</Text><Text style={styles.code}>{o.code}</Text></View><Pill label="Siap Diambil" tone="success" /></View><View style={styles.divider} /><Text style={styles.items}>{o.items_summary || "Rincian laundry"}</Text><View style={styles.cardBottom}><Text style={styles.phone}>{o.customer_phone || "Nomor pelanggan"}</Text><Text style={styles.total}>{rupiah(o.total)}</Text></View></Pressable>)}</ScrollView>}
  </View>;
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.lg, paddingBottom: spacing["3xl"], gap: spacing.md }, notice: { flexDirection: "row", gap: spacing.sm, backgroundColor: "#DCFCE7", borderRadius: radius.md, padding: spacing.md }, noticeText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: "#166534", lineHeight: 18 },
  card: { gap: spacing.sm, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, padding: spacing.md, ...shadow.card }, cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" }, customer: { fontFamily: fonts.displayBold, fontSize: 16, color: c.onSurface }, code: { marginTop: 2, fontFamily: fonts.body, fontSize: 12, color: c.muted }, divider: { height: 1, backgroundColor: c.divider }, items: { fontFamily: fonts.body, fontSize: 13, color: c.onSurfaceSecondary, lineHeight: 18 }, cardBottom: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }, phone: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 12, color: c.muted }, total: { fontFamily: fonts.displayBold, fontSize: 15, color: c.brandPrimary },
}));