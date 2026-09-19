import React from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, shadow, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { OutletSwitcher } from "@/src/components/OutletSwitcher";
import { OrdersPipeline } from "@/src/components/OrdersPipeline";

export default function OrderTab() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const outletId = session?.currentOutletId ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View>
          <Text style={styles.title}>Order & Antrian</Text>
          <Text style={styles.sub}>Kelola proses laundry</Text>
        </View>
        <OutletSwitcher />
      </View>

      <OrdersPipeline outletId={outletId} />

      <Pressable
        testID="fab-buat-order"
        onPress={() => router.push("/order-baru")}
        style={({ pressed }) => [styles.fab, { bottom: spacing.lg }, pressed && { transform: [{ scale: 0.95 }] }]}
      >
        <Icon name="plus" size={24} color={colors.onBrandPrimary} />
        <Text style={styles.fabText}>Buat Order</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.divider },
  title: { fontFamily: fonts.displayBold, fontSize: 22, color: c.onSurface },
  sub: { fontFamily: fonts.body, fontSize: 13, color: c.muted },
  fab: { position: "absolute", right: spacing.lg, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.brandPrimary, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: 20, ...shadow.soft },
  fabText: { fontFamily: fonts.displayBold, fontSize: 15, color: c.onBrandPrimary },
}));
