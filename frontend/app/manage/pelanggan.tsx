import React, { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Card, PrimaryButton, EmptyState, Loading } from "@/src/components/ui";
import { StackHeader, Field } from "@/src/components/form";
import { rupiah } from "@/src/format";

export default function ManagePelanggan() {
  const styles = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { session } = useAuth();
  const outlets = session?.outlets || [];

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [deposit, setDeposit] = useState("");
  const [outletId, setOutletId] = useState(session?.currentOutletId || outlets[0]?.id || "");

  const { data: customers, isLoading } = useQuery({ queryKey: ["customers", "manage"], queryFn: () => api.get("/customers") });

  const create = useMutation({
    mutationFn: () => api.post("/customers", { name, phone, email, deposit: Number(deposit) || 0, outlet_id: outletId }),
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setName(""); setPhone(""); setEmail(""); setDeposit("");
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Tambah Pelanggan" subtitle="Daftarkan pelanggan baru" />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["3xl"] }} bottomOffset={20}>
        <Card style={{ gap: spacing.md }}>
          <Field label="Nama" value={name} onChangeText={setName} placeholder="Nama pelanggan" testID="cust-name" />
          <Field label="No. HP" value={phone} onChangeText={setPhone} placeholder="0812xxxxxxx" keyboardType="phone-pad" testID="cust-phone" />
          <Field label="Email (opsional)" value={email} onChangeText={setEmail} placeholder="email@mail.com" keyboardType="email-address" testID="cust-email" />
          <Field label="Deposit Awal" value={deposit} onChangeText={setDeposit} placeholder="0" keyboardType="number-pad" testID="cust-deposit" />
          <View style={{ gap: spacing.xs }}>
            <Text style={styles.label}>Outlet</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {outlets.map((o) => {
                const active = o.id === outletId;
                return (
                  <Pressable key={o.id} onPress={() => setOutletId(o.id)} style={[styles.chip, active && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                    <Text style={[styles.chipText, active && { color: colors.onBrandPrimary }]}>{o.city}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <PrimaryButton label="Simpan Pelanggan" icon="content-save" onPress={() => create.mutate()} loading={create.isPending} disabled={!name} testID="save-customer" />
        </Card>

        <Text style={styles.sectionTitle}>Pelanggan Terdaftar</Text>
        {isLoading ? <Loading /> : (customers || []).length === 0 ? <EmptyState icon="account-off" title="Belum ada pelanggan" /> : (
          <View style={{ gap: spacing.sm }}>
            {(customers || []).map((c: any) => (
              <View key={c.id} style={styles.row}>
                <View style={styles.avatar}><Text style={styles.initial}>{c.name?.[0]}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{c.name}</Text>
                  <Text style={styles.sub}>{c.phone} • {c.points} poin</Text>
                </View>
                {c.deposit > 0 ? <Text style={styles.deposit}>{rupiah(c.deposit)}</Text> : null}
              </View>
            ))}
          </View>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurfaceSecondary },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurfaceSecondary },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 17, color: c.onSurface },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.brand, alignItems: "center", justifyContent: "center" },
  initial: { fontFamily: fonts.displayBold, fontSize: 16, color: c.onBrand },
  name: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurface },
  sub: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  deposit: { fontFamily: fonts.displayBold, fontSize: 14, color: c.brandPrimary },
}));
