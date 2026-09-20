import React, { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { Card, PrimaryButton, GhostButton, EmptyState, Loading, Pill } from "@/src/components/ui";
import { StackHeader, Field } from "@/src/components/form";
import { formatDate } from "@/src/format";

export default function ManagePromo() {
  const styles = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { session } = useAuth();
  const outlets = session?.outlets || [];

  const [outletId, setOutletId] = useState(session?.currentOutletId || outlets[0]?.id || "");
  const [editing, setEditing] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [pct, setPct] = useState("");
  const [code, setCode] = useState("");
  const [until, setUntil] = useState("");

  const { data: promos, isLoading } = useQuery({
    queryKey: ["promos-manage", outletId],
    queryFn: () => api.get(`/promos?outlet_id=${outletId}`),
    enabled: !!outletId,
  });

  const reset = () => { setEditing(null); setTitle(""); setDesc(""); setPct(""); setCode(""); setUntil(""); };

  const body = () => ({
    outlet_id: outletId, title, description: desc,
    discount_pct: Number(pct) || 0, code, valid_until: until || null, active: true,
  });

  const save = useMutation({
    mutationFn: () => (editing ? api.put(`/promos/${editing.id}`, { ...body(), active: editing.active }) : api.post("/promos", body())),
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reset();
      qc.invalidateQueries({ queryKey: ["promos-manage"] });
      qc.invalidateQueries({ queryKey: ["promos"] });
    },
  });

  const toggle = useMutation({
    mutationFn: (p: any) => api.put(`/promos/${p.id}`, {
      outlet_id: p.outlet_id, title: p.title, description: p.description,
      discount_pct: Number(p.discount_pct), code: p.code, valid_until: p.valid_until, active: !p.active,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promos-manage"] });
      qc.invalidateQueries({ queryKey: ["promos"] });
    },
  });

  const remove = useMutation({
    mutationFn: (pid: string) => api.del(`/promos/${pid}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promos-manage"] });
      qc.invalidateQueries({ queryKey: ["promos"] });
    },
  });

  const startEdit = (p: any) => {
    setEditing(p); setTitle(p.title); setDesc(p.description || "");
    setPct(String(Number(p.discount_pct))); setCode(p.code || "");
    setUntil(p.valid_until ? String(p.valid_until).slice(0, 10) : "");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Promo & Voucher" subtitle="Kelola promo yang tampil di aplikasi pelanggan" />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["3xl"] }} bottomOffset={20}>
        {outlets.length > 0 ? (
          <View style={{ gap: spacing.xs }}>
            <Text style={styles.label}>Outlet</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {outlets.map((o) => {
                const on = o.id === outletId;
                return (
                  <Pressable key={o.id} testID={`promo-outlet-${o.id}`} onPress={() => { setOutletId(o.id); reset(); }} style={[styles.chip, on && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
                    <Text style={[styles.chipText, on && { color: colors.onBrand }]}>{o.city}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <Card style={{ gap: spacing.md }}>
          <Text style={styles.cardTitle}>{editing ? "Ubah Promo" : "Buat Promo Baru"}</Text>
          <Field label="Judul Promo" value={title} onChangeText={setTitle} placeholder="Diskon 15% Cuci Kering Setrika" testID="promo-title" />
          <Field label="Keterangan" value={desc} onChangeText={setDesc} placeholder="Syarat & ketentuan singkat" testID="promo-desc" />
          <Field label="Diskon (%)" value={pct} onChangeText={setPct} placeholder="15" keyboardType="number-pad" testID="promo-pct" />
          <Field label="Kode (opsional)" value={code} onChangeText={setCode} placeholder="WANGI15" testID="promo-code" />
          <Field label="Berlaku Sampai (YYYY-MM-DD, opsional)" value={until} onChangeText={setUntil} placeholder="2026-12-31" testID="promo-until" />
          <PrimaryButton
            label={editing ? "Simpan Perubahan" : "Tambah Promo"}
            icon="tag-plus"
            onPress={() => save.mutate()}
            loading={save.isPending}
            disabled={!title.trim() || !outletId}
            testID="save-promo"
          />
          {editing ? <GhostButton label="Batal Ubah" icon="close" onPress={reset} testID="cancel-edit" /> : null}
        </Card>

        <Text style={styles.sectionTitle}>Daftar Promo</Text>
        {isLoading ? <Loading /> : (promos || []).length === 0 ? (
          <EmptyState icon="tag-off-outline" title="Belum ada promo" subtitle="Buat promo pertama untuk outlet ini." />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {(promos || []).map((p: any) => (
              <View key={p.id} style={styles.row} testID={`promo-row-${p.id}`}>
                <View style={styles.badge}><Text style={styles.badgeText}>{Number(p.discount_pct)}%</Text></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.name}>{p.title}</Text>
                  <Text style={styles.sub} numberOfLines={2}>{p.description}</Text>
                  <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center", marginTop: 2 }}>
                    <Pill label={p.active ? "Aktif" : "Nonaktif"} tone={p.active ? "success" : "neutral"} />
                    {p.valid_until ? <Text style={styles.sub}>s.d. {formatDate(p.valid_until)}</Text> : null}
                  </View>
                </View>
                <View style={{ gap: spacing.sm }}>
                  <Pressable testID={`edit-promo-${p.id}`} onPress={() => startEdit(p)} hitSlop={6} style={styles.iconBtn}>
                    <Icon name="pencil" size={16} color={colors.brand} />
                  </Pressable>
                  <Pressable testID={`toggle-promo-${p.id}`} onPress={() => toggle.mutate(p)} hitSlop={6} style={styles.iconBtn}>
                    <Icon name={p.active ? "pause" : "play"} size={16} color={colors.brandPrimary} />
                  </Pressable>
                  <Pressable testID={`del-promo-${p.id}`} onPress={() => remove.mutate(p.id)} hitSlop={6} style={[styles.iconBtn, { backgroundColor: "#FFE4E6" }]}>
                    <Icon name="trash-can-outline" size={16} color={colors.error} />
                  </Pressable>
                </View>
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
  cardTitle: { fontFamily: fonts.displayBold, fontSize: 16, color: c.onSurface },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 17, color: c.onSurface },
  row: { flexDirection: "row", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md },
  badge: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: fonts.displayBold, fontSize: 14, color: c.onBrandPrimary },
  name: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurface },
  sub: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  iconBtn: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
}));
