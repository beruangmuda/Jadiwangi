import React, { useState } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, Modal, TextInput, Platform } from "react-native";
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

export function OrdersPipeline({ outletId, employeeId, employeeName, canCancel = true }: { outletId: string | null; employeeId?: string; employeeName?: string; canCancel?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("active");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const buildUrl = () => {
    const params = new URLSearchParams();
    if (outletId) params.set("outlet_id", outletId);
    if (filter === "active") params.set("active", "true");
    else params.set("status", filter);
    params.set("limit", "100");
    return `/orders?${params.toString()}`;
  };

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["orders", outletId, filter],
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
    mutationFn: (id: string) => api.post(`/orders/${id}/pay`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api.post(`/orders/${id}/cancel`, { reason: reason || "Dibatalkan" }),
    onSuccess: () => {
      setCancelId(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const renderItem = ({ item }: { item: any }) => {
    const stage = STAGE[item.status] || STAGE.received;
    const nxt = nextStage(item.status);
    const canAdvance = nxt && item.status !== "cancelled";
    return (
      <View style={styles.card} testID={`order-card-${item.code}`}>
        <View style={styles.rowBetween}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <View style={styles.iconBox}>
              <Icon name={stage.icon} size={20} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.customer} numberOfLines={1}>{item.customer_name}</Text>
              <Text style={styles.code}>{item.code}</Text>
            </View>
          </View>
          <Pill label={stage.label} tone={stage.tone as any} />
        </View>

        <View style={styles.metaRow}>
          <Meta icon="scale" text={item.weight_kg > 0 ? kg(item.weight_kg) : `${item.unit_qty} pcs`} />
          <Meta icon="cash" text={rupiah(item.total)} />
          <Meta
            icon={item.delivery_type === "delivery" ? "truck-fast" : item.delivery_type === "pickup" ? "moped" : "storefront"}
            text={item.delivery_type === "delivery" ? "Antar" : item.delivery_type === "pickup" ? "Jemput" : "Datang"}
          />
        </View>

        <View style={styles.rowBetween}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name={item.overdue ? "alarm-light" : "clock-outline"} size={14} color={item.overdue ? colors.error : colors.muted} />
            <Text style={[styles.sla, item.overdue && { color: colors.error }]}>
              {item.status === "completed" ? "Selesai" : timeLeft(item.due_at)}
            </Text>
          </View>
          <Pill label={item.payment_status === "paid" ? "Lunas" : "Belum Bayar"} tone={item.payment_status === "paid" ? "success" : "warning"} />
        </View>

        {(canAdvance || item.payment_status !== "paid") && item.status !== "cancelled" ? (
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
            {item.payment_status !== "paid" ? (
              <Pressable
                testID={`pay-${item.code}`}
                onPress={() => pay.mutate(item.id)}
                style={[styles.smallBtn, { backgroundColor: colors.surfaceSecondary }]}
              >
                <Icon name="qrcode" size={16} color={colors.brand} />
                <Text style={[styles.smallBtnText, { color: colors.brand }]}>Bayar</Text>
              </Pressable>
            ) : null}
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
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ChipRow items={FILTERS} value={filter} onChange={setFilter} />
      {isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={data || []}
          keyExtractor={(o) => o.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing["3xl"], gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<EmptyState icon="hanger" title="Tidak ada antrian" subtitle="Order pada filter ini kosong." />}
        />
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
  card: { backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: c.border, gap: spacing.sm, ...shadow.card },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  iconBox: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  customer: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurface },
  code: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  metaRow: { flexDirection: "row", gap: spacing.lg, flexWrap: "wrap" },
  sla: { fontFamily: fonts.bodySemi, fontSize: 12, color: c.muted },
  smallBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, paddingHorizontal: 14, borderRadius: radius.md },
  smallBtnText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  cancelBtn: { width: 42, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: "#FFE4E6" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(30,26,52,0.45)", justifyContent: "center", padding: spacing.xl },
  modalCard: { backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm },
  modalTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: c.onSurface },
  input: { marginTop: spacing.sm, backgroundColor: c.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontFamily: fonts.body, fontSize: 14, color: c.onSurface },
  modalBtn: { paddingVertical: 15, paddingHorizontal: 20, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
}));
