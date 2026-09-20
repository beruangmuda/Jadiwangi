import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Modal, Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import dayjs from "dayjs";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, shadow, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { PrimaryButton, EmptyState, Loading } from "@/src/components/ui";
import { Field } from "@/src/components/form";
import { OutletSwitcher } from "@/src/components/OutletSwitcher";
import { rupiah, kg } from "@/src/format";

export default function GajiPegawai() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { session } = useAuth();
  const outlets = session?.outlets || [];
  const [outletId, setOutletId] = useState<string>(session?.currentOutletId || outlets[0]?.id || "");
  const [period, setPeriod] = useState<string>(dayjs().format("YYYY-MM"));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [edit, setEdit] = useState<any>(null);

  useEffect(() => {
    if (!outletId && outlets.length > 0) setOutletId(session?.currentOutletId || outlets[0].id);
  }, [outlets, outletId, session]);

  const months = useMemo(() => Array.from({ length: 6 }).map((_, i) => dayjs().subtract(i, "month").format("YYYY-MM")), []);

  const { data, isLoading } = useQuery({
    queryKey: ["payroll", outletId, period],
    queryFn: () => api.get(`/payroll?period=${period}${outletId ? `&outlet_id=${outletId}` : ""}`),
    enabled: !!outletId,
  });

  const saveManual = useMutation({
    mutationFn: () => api.post("/payroll/manual", {
      employee_id: edit.employee_id, period,
      lembur_shifts: Number(edit.lembur_shifts) || 0,
      perjalanan_dinas: Number(edit.perjalanan_dinas) || 0,
    }),
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEdit(null);
      qc.invalidateQueries({ queryKey: ["payroll"] });
    },
  });

  const emps = data?.employees || [];
  const grandTotal = emps.reduce((s: number, e: any) => s + e.total, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Gaji Pegawai</Text>
        <OutletSwitcher />
      </View>

      <View style={styles.periodBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
          {months.map((m) => {
            const on = m === period;
            return (
              <Pressable key={m} testID={`gaji-period-${m}`} onPress={() => setPeriod(m)} style={[styles.periodChip, on && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
                <Text style={[styles.periodText, on && { color: colors.onBrand }]}>{dayjs(m + "-01").format("MMM YYYY")}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["3xl"] }}>
        {isLoading ? <Loading /> : emps.length === 0 ? <EmptyState icon="account-cash" title="Belum ada pegawai" /> : (
          <>
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total Gaji ({dayjs(period + "-01").format("MMMM YYYY")})</Text>
              <Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{rupiah(grandTotal)}</Text>
              <Text style={styles.totalSub}>{emps.length} pegawai</Text>
            </View>

            {emps.map((e: any) => {
              const open = expanded === e.employee_id;
              return (
                <View key={e.employee_id} style={styles.card}>
                  <Pressable testID={`gaji-emp-${e.employee_id}`} onPress={() => setExpanded(open ? null : e.employee_id)} style={styles.cardHead}>
                    <View style={styles.avatar}><Icon name="account-hard-hat" size={18} color={colors.onBrandPrimary} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{e.name}</Text>
                      <Text style={styles.role}>{e.role} • {e.outlet_name.replace("Jadiwangi ", "")}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.total}>{rupiah(e.total)}</Text>
                      <Icon name={open ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
                    </View>
                  </Pressable>

                  {open ? (
                    <View style={styles.breakdown}>
                      <Row label="Gaji Pokok" value={rupiah(e.gaji_pokok)} />
                      <Row label="Tunjangan Kasir" value={rupiah(e.tunjangan_kasir)} />
                      <Row label={`Kehadiran ${e.kehadiran} hari + lembur ${e.lembur_shifts}`} value="" muted />
                      <Row label="Uang Makan" value={rupiah(e.uang_makan)} />
                      <Row label={`Bonus Cuci (${kg(e.wash_kg)} + ${e.wash_pcs} pcs)`} value={rupiah(e.bonus_cuci)} />
                      <Row label={`Bonus Setrika (${kg(e.iron_kg)} + ${e.iron_pcs} pcs)`} value={rupiah(e.bonus_setrika)} />
                      <Row label={`Antar Jemput (${e.trips} trip)`} value={rupiah(e.antar_jemput)} />
                      <Row label="Perjalanan Dinas" value={rupiah(e.perjalanan_dinas)} />
                      <Row label="Kasbon (potongan)" value={`- ${rupiah(e.kasbon)}`} tone={colors.error} />
                      <View style={styles.totalRow}>
                        <Text style={styles.totalRowLabel}>Total Diterima</Text>
                        <Text style={styles.totalRowValue}>{rupiah(e.total)}</Text>
                      </View>
                      <Pressable testID={`gaji-edit-${e.employee_id}`} onPress={() => setEdit({ ...e, lembur_shifts: String(e.lembur_shifts), perjalanan_dinas: String(e.perjalanan_dinas) })} style={styles.editBtn}>
                        <Icon name="pencil" size={16} color={colors.brandPrimary} />
                        <Text style={styles.editText}>Ubah Lembur / Perjalanan Dinas</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      <Modal visible={!!edit} transparent animationType="slide" onRequestClose={() => setEdit(null)}>
        <View style={styles.overlay}>
          <KeyboardAwareScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} bottomOffset={20}>
            {edit ? (
              <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
                <View style={styles.grabber} />
                <Text style={styles.sheetTitle}>{edit.name}</Text>
                <Text style={styles.sheetSub}>Input manual · {dayjs(period + "-01").format("MMMM YYYY")}</Text>
                <Field label="Jumlah Shift Lembur" value={edit.lembur_shifts} onChangeText={(t) => setEdit({ ...edit, lembur_shifts: t })} placeholder="0" keyboardType="number-pad" testID="edit-lembur" />
                <Field label="Perjalanan Dinas (Rp)" value={edit.perjalanan_dinas} onChangeText={(t) => setEdit({ ...edit, perjalanan_dinas: t })} placeholder="0" keyboardType="number-pad" testID="edit-perjalanan" />
                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                  <Pressable style={styles.cancel} onPress={() => setEdit(null)}><Text style={styles.cancelText}>Batal</Text></Pressable>
                  <PrimaryButton label="Simpan" onPress={() => saveManual.mutate()} loading={saveManual.isPending} testID="save-manual" style={{ flex: 1 }} />
                </View>
              </View>
            ) : <View />}
          </KeyboardAwareScrollView>
        </View>
      </Modal>
    </View>
  );
}

function Row({ label, value, tone, muted }: { label: string; value: string; tone?: string; muted?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, muted && { color: colors.muted }]}>{label}</Text>
      {value ? <Text style={[styles.rowValue, tone && { color: tone }]}>{value}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: c.surface },
  title: { fontFamily: fonts.displayBold, fontSize: 24, color: c.onSurface },
  periodBar: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.divider },
  periodChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  periodText: { fontFamily: fonts.bodyBold, fontSize: 12, color: c.onSurfaceSecondary },
  totalCard: { backgroundColor: c.brand, borderRadius: radius.lg, padding: spacing.lg, gap: 2, ...shadow.soft },
  totalLabel: { fontFamily: fonts.bodySemi, fontSize: 13, color: c.onBrand, opacity: 0.9 },
  totalValue: { fontFamily: fonts.displayBold, fontSize: 30, color: c.onBrand },
  totalSub: { fontFamily: fonts.bodySemi, fontSize: 12, color: c.onBrand, opacity: 0.9 },
  card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, ...shadow.card },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurface },
  role: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  total: { fontFamily: fonts.displayBold, fontSize: 16, color: c.brandPrimary },
  breakdown: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: 8, borderTopWidth: 1, borderTopColor: c.divider, paddingTop: spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLabel: { fontFamily: fonts.body, fontSize: 13, color: c.onSurfaceSecondary, flex: 1 },
  rowValue: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurface },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: c.divider, paddingTop: spacing.sm, marginTop: 2 },
  totalRowLabel: { fontFamily: fonts.displayBold, fontSize: 14, color: c.onSurface },
  totalRowValue: { fontFamily: fonts.displayBold, fontSize: 18, color: c.success },
  editBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: c.brandTertiary, borderRadius: radius.md, paddingVertical: 10, marginTop: spacing.xs },
  editText: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onBrandTertiary },
  overlay: { flex: 1, backgroundColor: "rgba(30,26,52,0.45)" },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, gap: spacing.md },
  grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: c.border, alignSelf: "center", marginBottom: spacing.xs },
  sheetTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: c.onSurface },
  sheetSub: { fontFamily: fonts.body, fontSize: 13, color: c.muted, marginTop: -6 },
  cancel: { paddingVertical: 15, paddingHorizontal: 20, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  cancelText: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurfaceSecondary },
}));
