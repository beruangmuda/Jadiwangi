import React, { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { Card, EmptyState, Loading, Pill } from "@/src/components/ui";
import { StackHeader, Segmented } from "@/src/components/form";
import { formatDateTime } from "@/src/format";

export default function ManagePengaduan() {
  const styles = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { session } = useAuth();
  const outletId = session?.currentOutletId ?? null;
  const [tab, setTab] = useState("complaint");

  const query = tab === "complaint" ? `?max_rating=2${outletId ? `&outlet_id=${outletId}` : ""}` : outletId ? `?outlet_id=${outletId}` : "";
  const { data, isLoading } = useQuery({
    queryKey: ["reviews", tab, outletId],
    queryFn: () => api.get(`/reviews${query}`),
  });

  const resolve = useMutation({
    mutationFn: (rid: string) => api.patch(`/reviews/${rid}/resolve`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const list = data || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Pengaduan & Ulasan" subtitle="Keluhan pelanggan bintang 1-2 dan semua ulasan" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["3xl"] }}>
        <Segmented
          items={[{ key: "complaint", label: "Pengaduan" }, { key: "all", label: "Semua Ulasan" }]}
          value={tab}
          onChange={setTab}
        />

        {isLoading ? <Loading /> : list.length === 0 ? (
          <Card><EmptyState icon="emoticon-happy-outline" title="Tidak ada pengaduan" subtitle="Semua pelanggan puas sejauh ini." /></Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {list.map((r: any) => (
              <View key={r.id} style={styles.row} testID={`review-${r.id}`}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <Text style={styles.name}>{r.customer_name || "-"}</Text>
                    <View style={{ flexDirection: "row" }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Icon key={n} name={r.rating >= n ? "star" : "star-outline"} size={14} color={r.rating >= n ? "#F59E0B" : colors.muted} />
                      ))}
                    </View>
                  </View>
                  <Text style={styles.sub}>{r.customer_phone} • {r.outlet_name} • {formatDateTime(r.created_at)}</Text>
                  {r.comment ? <Text style={styles.comment}>&ldquo;{r.comment}&rdquo;</Text> : null}
                  <Pill
                    label={r.status === "resolved" ? "Ditindaklanjuti" : r.status === "new" ? "Perlu ditangani" : "Ulasan"}
                    tone={r.status === "resolved" ? "success" : r.status === "new" ? "error" : "azure"}
                  />
                </View>
                {r.status === "new" ? (
                  <Pressable testID={`resolve-${r.id}`} onPress={() => resolve.mutate(r.id)} style={[styles.btn, { backgroundColor: colors.brandPrimary }]}>
                    <Icon name="check" size={16} color={colors.onBrandPrimary} />
                    <Text style={styles.btnText}>Selesai</Text>
                  </Pressable>
                ) : null}
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
  comment: { fontFamily: fonts.body, fontSize: 13, color: c.onSurfaceSecondary, lineHeight: 18 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: radius.sm, paddingVertical: 9, paddingHorizontal: 12 },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 12, color: "#fff" },
}));
