import React from "react";
import { View, Text, TextInput, Pressable, KeyboardTypeOptions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";

export function StackHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable testID="stack-back" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
        <Icon name="arrow-left" size={22} color={colors.onSurface} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

export function Segmented({
  items,
  value,
  onChange,
}: {
  items: { key: string; label: string }[];
  value: string;
  onChange: (k: string) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.segment}>
      {items.map((it) => {
        const active = it.key === value;
        return (
          <Pressable key={it.key} testID={`seg-${it.key}`} onPress={() => onChange(it.key)} style={[styles.segBtn, active && { backgroundColor: colors.brandPrimary }]}>
            <Text style={[styles.segText, { color: active ? colors.onBrandPrimary : colors.onSurfaceSecondary }]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.divider },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: 20, color: c.onSurface },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: c.muted },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurfaceSecondary },
  input: { backgroundColor: c.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 13, fontFamily: fonts.body, fontSize: 15, color: c.onSurface },
  segment: { flexDirection: "row", backgroundColor: c.surfaceTertiary, borderRadius: radius.md, padding: 4 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: "center" },
  segText: { fontFamily: fonts.bodyBold, fontSize: 13 },
}));
