import React, { useMemo, useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, shadow, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { PrimaryButton } from "@/src/components/ui";
import { StackHeader, Field, Segmented } from "@/src/components/form";

const CATS = [
  { key: "Cuci Kering Setrika", icon: "washing-machine", unit: "kg" },
  { key: "Cuci Lipat", icon: "tshirt-crew", unit: "kg" },
  { key: "Setrika", icon: "iron", unit: "kg" },
  { key: "Satuan", icon: "hanger", unit: "pcs" },
  { key: "Bed Cover", icon: "bed", unit: "pcs" },
  { key: "Karpet", icon: "rug", unit: "m" },
  { key: "Sepatu", icon: "shoe-sneaker", unit: "pasang" },
  { key: "Lainnya", icon: "dots-horizontal", unit: "item" },
];

export default function Permintaan() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const cust = session?.customer;
  const outletId = cust?.outlet_id;

  const [sel, setSel] = useState<Record<string, number>>({});
  const [delivery, setDelivery] = useState("self");
  const [address, setAddress] = useState(cust?.address || "");
  const [notes, setNotes] = useState("");

  const { data: outlets } = useQuery({ queryKey: ["outlets"], queryFn: () => api.get("/outlets") });
  const outletName = useMemo(() => (outlets || []).find((o: any) => o.id === outletId)?.name || "Outlet kamu", [outlets, outletId]);

  const toggle = (key: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSel((p) => {
      const copy = { ...p };
      if (copy[key] != null) delete copy[key];
      else copy[key] = 1;
      return copy;
    });
  };
  const setQty = (key: string, delta: number) => {
    setSel((p) => ({ ...p, [key]: Math.max(1, (p[key] || 1) + delta) }));
  };

  const submit = useMutation({
    mutationFn: () => api.post("/orders/request", {
      customer_id: cust?.id, outlet_id: outletId, delivery_type: delivery,
      address: delivery === "self" ? "" : address, notes,
      categories: Object.entries(sel).map(([category, qty]) => ({ category, qty })),
    }),
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      router.replace("/customer");
    },
  });

  const count = Object.keys(sel).length;
  const needAddr = delivery !== "self";
  const valid = count > 0 && (!needAddr || address.trim().length > 3);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Buat Permintaan" subtitle={outletName} />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 }} bottomOffset={20}>
        <View style={styles.info}>
          <Icon name="information-outline" size={18} color={colors.brand} />
          <Text style={styles.infoText}>Pilih layanan & perkiraan jumlah. Pegawai akan menimbang dan mengirim harga untuk kamu setujui.</Text>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text style={styles.label}>Pilih Layanan (bisa lebih dari 1)</Text>
          <View style={styles.grid}>
            {CATS.map((c) => {
              const on = sel[c.key] != null;
              return (
                <Pressable key={c.key} testID={`cat-${c.key}`} onPress={() => toggle(c.key)} style={[styles.catCard, on && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}>
                  <View style={[styles.catIcon, on && { backgroundColor: colors.brandPrimary }]}>
                    <Icon name={c.icon} size={22} color={on ? colors.onBrandPrimary : colors.brand} />
                  </View>
                  <Text style={styles.catName} numberOfLines={2}>{c.key}</Text>
                  {on ? (
                    <View style={styles.stepper}>
                      <Pressable onPress={() => setQty(c.key, -1)} hitSlop={8} style={styles.stepBtn}><Icon name="minus" size={14} color={colors.brand} /></Pressable>
                      <Text style={styles.qty}>{sel[c.key]} <Text style={styles.unit}>{c.unit}</Text></Text>
                      <Pressable onPress={() => setQty(c.key, 1)} hitSlop={8} style={styles.stepBtn}><Icon name="plus" size={14} color={colors.brand} /></Pressable>
                    </View>
                  ) : (
                    <Text style={styles.estimate}>perkiraan</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text style={styles.label}>Metode</Text>
          <Segmented
            items={[{ key: "self", label: "Antar Sendiri" }, { key: "pickup", label: "Dijemput" }, { key: "delivery", label: "Diantar" }]}
            value={delivery}
            onChange={setDelivery}
          />
        </View>

        {needAddr ? (
          <Field label="Alamat" value={address} onChangeText={setAddress} placeholder="Alamat lengkap untuk penjemputan/pengantaran" testID="req-address" />
        ) : null}

        <Field label="Catatan (opsional)" value={notes} onChangeText={setNotes} placeholder="Contoh: pakai pewangi Dettol, pisahkan pakaian putih" testID="req-notes" />
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton
          label={count > 0 ? `Kirim Permintaan (${count} layanan)` : "Pilih layanan dulu"}
          icon="send"
          onPress={() => submit.mutate()}
          loading={submit.isPending}
          disabled={!valid}
          testID="submit-request"
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  info: { flexDirection: "row", gap: spacing.sm, backgroundColor: c.brandTertiary, borderRadius: radius.md, padding: spacing.md },
  infoText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: c.onBrandTertiary, lineHeight: 18 },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurface },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  catCard: { flexBasis: "47%", flexGrow: 1, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1.5, borderColor: c.border, padding: spacing.md, gap: 8, alignItems: "flex-start" },
  catIcon: { width: 42, height: 42, borderRadius: radius.sm, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  catName: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurface, minHeight: 36 },
  estimate: { fontFamily: fonts.body, fontSize: 11, color: c.muted },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stepBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  qty: { fontFamily: fonts.displayBold, fontSize: 14, color: c.onSurface },
  unit: { fontFamily: fonts.body, fontSize: 11, color: c.muted },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.divider, ...shadow.soft },
}));
