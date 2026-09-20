import React from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { Logo, Card, SectionHeader, Loading, EmptyState } from "@/src/components/ui";
import { rupiah, formatDate } from "@/src/format";

export default function CustomerHome() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, logout } = useAuth();
  const cust = session?.customer;
  const outletId = cust?.outlet_id;
  const customerId = cust?.id;

  const { data: lb, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["leaderboard", outletId, customerId],
    queryFn: () => api.get(`/leaderboard?outlet_id=${outletId}&customer_id=${customerId}`),
    enabled: !!outletId && !!customerId,
  });

  const { data: promos } = useQuery({
    queryKey: ["promos", outletId],
    queryFn: () => api.get(`/promos?outlet_id=${outletId}`),
    enabled: !!outletId,
  });

  const { data: detail } = useQuery({
    queryKey: ["cust-detail", customerId],
    queryFn: () => api.get(`/customers/${customerId}/detail`),
    enabled: !!customerId,
  });

  const { data: myOrders } = useQuery({
    queryKey: ["my-orders", customerId],
    queryFn: () => api.get(`/orders?customer_id=${customerId}&limit=20`),
    enabled: !!customerId,
  });

  const active = (myOrders || []).filter((o: any) => !["completed", "cancelled"].includes(o.status));
  const readyOrders = (myOrders || []).filter((o: any) => o.status === "ready");
  const mine = lb?.my_rank;
  const total = lb?.total_participants ?? 0;
  const top3 = (lb?.ranking || []).slice(0, 3);
  const showMineSeparately = mine && mine.rank > 3;
  const coin = Number(detail?.deposit ?? cust?.deposit ?? 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Logo size={38} />
        <Pressable testID="logout-btn" onPress={async () => { await logout(); router.replace("/login"); }} hitSlop={10} style={styles.logoutBtn}>
          <Icon name="logout" size={20} color={colors.error} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"], gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
      >
        {/* Sapaan + sorotan siap diambil */}
        <Animated.View entering={FadeInDown} style={{ gap: spacing.md }}>
          <View>
            <Text style={styles.hello}>Halo, {cust?.name} 👋</Text>
            <Text style={styles.helloSub}>Semoga harimu wangi terus!</Text>
          </View>
          {readyOrders.map((o: any) => {
            const days = Math.max(0, Math.floor((Date.now() - new Date(o.updated_at || o.created_at).getTime()) / 86400000));
            const urgent = days >= 2;
            return (
              <Pressable
                key={o.id}
                testID={`ready-${o.id}`}
                onPress={() => router.push(`/order-detail/${o.id}`)}
                style={({ pressed }) => [styles.readyCard, urgent && { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" }, pressed && { opacity: 0.85 }]}
              >
                <View style={[styles.readyIcon, urgent && { backgroundColor: "#F59E0B" }]}>
                  <Icon name={urgent ? "bell-alert" : "basket-check"} size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.readyTitle, urgent && { color: "#B45309" }]}>Laundry {o.code} siap diambil!</Text>
                  <Text style={[styles.readySub, urgent && { color: "#B45309" }]}>
                    {days === 0 ? "Siap hari ini — ditunggu ya" : `Sudah ${days} hari menunggu di outlet`}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={urgent ? "#B45309" : colors.brandPrimary} />
              </Pressable>
            );
          })}
        </Animated.View>

        {/* 1. Promo saat ini */}
        <Card>
          <SectionHeader title="🎉 Promo Saat Ini" />
          {(promos || []).length === 0 ? (
            <Text style={styles.empty}>Belum ada promo aktif. Pantau terus ya!</Text>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {(promos || []).map((p: any) => (
                <View key={p.id} style={styles.promoCard} testID={`promo-${p.id}`}>
                  <View style={styles.promoBadge}>
                    <Text style={styles.promoBadgeText}>{Number(p.discount_pct)}%</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.promoTitle}>{p.title}</Text>
                    <Text style={styles.promoDesc}>{p.description}</Text>
                    <Text style={styles.promoMeta}>
                      {p.code ? `Kode: ${p.code}` : ""}{p.valid_until ? `  •  s.d. ${formatDate(p.valid_until)}` : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* 2. Saldo coin */}
        <Card>
          <SectionHeader title="🪙 JW Coin" action="Isi Saldo" onAction={() => router.push("/topup")} />
          <View style={styles.coinRow}>
            <View style={styles.coinIcon}><Icon name="hand-coin" size={24} color={colors.onBrandPrimary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.coinValue} testID="coin-balance">{Number(coin).toLocaleString("id-ID")} coin</Text>
              <Text style={styles.coinSub}>Setara {rupiah(coin)}</Text>
            </View>
          </View>
          {detail?.pending_topups ? (
            <Text style={styles.coinSub}>⏳ {detail.pending_topups} permintaan top-up menunggu konfirmasi outlet.</Text>
          ) : null}
          <View style={styles.voucherRow} testID="coin-benefit">
            <Icon name="ticket-percent" size={18} color={colors.onBrand} />
            <Text style={styles.voucherText}>Lebih hemat, diskon 10% untuk pembayaran dengan coin</Text>
          </View>
        </Card>

        {/* 3. Pantau ordermu */}
        <Card>
          <SectionHeader title="📦 Pantau Ordermu" action="Riwayat" onAction={() => router.push("/(customer)/riwayat")} />
          {active.length === 0 ? (
            <Text style={styles.empty}>Belum ada pesanan aktif. Yuk pesan laundry!</Text>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {active.map((o: any) => (
                <Pressable
                  key={o.id}
                  testID={`order-${o.id}`}
                  onPress={() => router.push(`/order-detail/${o.id}`)}
                  style={({ pressed }) => [styles.orderRow, pressed && { opacity: 0.7 }]}
                >
                  <View style={[styles.dot, { backgroundColor: o.overdue ? colors.error : colors.brandPrimary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderCode}>{o.code}</Text>
                    <Text style={styles.orderSub}>
                      {o.is_request ? "Permintaan awal" : `${o.weight_kg} kg`}
                      {o.delivery_type !== "self" ? ` • ${o.delivery_type === "pickup" ? "Dijemput" : "Diantar"}` : ""}
                    </Text>
                  </View>
                  <View style={styles.statusPill}><Text style={styles.statusText}>{o.stage_label}</Text></View>
                  <Icon name="chevron-right" size={18} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          )}
        </Card>

        {/* Klasemen: 3 besar + posisi saya */}
        <Card>
          <SectionHeader title="🏆 Ranking Kamu" />
          {isLoading ? <Loading /> : top3.length === 0 ? (
            <EmptyState icon="trophy-outline" title="Belum ada data" subtitle="Mulai laundry untuk kumpulkan poin." />
          ) : (
            <View style={{ gap: spacing.sm }}>
              <Text style={styles.rankGroup}>3 Besar</Text>
              {top3.map((p: any) => (
                <RankRow key={p.id} p={p} />
              ))}
              <Text style={styles.rankGroup}>Posisi Kamu</Text>
              {mine ? (
                <>
                  {showMineSeparately ? <Text style={styles.dots}>⋮</Text> : null}
                  <RankRow p={{ ...mine, is_me: true }} />
                  <Text style={styles.rankMeta}>Kamu di peringkat #{mine.rank} dari {total} pelanggan outlet ini.</Text>
                </>
              ) : (
                <Text style={styles.empty}>Kamu belum masuk klasemen. Yuk laundry untuk mulai kumpulkan poin!</Text>
              )}
            </View>
          )}
          <Text style={styles.rules}>Poin: 1 kg = 1 poin · 1 satuan = 2 poin · Bed Cover = 1 poin · Express +2 poin</Text>
        </Card>
      </ScrollView>
    </View>
  );
}

function RankRow({ p }: { p: any }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View
      testID={p.is_me ? "rank-me" : `rank-${p.rank}`}
      style={[styles.rankItem, p.is_me && { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary, borderWidth: 1.5 }]}
    >
      <Text style={[styles.rankNum, p.is_me && { color: colors.brandPrimary }]}>{p.rank}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rankName, !p.is_me && styles.blurred]} numberOfLines={1}>
          {p.is_me ? `${p.name} (Kamu)` : p.name}
        </Text>
        <Text style={[styles.rankSub, !p.is_me && styles.blurred]}>
          {p.is_me ? `${Number(p.total_kg).toFixed(0)} kg • ${p.orders}x order` : "•••••"}
        </Text>
      </View>
      <Text style={[styles.rankPts, !p.is_me && styles.blurred]}>{p.is_me ? `${p.points} poin` : "••• poin"}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.divider },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFE4E6", alignItems: "center", justifyContent: "center" },
  hello: { fontFamily: fonts.displayBold, fontSize: 22, color: c.onSurface },
  helloSub: { fontFamily: fonts.body, fontSize: 13, color: c.muted, marginTop: 2 },
  readyCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.brandTertiary, borderRadius: radius.lg, borderWidth: 1.5, borderColor: c.brandPrimary, padding: spacing.md },
  readyIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  readyTitle: { fontFamily: fonts.displayBold, fontSize: 15, color: c.onBrandTertiary },
  readySub: { fontFamily: fonts.body, fontSize: 12, color: c.onBrandTertiary, marginTop: 2 },
  rankGroup: { fontFamily: fonts.bodyBold, fontSize: 12, color: c.muted, textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.xs },
  rankMeta: { fontFamily: fonts.bodyBold, fontSize: 12, color: c.brandPrimary },
  dots: { fontFamily: fonts.displayBold, fontSize: 18, color: c.muted, textAlign: "center" },
  empty: { fontFamily: fonts.body, fontSize: 13, color: c.muted, paddingVertical: spacing.sm },
  promoCard: { flexDirection: "row", gap: spacing.md, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  promoBadge: { width: 46, height: 46, borderRadius: radius.sm, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  promoBadgeText: { fontFamily: fonts.displayBold, fontSize: 15, color: c.onBrandPrimary },
  promoTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurface },
  promoDesc: { fontFamily: fonts.body, fontSize: 12, color: c.muted, marginTop: 2, lineHeight: 17 },
  promoMeta: { fontFamily: fonts.bodyBold, fontSize: 11, color: c.brandPrimary, marginTop: 4 },
  coinRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.xs },
  coinIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  coinValue: { fontFamily: fonts.displayBold, fontSize: 22, color: c.onSurface },
  coinSub: { fontFamily: fonts.body, fontSize: 12, color: c.muted, marginTop: 2 },
  voucherRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.brand, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  voucherText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 13, color: c.onBrand },
  orderRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  orderCode: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurface },
  orderSub: { fontFamily: fonts.body, fontSize: 12, color: c.muted, marginTop: 1 },
  statusPill: { backgroundColor: c.brandTertiary, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontFamily: fonts.bodyBold, fontSize: 11, color: c.onBrandTertiary },
  rankItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.sm, borderRadius: radius.md },
  rankNum: { fontFamily: fonts.displayBold, fontSize: 15, color: c.muted, width: 26, textAlign: "center" },
  rankName: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurface },
  rankSub: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  rankPts: { fontFamily: fonts.displayBold, fontSize: 14, color: c.brandPrimary },
  blurred: { opacity: 0.28, letterSpacing: 1.5 },
  rules: { fontFamily: fonts.body, fontSize: 11, color: c.muted, marginTop: spacing.md, lineHeight: 16 },
}));
