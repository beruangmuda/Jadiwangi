import React, { useState } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";

// Pill in a header that opens an outlet picker. Owner can pick "Semua Outlet".
export function OutletSwitcher({ allowAll = true }: { allowAll?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { session, currentOutlet, setOutlet } = useAuth();
  const [open, setOpen] = useState(false);
  const outlets = session?.outlets || [];
  const current = currentOutlet();
  const label = current ? current.name.replace("Jadiwangi ", "") : "Semua Outlet";

  return (
    <>
      <Pressable testID="outlet-switcher" onPress={() => setOpen(true)} style={styles.pill}>
        <Icon name="map-marker" size={15} color={colors.brandPrimary} />
        <Text style={styles.pillText} numberOfLines={1}>{label}</Text>
        <Icon name="chevron-down" size={16} color={colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.title}>Pilih Outlet</Text>
            {allowAll ? (
              <Row active={!current} label="Semua Outlet" sub="Gabungan semua cabang" onPress={() => { setOutlet(null); setOpen(false); }} />
            ) : null}
            {outlets.map((o) => (
              <Row key={o.id} active={current?.id === o.id} label={o.name} sub={o.city} onPress={() => { setOutlet(o.id); setOpen(false); }} />
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function Row({ active, label, sub, onPress }: { active: boolean; label: string; sub: string; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={`outlet-opt-${label}`} onPress={onPress} style={[styles.row, active && { backgroundColor: colors.surfaceSecondary }]}>
      <View style={[styles.dot, { backgroundColor: active ? colors.brandPrimary : colors.surfaceTertiary }]}>
        <Icon name="store" size={16} color={active ? colors.onBrandPrimary : colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      {active ? <Icon name="check-circle" size={20} color={colors.brandPrimary} /> : null}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  pill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: c.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7, maxWidth: 190 },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurface, flexShrink: 1 },
  overlay: { flex: 1, backgroundColor: "rgba(30,26,52,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, gap: spacing.xs, paddingBottom: spacing["2xl"] },
  title: { fontFamily: fonts.displayBold, fontSize: 18, color: c.onSurface, marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md },
  dot: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurface },
  rowSub: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
}));
