import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, Modal, TextInput, Platform } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

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
  { key: "ready", label: "Siap Diambil" },
  { key: "completed", label: "Selesai" },
];

const PAY_METHODS = [
  { key: "cash", label: "Tunai", icon: "cash" },
  { key: "qris", label: "QRIS", icon: "qrcode-scan" },
  { key: "coin", label: "JW Coin", icon: "hand-coin" },
];

export function OrdersPipeline({
  outletId, employeeId, employeeName, canCancel = true, todayOnly = false,
}: { outletId: string | null; employeeId?: string; employeeName?: string; canCancel?: boolean; todayOnly?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("active");
  const [openId, setOpenId] = useState<string | null>(null);
  const [method, setMethod] = useState("cash");
  const [payError, setPayError] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const buildUrl = () => {
    const params = new URLSearchParams();
    if (outletId) params.set("outlet_id", outletId);
    if (filter === "active") params.set("active", "true");
    else params.set("status", filter);
    if (todayOnly) params.set("today", "true");
    params.set("sort", "fifo");
    params.set("limit", "100");
    return `/orders?${params.toString()}`;
  };

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["orders", outletId, filter, todayOnly],
    queryFn: () => api.get(buildUrl()),
  });

  const advance = useMutation({
    mutationFn: (id: string) => api.post(`/orders/${id}/advance`, employeeId ? { employee_id: employeeId, employee_name: employeeName || "" } : {}),
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const pay = useMutation({
    mutationFn: (id: string) => api.post(`/orders/${id}/pay`, { method }),
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPayError("");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => setPayError(e?.message || "Verifikasi pembayaran gagal"),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api.post(`/orders/${id}/cancel`, { reason: reason || "Dibatalkan" }),
    onSuccess: () => {
      setCancelId(null); setReason("");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const list = data || [];
  const express = list.filter((o: any) => o.express);
  const regular = list.filter((o: any) => !o.express);

  const Card = ({ item, index }: { item: any; index: number }) => {
    const stage = STAGE[item.status] || STAGE.received;
    const open = openId === item.id;
    const nxt = nextStage(item.status);
    const canAdvance = nxt && item.status !== "cancelled";
    const total = Number(item.total);
    const coinCharge = Math.round(total * 0.9);

    return (
      <View style={[styles.card, item.express && { borderColor: colors.brandPrimary, borderWidth: 1.5 }]} testID={`order-card-${item.code}`}>
        {/* Ringkas */}
        <Pressable
          onPress={() => { setOpenId(open ? null : item.id); setMethod("cash"); setPayError(""); }}
          style={styles.cardHead}
        >
          <View style={[styles.queueNo, item.express && { backgroundColor: colors.brandPrimary }]}>
            <Text style={[styles.queueNoText, item.express && { color: colors.onBrandPrimary }]}>{index + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.customer} numberOfLines={1}>{item.customer_name}</Text>
            <Text style={styles.code}>
              {item.code} • {new Date(item.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
            </Text>
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

            {/* Konfirmasi pembayaran */}
            {item.payment_status !== "paid" && item.status !== "cancelled" && total > 0 ? (
              <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
                <Text style={styles.label}>Konfirmasi Pembayaran</Text>
                <View style={styles.methodRow}>
                  {PAY_METHODS.map((m) => {
                    const on = method === m.key;
                    return (
                      <Pressable
                        key={m.key}
                        testID={`pay-method-${m.key}-${item.code}`}
                        onPress={() => { setMethod(m.key); setPayError(""); }}
                        style={[styles.methodCard, on && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}
                      >
                        <Icon name={m.icon} size={16} color={on ? colors.brandPrimary : colors.muted} />
                        <Text style={[styles.methodLabel, on && { color: colors.brandPrimary }]}>{m.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {method === "coin" ? (
                  <Text style={styles.hint}>Saldo coin pelanggan terpotong {coinCharge.toLocaleString("id-ID")} coin (diskon 10%).</Text>
                ) : null}
                {payError ? <Text style={styles.error} testID="pay-error">{payError}</Text> : null}
                <Pressable
                  testID={`pay-${item.code}`}
                  onPress={() => pay.mutate(item.id)}
                  style={[styles.payBtn, { backgroundColor: colors.brand }]}
                >
                  <Icon name="cash-check" size={16} color={colors.onBrand} />
                  <Text style={[styles.smallBtnText, { color: colors.onBrand }]}>
                    Tandai Lunas • {rupiah(method === "coin" ? coinCharge : total)}
                  </Text>
                </Pressable>
              </View>
            ) : item.payment_status === "paid" ? (
              <View style={styles.paidRow}>
                <Icon name="check-decagram" size={16} color="#15803D" />
                <Text style={styles.paidText}>Lunas • {item.payment_method === "coin" ? "JW Coin" : (item.payment_method || "-").toUpperCase()}</Text>
              </View>
            ) : null}

            {/* Aksi status */}
            {item.status !== "cancelled" ? (
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
                {canAdvance ? (
                  <Pressable
                    testID={`advance-${item.code}`}
                    onPress={() => advance.mutate(item.id)}
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
  total: { fontFamily: fonts.displayBold, fontSize: 14, color: c.onSurface },
  divider: { height: 1, backgroundColor: c.divider },
  itemsRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  itemsText: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: c.onSurfaceSecondary, lineHeight: 17 },
  metaRow: { flexDirection: "row", gap: spacing.lg, flexWrap: "wrap" },
  notes: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurfaceSecondary },
  hint: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  methodRow: { flexDirection: "row", gap: spacing.sm },
  methodCard: { flex: 1, alignItems: "center", gap: 4, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface },
  methodLabel: { fontFamily: fonts.bodyBold, fontSize: 11, color: c.onSurfaceSecondary },
  payBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: radius.md },
  paidRow: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#DCFCE7", borderRadius: radius.md, padding: spacing.sm },
  paidText: { fontFamily: fonts.bodyBold, fontSize: 12, color: "#15803D" },
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
