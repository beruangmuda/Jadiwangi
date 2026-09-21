import React from "react";
import { View, Text, ScrollView, Pressable, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { StackHeader } from "@/src/components/form";
import { Icon } from "@/src/components/Icon";
import { Loading, Pill } from "@/src/components/ui";
import { fonts, makeStyles, radius, shadow, spacing, useTheme } from "@/src/theme";
import { STAGE, PIPELINE } from "@/src/status";
import { queueOrderStage } from "@/src/orderSync";
import { rupiah } from "@/src/format";

export default function ProsesOrder() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const { data: order, isLoading } = useQuery({ queryKey: ["order-process", id], queryFn: () => api.get(`/orders/${id}`), enabled: !!id });
  const moveTo = (target: string) => {
    const optimistic = { ...order, status: target, stage_label: STAGE[target]?.label || target };
    qc.setQueryData(["order-process", id], optimistic);
    qc.setQueriesData({ queryKey: ["orders"] }, (data: any) => Array.isArray(data) ? data.map((o) => o.id === id ? optimistic : o) : data);
    void queueOrderStage({ id: id!, target_status: target, employee_id: session?.employee?.id, employee_name: session?.name || "" });
    if (target === "ready") router.replace("/siap-diambil");
  };

  if (isLoading || !order) return <Loading />;
  const current = PIPELINE.indexOf(order.status as any);
  const isDone = ["ready", "completed", "cancelled"].includes(order.status);

  return <View style={{ flex: 1, backgroundColor: colors.surface }}>
    <StackHeader title="Proses Laundry" subtitle={order.code} />
    <ScrollView contentContainerStyle={styles.content}>
      <View testID="process-order-summary" style={styles.summary}>
        <View style={{ flex: 1 }}><Text style={styles.customer}>{order.customer_name}</Text><Text style={styles.items}>{order.items_summary || "Rincian laundry"}</Text></View>
        <View style={{ alignItems: "flex-end", gap: 6 }}><Pill label={order.stage_label} tone={(STAGE[order.status]?.tone || "neutral") as any} /><Text style={styles.total}>{rupiah(order.total)}</Text></View>
      </View>
      <Text style={styles.sectionTitle}>Tahapan Proses</Text>
      <View testID="process-timeline" style={styles.timeline}>
        {PIPELINE.slice(0, 6).map((key, index) => {
          const stage = STAGE[key]; const complete = index <= current; const available = index === current + 1 && !isDone; const pending = index > current + 1;
          return <View key={key} testID={`process-stage-${key}`} style={styles.stageRow}>
            <View style={styles.rail}><View style={[styles.stageDot, (complete || available) && { backgroundColor: available ? colors.brandPrimary : colors.success }]}>{complete ? <Icon name="check" size={15} color="#fff" /> : <Icon name={stage.icon} size={15} color={available ? "#fff" : colors.muted} />}</View>{index < 5 ? <View style={[styles.stageLine, complete && { backgroundColor: colors.success }]} /> : null}</View>
            <Pressable disabled={!available} onPress={() => moveTo(key)} style={[styles.stageCard, available && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }, pending && { opacity: 0.45 }]}><Text style={styles.stageTitle}>{stage.label}</Text><Text style={styles.stageSub}>{available ? "Klik untuk lanjut ke tahap ini →" : complete ? "Selesai" : "Menunggu tahap sebelumnya"}</Text></Pressable>
          </View>;
        })}
      </View>
      {order.status === "ready" ? <View style={styles.readyBox}><Icon name="basket-check" size={24} color="#15803D" /><View style={{ flex: 1 }}><Text style={styles.readyTitle}>Siap Diambil</Text><Text style={styles.readySub}>Laundry sudah selesai dikemas dan menunggu pelanggan.</Text></View></View> : null}
    </ScrollView>
  </View>;
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.lg },
  summary: { flexDirection: "row", gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, ...shadow.card },
  customer: { fontFamily: fonts.displayBold, fontSize: 18, color: c.onSurface }, items: { marginTop: 4, fontFamily: fonts.body, fontSize: 13, color: c.muted, lineHeight: 19 }, total: { fontFamily: fonts.displayBold, fontSize: 15, color: c.brandPrimary },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: c.onSurface }, timeline: { gap: 0 }, stageRow: { flexDirection: "row", minHeight: 78 }, rail: { width: 42, alignItems: "center" }, stageDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center", zIndex: 1 }, stageLine: { position: "absolute", top: 31, bottom: -1, width: 2, backgroundColor: c.border },
  stageCard: { flex: 1, alignSelf: "flex-start", minHeight: 62, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: spacing.md, marginBottom: spacing.sm }, stageTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurface }, stageSub: { marginTop: 2, fontFamily: fonts.body, fontSize: 12, color: c.muted },
  readyBox: { flexDirection: "row", gap: spacing.md, backgroundColor: "#DCFCE7", borderRadius: radius.md, padding: spacing.md }, readyTitle: { fontFamily: fonts.displayBold, fontSize: 16, color: "#15803D" }, readySub: { marginTop: 2, fontFamily: fonts.body, fontSize: 12, color: "#166534" },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: c.surface, borderTopWidth: 1, borderColor: c.border }, backBtn: { minHeight: 48, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceSecondary, borderRadius: radius.md }, backText: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurfaceSecondary },
}));