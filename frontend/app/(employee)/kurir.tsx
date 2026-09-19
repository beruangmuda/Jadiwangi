import React from "react";
import { View, Text, Pressable, FlatList, RefreshControl, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, shadow, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { Pill, EmptyState, Loading, ChipRow } from "@/src/components/ui";
import { STAGE, nextStage, NEXT_LABEL } from "@/src/status";
import { rupiah } from "@/src/format";

const FILTERS = [
  { key: "all", label: "Semua" },
  { key: "pickup", label: "Jemput" },
  { key: "delivery", label: "Antar" },
];

export default function Kurir() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { session } = useAuth();
  const outletId = session?.currentOutletId ?? null;
  const [filter, setFilter] = React.useState("all");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["orders", outletId, "active"],
    queryFn: () => api.get(`/orders?active=true${outletId ? `&outlet_id=${outletId}` : ""}&limit=100`),
  });

  const advance = useMutation({
    mutationFn: (id: string) => api.post(`/orders/${id}/advance`),
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const list = (data || []).filter((o: any) => o.delivery_type !== "self" && (filter === "all" || o.delivery_type === filter));

  const renderItem = ({ item }: { item: any }) => {
    const stage = STAGE[item.status] || STAGE.received;
    const nxt = nextStage(item.status);
    return (
      <View style={styles.card} testID={`kurir-${item.code}`}>
        <View style={styles.rowBetween}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <View style={[styles.iconBox, { backgroundColor: item.delivery_type === "delivery" ? colors.brandTertiary : colors.surfaceSecondary }]}>
              <Icon name={item.delivery_type === "delivery" ? "truck-fast" : "moped"} size={20} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.customer_name}</Text>
              <Text style={styles.sub}>{item.customer_phone || item.code}</Text>
            </View>
          </View>
          <Pill label={item.delivery_type === "delivery" ? "Antar" : "Jemput"} tone="azure" />
        </View>
        <View style={styles.rowBetween}>
          <Pill label={stage.label} tone={stage.tone as any} />
          <Text style={styles.total}>{rupiah(item.total)}</Text>
        </View>
        {nxt ? (
          <Pressable testID={`kurir-advance-${item.code}`} onPress={() => advance.mutate(item.id)} style={styles.btn}>
            <Text style={styles.btnText}>{NEXT_LABEL[item.status]}</Text>
            <Icon name="arrow-right-bold" size={16} color={colors.onBrandPrimary} />
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Antar Jemput</Text>
        <Text style={styles.hsub}>Order pickup & delivery</Text>
      </View>
      <ChipRow items={FILTERS} value={filter} onChange={setFilter} />
      {isLoading ? <Loading /> : (
        <FlatList
          data={list}
          keyExtractor={(o) => o.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing["3xl"], gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<EmptyState icon="moped-outline" title="Tidak ada antar/jemput" subtitle="Order antar-jemput akan muncul di sini." />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: c.surface },
  title: { fontFamily: fonts.displayBold, fontSize: 22, color: c.onSurface },
  hsub: { fontFamily: fonts.body, fontSize: 13, color: c.muted },
  card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg, gap: spacing.sm, ...shadow.card },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  iconBox: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurface },
  sub: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  total: { fontFamily: fonts.displayBold, fontSize: 15, color: c.onSurface },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: c.brandPrimary, borderRadius: radius.md, paddingVertical: 12, ...shadow.soft },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onBrandPrimary },
}));
