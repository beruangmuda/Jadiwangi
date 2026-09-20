import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, Modal, Platform, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import dayjs from "dayjs";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { PrimaryButton, EmptyState, Loading } from "@/src/components/ui";
import { StackHeader, Field } from "@/src/components/form";
import { STAGE } from "@/src/status";
import { rupiah, kg } from "@/src/format";

const TONE: Record<string, keyof ReturnType<typeof useTheme>["colors"]> = {
  neutral: "muted", azure: "brandPrimary", brand: "brand", warning: "warning", success: "success",
};

export default function HariIni() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { session } = useAuth();
  const isOwner = session?.role === "owner";
  const outletId = session?.currentOutletId ?? null;
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["orders-today", outletId],
    queryFn: () => api.get(`/orders?today=true${outletId ? `&outlet_id=${outletId}` : ""}`),
  });

  const cancel = useMutation({
    mutationFn: () => api.post(`/orders/${cancelId}/cancel`, { reason: reason || "Kesalahan input pegawai" }),
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCancelId(null); setReason("");
      qc.invalidateQueries({ queryKey: ["orders-today"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const orders = data || [];
  const totalOmzet = orders.filter((o: any) => o.status !== "cancelled").reduce((s: number, o: any) => s + Number(o.total), 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Transaksi Hari Ini" subtitle={dayjs().format("dddd, DD MMMM YYYY")} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["3xl"] }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
      >
        {isLoading ? <Loading /> : (
          <>
            <View style={styles.summary}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sumLabel}>Nota Masuk</Text>
                <Text style={styles.sumValue}>{orders.length}</Text>
              </View>
              <View style={styles.sumDivider} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sumLabel}>Omzet</Text>
                <Text style={[styles.sumValue, { color: colors.brandPrimary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{rupiah(totalOmzet)}</Text>
              </View>
            </View>

            {orders.length === 0 ? <EmptyState icon="receipt-text" title="Belum ada transaksi hari ini" /> : (
              orders.map((o: any) => {
                const cancelled = o.status === "cancelled";
                const toneKey = TONE[STAGE[o.status]?.tone || "neutral"] || "muted";
                const sc = colors[toneKey] as string;
                return (
                  <View key={o.id} style={[styles.card, cancelled && { opacity: 0.6 }]}>
                    <View style={styles.cardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.code}>{o.code}</Text>
                        <Text style={styles.cust}>{o.customer_name} • {dayjs(o.created_at).format("HH:mm")}</Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: sc + "22" }]}>
                        <Text style={[styles.badgeText, { color: sc }]}>{o.stage_label}</Text>
                      </View>
                    </View>
                    <View style={styles.cardBottom}>
                      <Text style={styles.meta}>{kg(o.weight_kg)} • {o.unit_qty} pcs</Text>
                      <Text style={styles.total}>{rupiah(o.total)}</Text>
                    </View>
                    {isOwner && !cancelled ? (
                      <Pressable testID={`cancel-${o.id}`} onPress={() => setCancelId(o.id)} style={styles.cancelBtn}>
                        <Icon name="close-circle-outline" size={16} color={colors.error} />
                        <Text style={styles.cancelText}>Batalkan Nota (salah input)</Text>
                      </Pressable>
                    ) : null}
                    {cancelled ? <Text style={styles.cancelledNote}>Dibatalkan: {o.cancel_reason || "-"}</Text> : null}
                  </View>
                );
              })
            )}
            {!isOwner ? <Text style={styles.hint}>Hanya Owner yang dapat membatalkan nota.</Text> : null}
          </>
        )}
      </ScrollView>

      <Modal visible={!!cancelId} transparent animationType="fade" onRequestClose={() => setCancelId(null)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={styles.sheetTitle}>Batalkan Nota?</Text>
            <Text style={styles.sheetSub}>Nota yang dibatalkan tidak dihitung ke omzet.</Text>
            <Field label="Alasan Pembatalan" value={reason} onChangeText={setReason} placeholder="Kesalahan input pegawai" testID="cancel-reason" />
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
              <Pressable style={styles.cancel} onPress={() => setCancelId(null)}><Text style={styles.cancelBtnText}>Batal</Text></Pressable>
              <PrimaryButton label="Ya, Batalkan" onPress={() => cancel.mutate()} loading={cancel.isPending} testID="confirm-cancel" style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  summary: { flexDirection: "row", alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg },
  sumLabel: { fontFamily: fonts.bodySemi, fontSize: 12, color: c.muted },
  sumValue: { fontFamily: fonts.displayBold, fontSize: 22, color: c.onSurface, marginTop: 2 },
  sumDivider: { width: 1, height: 36, backgroundColor: c.divider, marginHorizontal: spacing.md },
  card: { backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md, gap: spacing.sm },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  code: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurface },
  cust: { fontFamily: fonts.body, fontSize: 12, color: c.muted, marginTop: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  meta: { fontFamily: fonts.bodySemi, fontSize: 12, color: c.onSurfaceSecondary },
  total: { fontFamily: fonts.displayBold, fontSize: 15, color: c.brandPrimary },
  cancelBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#FFE4E6", borderRadius: radius.sm, paddingVertical: 9, marginTop: 2 },
  cancelText: { fontFamily: fonts.bodyBold, fontSize: 12, color: c.error },
  cancelledNote: { fontFamily: fonts.body, fontSize: 12, color: c.error },
  hint: { fontFamily: fonts.body, fontSize: 12, color: c.muted, textAlign: "center", marginTop: spacing.sm },
  overlay: { flex: 1, backgroundColor: "rgba(30,26,52,0.45)", justifyContent: "center", padding: spacing.lg },
  sheet: { backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm },
  sheetTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: c.onSurface },
  sheetSub: { fontFamily: fonts.body, fontSize: 13, color: c.muted },
  cancel: { paddingVertical: 15, paddingHorizontal: 20, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurfaceSecondary },
}));
