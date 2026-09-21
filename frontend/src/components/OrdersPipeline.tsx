import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, Modal, TextInput } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { api } from "@/src/api";
import { fonts, makeStyles, radius, spacing, useTheme, shadow } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { Pill, ChipRow, PrimaryButton, Loading, EmptyState, BodyText } from "@/src/components/ui";
import { STAGE, NEXT_LABEL, nextStage } from "@/src/status";
import { rupiah, kg, timeLeft } from "@/src/format";

const FILTERS = [
  { key: "active", label: "Aktif" },
  { key: "received", label: "Diterima" },
  { key: "washing", label: "Cuci" },
  { key: "drying", label: "Pengering" },
  { key: "ironing", label: "Setrika" },
  { key: "packing", label: "Packing" },
  { key: "completed", label: "Selesai" },
];

export function OrdersPipeline({
  outletId, employeeId, employeeName, canCancel = true, todayOnly = false,
}: { outletId: string | null; employeeId?: string; employeeName?: string; canCancel?: boolean; todayOnly?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const router = useRouter();
  const [filter, setFilter] = useState("active");
  const [openId, setOpenId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const buildUrl = () => {
    const params = new URLSearchParams();
    if (outletId) params.set("outlet_id", outletId);
    if (filter === "active") params.set("active", "true");
    else params.set("status", filter);
    if (todayOnly) params.set("queue", "true");
    params.set("sort", "fifo");
    params.set("limit", "100");
    return `/orders?${params.toString()}`;
  };

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["orders", outletId, filter, todayOnly],
    queryFn: () => api.get(buildUrl()),
    placeholderData: (previous) => previous,
    staleTime: 15000,
  });

  useEffect(() => { if (outletId) ["received", "washing", "drying", "ironing", "packing"].forEach((status) => qc.prefetchQuery({ queryKey: ["orders", outletId, status, todayOnly], queryFn: () => api.get(`/orders?outlet_id=${outletId}&status=${status}${todayOnly ? "&queue=true" : ""}&sort=fifo&limit=100`), staleTime: 15000 })); }, [outletId, todayOnly, qc]);

  const cancel = useMutation({
    mutationFn: (id: string) => api.post(`/orders/${id}/cancel`, { reason: reason || "Dibatalkan" }),
    onSuccess: () => {
      setCancelId(null); setReason("");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const list = (data || []).filter((o: any) => o.status !== "ready");
  const express = list.filter((o: any) => o.express);
  const regular = list.filter((o: any) => !o.express);

  const Card = ({ item, index }: { item: any; index: number }) => {
    const stage = STAGE[item.status] || STAGE.received;
    const open = openId === item.id;
    const nxt = nextStage(item.status);
    const canAdvance = nxt && item.status !== "cancelled";
    const total = Number(item.total);

    return (
      <View style={[styles.card, item.express && { borderColor: "#DC2626", borderWidth: 1.5, backgroundColor: "#FFF7F7" }]} testID={`order-card-${item.code}`}>
        {/* Ringkas */}
        <Pressable
          testID={`toggle-order-${item.code}`}
          onPress={() => setOpenId(open ? null : item.id)}
          style={styles.cardHead}
        >
          <View style={[styles.queueNo, item.express && { backgroundColor: "#DC2626" }]}>
            <Text style={[styles.queueNoText, item.express && { color: colors.onBrandPrimary }]}>{index + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.customer} numberOfLines={1}>{item.customer_name}</Text>
            <Text style={[styles.code, item.express && { color: "#B91C1C" }]}>
              {item.code} • {new Date(item.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
            </Text>
            {item.express ? <View testID={`express-badge-${item.code}`} style={styles.expressBadge}><Icon name="lightning-bolt" size={13} color="#B91C1C" /><Text style={styles.expressBadgeText}>EXPRESS</Text></View> : null}
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <Pill label={item.stage_label || stage.label} tone={stage.tone as any} />
            <Text style={styles.total}>{rupiah(total)}</Text>
          </View>
          <Icon name={open ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
        </Pressable>

        {/* Detail */}
        {open ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <View style={styles.divider} />
            <View style={styles.itemsRow}>
              <Icon name="hanger" size={14} color={colors.muted} />
              <Text style={styles.itemsText}>
                {item.items_summary || (Array.isArray(item.request_items) && item.request_items.length
                  ? item.request_items.map((r: any) => `${r.category} ±${r.qty}`).join(", ")
                  : "Rincian belum ada")}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Meta icon="scale" text={item.weight_kg > 0 ? kg(item.weight_kg) : `${item.unit_qty} pcs`} />
              <Meta
                icon={item.delivery_type === "delivery" ? "truck-fast" : item.delivery_type === "pickup" ? "moped" : "storefront"}
                text={item.delivery_type === "delivery" ? "Antar" : item.delivery_type === "pickup" ? "Jemput" : "Datang"}
              />
              <Meta icon={item.overdue ? "alarm-light" : "clock-outline"} text={item.status === "completed" ? "Selesai" : timeLeft(item.due_at)} />
              <Meta icon="flash" text={item.express ? "Express" : "Reguler"} />
            </View>
            {item.customer_phone ? <Meta icon="phone" text={item.customer_phone} /> : null}
            {item.notes ? <Text style={styles.notes}>Catatan: {item.notes}</Text> : null}
            <View testID={`payment-status-${item.code}`} style={[styles.paymentStatus, item.payment_status === "paid" ? styles.paidRow : styles.unpaidRow]}>
              <Icon name={item.payment_status === "paid" ? "check-decagram" : "lock-outline"} size={16} color={item.payment_status === "paid" ? "#15803D" : colors.error} />
              <Text style={[styles.paymentStatusText, { color: item.payment_status === "paid" ? "#15803D" : colors.error }]}>{item.payment_status === "paid" ? `Lunas • ${item.payment_method === "coin" ? "JW Coin" : (item.payment_method || "-").toUpperCase()}` : "Belum Lunas"}</Text>
            </View>

            {/* Aksi status */}
            {item.status !== "cancelled" ? (
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
                {canAdvance ? (
                  <Pressable
                    testID={`advance-${item.code}`}
                    onPress={() => { qc.setQueryData(["order-process", item.id], item); router.push(`/proses/${item.id}`); }}
                    style={[styles.smallBtn, { backgroundColor: colors.brandPrimary, flex: 1, ...shadow.soft }]}
                  >
                    <Text style={[styles.smallBtnText, { color: colors.onBrandPrimary }]}>{NEXT_LABEL[item.status]}</Text>
                    <Icon name="arrow-right-bold" size={16} color={colors.onBrandPrimary} />
                  </Pressable>
                ) : null}
                {canCancel ? (
                  <Pressable testID={`cancel-${item.code}`} onPress={() => setCancelId(item.id)} style={styles.cancelBtn}>
                    <Icon name="close" size={16} color={colors.error} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ChipRow items={FILTERS} value={filter} onChange={setFilter} />
      {isLoading ? (
        <Loading />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing["3xl"], gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
        >
          {list.length === 0 ? (
            <EmptyState icon="hanger" title="Tidak ada antrian" subtitle="Order pada filter ini kosong." />
          ) : (
            <>
              <Row title="⚡ Express" count={express.length} />
              {express.length === 0 ? (
                <Text style={styles.emptyRow}>Belum ada order express.</Text>
              ) : express.map((o: any, i: number) => <Card key={o.id} item={o} index={i} />)}

              <Row title="Reguler" count={regular.length} />
              {regular.length === 0 ? (
                <Text style={styles.emptyRow}>Belum ada order reguler.</Text>
              ) : regular.map((o: any, i: number) => <Card key={o.id} item={o} index={i} />)}
            </>
          )}
        </ScrollView>
      )}

      <Modal visible={!!cancelId} transparent animationType="fade" onRequestClose={() => setCancelId(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Batalkan Order?</Text>
            <BodyText muted>Masukkan alasan pembatalan.</BodyText>
            <TextInput
              testID="cancel-reason-input"
              value={reason}
              onChangeText={setReason}
              placeholder="Alasan pembatalan"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <Pressable style={[styles.modalBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={() => setCancelId(null)}>
                <Text style={[styles.smallBtnText, { color: colors.onSurfaceSecondary }]}>Batal</Text>
              </Pressable>
              <PrimaryButton label="Ya, Batalkan" tone="danger" onPress={() => cancel.mutate(cancelId!)} loading={cancel.isPending} testID="confirm-cancel-btn" style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Row({ title, count }: { title: string; count: number }) {
  const styles = useStyles();
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCount}>{count} order</Text>
    </View>
  );
}

function Meta({ icon, text }: { icon: string; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Icon name={icon} size={14} color={colors.muted} />
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: colors.onSurfaceSecondary }}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: c.border, ...shadow.card },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  queueNo: { width: 32, height: 32, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  queueNoText: { fontFamily: fonts.displayBold, fontSize: 14, color: c.onSurfaceSecondary },
  customer: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurface },
  code: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  expressBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 3, marginTop: 3, backgroundColor: "#FEE2E2", borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 3 },
  expressBadgeText: { fontFamily: fonts.bodyBold, fontSize: 10, color: "#B91C1C" },
  total: { fontFamily: fonts.displayBold, fontSize: 14, color: c.onSurface },
  divider: { height: 1, backgroundColor: c.divider },
  itemsRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  itemsText: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: c.onSurfaceSecondary, lineHeight: 17 },
  metaRow: { flexDirection: "row", gap: spacing.lg, flexWrap: "wrap" },
  notes: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  paymentStatus: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.md, padding: spacing.sm },
  paidRow: { backgroundColor: "#DCFCE7" },
  unpaidRow: { backgroundColor: "#FFF1F2" },
  paymentStatusText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  smallBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, paddingHorizontal: 14, borderRadius: radius.md },
  smallBtnText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  cancelBtn: { width: 42, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: "#FFE4E6" },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 16, color: c.onSurface },
  sectionCount: { fontFamily: fonts.bodyBold, fontSize: 12, color: c.muted },
  emptyRow: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  error: { fontFamily: fonts.bodyBold, fontSize: 12, color: c.error },
  modalOverlay: { flex: 1, backgroundColor: "rgba(30,26,52,0.45)", justifyContent: "center", padding: spacing.xl },
  modalCard: { backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm },
  modalTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: c.onSurface },
  input: { marginTop: spacing.sm, backgroundColor: c.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontFamily: fonts.body, fontSize: 14, color: c.onSurface },
  modalBtn: { paddingVertical: 15, paddingHorizontal: 20, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
}));
