import React, { useState } from "react";
import { View, Text, Pressable, Modal, Switch, Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { PrimaryButton, Loading, Pill } from "@/src/components/ui";
import { StackHeader, Field, Segmented } from "@/src/components/form";

const ROLE_META: Record<string, { label: string; icon: string }> = {
  admin: { label: "Admin", icon: "clipboard-account" },
  produksi: { label: "Produksi", icon: "washing-machine" },
  kurir: { label: "Kurir", icon: "moped" },
};
const PERMS = [
  { key: "orders", label: "Kelola Order" },
  { key: "reports", label: "Lihat Laporan" },
  { key: "delivery", label: "Antar Jemput" },
];

export default function ManagePegawai() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { session } = useAuth();
  const outlets = session?.outlets || [];

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>(null);

  const { data: employees, isLoading } = useQuery({ queryKey: ["employees", "manage"], queryFn: () => api.get("/employees") });

  const save = useMutation({
    mutationFn: () => {
      const body = { name: form.name, role_type: form.role_type, pin: form.pin || "0000", username: form.username, password: form.password, outlet_id: form.outlet_id, active: form.active, gaji_pokok: Number(form.gaji_pokok) || 0, tunjangan_kasir: Number(form.tunjangan_kasir) || 0, permissions: form.permissions };
      return form.id ? api.put(`/employees/${form.id}`, body) : api.post("/employees", body);
    },
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModal(false);
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
  });

  const openAdd = () => { setForm({ id: "", name: "", role_type: "admin", pin: "0000", username: "", password: "", outlet_id: outlets[0]?.id || "", active: true, gaji_pokok: "", tunjangan_kasir: "", permissions: { orders: true, reports: false, delivery: false } }); setModal(true); };
  const openEdit = (e: any) => { setForm({ ...e, password: "", gaji_pokok: String(e.gaji_pokok ?? ""), tunjangan_kasir: String(e.tunjangan_kasir ?? ""), permissions: e.permissions || {} }); setModal(true); };

  const grouped = (role: string) => (employees || []).filter((e: any) => e.role_type === role);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Pegawai & Hak Akses" subtitle="Tambah pegawai & atur akses" />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["3xl"] }}>
        <Pressable testID="add-employee" onPress={openAdd} style={styles.addRow}>
          <Icon name="account-plus" size={22} color={colors.brandPrimary} />
          <Text style={styles.addText}>Tambah Pegawai</Text>
        </Pressable>

        {isLoading ? <Loading /> : Object.keys(ROLE_META).map((role) => (
          <View key={role} style={{ gap: spacing.sm }}>
            <Text style={styles.groupTitle}>{ROLE_META[role].label}</Text>
            {grouped(role).length === 0 ? <Text style={styles.empty}>Belum ada.</Text> : grouped(role).map((e: any) => (
              <Pressable key={e.id} testID={`emp-${e.id}`} onPress={() => openEdit(e)} style={styles.row}>
                <View style={styles.avatar}><Icon name={ROLE_META[role].icon} size={18} color={colors.onBrandPrimary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{e.name}</Text>
                  <Text style={styles.sub}>@{e.username || "-"} • {outlets.find((o) => o.id === e.outlet_id)?.city || "-"}</Text>
                </View>
                {e.active ? <Pill label="Aktif" tone="success" /> : <Pill label="Nonaktif" tone="neutral" />}
                <Icon name="chevron-right" size={20} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        ))}
      </KeyboardAwareScrollView>

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.overlay}>
          <KeyboardAwareScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} bottomOffset={20}>
            {form ? (
              <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
                <View style={styles.grabber} />
                <Text style={styles.sheetTitle}>{form.id ? "Edit Pegawai" : "Tambah Pegawai"}</Text>
                <Field label="Nama" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="Nama pegawai" testID="emp-name" />
                <View style={{ gap: spacing.xs }}>
                  <Text style={styles.label}>Bagian</Text>
                  <Segmented items={[{ key: "admin", label: "Admin" }, { key: "produksi", label: "Produksi" }, { key: "kurir", label: "Kurir" }]} value={form.role_type} onChange={(k) => setForm({ ...form, role_type: k })} />
                </View>
                <Field label="Username" value={form.username} onChangeText={(t) => setForm({ ...form, username: t.replace(/\s/g, "").toLowerCase() })} placeholder="mis. andi" testID="emp-username" />
                <Field label={form.id ? "Kata Sandi (kosongkan jika tetap)" : "Kata Sandi (min. 6)"} value={form.password} onChangeText={(t) => setForm({ ...form, password: t })} placeholder="••••••" testID="emp-password" />
                <View style={{ gap: spacing.xs }}>
                  <Text style={styles.label}>Outlet</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                    {outlets.map((o) => {
                      const active = o.id === form.outlet_id;
                      return (
                        <Pressable key={o.id} onPress={() => setForm({ ...form, outlet_id: o.id })} style={[styles.chip, active && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                          <Text style={[styles.chipText, active && { color: colors.onBrandPrimary }]}>{o.city}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Field label="Gaji Pokok" value={form.gaji_pokok} onChangeText={(t) => setForm({ ...form, gaji_pokok: t })} placeholder="1500000" keyboardType="number-pad" testID="emp-gaji" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Tunjangan Kasir" value={form.tunjangan_kasir} onChangeText={(t) => setForm({ ...form, tunjangan_kasir: t })} placeholder="0" keyboardType="number-pad" testID="emp-tunjangan" />
                  </View>
                </View>
                <View style={{ gap: spacing.xs }}>
                  <Text style={styles.label}>Hak Akses</Text>
                  {PERMS.map((p) => (
                    <View key={p.key} style={styles.permRow}>
                      <Text style={styles.permLabel}>{p.label}</Text>
                      <Switch value={!!form.permissions?.[p.key]} onValueChange={(v) => setForm({ ...form, permissions: { ...form.permissions, [p.key]: v } })} trackColor={{ true: colors.brandPrimary, false: colors.border }} thumbColor="#fff" />
                    </View>
                  ))}
                </View>
                <View style={styles.permRow}>
                  <Text style={styles.permLabel}>Status Aktif</Text>
                  <Switch value={form.active} onValueChange={(v) => setForm({ ...form, active: v })} trackColor={{ true: colors.success, false: colors.border }} thumbColor="#fff" />
                </View>
                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                  <Pressable style={styles.cancel} onPress={() => setModal(false)}><Text style={styles.cancelText}>Batal</Text></Pressable>
                  <PrimaryButton label="Simpan" onPress={() => save.mutate()} loading={save.isPending} disabled={!form.name || !form.username || (!form.id && form.password.length < 6)} testID="save-employee" style={{ flex: 1 }} />
                </View>
              </View>
            ) : <View />}
          </KeyboardAwareScrollView>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  addRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.brandTertiary, borderRadius: radius.md, padding: spacing.md },
  addText: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onBrandTertiary },
  groupTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  empty: { fontFamily: fonts.body, fontSize: 13, color: c.muted },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurface },
  sub: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  overlay: { flex: 1, backgroundColor: "rgba(30,26,52,0.45)" },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, gap: spacing.md },
  grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: c.border, alignSelf: "center", marginBottom: spacing.xs },
  sheetTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: c.onSurface },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurfaceSecondary },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurfaceSecondary },
  permRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10 },
  permLabel: { fontFamily: fonts.bodySemi, fontSize: 14, color: c.onSurface },
  cancel: { paddingVertical: 15, paddingHorizontal: 20, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  cancelText: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurfaceSecondary },
}));
