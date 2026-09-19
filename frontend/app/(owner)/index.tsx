import React from "react";
import { View, Text, ScrollView, Pressable, useWindowDimensions, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, shadow, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { Logo, Card, SectionHeader, Skeleton, EmptyState } from "@/src/components/ui";
import { OutletSwitcher } from "@/src/components/OutletSwitcher";
import { TrendChart } from "@/src/components/Chart";
import { rupiah, rupiahShort, kg } from "@/src/format";

export default function Dashboard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const outletId = session?.currentOutletId ?? null;

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard", outletId],
    queryFn: () => api.get(`/dashboard${outletId ? `?outlet_id=${outletId}` : ""}`),
  });

  const chartWidth = Math.min(width, 640) - spacing.lg * 2 - spacing.lg * 2;
  const t = data?.today;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Logo size={40} />
        <OutletSwitcher />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] * 2, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
      >
        <View>
          <Text style={styles.greeting}>Halo, {session?.name || "Owner"} 👋</Text>
          <Text style={styles.sub}>Ringkasan performa hari ini</Text>
        </View>

        {isLoading ? (
          <>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <Skeleton height={130} style={{ flex: 1 }} />
              <Skeleton height={130} style={{ flex: 1 }} />
            </View>
            <Skeleton height={220} />
          </>
        ) : (
          <>
            {/* KPI ROW */}
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <Card style={{ flex: 1, gap: spacing.sm }} delay={40}>
                <View style={styles.kpiIcon}>
                  <Icon name="receipt-text" size={20} color={colors.brand} />
                </View>
                <Text style={styles.kpiValue}>{t?.orders ?? 0}</Text>
                <Text style={styles.kpiLabel}>Transaksi</Text>
                <View style={styles.kpiMetaRow}>
                  <Text style={styles.kpiMeta}>{kg(t?.kg)}</Text>
                  <Text style={styles.kpiDot}>•</Text>
                  <Text style={styles.kpiMeta}>{t?.pcs ?? 0} pcs</Text>
                </View>
                <View style={styles.custBadge}>
                  <Icon name="account-group" size={13} color={colors.onBrandTertiary} />
                  <Text style={styles.custText}>{t?.customers ?? 0} pelanggan</Text>
                </View>
              </Card>

              <Card style={{ flex: 1, gap: spacing.sm }} delay={90}>
                <View style={[styles.kpiIcon, { backgroundColor: colors.brandTertiary }]}>
                  <Icon name="cash-multiple" size={20} color={colors.brandPrimary} />
                </View>
                <Text style={styles.kpiLabel}>Pendapatan</Text>
                <Text style={[styles.kpiValue, { fontSize: 20, color: colors.brandPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{rupiah(t?.pendapatan)}</Text>
                <View style={styles.divider} />
                <Text style={styles.kpiLabel}>Omzet</Text>
                <Text style={styles.omzet} numberOfLines={1} adjustsFontSizeToFit>{rupiah(t?.omzet)}</Text>
              </Card>
            </View>

            {/* CHART */}
            <Card delay={140}>
              <SectionHeader title="Trend Bulan Ini" />
              <TrendChart data={data?.trend || []} width={chartWidth} />
            </Card>

            {/* QUEUE */}
            <View>
              <SectionHeader title="Antrian Pekerjaan" />
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <QueueCard icon="progress-wrench" label="Dikerjakan" value={data?.queue?.in_progress ?? 0} tone="brand" delay={40} />
                <QueueCard icon="basket-check" label="Belum Diambil" value={data?.queue?.ready ?? 0} tone="azure" delay={90} />
                <QueueCard icon="alarm-light" label="Lewat SLA" value={data?.queue?.overdue ?? 0} tone="error" delay={140} />
              </View>
            </View>

            {/* TOP SERVICES */}
            <Card delay={160}>
              <SectionHeader title="Top Layanan" />
              {(data?.top_services || []).length === 0 ? (
                <EmptyState icon="tshirt-crew" title="Belum ada data" />
              ) : (
                <View style={{ gap: spacing.md }}>
                  {(data?.top_services || []).map((s: any, i: number) => (
                    <View key={s.name} style={styles.serviceRow}>
                      <View style={styles.rankBadge}>
                        <Text style={styles.rankText}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.serviceName}>{s.name}</Text>
                        <Text style={styles.serviceSub}>{s.count}x order</Text>
                      </View>
                      <Text style={styles.serviceRev}>{rupiahShort(s.revenue)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </>
        )}
      </ScrollView>

      <Pressable
        testID="fab-buat-order"
        onPress={() => router.push("/order-baru")}
        style={({ pressed }) => [styles.fab, { bottom: spacing.lg }, pressed && { transform: [{ scale: 0.95 }] }]}
      >
        <Icon name="plus" size={24} color={colors.onBrandPrimary} />
        <Text style={styles.fabText}>Buat Order</Text>
      </Pressable>
    </View>
  );
}

function QueueCard({ icon, label, value, tone, delay }: { icon: string; label: string; value: number; tone: "brand" | "azure" | "error"; delay: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toneColor = tone === "error" ? colors.error : tone === "azure" ? colors.brandPrimary : colors.brand;
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify().damping(16)} style={[styles.queueCard, { flex: 1 }]}>
      <View style={[styles.queueIcon, { backgroundColor: tone === "error" ? "#FFE4E6" : colors.surfaceSecondary }]}>
        <Icon name={icon} size={18} color={toneColor} />
      </View>
      <Text style={[styles.queueValue, { color: toneColor }]}>{value}</Text>
      <Text style={styles.queueLabel}>{label}</Text>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.divider },
  greeting: { fontFamily: fonts.displayBold, fontSize: 22, color: c.onSurface },
  sub: { fontFamily: fonts.body, fontSize: 14, color: c.muted, marginTop: 2 },
  kpiIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  kpiValue: { fontFamily: fonts.displayBold, fontSize: 30, color: c.onSurface },
  kpiLabel: { fontFamily: fonts.bodySemi, fontSize: 13, color: c.muted },
  kpiMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  kpiMeta: { fontFamily: fonts.bodyBold, fontSize: 12, color: c.onSurfaceSecondary },
  kpiDot: { color: c.muted },
  custBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: c.brandTertiary, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, marginTop: 2 },
  custText: { fontFamily: fonts.bodyBold, fontSize: 11, color: c.onBrandTertiary },
  divider: { height: 1, backgroundColor: c.divider, marginVertical: 2 },
  omzet: { fontFamily: fonts.displayBold, fontSize: 18, color: c.onSurface },
  queueCard: { backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: c.border, alignItems: "flex-start", gap: 6, ...shadow.card },
  queueIcon: { width: 34, height: 34, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  queueValue: { fontFamily: fonts.displayBold, fontSize: 26 },
  queueLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: c.muted },
  serviceRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rankBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  rankText: { fontFamily: fonts.displayBold, fontSize: 14, color: c.brand },
  serviceName: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurface },
  serviceSub: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  serviceRev: { fontFamily: fonts.displayBold, fontSize: 14, color: c.brandPrimary },
  fab: { position: "absolute", right: spacing.lg, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.brandPrimary, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: 20, ...shadow.soft },
  fabText: { fontFamily: fonts.displayBold, fontSize: 15, color: c.onBrandPrimary },
}));
