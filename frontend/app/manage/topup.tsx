import React, { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/api";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { Card, EmptyState, Loading, Pill } from "@/src/components/ui";
import { StackHeader, Segmented } from "@/src/components/form";
import { rupiah, formatDateTime } from "@/src/format";

export default function ManageTopup() {
  const styles = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const [tab, setTab] = useState("pending");

  const { data, isLoading } = useQuery({
    queryKey: ["topups", tab],
    queryFn: () => api.get(`/topups?status=${tab}`),
  });

  const confirm = useMutation({
    mutationFn: (tid: string) => api.post(`/topups/${tid}/confirm`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["topups"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
  const reject = useMutation({
    mutationFn: (tid: string) => api.post(`/topups/${tid}/reject`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["topups"] }),
  });

  const list = data || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Konfirmasi Top-up Coin" subtitle="Setujui setelah pelanggan membayar di outlet" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["3xl"] }}>
        <Segmented
          items={[{ key: "pending", label: "Menunggu" }, { key: "confirmed", label: "Disetujui" }, { key: "rejected", label: "Ditolak" }]}
          value={tab}
          onChange={setTab}
        />

        {isLoading ? <Loading /> : list.length === 0 ? (
          <Card><EmptyState icon="hand-coin-outline" title="Tidak ada data" subtitle="Belum ada permintaan top-up pada status ini." /></Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {list.map((t: any) => (
              <View key={t.id} style={styles.row} testID={`topup-req-${t.id}`}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.name}>{t.customer_name || "-"}</Text>
                  <Text style={styles.sub}>{t.customer_phone} • {t.outlet_name}</Text>
                  <Text style={styles.amount}>{rupiah(t.amount)} → {Number(t.coins).toLocaleString("id-ID")} coin</Text>
                  <Text style={styles.sub}>{formatDateTime(t.created_at)} • {t.method === "cash" ? "Tunai" : "QRIS"}</Text>
                </View>
                {t.status === "pending" ? (
                  <View style={{ gap: spacing.sm }}>
                    <Pressable testID={`confirm-${t.id}`} onPress={() => confirm.mutate(t.id)} style={[styles.btn, { backgroundColor: colors.brandPrimary }]}>
                      <Icon name="check" size={16} color={colors.onBrandPrimary} />
                      <Text style={[styles.btnText, { color: colors.onBrandPrimary }]}>Setujui</Text>
                    </Pressable>
                    <Pressable testID={`reject-${t.id}`} onPress={() => reject.mutate(t.id)} style={[styles.btn, { backgroundColor: "#FFE4E6" }]}>
                      <Icon name="close" size={16} color={colors.error} />
                      <Text style={[styles.btnText, { color: colors.error }]}>Tolak</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pill label={t.status === "confirmed" ? "Disetujui" : "Ditolak"} tone={t.status === "confirmed" ? "success" : "error"} />
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md },
  name: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurface },
  sub: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  amount: { fontFamily: fonts.displayBold, fontSize: 15, color: c.brandPrimary },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: radius.sm, paddingVertical: 9, paddingHorizontal: 12, minWidth: 96 },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 12 },
}));
