import React, { useState } from "react";
import { View, Text, Pressable, Modal, Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { PrimaryButton, Loading } from "@/src/components/ui";
import { StackHeader, Field } from "@/src/components/form";

export default function ManageOutlet() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>(null);

  const { data: outlets, isLoading } = useQuery({ queryKey: ["outlets", "manage"], queryFn: () => api.get("/outlets") });

  const save = useMutation({
    mutationFn: () => api.put(`/outlets/${form.id}`, {
      name: form.name, city: form.city, address: form.address, phone: form.phone,
      sla_hours: Number(form.sla_hours) || 48, qris_url: form.qris_url || "",
    }),
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModal(false);
      qc.invalidateQueries({ queryKey: ["outlets"] });
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Edit Outlet" subtitle="Informasi 3 cabang" />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["3xl"] }}>
        {isLoading ? <Loading /> : (outlets || []).map((o: any) => (
          <Pressable key={o.id} testID={`outlet-${o.id}`} onPress={() => { setForm({ ...o, sla_hours: String(o.sla_hours) }); setModal(true); }} style={styles.card}>
            <View style={styles.iconBox}><Icon name="storefront" size={24} color={colors.onBrandPrimary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{o.name}</Text>
              <Text style={styles.sub}>{o.address}</Text>
              <View style={{ flexDirection: "row", gap: spacing.md, marginTop: 4 }}>
                <Meta icon="phone" text={o.phone || "-"} />
                <Meta icon="clock-fast" text={`SLA ${o.sla_hours}j`} />
              </View>
            </View>
            <Icon name="pencil" size={18} color={colors.brand} />
          </Pressable>
        ))}
      </KeyboardAwareScrollView>

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.overlay}>
          <KeyboardAwareScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} bottomOffset={20}>
            {form ? (
              <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
                <View style={styles.grabber} />
                <Text style={styles.sheetTitle}>Edit {form.city}</Text>
                <Field label="Nama Outlet" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} testID="outlet-name" />
                <Field label="Kota" value={form.city} onChangeText={(t) => setForm({ ...form, city: t })} testID="outlet-city" />
                <Field label="Alamat" value={form.address} onChangeText={(t) => setForm({ ...form, address: t })} testID="outlet-address" />
                <Field label="No. Telp" value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} keyboardType="phone-pad" testID="outlet-phone" />
                <Field label="SLA (jam)" value={form.sla_hours} onChangeText={(t) => setForm({ ...form, sla_hours: t })} keyboardType="number-pad" testID="outlet-sla" />
                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                  <Pressable style={styles.cancel} onPress={() => setModal(false)}><Text style={styles.cancelText}>Batal</Text></Pressable>
                  <PrimaryButton label="Simpan" onPress={() => save.mutate()} loading={save.isPending} testID="save-outlet" style={{ flex: 1 }} />
                </View>
              </View>
            ) : <View />}
          </KeyboardAwareScrollView>
        </View>
      </Modal>
    </View>
  );
}

function Meta({ icon, text }: { icon: string; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Icon name={icon} size={13} color={colors.muted} />
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: colors.muted }}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg },
  iconBox: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: c.brand, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.displayBold, fontSize: 16, color: c.onSurface },
  sub: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  overlay: { flex: 1, backgroundColor: "rgba(30,26,52,0.45)" },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, gap: spacing.md },
  grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: c.border, alignSelf: "center", marginBottom: spacing.xs },
  sheetTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: c.onSurface },
  cancel: { paddingVertical: 15, paddingHorizontal: 20, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  cancelText: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurfaceSecondary },
}));
