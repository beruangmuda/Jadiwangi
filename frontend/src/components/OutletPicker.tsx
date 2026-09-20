import React from "react";
import { View, Text, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/src/api";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { Loading } from "@/src/components/ui";

/** Pilihan outlet untuk pelanggan (dipakai saat pendaftaran & sebelum halaman order). */
export function OutletPicker({
  value,
  onChange,
  testIDPrefix = "outlet",
}: {
  value: string | null;
  onChange: (id: string) => void;
  testIDPrefix?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { data, isLoading } = useQuery({ queryKey: ["outlets"], queryFn: () => api.get("/outlets") });

  if (isLoading) return <Loading />;

  return (
    <View style={{ gap: spacing.sm }}>
      {(data || []).map((o: any) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            testID={`${testIDPrefix}-${o.id}`}
            onPress={() => onChange(o.id)}
            style={[styles.row, on && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}
          >
            <View style={[styles.iconWrap, on && { backgroundColor: colors.brandPrimary }]}>
              <Icon name="storefront" size={20} color={on ? colors.onBrandPrimary : colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{o.name}</Text>
              <Text style={styles.sub} numberOfLines={2}>{o.address || o.city}</Text>
            </View>
            <Icon name={on ? "radiobox-marked" : "radiobox-blank"} size={20} color={on ? colors.brandPrimary : colors.muted} />
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface,
  },
  iconWrap: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onSurface },
  sub: { fontFamily: fonts.body, fontSize: 12, color: c.muted, marginTop: 1 },
}));
