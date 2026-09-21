import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Platform, TextInput, LayoutAnimation, UIManager } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, shadow, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { Card, PrimaryButton, Loading, Pill, SectionHeader } from "@/src/components/ui";
import { StackHeader, Segmented } from "@/src/components/form";
import { rupiah } from "@/src/format";
import { pickPhoto, uploadPhoto, photoUrl } from "@/src/photos";
import { Image } from "expo-image";

type Line = { service_id: string; service_name: string; unit: string; qty: string; price: number };

export default function TimbangOrder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();

  const [speed, setSpeed] = useState("regular");
  const [lines, setLines] = useState<Line[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({ Kiloan: true });

  const { data: order } = useQuery({ queryKey: ["order-detail", id], queryFn: () => api.get(`/orders/${id}`), enabled: !!id });
  const { data: services } = useQuery({
    queryKey: ["services", order?.outlet_id],
    queryFn: () => api.get(`/services?outlet_id=${order?.outlet_id}`),
    enabled: !!order?.outlet_id,
  });

  const priceOf = (s: any) => Number(speed === "express" ? (s.price_express || s.price) : s.price);
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    (services || []).forEach((service: any) => { (groups[service.category] = groups[service.category] || []).push(service); });
    return Object.entries(groups);
  }, [services]);

  const total = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.qty) || 0) * l.price, 0),
    [lines]);

  const weigh = useMutation({
    mutationFn: () => api.post(`/orders/${id}/weigh`, {
      items: lines.map((l) => ({ service_id: l.service_id, service_name: l.service_name, unit: l.unit, qty: Number(l.qty) || 0, price: l.price })),
      express: speed === "express",
      photos,
      employee_id: session?.employee?.id,
      employee_name: session?.name,
    }),
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order-detail"] });
      router.back();
    },
  });

  const addService = (s: any) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    const minimum = s.unit === "kg" && Number(s.min_kg) > 0 ? Number(s.min_kg) : 1;
    setLines((p) => p.some((l) => l.service_id === s.id)
      ? p.filter((l) => l.service_id !== s.id)
      : [...p, { service_id: s.id, service_name: s.name, unit: s.unit, qty: String(minimum), price: priceOf(s) }]);
  };

  const setQty = (sid: string, v: string) =>
    setLines((p) => p.map((l) => (l.service_id === sid ? { ...l, qty: v.replace(",", ".") } : l)));

  const normalizeQty = (sid: string) => setLines((p) => p.map((l) => {
    if (l.service_id !== sid) return l;
    const service = (services || []).find((s: any) => s.id === sid);
    const min = service?.unit === "kg" && Number(service?.min_kg) > 0 ? Number(service.min_kg) : 1;
    return { ...l, qty: String(Math.max(min, Number(l.qty) || min)) };
  }));

  const onSpeed = (v: string) => {
    setSpeed(v);
    setLines((p) => p.map((l) => {
      const s = (services || []).find((x: any) => x.id === l.service_id);
      return s ? { ...l, price: Number(v === "express" ? (s.price_express || s.price) : s.price) } : l;
    }));
  };

  useEffect(() => {
    if (Platform.OS === "android") UIManager.setLayoutAnimationEnabledExperimental?.(true);
  }, []);

  const toggleCategory = (category: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const addPhoto = async (source: "camera" | "library") => {
    setPhotoError("");
    try {
      const asset = await pickPhoto(source);
      if (!asset) return;
      setUploading(true);
      const url = await uploadPhoto(asset, "orders");
      setPhotos((p) => [...p, url]);
    } catch (e: any) {
      setPhotoError(e?.message || "Gagal mengunggah foto");
    } finally {
      setUploading(false);
    }
  };

  if (!order) {
    return <View style={{ flex: 1, backgroundColor: colors.surface }}><StackHeader title="Timbang Order" /><Loading /></View>;
  }

  const valid = lines.length > 0 && lines.every((line) => {
    const service = (services || []).find((s: any) => s.id === line.service_id);
    const minimum = service?.unit === "kg" && Number(service?.min_kg) > 0 ? Number(service.min_kg) : 1;
    return Number(line.qty) >= minimum;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title={`Timbang ${order.code}`} subtitle={`${order.customer_name} • ${order.customer_phone || "-"}`} />

      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 160 }} bottomOffset={20}>
        <Card style={{ gap: spacing.sm }}>
          <SectionHeader title="Permintaan Pelanggan" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {(Array.isArray(order.request_items) ? order.request_items : []).map((r: any, i: number) => (
              <Pill key={i} label={`${r.category} · ±${r.qty}`} tone="azure" />
            ))}
          </View>
          <Text style={styles.hint}>
            {order.delivery_type === "pickup" ? "Dijemput kurir" : order.delivery_type === "delivery" ? "Diantar kurir" : "Antar sendiri"}
            {order.notes ? ` • Catatan: ${order.notes}` : ""}
          </Text>
        </Card>

        <View style={{ gap: spacing.xs }}>
          <Text style={styles.label}>Kecepatan Layanan</Text>
          <Segmented items={[{ key: "regular", label: "Regular" }, { key: "express", label: "Express" }]} value={speed} onChange={onSpeed} />
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text style={styles.label}>Pilih Layanan & Input Berat</Text>
          <Text style={styles.hint}>Gunakan kartu layanan yang sama seperti Buat Order. Minimum order terapkan otomatis saat dipilih.</Text>
          {!services ? <Loading /> : grouped.map(([category, list]) => <View key={category} style={{ gap: spacing.sm }}>
            <Pressable testID={`weigh-category-${category}`} onPress={() => toggleCategory(category)} style={styles.catHeader}><View style={styles.catTitleRow}><Icon name={expandedCategories[category] ? "chevron-up" : "chevron-down"} size={20} color={colors.brand} /><Text style={styles.catTitle}>{category}</Text></View><Text style={styles.catCount}>{list.length} layanan</Text></Pressable>
            {expandedCategories[category] ? list.map((s: any) => {
              const line = lines.find((l) => l.service_id === s.id);
              return <View key={s.id} style={[styles.svc, line && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}>
                <Pressable testID={`svc-${s.id}`} onPress={() => addService(s)} style={styles.svcHead}><View style={styles.svcIcon}><Icon name={s.icon} size={20} color={colors.brand} /></View><View style={{ flex: 1 }}><Text style={styles.svcName}>{s.name}</Text><Text style={styles.hint}>{rupiah(priceOf(s))}/{s.unit}{s.duration ? ` • ${speed === "express" && s.duration_express ? s.duration_express : s.duration}` : ""}</Text>{s.min_kg ? <Text style={styles.minBadge}>Minimal {Number(s.min_kg)} kg</Text> : null}</View><Icon name={line ? "checkbox-marked" : "plus-circle-outline"} size={23} color={line ? colors.brandPrimary : colors.muted} /></Pressable>
                {line ? <View style={styles.qtyRow}><TextInput testID={`qty-${s.id}`} value={line.qty} onChangeText={(v) => setQty(s.id, v)} onBlur={() => normalizeQty(s.id)} keyboardType="decimal-pad" placeholder={s.unit === "kg" ? "Berat (kg)" : `Jumlah (${s.unit})`} placeholderTextColor={colors.muted} style={styles.qtyField} /><Text style={styles.lineTotal}>{rupiah((Number(line.qty) || 0) * line.price)}</Text></View> : null}
              </View>;
            }) : null}
          </View>)}
        </View>

        {/* Foto pakaian */}
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.label}>Foto Pakaian (dikirim ke pelanggan)</Text>
          <Text style={styles.hint}>Sertakan foto agar pelanggan yakin saat menyetujui nota.</Text>
          <View style={styles.photoRow}>
            {photos.map((u) => (
              <View key={u} style={styles.thumbWrap}>
                <Image source={{ uri: photoUrl(u) }} style={styles.thumb} contentFit="cover" />
                <Pressable testID={`rm-photo-${photos.indexOf(u)}`} onPress={() => setPhotos((p) => p.filter((x) => x !== u))} style={styles.thumbX} hitSlop={6}>
                  <Icon name="close" size={12} color="#fff" />
                </Pressable>
              </View>
            ))}
            <Pressable testID="photo-camera" onPress={() => addPhoto("camera")} style={styles.addPhoto}>
              <Icon name="camera-plus" size={22} color={colors.brand} />
              <Text style={styles.addPhotoText}>Kamera</Text>
            </Pressable>
            <Pressable testID="photo-library" onPress={() => addPhoto("library")} style={styles.addPhoto}>
              <Icon name="image-multiple" size={22} color={colors.brand} />
              <Text style={styles.addPhotoText}>Galeri</Text>
            </Pressable>
          </View>
          {uploading ? <Text style={styles.hint}>Mengunggah foto…</Text> : null}
          {photoError ? <Text style={styles.photoError} testID="photo-error">{photoError}</Text> : null}
        </View>
      </KeyboardAwareScrollView>

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Nota</Text>
          <Text style={styles.totalValue} testID="weigh-total">{rupiah(total)}</Text>
        </View>
        <PrimaryButton
          label={valid ? "Kirim Nota ke Pelanggan" : "Input berat dulu"}
          icon="send-check"
          onPress={() => weigh.mutate()}
          loading={weigh.isPending}
          disabled={!valid}
          testID="submit-weigh"
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  label: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurface },
  hint: { fontFamily: fonts.body, fontSize: 12, color: c.muted, lineHeight: 17 },
  svc: { borderRadius: radius.md, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface, padding: spacing.md, gap: spacing.sm },
  svcHead: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 44 },
  svcIcon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  svcName: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurface },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  qtyField: { flex: 1, height: 44, borderRadius: radius.sm, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface, paddingHorizontal: spacing.md, fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurface },
  lineTotal: { fontFamily: fonts.displayBold, fontSize: 15, color: c.brandPrimary, minWidth: 92, textAlign: "right" },
  catHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: c.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 13 },
  catTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  catTitle: { fontFamily: fonts.displayBold, fontSize: 14, color: c.brand, textTransform: "uppercase", letterSpacing: 0.5 },
  catCount: { fontFamily: fonts.bodySemi, fontSize: 12, color: c.muted },
  minBadge: { alignSelf: "flex-start", marginTop: 4, backgroundColor: "#FEF3C7", color: "#92400E", overflow: "hidden", borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 3, fontFamily: fonts.bodyBold, fontSize: 11 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, gap: spacing.sm, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.divider, ...shadow.soft },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurfaceSecondary },
  totalValue: { fontFamily: fonts.displayBold, fontSize: 22, color: c.brandPrimary },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  thumbWrap: { width: 78, height: 78, borderRadius: radius.md, overflow: "hidden", position: "relative" },
  thumb: { width: "100%", height: "100%" },
  thumbX: { position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  addPhoto: { width: 78, height: 78, borderRadius: radius.md, borderWidth: 1.5, borderStyle: "dashed", borderColor: c.border, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", gap: 4 },
  addPhotoText: { fontFamily: fonts.bodyBold, fontSize: 11, color: c.brand },
  photoError: { fontFamily: fonts.bodyBold, fontSize: 12, color: c.error },
}));
