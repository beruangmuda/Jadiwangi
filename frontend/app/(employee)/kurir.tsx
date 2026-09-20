import React from "react";
import { View, Text, Pressable, FlatList, RefreshControl, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
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
  { key: "request", label: "Permintaan" },
  { key: "pickup", label: "Jemput" },
  { key: "delivery", label: "Antar" },
];

export default function Kurir() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const outletId = session?.currentOutletId ?? null;
  const [filter, setFilter] = React.useState("all");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["orders", outletId, "active"],
    queryFn: () => api.get(`/orders?active=true${outletId ? `&outlet_id=${outletId}` : ""}&limit=100`),
  });

  const { data: requests } = useQuery({
    queryKey: ["orders", outletId, "requested"],
    queryFn: () => api.get(`/orders?status=requested${outletId ? `&outlet_id=${outletId}` : ""}&sort=fifo&limit=100`),
  });

  const { data: quoted } = useQuery({
    queryKey: ["orders", outletId, "quoted"],
    queryFn: () => api.get(`/orders?status=quoted${outletId ? `&outlet_id=${outletId}` : ""}&sort=fifo&limit=100`),
  });

  const advance = useMutation({
    mutationFn: (id: string) => api.post(`/orders/${id}/advance`, session?.employee?.id ? { employee_id: session.employee.id, employee_name: session.name } : {}),
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const trip = useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) => api.post(`/orders/${id}/trip`, {
      type, employee_id: session?.employee?.id, employee_name: session?.name,
    }),
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const pending = [...(requests || []), ...(quoted || [])];
  const activeTrips = (data || []).filter((o: any) => o.delivery_type !== "self");
  const list = filter === "request"
    ? pending
    : filter === "all"
      ? [...pending, ...activeTrips]
      : [...pending, ...activeTrips].filter((o: any) => o.delivery_type === filter);

  const renderItem = ({ item }: { item: any }) => {
    const stage = STAGE[item.status] || STAGE.received;
    const nxt = nextStage(item.status);
    const isRequest = item.status === "requested";
    const isQuoted = item.status === "quoted";
    const readyToWeigh = isRequest && (item.delivery_type !== "pickup" || !!item.picked_up_at);
    return (
      <View style={[styles.card, (isRequest || isQuoted) && { borderColor: colors.brandPrimary, borderWidth: 1.5 }]} testID={`kurir-${item.code}`}>
        <View style={styles.rowBetween}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <View style={[styles.iconBox, { backgroundColor: item.delivery_type === "delivery" ? colors.brandTertiary : colors.surfaceSecondary }]}>
              <Icon name={isRequest ? "inbox-arrow-down" : item.delivery_type === "delivery" ? "truck-fast" : "moped"} size={20} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.customer_name}</Text>
              <Text style={styles.sub}>{item.customer_phone || item.code}</Text>
            </View>
          </View>
          <Pill label={item.delivery_type === "delivery" ? "Antar" : item.delivery_type === "pickup" ? "Jemput" : "Antar Sendiri"} tone="azure" />
        </View>
        <View style={styles.rowBetween}>
          <Pill label={item.stage_label || stage.label} tone={isRequest ? "warning" : (stage.tone as any)} />
          <Text style={styles.total}>{isRequest ? "Belum ditimbang" : rupiah(item.total)}</Text>
        </View>

        {isRequest && Array.isArray(item.request_items) && item.request_items.length ? (
          <View style={styles.catRow}>
            {item.request_items.map((r: any, i: number) => (
              <View key={i} style={styles.catChip}><Text style={styles.catText}>{r.category} · ±{r.qty}</Text></View>
            ))}
          </View>
        ) : null}

        {item.address ? (
          <View style={styles.addrRow}>
            <Icon name="map-marker" size={16} color={colors.brand} />
            <Text style={styles.sub}>{item.address}</Text>
          </View>
        ) : null}

        {/* Konfirmasi trip kurir */}
        <View style={styles.tripRow}>
          {item.delivery_type === "pickup" ? (
            item.picked_up_at ? (
              <View style={styles.tripDone}>
                <Icon name="check-circle" size={16} color="#15803D" />
                <Text style={styles.tripDoneText}>Sudah dijemput</Text>
              </View>
            ) : (
              <Pressable testID={`trip-pickup-${item.code}`} onPress={() => trip.mutate({ id: item.id, type: "pickup" })} style={styles.tripBtn}>
                <Icon name="moped" size={16} color={colors.brand} />
                <Text style={styles.tripBtnText}>Konfirmasi Dijemput</Text>
              </Pressable>
            )
          ) : item.delivery_type === "delivery" ? (
            item.delivered_at ? (
              <View style={styles.tripDone}>
                <Icon name="check-circle" size={16} color="#15803D" />
                <Text style={styles.tripDoneText}>
                  {item.customer_confirmed_at ? "Diterima pelanggan" : "Sudah diantar • menunggu konfirmasi pelanggan"}
                </Text>
              </View>
            ) : (
              <Pressable testID={`trip-delivery-${item.code}`} onPress={() => trip.mutate({ id: item.id, type: "delivery" })} style={styles.tripBtn}>
                <Icon name="truck-fast" size={16} color={colors.brand} />
                <Text style={styles.tripBtnText}>Konfirmasi Diantar</Text>
              </Pressable>
            )
          ) : null}
        </View>

        {readyToWeigh ? (
          <Pressable testID={`weigh-${item.code}`} onPress={() => router.push(`/timbang/${item.id}`)} style={styles.btn}>
            <Icon name="scale-balance" size={16} color={colors.onBrandPrimary} />
            <Text style={styles.btnText}>Timbang Pakaian & Foto</Text>
          </Pressable>
        ) : isRequest ? (
          <Text style={styles.hintSmall}>Konfirmasi penjemputan dulu sebelum menimbang.</Text>
        ) : isQuoted ? (
          <View style={styles.tripDone}>
            <Icon name="send-clock" size={16} color="#15803D" />
            <Text style={styles.tripDoneText}>Nota terkirim • menunggu persetujuan pelanggan</Text>
          </View>
        ) : null}

        {nxt && !isRequest && !isQuoted ? (
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
        <Text style={styles.title}>Antar Jemput & Permintaan</Text>
        <Text style={styles.hsub}>Jemput, antar, dan timbang permintaan pelanggan</Text>
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
  addrRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  tripRow: { flexDirection: "row" },
  tripBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: radius.md, borderWidth: 1.5, borderColor: c.brand, paddingVertical: 10 },
  tripBtnText: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.brand },
  tripDone: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#DCFCE7", borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: spacing.md },
  tripDoneText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 12, color: "#15803D" },
  hintSmall: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  catChip: { backgroundColor: c.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  catText: { fontFamily: fonts.bodyBold, fontSize: 11, color: c.onSurfaceSecondary },
}));
