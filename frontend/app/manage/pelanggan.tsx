import React, { useState } from "react";
import { View, Text, Pressable, Platform, Modal, ScrollView, TextInput } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import dayjs from "dayjs";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { Card, PrimaryButton, EmptyState, Loading } from "@/src/components/ui";
import { StackHeader, Field } from "@/src/components/form";
import { rupiah, kg } from "@/src/format";

export default function ManagePelanggan() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { session } = useAuth();
  const outlets = session?.outlets || [];

  const [q, setQ] = useState("");
  const [form, setForm] = useState<any>(null); // add/edit form
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers", "manage", q],
    queryFn: () => api.get(`/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  });

  const { data: detail } = useQuery({
    queryKey: ["customer-detail", detailId],
    queryFn: () => api.get(`/customers/${detailId}/detail`),
    enabled: !!detailId,
  });

  const save = useMutation({
    mutationFn: () => {
      const body = { name: form.name, phone: form.phone, email: form.email, address: form.address, deposit: Number(form.deposit) || 0, outlet_id: form.outlet_id };
      return form.id ? api.put(`/customers/${form.id}`, body) : api.post("/customers", body);
    },
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setForm(null);
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  const emptyForm = () => ({ id: "", name: "", phone: "", email: "", address: "", deposit: "", outlet_id: session?.currentOutletId || outlets[0]?.id || "" });
  const openEdit = (c: any) => setForm({ ...c, deposit: String(c.deposit ?? ""), address: c.address || "", email: c.email || "" });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Database Pelanggan" subtitle="Kelola & pantau riwayat pelanggan" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["3xl"] }}>
        <View style={styles.searchRow}>
          <Icon name="magnify" size={20} color={colors.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Cari nama / no. HP" placeholderTextColor={colors.muted} testID="cust-search" style={styles.searchInput} />
          <Pressable testID="add-customer-btn" onPress={() => setForm(emptyForm())} style={styles.addBtn}>
            <Icon name="plus" size={20} color={colors.onBrandPrimary} />
          </Pressable>
        </View>

        {isLoading ? <Loading /> : (customers || []).length === 0 ? <EmptyState icon="account-off" title="Belum ada pelanggan" /> : (
          (customers || []).map((c: any) => (
            <Pressable key={c.id} testID={`cust-${c.id}`} onPress={() => setDetailId(c.id)} style={styles.row}>
              <View style={styles.avatar}><Text style={styles.initial}>{c.name?.[0]?.toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.sub}>{c.phone || "-"}{c.outlet_name ? ` • ${c.outlet_name.replace("Jadiwangi ", "")}` : ""}</Text>
                <View style={styles.statsRow}>
                  <Text style={styles.stat}>{kg(c.total_kg)}</Text>
                  <Text style={styles.dot}>•</Text>
                  <Text style={styles.stat}>{c.tx_count}x</Text>
                  <Text style={styles.dot}>•</Text>
                  <Text style={[styles.stat, { color: colors.brandPrimary }]}>{rupiah(c.total_spend)}</Text>
                </View>
              </View>
              <Icon name="chevron-right" size={20} color={colors.muted} />
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* Detail modal */}
      <Modal visible={!!detailId} transparent animationType="slide" onRequestClose={() => setDetailId(null)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg, maxHeight: "85%" }]}>
            <View style={styles.grabber} />
            {!detail ? <Loading /> : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
                <View style={styles.detailHead}>
                  <View style={[styles.avatar, { width: 52, height: 52, borderRadius: 26 }]}><Text style={[styles.initial, { fontSize: 22 }]}>{detail.name?.[0]?.toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailName}>{detail.name}</Text>
                    <Text style={styles.sub}>{detail.phone || "-"} • {detail.points} poin</Text>
                  </View>
                  <Pressable testID="edit-customer" onPress={() => { const d = detail; setDetailId(null); openEdit(d); }} style={styles.editBtn}>
                    <Icon name="pencil" size={18} color={colors.brand} />
                  </Pressable>
                </View>
                {detail.address ? <Text style={styles.addr}><Icon name="map-marker" size={13} color={colors.muted} /> {detail.address}</Text> : null}

                <View style={styles.statGrid}>
                  <Stat label="Total Kiloan" value={kg(detail.total_kg)} icon="scale-balance" />
                  <Stat label="Jumlah Transaksi" value={`${detail.tx_count}x`} icon="receipt-text" />
                  <Stat label="Total Belanja" value={rupiah(detail.total_spend)} icon="cash-multiple" tone />
                  <Stat label="Saldo Deposit" value={rupiah(detail.deposit)} icon="wallet" />
                </View>
                <View style={styles.dateRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dateLabel}>Transaksi Pertama</Text>
                    <Text style={styles.dateVal}>{detail.first_order ? dayjs(detail.first_order).format("DD MMM YYYY") : "-"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dateLabel}>Transaksi Terakhir</Text>
                    <Text style={styles.dateVal}>{detail.last_order ? dayjs(detail.last_order).format("DD MMM YYYY") : "-"}</Text>
                  </View>
                </View>

                <Text style={styles.recentTitle}>Riwayat Order Terakhir</Text>
                {(detail.recent_orders || []).length === 0 ? <Text style={styles.sub}>Belum ada order.</Text> : (
                  (detail.recent_orders || []).map((o: any) => (
                    <View key={o.code} style={styles.recentRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.recentCode}>{o.code}</Text>
                        <Text style={styles.sub}>{dayjs(o.created_at).format("DD MMM YYYY")} • {kg(o.weight_kg)}</Text>
                      </View>
                      <Text style={styles.recentTotal}>{rupiah(o.total)}</Text>
                    </View>
                  ))
                )}
                <Pressable style={styles.closeBtn} onPress={() => setDetailId(null)}><Text style={styles.closeText}>Tutup</Text></Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Add/Edit form modal */}
      <Modal visible={!!form} transparent animationType="slide" onRequestClose={() => setForm(null)}>
        <View style={styles.overlay}>
          <KeyboardAwareScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} bottomOffset={20}>
            {form ? (
              <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
                <View style={styles.grabber} />
                <Text style={styles.detailName}>{form.id ? "Edit Pelanggan" : "Tambah Pelanggan"}</Text>
                <Card style={{ gap: spacing.md, marginTop: spacing.sm }}>
                  <Field label="Nama" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="Nama pelanggan" testID="f-name" />
                  <Field label="No. HP" value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} placeholder="0812xxxxxxx" keyboardType="phone-pad" testID="f-phone" />
                  <Field label="Alamat" value={form.address} onChangeText={(t) => setForm({ ...form, address: t })} placeholder="Alamat lengkap" testID="f-address" />
                  <Field label="Email (opsional)" value={form.email} onChangeText={(t) => setForm({ ...form, email: t })} placeholder="email@mail.com" keyboardType="email-address" testID="f-email" />
                  <Field label="Deposit" value={form.deposit} onChangeText={(t) => setForm({ ...form, deposit: t })} placeholder="0" keyboardType="number-pad" testID="f-deposit" />
                  <View style={{ gap: spacing.xs }}>
                    <Text style={styles.label}>Outlet</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                      {outlets.map((o: any) => {
                        const on = o.id === form.outlet_id;
                        return (
                          <Pressable key={o.id} onPress={() => setForm({ ...form, outlet_id: o.id })} style={[styles.chip, on && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                            <Text style={[styles.chipText, on && { color: colors.onBrandPrimary }]}>{o.city}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <Pressable style={styles.cancel} onPress={() => setForm(null)}><Text style={styles.closeText}>Batal</Text></Pressable>
                    <PrimaryButton label="Simpan" onPress={() => save.mutate()} loading={save.isPending} disabled={!form.name} testID="save-customer" style={{ flex: 1 }} />
                  </View>
                </Card>
              </View>
            ) : <View />}
          </KeyboardAwareScrollView>
        </View>
      </Modal>
    </View>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon: string; tone?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.statCard}>
      <Icon name={icon} size={18} color={tone ? colors.brandPrimary : colors.brand} />
      <Text style={[styles.statVal, tone && { color: colors.brandPrimary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, paddingVertical: 12, fontFamily: fonts.body, fontSize: 14, color: c.onSurface },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurfaceSecondary },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurfaceSecondary },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brand, alignItems: "center", justifyContent: "center" },
  initial: { fontFamily: fonts.displayBold, fontSize: 18, color: c.onBrand },
  name: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurface },
  sub: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  stat: { fontFamily: fonts.bodyBold, fontSize: 12, color: c.onSurfaceSecondary },
  dot: { color: c.muted, fontSize: 11 },
  overlay: { flex: 1, backgroundColor: "rgba(30,26,52,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, gap: spacing.sm },
  grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: c.border, alignSelf: "center", marginBottom: spacing.xs },
  detailHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  detailName: { fontFamily: fonts.displayBold, fontSize: 18, color: c.onSurface },
  editBtn: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  addr: { fontFamily: fonts.body, fontSize: 13, color: c.onSurfaceSecondary },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statCard: { flexBasis: "47%", flexGrow: 1, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  statVal: { fontFamily: fonts.displayBold, fontSize: 16, color: c.onSurface },
  statLbl: { fontFamily: fonts.body, fontSize: 11, color: c.muted },
  dateRow: { flexDirection: "row", gap: spacing.md, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  dateLabel: { fontFamily: fonts.body, fontSize: 11, color: c.muted },
  dateVal: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurface, marginTop: 2 },
  recentTitle: { fontFamily: fonts.displayBold, fontSize: 15, color: c.onSurface, marginTop: spacing.xs },
  recentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.divider },
  recentCode: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurface },
  recentTotal: { fontFamily: fonts.displayBold, fontSize: 13, color: c.brandPrimary },
  closeBtn: { paddingVertical: 14, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", marginTop: spacing.sm },
  closeText: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurfaceSecondary },
  cancel: { paddingVertical: 15, paddingHorizontal: 20, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
}));
