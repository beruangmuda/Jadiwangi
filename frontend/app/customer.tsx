import React from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, shadow, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { Logo, Card, SectionHeader, Loading } from "@/src/components/ui";
import { rupiahShort } from "@/src/format";

const MEDALS = ["#F5C518", "#B8C1CC", "#CD7F32"];

export default function CustomerHome() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, logout } = useAuth();
  const outletId = session?.customer?.outlet_id;
  const customerId = session?.customer?.id;

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["leaderboard", outletId, customerId],
    queryFn: () => api.get(`/leaderboard?outlet_id=${outletId}&customer_id=${customerId}`),
  });

  const ranking = data?.ranking || [];
  const mine = data?.my_rank;
  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Logo size={18} />
        <Pressable testID="logout-btn" onPress={logout} hitSlop={10} style={styles.logoutBtn}>
          <Icon name="logout" size={20} color={colors.error} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] * 2, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
      >
        <Animated.View entering={FadeInDown}>
          <LinearGradient colors={["#A78BFA", "#0096FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <Text style={styles.heroHello}>Halo, {session?.customer?.name} 👋</Text>
            <Text style={styles.heroLabel}>Peringkat kamu di outlet</Text>
            <View style={styles.rankRow}>
              <Text style={styles.rankBig}>#{mine?.rank ?? "-"}</Text>
              <View style={styles.heroStats}>
                <HeroStat label="Poin" value={String(mine?.points ?? 0)} />
                <HeroStat label="Order" value={String(mine?.orders ?? 0)} />
                <HeroStat label="Belanja" value={rupiahShort(mine?.spend ?? 0)} />
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {isLoading ? <Loading /> : (
          <>
            {/* Podium */}
            {top3.length > 0 ? (
              <Card>
                <SectionHeader title="🏆 Top 3 Pelanggan" />
                <View style={styles.podium}>
                  {[1, 0, 2].map((idx) => {
                    const p = top3[idx];
                    if (!p) return <View key={idx} style={{ flex: 1 }} />;
                    const h = idx === 0 ? 92 : idx === 1 ? 70 : 58;
                    return (
                      <View key={p.id} style={styles.podCol}>
                        <View style={[styles.podAvatar, { borderColor: MEDALS[idx] }]}>
                          <Text style={styles.podInitial}>{p.name?.[0]}</Text>
                          <View style={[styles.medal, { backgroundColor: MEDALS[idx] }]}>
                            <Text style={styles.medalText}>{idx + 1}</Text>
                          </View>
                        </View>
                        <Text style={styles.podName} numberOfLines={1}>{p.name.split(" ")[0]}</Text>
                        <Text style={styles.podPts}>{p.points} poin</Text>
                        <View style={[styles.podBar, { height: h, backgroundColor: idx === 0 ? colors.brandPrimary : colors.brandSecondary }]} />
                      </View>
                    );
                  })}
                </View>
              </Card>
            ) : null}

            {/* Rest of ranking */}
            <Card>
              <SectionHeader title="Klasemen Lengkap" />
              <View style={{ gap: spacing.sm }}>
                {rest.map((p: any) => {
                  const isMe = p.id === customerId;
                  return (
                    <View key={p.id} style={[styles.rankItem, isMe && { backgroundColor: colors.brandTertiary }]}>
                      <Text style={styles.rankNum}>{p.rank}</Text>
                      <View style={styles.rankAvatar}><Text style={styles.rankInitial}>{p.name?.[0]}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rankName}>{p.name}{isMe ? " (Kamu)" : ""}</Text>
                        <Text style={styles.rankSub}>{p.orders}x order</Text>
                      </View>
                      <Text style={styles.rankPts}>{p.points} pts</Text>
                    </View>
                  );
                })}
              </View>
            </Card>
          </>
        )}
      </ScrollView>

      <Pressable
        testID="order-sekarang"
        onPress={() => router.push("/order-baru")}
        style={({ pressed }) => [styles.fab, { bottom: insets.bottom + spacing.lg }, pressed && { transform: [{ scale: 0.96 }] }]}
      >
        <Icon name="washing-machine" size={22} color={colors.onBrandPrimary} />
        <Text style={styles.fabText}>Order Sekarang</Text>
      </Pressable>
    </View>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.divider },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFE4E6", alignItems: "center", justifyContent: "center" },
  hero: { borderRadius: radius.lg, padding: spacing.xl, gap: 4, ...shadow.soft },
  heroHello: { fontFamily: fonts.displayBold, fontSize: 20, color: "#fff" },
  heroLabel: { fontFamily: fonts.bodySemi, fontSize: 13, color: "rgba(255,255,255,0.85)" },
  rankRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: spacing.sm },
  rankBig: { fontFamily: fonts.displayBold, fontSize: 48, color: "#fff" },
  heroStats: { flex: 1, flexDirection: "row", justifyContent: "space-between" },
  heroStat: { alignItems: "center" },
  heroStatValue: { fontFamily: fonts.displayBold, fontSize: 18, color: "#fff" },
  heroStatLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: "rgba(255,255,255,0.8)" },
  podium: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, justifyContent: "center", marginTop: spacing.sm },
  podCol: { flex: 1, alignItems: "center", gap: 4 },
  podAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#F2EFFF", alignItems: "center", justifyContent: "center", borderWidth: 3 },
  podInitial: { fontFamily: fonts.displayBold, fontSize: 22, color: "#3D3664" },
  medal: { position: "absolute", bottom: -6, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  medalText: { fontFamily: fonts.displayBold, fontSize: 11, color: "#1E1A34" },
  podName: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurface, marginTop: 6 },
  podPts: { fontFamily: fonts.body, fontSize: 11, color: c.muted },
  podBar: { width: "70%", borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm, marginTop: 4 },
  rankItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.sm, borderRadius: radius.md },
  rankNum: { fontFamily: fonts.displayBold, fontSize: 15, color: c.muted, width: 24, textAlign: "center" },
  rankAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  rankInitial: { fontFamily: fonts.displayBold, fontSize: 15, color: c.brand },
  rankName: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurface },
  rankSub: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  rankPts: { fontFamily: fonts.displayBold, fontSize: 14, color: c.brandPrimary },
  fab: { position: "absolute", left: spacing.lg, right: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: c.brandPrimary, borderRadius: radius.pill, paddingVertical: 16, ...shadow.soft },
  fabText: { fontFamily: fonts.displayBold, fontSize: 16, color: c.onBrandPrimary },
}));
