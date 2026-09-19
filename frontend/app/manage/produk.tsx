import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Modal, Switch, Platform, ScrollView } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { PrimaryButton, EmptyState, Loading } from "@/src/components/ui";
import { StackHeader, Field, Segmented } from "@/src/components/form";
import { rupiah } from "@/src/format";

const CAT_ORDER = ["Kiloan", "Add-on", "Bed Cover", "Selimut", "Bantal & Guling", "Boneka",
  "Atasan", "Bawahan", "Ibadah", "Sepatu & Tas", "Karpet & Gorden", "Kasur", "Lantai"];

export default function ManageProduk() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { session } = useAuth();
  const outlets = session?.outlets || [];
  const [outletId, setOutletId] = useState<string>(session?.currentOutletId || outlets[0]?.id || "");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    if (!outletId && outlets.length > 0) setOutletId(session?.currentOutletId || outlets[0].id);
  }, [outlets, outletId, session]);

  const emptyForm = () => ({
    id: "", name: "", category: "Kiloan", unit: "kg", price: "", price_express: "",
    duration: "2 Hari", duration_express: "6 Jam", min_kg: "", icon: "washing-machine",
    active: true, outlet_id: outletId,
  });

  const { data: services, isLoading } = useQuery({
    queryKey: ["services", "manage", outletId],
    queryFn: () => api.get(`/services?include_inactive=true&outlet_id=${outletId}`),
    enabled: !!outletId,
  });

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    (services || []).forEach((s: any) => { (map[s.category] = map[s.category] || []).push(s); });
    return Object.entries(map).sort((a, b) => {
      const ia = CAT_ORDER.indexOf(a[0]); const ib = CAT_ORDER.indexOf(b[0]);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }, [services]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name, category: form.category, unit: form.unit,
        price: Number(form.price) || 0,
        price_express: form.price_express === "" ? null : Number(form.price_express),
        duration: form.duration, duration_express: form.duration_express,
        min_kg: form.min_kg === "" ? null : Number(form.min_kg),
        icon: form.icon, active: form.active, outlet_id: outletId,
      };
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

  const openAdd = () => { setForm(emptyForm()); setModal(true); };
  const openEdit = (svc: any) => {
    setForm({
      ...svc,
      price: String(svc.price ?? ""),
      price_express: svc.price_express != null ? String(svc.price_express) : "",
      min_kg: svc.min_kg != null ? String(svc.min_kg) : "",
      duration: svc.duration || "",
      duration_express: svc.duration_express || "",
    });
    setModal(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Produk & Layanan" subtitle="Kelola layanan & harga per outlet" />

      {outlets.length > 1 ? (
        <View style={styles.outletBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
            {outlets.map((o: any) => {
              const on = o.id === outletId;
              return (
                <Pressable key={o.id} testID={`outlet-tab-${o.city}`} onPress={() => setOutletId(o.id)} style={[styles.outletChip, on && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                  <Text style={[styles.outletChipText, on && { color: colors.onBrandPrimary }]}>{o.name.replace("Jadiwangi ", "")}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing["3xl"] }}>
        <Pressable testID="add-service" onPress={openAdd} style={styles.addRow}>
          <Icon name="plus-circle" size={22} color={colors.brandPrimary} />
          <Text style={styles.addText}>Tambah Layanan Baru</Text>
        </Pressable>

        {isLoading ? <Loading /> : (services || []).length === 0 ? <EmptyState icon="tshirt-crew" title="Belum ada layanan" /> : (
          grouped.map(([cat, list]) => (
            <View key={cat} style={{ gap: spacing.sm, marginTop: spacing.xs }}>
              <Text style={styles.catHeader}>{cat}</Text>
              {list.map((svc: any) => (
                <View key={svc.id} style={[styles.row, !svc.active && { opacity: 0.55 }]}>
                  <View style={styles.icon}><Icon name={svc.icon} size={20} color={colors.brand} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{svc.name}</Text>
                    <Text style={styles.sub}>
                      {rupiah(svc.price)}/{svc.unit}
                      {svc.duration ? ` · ${svc.duration}` : ""}
                    </Text>
                    {svc.price_express != null ? (
                      <Text style={styles.subExp}>
                        Express {rupiah(svc.price_express)}/{svc.unit}
                        {svc.duration_express ? ` · ${svc.duration_express}` : ""}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable testID={`edit-service-${svc.id}`} onPress={() => openEdit(svc)} style={styles.editBtn}>
                    <Icon name="pencil" size={18} color={colors.brand} />
                  </Pressable>
                  <Switch value={svc.active} onValueChange={() => toggle.mutate(svc)} trackColor={{ true: colors.brandPrimary, false: colors.border }} thumbColor="#fff" />
                </View>
              ))}
            </View>
          ))
        )}
      </KeyboardAwareScrollView>

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.overlay}>
          <KeyboardAwareScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} bottomOffset={20}>
            <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
              <View style={styles.grabber} />
              <Text style={styles.sheetTitle}>{form?.id ? "Edit Layanan" : "Tambah Layanan"}</Text>
              {form ? (
                <>
                  <Field label="Nama Layanan" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="Cuci Kering Setrika" testID="svc-name" />
                  <View style={{ gap: spacing.xs }}>
                    <Text style={styles.label}>Satuan</Text>
                    <Segmented items={[{ key: "kg", label: "Per Kg" }, { key: "pcs", label: "Pcs" }, { key: "m", label: "Meter" }]} value={form.unit} onChange={(k) => setForm({ ...form, unit: k })} />
                  </View>
                  <Field label="Kategori" value={form.category} onChangeText={(t) => setForm({ ...form, category: t })} placeholder="Kiloan / Atasan / Bed Cover" testID="svc-cat" />
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Field label="Harga Reguler" value={form.price} onChangeText={(t) => setForm({ ...form, price: t })} placeholder="10000" keyboardType="number-pad" testID="svc-price" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field label="Harga Express" value={form.price_express} onChangeText={(t) => setForm({ ...form, price_express: t })} placeholder="opsional" keyboardType="number-pad" testID="svc-price-exp" />
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Field label="Durasi Reguler" value={form.duration} onChangeText={(t) => setForm({ ...form, duration: t })} placeholder="2 Hari" testID="svc-dur" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field label="Durasi Express" value={form.duration_express} onChangeText={(t) => setForm({ ...form, duration_express: t })} placeholder="6 Jam" testID="svc-dur-exp" />
                    </View>
                  </View>
                  {form.unit === "kg" ? (
                    <Field label="Minimal Kg (opsional)" value={form.min_kg} onChangeText={(t) => setForm({ ...form, min_kg: t })} placeholder="4" keyboardType="number-pad" testID="svc-minkg" />
                  ) : null}
                  <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                    <Pressable style={styles.cancel} onPress={() => setModal(false)}><Text style={styles.cancelText}>Batal</Text></Pressable>
                    <PrimaryButton label="Simpan" onPress={() => save.mutate()} loading={save.isPending} disabled={!form.name} testID="save-service" style={{ flex: 1 }} />
                  </View>
                </>
              ) : null}
            </View>
          </KeyboardAwareScrollView>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  outletBar: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.divider },
  outletChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  outletChipText: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurfaceSecondary },
  addRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.brandTertiary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xs },
  addText: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onBrandTertiary },
  catHeader: { fontFamily: fonts.displayBold, fontSize: 13, color: c.brand, textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md },
  icon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurface },
  sub: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  subExp: { fontFamily: fonts.bodySemi, fontSize: 12, color: c.error },
  editBtn: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(30,26,52,0.45)" },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, gap: spacing.md, alignItems: "stretch" },
  grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: c.border, alignSelf: "center", marginBottom: spacing.xs },
  sheetTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: c.onSurface },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurfaceSecondary },
  cancel: { paddingVertical: 15, paddingHorizontal: 20, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  cancelText: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurfaceSecondary },
}));
