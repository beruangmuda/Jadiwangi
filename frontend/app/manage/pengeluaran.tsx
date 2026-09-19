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
import { StackHeader, Field } from "@/src/components/form";
import { rupiah, formatDate } from "@/src/format";

const CATS = ["Deterjen & Pewangi", "Listrik & Air", "Gaji Harian", "Plastik & Packaging", "Perawatan Mesin", "Transport Kurir", "Lainnya"];

export default function ManagePengeluaran() {
  const styles = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { session } = useAuth();
  const outlets = session?.outlets || [];

  const [category, setCategory] = useState(CATS[0]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [outletId, setOutletId] = useState(session?.currentOutletId || outlets[0]?.id || "");

  const { data: expenses, isLoading } = useQuery({ queryKey: ["expenses"], queryFn: () => api.get("/expenses") });

  const create = useMutation({
    mutationFn: () => api.post("/expenses", { outlet_id: outletId, category, amount: Number(amount) || 0, note }),
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAmount(""); setNote("");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["rep-fin"] });
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Pencatatan Pengeluaran" subtitle="Catat biaya operasional" />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["3xl"] }} bottomOffset={20}>
        <Card style={{ gap: spacing.md }}>
          <View style={{ gap: spacing.xs }}>
            <Text style={styles.label}>Kategori</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {CATS.map((cat) => {
                const active = cat === category;
                return (
                  <Pressable key={cat} onPress={() => setCategory(cat)} style={[styles.chip, active && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                    <Text style={[styles.chipText, active && { color: colors.onBrandPrimary }]}>{cat}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Field label="Jumlah (Rp)" value={amount} onChangeText={setAmount} placeholder="100000" keyboardType="number-pad" testID="exp-amount" />
          <Field label="Catatan (opsional)" value={note} onChangeText={setNote} placeholder="Keterangan" testID="exp-note" />
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
          <PrimaryButton label="Catat Pengeluaran" icon="cash-minus" tone="danger" onPress={() => create.mutate()} loading={create.isPending} disabled={!amount || !outletId} testID="save-expense" />
        </Card>

        <Text style={styles.sectionTitle}>Riwayat Pengeluaran</Text>
        {isLoading ? <Loading /> : (expenses || []).length === 0 ? <EmptyState icon="cash-remove" title="Belum ada pengeluaran" /> : (
          <View style={{ gap: spacing.sm }}>
            {(expenses || []).map((e: any) => (
              <View key={e.id} style={styles.row}>
                <View style={styles.iconBox}><Icon name="cash-minus" size={18} color={colors.error} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{e.category}</Text>
                  <Text style={styles.sub}>{formatDate(e.created_at)}{e.note ? ` • ${e.note}` : ""}</Text>
                </View>
                <Text style={styles.amount}>-{rupiah(e.amount)}</Text>
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
  chipText: { fontFamily: fonts.bodySemi, fontSize: 12, color: c.onSurfaceSecondary },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 17, color: c.onSurface },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md },
  iconBox: { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: "#FFE4E6", alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurface },
  sub: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  amount: { fontFamily: fonts.displayBold, fontSize: 15, color: c.error },
}));
