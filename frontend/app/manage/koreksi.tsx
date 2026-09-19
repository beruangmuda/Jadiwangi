import React, { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { Card, PrimaryButton, EmptyState, Loading } from "@/src/components/ui";
import { StackHeader, Field, Segmented } from "@/src/components/form";
import { rupiah, formatDate } from "@/src/format";

export default function ManageKoreksi() {
  const styles = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { session } = useAuth();
  const outlets = session?.outlets || [];

  const [direction, setDirection] = useState("in");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [outletId, setOutletId] = useState(session?.currentOutletId || outlets[0]?.id || "");

  const { data: list, isLoading } = useQuery({ queryKey: ["adjustments"], queryFn: () => api.get("/adjustments") });

  const create = useMutation({
    mutationFn: () => api.post("/adjustments", { outlet_id: outletId, amount: Number(amount) || 0, direction, reason }),
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAmount(""); setReason("");
      qc.invalidateQueries({ queryKey: ["adjustments"] });
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Koreksi Keuangan" subtitle="Penyesuaian saldo kas" />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["3xl"] }} bottomOffset={20}>
        <Card style={{ gap: spacing.md }}>
          <View style={{ gap: spacing.xs }}>
            <Text style={styles.label}>Jenis Koreksi</Text>
            <Segmented items={[{ key: "in", label: "Kas Masuk (+)" }, { key: "out", label: "Kas Keluar (−)" }]} value={direction} onChange={setDirection} />
          </View>
          <Field label="Jumlah (Rp)" value={amount} onChangeText={setAmount} placeholder="50000" keyboardType="number-pad" testID="adj-amount" />
          <Field label="Alasan" value={reason} onChangeText={setReason} placeholder="Selisih kas / koreksi input" testID="adj-reason" />
          {outlets.length > 0 ? (
            <View style={{ gap: spacing.xs }}>
              <Text style={styles.label}>Outlet</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {outlets.map((o) => {
                  const active = o.id === outletId;
                  return (
                    <Pressable key={o.id} onPress={() => setOutletId(o.id)} style={[styles.chip, active && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
                      <Text style={[styles.chipText, active && { color: colors.onBrand }]}>{o.city}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
          <PrimaryButton label="Simpan Koreksi" icon="cash-sync" onPress={() => create.mutate()} loading={create.isPending} disabled={!amount || !outletId} testID="save-adjustment" />
        </Card>

        <Text style={styles.sectionTitle}>Riwayat Koreksi</Text>
        {isLoading ? <Loading /> : (list || []).length === 0 ? <EmptyState icon="cash-sync" title="Belum ada koreksi" /> : (
          <View style={{ gap: spacing.sm }}>
            {(list || []).map((a: any) => {
              const isIn = a.direction === "in";
              return (
                <View key={a.id} style={styles.row}>
                  <View style={[styles.iconBox, { backgroundColor: isIn ? "#DCFCE7" : "#FFE4E6" }]}>
                    <Icon name={isIn ? "arrow-up-bold" : "arrow-down-bold"} size={18} color={isIn ? colors.success : colors.error} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{a.reason || "Koreksi"}</Text>
                    <Text style={styles.sub}>{formatDate(a.created_at)}</Text>
                  </View>
                  <Text style={[styles.amount, { color: isIn ? colors.success : colors.error }]}>{isIn ? "+" : "−"}{rupiah(a.amount)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurfaceSecondary },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 12, color: c.onSurfaceSecondary },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 17, color: c.onSurface },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md },
  iconBox: { width: 38, height: 38, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurface },
  sub: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  amount: { fontFamily: fonts.displayBold, fontSize: 15 },
}));
