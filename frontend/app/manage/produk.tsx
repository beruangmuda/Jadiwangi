import React, { useState } from "react";
import { View, Text, Pressable, Modal, Switch, Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { PrimaryButton, EmptyState, Loading } from "@/src/components/ui";
import { StackHeader, Field, Segmented } from "@/src/components/form";
import { rupiah } from "@/src/format";

const emptyForm = { id: "", name: "", category: "Cuci", unit: "kg", price: "", icon: "washing-machine", active: true };

export default function ManageProduk() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);

  const { data: services, isLoading } = useQuery({ queryKey: ["services", "all"], queryFn: () => api.get("/services?include_inactive=true") });

  const save = useMutation({
    mutationFn: () => {
      const body = { name: form.name, category: form.category, unit: form.unit, price: Number(form.price) || 0, icon: form.icon, active: form.active };
      return form.id ? api.put(`/services/${form.id}`, body) : api.post("/services", body);
    },
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModal(false);
      qc.invalidateQueries({ queryKey: ["services"] });
    },
  });

  const toggle = useMutation({
    mutationFn: (svc: any) => api.put(`/services/${svc.id}`, { ...svc, active: !svc.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });

  const openAdd = () => { setForm(emptyForm); setModal(true); };
  const openEdit = (svc: any) => { setForm({ ...svc, price: String(svc.price) }); setModal(true); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Produk & Layanan" subtitle="Kelola layanan & harga" />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing["3xl"] }}>
        <Pressable testID="add-service" onPress={openAdd} style={styles.addRow}>
          <Icon name="plus-circle" size={22} color={colors.brandPrimary} />
          <Text style={styles.addText}>Tambah Layanan Baru</Text>
        </Pressable>

        {isLoading ? <Loading /> : (services || []).length === 0 ? <EmptyState icon="tshirt-crew" title="Belum ada layanan" /> : (
          (services || []).map((svc: any) => (
            <View key={svc.id} style={[styles.row, !svc.active && { opacity: 0.55 }]}>
              <View style={styles.icon}><Icon name={svc.icon} size={20} color={colors.brand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{svc.name}</Text>
                <Text style={styles.sub}>{rupiah(svc.price)}/{svc.unit} • {svc.category}</Text>
              </View>
              <Pressable testID={`edit-service-${svc.id}`} onPress={() => openEdit(svc)} style={styles.editBtn}>
                <Icon name="pencil" size={18} color={colors.brand} />
              </Pressable>
              <Switch value={svc.active} onValueChange={() => toggle.mutate(svc)} trackColor={{ true: colors.brandPrimary, false: colors.border }} thumbColor="#fff" />
            </View>
          ))
        )}
      </KeyboardAwareScrollView>

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.overlay}>
          <KeyboardAwareScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} bottomOffset={20}>
            <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
              <View style={styles.grabber} />
              <Text style={styles.sheetTitle}>{form.id ? "Edit Layanan" : "Tambah Layanan"}</Text>
              <Field label="Nama Layanan" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="Cuci Kering Lipat" testID="svc-name" />
              <View style={{ gap: spacing.xs }}>
                <Text style={styles.label}>Satuan</Text>
                <Segmented items={[{ key: "kg", label: "Per Kg" }, { key: "pcs", label: "Satuan (pcs)" }]} value={form.unit} onChange={(k) => setForm({ ...form, unit: k })} />
              </View>
              <Field label="Kategori" value={form.category} onChangeText={(t) => setForm({ ...form, category: t })} placeholder="Cuci / Setrika / Satuan" testID="svc-cat" />
              <Field label="Harga" value={form.price} onChangeText={(t) => setForm({ ...form, price: t })} placeholder="7000" keyboardType="number-pad" testID="svc-price" />
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                <Pressable style={styles.cancel} onPress={() => setModal(false)}><Text style={styles.cancelText}>Batal</Text></Pressable>
                <PrimaryButton label="Simpan" onPress={() => save.mutate()} loading={save.isPending} disabled={!form.name} testID="save-service" style={{ flex: 1 }} />
              </View>
            </View>
          </KeyboardAwareScrollView>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  addRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.brandTertiary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xs },
  addText: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onBrandTertiary },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md },
  icon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurface },
  sub: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  editBtn: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(30,26,52,0.45)" },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, gap: spacing.md, alignItems: "stretch" },
  grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: c.border, alignSelf: "center", marginBottom: spacing.xs },
  sheetTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: c.onSurface },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurfaceSecondary },
  cancel: { paddingVertical: 15, paddingHorizontal: 20, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  cancelText: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurfaceSecondary },
}));
