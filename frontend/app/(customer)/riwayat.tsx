import React from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { Card, Loading, EmptyState, Pill } from "@/src/components/ui";
import { rupiah, formatDateTime, kg } from "@/src/format";

export default function Riwayat() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const customerId = session?.customer?.id;

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["my-orders-all", customerId],
    queryFn: () => api.get(`/orders?customer_id=${customerId}&limit=100`),
    enabled: !!customerId,
  });

  const list = data || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.headerTitle}>Riwayat Pesanan</Text>
        <Text style={styles.headerSub}>{list.length} pesanan</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["3xl"] }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
      >
        {isLoading ? <Loading /> : list.length === 0 ? (
          <Card><EmptyState icon="history" title="Belum ada riwayat" subtitle="Pesanan laundry kamu akan tersimpan di sini." /></Card>
        ) : (
          list.map((o: any) => (
            <Pressable
              key={o.id}
              testID={`hist-${o.id}`}
              onPress={() => router.push(`/order-detail/${o.id}`)}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceSecondary }]}
            >
              <View style={styles.iconBox}>
                <Icon name={o.status === "cancelled" ? "close-circle-outline" : o.status === "completed" ? "check-decagram" : "washing-machine"} size={20} color={colors.brand} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.code}>{o.code}</Text>
                <Text style={styles.sub}>{formatDateTime(o.created_at)}</Text>
                <Text style={styles.sub}>{o.is_request ? "Permintaan awal" : `${kg(o.weight_kg)}${o.unit_qty ? ` • ${o.unit_qty} pcs` : ""}`}</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Text style={styles.total}>{rupiah(o.total)}</Text>
                <Pill label={o.stage_label} tone={o.status === "completed" ? "success" : o.status === "cancelled" ? "error" : "azure"} />
                <Pill label={o.payment_status === "paid" ? "Lunas" : "Belum bayar"} tone={o.payment_status === "paid" ? "success" : "warning"} />
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.divider, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  headerTitle: { fontFamily: fonts.displayBold, fontSize: 22, color: c.onSurface },
  headerSub: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.muted },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md },
  iconBox: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  code: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurface },
  sub: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  total: { fontFamily: fonts.displayBold, fontSize: 15, color: c.onSurface },
}));
