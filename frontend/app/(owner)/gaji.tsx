import React, { useMemo, useState } from "react";
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
import { msUntilJakartaNightRefresh } from "@/src/summaryCache";

export default function GajiPegawai() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { session } = useAuth();
  const outlets = useMemo(() => session?.outlets || [], [session?.outlets]);
  const outletId = session?.currentOutletId ?? null;
  const outletsReady = outlets.length > 0;
  const [period, setPeriod] = useState<string>(dayjs().format("YYYY-MM"));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [edit, setEdit] = useState<any>(null);
  const [kasbon, setKasbon] = useState<any>(null);

  const months = useMemo(() => Array.from({ length: 6 }).map((_, i) => dayjs().subtract(i, "month").format("YYYY-MM")), []);

  const { data, isLoading } = useQuery({
    queryKey: ["payroll", outletId, period],
    queryFn: () => api.get(`/payroll?period=${period}${outletId ? `&outlet_id=${outletId}` : ""}`),
    enabled: outletsReady,
    staleTime: msUntilJakartaNightRefresh(), refetchOnMount: false, refetchOnWindowFocus: false,
  });
  const { data: kasbonEntries = [] } = useQuery({
    queryKey: ["kasbon", outletId, period],
    queryFn: () => api.get(`/kasbon?period=${period}${outletId ? `&outlet_id=${outletId}` : ""}`),
    enabled: outletsReady,
    staleTime: msUntilJakartaNightRefresh(), refetchOnMount: false, refetchOnWindowFocus: false,
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

  const saveKasbon = useMutation({
    mutationFn: () => api.post("/kasbon", {
      employee_id: kasbon.employee_id,
      outlet_id: outletId,
      amount: Number(kasbon.amount) || 0,
      note: kasbon.note || "",
      kasbon_date: kasbon.kasbon_date,
    }),
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setKasbon(null);
      qc.invalidateQueries({ queryKey: ["payroll"] });
      qc.invalidateQueries({ queryKey: ["kasbon"] });
    },
  });

  const emps = data?.employees || [];
  const payrollLoading = !outletsReady || isLoading;
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
        {payrollLoading ? <Loading /> : emps.length === 0 ? <EmptyState icon="account-cash" title="Belum ada pegawai" /> : (
          <>
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total Gaji ({dayjs(period + "-01").format("MMMM YYYY")})</Text>
              <Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{rupiah(grandTotal)}</Text>
              <Text style={styles.totalSub}>{emps.length} pegawai</Text>
            </View>

            {emps.map((e: any) => {
              const open = expanded === e.employee_id;
              const employeeKasbon = kasbonEntries.filter((entry: any) => entry.employee_id === e.employee_id);
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
                      <KasbonHistory employeeId={e.employee_id} entries={employeeKasbon} />
                      <View style={styles.totalRow}>
                        <Text style={styles.totalRowLabel}>Total Diterima</Text>
                        <Text style={styles.totalRowValue}>{rupiah(e.total)}</Text>
                      </View>
                      <View style={styles.actionRow}>
                        <Pressable testID={`gaji-edit-${e.employee_id}`} onPress={() => setEdit({ ...e, lembur_shifts: String(e.lembur_shifts), perjalanan_dinas: String(e.perjalanan_dinas) })} style={[styles.editBtn, { flex: 1 }]}>
                          <Icon name="pencil" size={16} color={colors.brandPrimary} />
                          <Text style={styles.editText}>Ubah Manual</Text>
                        </Pressable>
                        <Pressable testID={`gaji-kasbon-${e.employee_id}`} onPress={() => setKasbon({ ...e, amount: "", note: "", kasbon_date: dayjs().format("YYYY-MM-DD") })} style={[styles.kasbonBtn, { flex: 1 }]}>
                          <Icon name="cash-minus" size={16} color={colors.error} />
                          <Text style={styles.kasbonText}>Catat Kasbon</Text>
                        </Pressable>
                      </View>
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
          <KeyboardAwareScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end", paddingTop: insets.top + spacing.md }} bottomOffset={20} keyboardShouldPersistTaps="handled">
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

      <Modal visible={!!kasbon} transparent animationType="slide" onRequestClose={() => setKasbon(null)}>
        <View style={styles.overlay}>
          <KeyboardAwareScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end", paddingTop: insets.top + spacing.md }} bottomOffset={20} keyboardShouldPersistTaps="handled">
            {kasbon ? (
              <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
                <View style={styles.grabber} />
                <Text style={styles.sheetTitle}>Catat Kasbon</Text>
                <Text style={styles.sheetSub}>{kasbon.name} · otomatis dipotong pada gaji {dayjs(period + "-01").format("MMMM YYYY")}</Text>
                <KasbonDatePicker value={kasbon.kasbon_date} onChange={(kasbon_date) => setKasbon({ ...kasbon, kasbon_date })} />
                <Field label="Nominal Kasbon (Rp)" value={kasbon.amount} onChangeText={(t) => setKasbon({ ...kasbon, amount: t })} placeholder="Contoh: 100000" keyboardType="number-pad" testID="kasbon-amount" />
                <Field label="Catatan (opsional)" value={kasbon.note} onChangeText={(t) => setKasbon({ ...kasbon, note: t })} placeholder="Contoh: Kasbon kebutuhan pribadi" testID="kasbon-note" />
                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                  <Pressable testID="cancel-kasbon" style={styles.cancel} onPress={() => setKasbon(null)}><Text style={styles.cancelText}>Batal</Text></Pressable>
                  <PrimaryButton label="Simpan Kasbon" onPress={() => saveKasbon.mutate()} loading={saveKasbon.isPending} disabled={!Number(kasbon.amount)} testID="save-kasbon" style={{ flex: 1 }} />
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

function KasbonDatePicker({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const styles = useStyles(); const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => dayjs(value || undefined).startOf("month"));
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const selectedDate = dayjs(value);
  const offset = (month.startOf("month").day() + 6) % 7;
  const days = month.daysInMonth();
  const cells = Array.from({ length: offset + days }, (_, index) => index < offset ? null : index - offset + 1);
  return <View style={{ gap: spacing.xs }}>
    <Text style={styles.datePickerLabel}>Tanggal Kasbon</Text>
    <Pressable testID="kasbon-date-picker" onPress={() => setOpen(!open)} style={styles.datePickerButton}>
      <Icon name="calendar-month" size={18} color={colors.brandPrimary} /><Text testID="kasbon-date-value" style={styles.datePickerValue}>{String(selectedDate.date()).padStart(2, "0")} {monthNames[selectedDate.month()]} {selectedDate.year()}</Text><Icon name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
    </Pressable>
    {open ? <View testID="kasbon-calendar" style={styles.calendar}>
      <View style={styles.calendarHeader}><Pressable testID="kasbon-calendar-prev" onPress={() => setMonth(month.subtract(1, "month"))} style={styles.calendarNav}><Icon name="chevron-left" size={18} color={colors.onSurface} /></Pressable><Text style={styles.calendarMonth}>{monthNames[month.month()]} {month.year()}</Text><Pressable testID="kasbon-calendar-next" onPress={() => setMonth(month.add(1, "month"))} style={styles.calendarNav}><Icon name="chevron-right" size={18} color={colors.onSurface} /></Pressable></View>
      <View style={styles.weekRow}>{["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((label) => <Text key={label} style={styles.weekLabel}>{label}</Text>)}</View>
      <View style={styles.dayGrid}>{cells.map((day, index) => { if (!day) return <View key={`blank-${index}`} style={styles.dayCell} />; const date = month.date(day).format("YYYY-MM-DD"); const selected = date === value; return <Pressable key={date} testID={`kasbon-calendar-day-${date}`} onPress={() => { onChange(date); setOpen(false); }} style={[styles.dayCell, selected && { backgroundColor: colors.brandPrimary }]}><Text style={[styles.dayText, selected && { color: colors.onBrandPrimary }]}>{day}</Text></Pressable>; })}</View>
    </View> : null}
  </View>;
}

function KasbonHistory({ employeeId, entries }: { employeeId: string; entries: any[] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return <View testID={`kasbon-history-${employeeId}`} style={styles.kasbonHistory}>
    <View style={styles.kasbonHistoryHead}><Text style={styles.kasbonHistoryTitle}>Riwayat Kasbon</Text><Text style={styles.kasbonHistoryCount}>{entries.length} catatan</Text></View>
    {entries.length ? entries.map((entry: any) => <View key={entry.id} testID={`kasbon-entry-${entry.id}`} style={styles.kasbonEntry}>
      <View style={{ flex: 1 }}><Text style={styles.kasbonDate}>{dayjs(entry.kasbon_date).format("DD/MM/YYYY")}</Text><Text style={styles.kasbonNote} numberOfLines={1}>{entry.note || "Tanpa catatan"}</Text></View>
      <Text style={[styles.kasbonEntryAmount, { color: colors.error }]}>- {rupiah(entry.amount)}</Text>
    </View>) : <Text testID={`kasbon-empty-${employeeId}`} style={styles.kasbonEmpty}>Belum ada kasbon pada periode ini.</Text>}
  </View>;
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
  datePickerLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurfaceSecondary },
  datePickerButton: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, paddingHorizontal: spacing.md },
  datePickerValue: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: c.onSurface },
  calendar: { borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: spacing.sm, gap: 6 },
  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  calendarNav: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  calendarMonth: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurface },
  weekRow: { flexDirection: "row" },
  weekLabel: { width: "14.285%", textAlign: "center", fontFamily: fonts.bodyBold, fontSize: 10, color: c.muted },
  dayGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: "14.285%", aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  dayText: { fontFamily: fonts.bodySemi, fontSize: 12, color: c.onSurface },
  kasbonHistory: { marginTop: spacing.xs, borderRadius: radius.md, backgroundColor: "#FFF7F7", padding: spacing.sm, gap: 7 },
  kasbonHistoryHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kasbonHistoryTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurface },
  kasbonHistoryCount: { fontFamily: fonts.bodySemi, fontSize: 11, color: c.muted },
  kasbonEntry: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#FFE4E6" },
  kasbonDate: { fontFamily: fonts.bodyBold, fontSize: 12, color: c.onSurfaceSecondary },
  kasbonNote: { fontFamily: fonts.body, fontSize: 11, color: c.muted, marginTop: 1 },
  kasbonEntryAmount: { fontFamily: fonts.bodyBold, fontSize: 12 },
  kasbonEmpty: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: c.divider, paddingTop: spacing.sm, marginTop: 2 },
  totalRowLabel: { fontFamily: fonts.displayBold, fontSize: 14, color: c.onSurface },
  totalRowValue: { fontFamily: fonts.displayBold, fontSize: 18, color: c.success },
  editBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: c.brandTertiary, borderRadius: radius.md, paddingVertical: 10, marginTop: spacing.xs },
  editText: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onBrandTertiary },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  kasbonBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#FFE4E6", borderRadius: radius.md, paddingVertical: 10 },
  kasbonText: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.error },
  overlay: { flex: 1, backgroundColor: "rgba(30,26,52,0.45)" },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, gap: spacing.md },
  grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: c.border, alignSelf: "center", marginBottom: spacing.xs },
  sheetTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: c.onSurface },
  sheetSub: { fontFamily: fonts.body, fontSize: 13, color: c.muted, marginTop: -6 },
  cancel: { paddingVertical: 15, paddingHorizontal: 20, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  cancelText: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurfaceSecondary },
}));
