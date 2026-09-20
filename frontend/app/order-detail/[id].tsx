import React, { useState } from "react";
import { View, Text, Pressable, Platform, Linking } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { Card, PrimaryButton, Loading, Pill, SectionHeader } from "@/src/components/ui";
import { StackHeader, Field } from "@/src/components/form";
import { rupiah, formatDateTime, kg } from "@/src/format";
import { PIPELINE, STAGE } from "@/src/status";

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const cust = session?.customer;

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [voucher, setVoucher] = useState<any>(null);

  const { data: order, isLoading } = useQuery({ queryKey: ["order-detail", id], queryFn: () => api.get(`/orders/${id}`), enabled: !!id });
  const { data: outlets } = useQuery({ queryKey: ["outlets"], queryFn: () => api.get("/outlets") });
  const { data: myReviews } = useQuery({
    queryKey: ["my-reviews", cust?.id],
    queryFn: () => api.get(`/reviews?customer_id=${cust?.id}`),
    enabled: !!cust?.id,
  });

  const outlet = (outlets || []).find((o: any) => o.id === order?.outlet_id);
  const existing = (myReviews || []).find((r: any) => r.order_id === id);

  const send = useMutation({
    mutationFn: () => api.post("/reviews", {
      customer_id: cust?.id, outlet_id: order?.outlet_id, order_id: id, rating, comment,
    }),
    onSuccess: (res: any) => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setVoucher(res?.voucher || null);
      setComment("");
      qc.invalidateQueries({ queryKey: ["my-reviews"] });
      qc.invalidateQueries({ queryKey: ["cust-detail"] });
    },
  });

  if (isLoading || !order) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <StackHeader title="Detail Pesanan" />
        <Loading />
      </View>
    );
  }

  const idx = (PIPELINE as readonly string[]).indexOf(order.status);
  const canReview = order.status === "completed" && !existing;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title={order.code} subtitle={formatDateTime(order.created_at)} />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["3xl"] }} bottomOffset={20}>
        {/* Status */}
        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={styles.status} testID="order-status">{order.stage_label}</Text>
            <Pill label={order.payment_status === "paid" ? "Lunas" : "Belum bayar"} tone={order.payment_status === "paid" ? "success" : "warning"} />
          </View>
          {order.status === "cancelled" ? (
            <Text style={styles.hint}>Pesanan dibatalkan{order.cancel_reason ? `: ${order.cancel_reason}` : ""}.</Text>
          ) : order.is_request ? (
            <Text style={styles.hint}>Menunggu pegawai menimbang laundry kamu. Nota akan muncul di menu Bayar.</Text>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {PIPELINE.map((s, i) => {
                const st = STAGE[s];
                const passed = idx >= i;
                return (
                  <View key={s} style={styles.stepRow}>
                    <View style={[styles.stepDot, passed && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                      <Icon name={passed ? "check" : st.icon} size={12} color={passed ? colors.onBrandPrimary : colors.muted} />
                    </View>
                    <Text style={[styles.stepLabel, passed && { color: colors.onSurface, fontFamily: fonts.bodyBold }]}>{st.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        {/* Rincian */}
        <Card style={{ gap: spacing.sm }}>
          <SectionHeader title="Rincian Nota" />
          {(order.items || []).length === 0 && (order.request_items || []).length > 0 ? (
            (order.request_items || []).map((it: any, i: number) => (
              <View key={i} style={styles.itemRow}>
                <Text style={styles.itemName}>{it.category}</Text>
                <Text style={styles.hint}>± {it.qty}</Text>
              </View>
            ))
          ) : (order.items || []).length === 0 ? (
            <Text style={styles.hint}>Belum ada rincian item.</Text>
          ) : (
            (order.items || []).map((it: any) => (
              <View key={it.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{it.service_name}</Text>
                  <Text style={styles.hint}>{Number(it.qty)} {it.unit} × {rupiah(it.price)}</Text>
                </View>
                <Text style={styles.itemName}>{rupiah(it.subtotal)}</Text>
              </View>
            ))
          )}
          <View style={styles.divider} />
          <Row label="Berat / Jumlah" value={`${kg(order.weight_kg)}${order.unit_qty ? ` • ${order.unit_qty} pcs` : ""}`} />
          <Row label="Layanan Antar" value={order.delivery_type === "pickup" ? "Dijemput" : order.delivery_type === "delivery" ? "Diantar" : "Antar Sendiri"} />
          {order.discount ? <Row label="Diskon" value={`- ${rupiah(order.discount)}`} /> : null}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{rupiah(order.total)}</Text>
          </View>
          {order.payment_status !== "paid" && Number(order.total) > 0 ? (
            <PrimaryButton label="Bayar Sekarang" icon="wallet" onPress={() => router.push("/(customer)/bayar")} testID="go-bayar" />
          ) : null}
        </Card>

        {order.notes ? (
          <Card><SectionHeader title="Catatan" /><Text style={styles.hint}>{order.notes}</Text></Card>
        ) : null}

        {/* Ulasan */}
        {order.status === "completed" ? (
          <Card style={{ gap: spacing.md }}>
            <SectionHeader title="Nilai & Ulas" />
            {existing ? (
              <View style={{ gap: spacing.sm }}>
                <Stars value={existing.rating} />
                <Text style={styles.hint}>Terima kasih sudah memberi ulasan{existing.comment ? `: "${existing.comment}"` : ""}.</Text>
              </View>
            ) : send.isSuccess ? (
              <View style={{ gap: spacing.md }}>
                <Text style={styles.thanks}>Terima kasih atas ulasanmu! 🙏</Text>
                {voucher ? (
                  <View style={styles.voucher} testID="voucher-granted">
                    <Icon name="ticket-percent" size={22} color={colors.onBrandPrimary} />
                    <Text style={styles.voucherText}>{voucher.title} sudah masuk ke akunmu. Pakai saat bayar order berikutnya!</Text>
                  </View>
                ) : null}
                {rating >= 5 && outlet?.review_url ? (
                  <PrimaryButton label="Tulis Ulasan di Google Maps" icon="google-maps" tone="lavender" onPress={() => Linking.openURL(outlet.review_url)} testID="open-gmaps" />
                ) : null}
                {rating <= 2 ? <Text style={styles.hint}>Keluhanmu sudah diteruskan ke owner. Kami akan segera menghubungi kamu.</Text> : null}
              </View>
            ) : (
              <View style={{ gap: spacing.md }}>
                <Text style={styles.hint}>Seberapa puas kamu dengan layanan kami?</Text>
                <View style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "center" }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable key={n} testID={`star-${n}`} onPress={() => { setRating(n); if (Platform.OS !== "web") Haptics.selectionAsync(); }} hitSlop={6}>
                      <Icon name={rating >= n ? "star" : "star-outline"} size={38} color={rating >= n ? "#F59E0B" : colors.muted} />
                    </Pressable>
                  ))}
                </View>
                {rating > 0 && rating <= 2 ? (
                  <>
                    <View style={styles.warn}>
                      <Icon name="message-alert-outline" size={16} color={colors.error} />
                      <Text style={styles.warnText}>Maaf atas ketidaknyamanannya. Tulis keluhan atau saran kamu, langsung kami sampaikan ke owner.</Text>
                    </View>
                    <Field label="Keluhan / Saran" value={comment} onChangeText={setComment} placeholder="Ceritakan kendalanya…" testID="complaint-input" />
                  </>
                ) : rating >= 3 ? (
                  <Field label="Komentar (opsional)" value={comment} onChangeText={setComment} placeholder="Tulis pengalamanmu" testID="review-comment" />
                ) : null}
                {rating === 5 ? (
                  <View style={styles.reward}>
                    <Icon name="gift-outline" size={16} color={colors.brand} />
                    <Text style={styles.noteText}>Ulasan 5 bintang pertamamu berhadiah diskon 20% untuk order berikutnya.</Text>
                  </View>
                ) : null}
                <PrimaryButton
                  label={rating === 0 ? "Pilih bintang dulu" : rating <= 2 ? "Kirim Pengaduan" : "Kirim Ulasan"}
                  icon="send"
                  onPress={() => send.mutate()}
                  loading={send.isPending}
                  disabled={rating === 0 || (rating <= 2 && comment.trim().length < 5)}
                  testID="submit-review"
                />
              </View>
            )}
          </Card>
        ) : canReview ? null : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.itemRow}>
      <Text style={styles.hint}>{label}</Text>
      <Text style={styles.itemName}>{value}</Text>
    </View>
  );
}

function Stars({ value }: { value: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} name={value >= n ? "star" : "star-outline"} size={22} color={value >= n ? "#F59E0B" : colors.muted} />
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  status: { fontFamily: fonts.displayBold, fontSize: 18, color: c.brandPrimary },
  hint: { fontFamily: fonts.body, fontSize: 12, color: c.muted, lineHeight: 17 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
  stepLabel: { fontFamily: fonts.body, fontSize: 13, color: c.muted },
  itemRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  itemName: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurface },
  divider: { height: 1, backgroundColor: c.divider, marginVertical: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: c.divider, paddingTop: spacing.sm },
  totalLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurfaceSecondary },
  totalValue: { fontFamily: fonts.displayBold, fontSize: 18, color: c.brandPrimary },
  thanks: { fontFamily: fonts.displayBold, fontSize: 16, color: c.onSurface },
  voucher: { flexDirection: "row", gap: spacing.sm, alignItems: "center", backgroundColor: c.brand, borderRadius: radius.md, padding: spacing.md },
  voucherText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 13, color: c.onBrand, lineHeight: 18 },
  warn: { flexDirection: "row", gap: spacing.sm, backgroundColor: "#FFE4E6", borderRadius: radius.md, padding: spacing.md },
  warnText: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: c.error, lineHeight: 17 },
  reward: { flexDirection: "row", gap: spacing.sm, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  noteText: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: c.onSurfaceSecondary, lineHeight: 17 },
}));
