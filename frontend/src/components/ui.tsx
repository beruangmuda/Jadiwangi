import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextProps,
  View,
  ViewStyle,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { fonts, makeStyles, radius, shadow, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";

// ---------------------------------------------------------------------------
// Logo
// ---------------------------------------------------------------------------
export function Logo({ size = 26 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Text style={{ fontFamily: fonts.displayBold, fontSize: size, color: colors.brand, letterSpacing: 0.5 }}>
        JADI WANGI
      </Text>
      <View
        style={{
          backgroundColor: colors.brandPrimary,
          borderRadius: radius.sm,
          paddingHorizontal: 8,
          paddingVertical: 2,
        }}
      >
        <Text style={{ fontFamily: fonts.displayBold, fontSize: size * 0.62, color: colors.onBrandPrimary }}>
          App
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Typography helpers
// ---------------------------------------------------------------------------
export function TitleText(props: TextProps & { size?: number }) {
  const { colors } = useTheme();
  const { style, size = 20, ...rest } = props;
  return <Text {...rest} style={[{ fontFamily: fonts.displayBold, fontSize: size, color: colors.onSurface }, style]} />;
}
export function BodyText(props: TextProps & { muted?: boolean; weight?: keyof typeof fonts }) {
  const { colors } = useTheme();
  const { style, muted, weight = "body", ...rest } = props;
  return <Text {...rest} style={[{ fontFamily: fonts[weight], fontSize: 14, color: muted ? colors.muted : colors.onSurface }, style]} />;
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
export function Card({ children, style, delay = 0, testID }: { children: React.ReactNode; style?: ViewStyle; delay?: number; testID?: string }) {
  const styles = useCardStyles();
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify().damping(16)} style={[styles.card, style]} testID={testID}>
      {children}
    </Animated.View>
  );
}
const useCardStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
    ...shadow.card,
  },
}));

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 18, color: colors.onSurface }}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.brandPrimary }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pill / Chip
// ---------------------------------------------------------------------------
export function Pill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" | "error" | "brand" | "azure" }) {
  const { colors } = useTheme();
  const map: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: colors.surfaceTertiary, fg: colors.onSurfaceTertiary },
    success: { bg: "#DCFCE7", fg: "#0F9D6B" },
    warning: { bg: "#FEF3C7", fg: "#B45309" },
    error: { bg: "#FFE4E6", fg: "#E11D48" },
    brand: { bg: colors.surfaceSecondary, fg: colors.brand },
    azure: { bg: colors.brandTertiary, fg: colors.onBrandTertiary },
  };
  const t = map[tone];
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: t.fg }}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Filter chip row (horizontal, non-wrapping)
// ---------------------------------------------------------------------------
export function ChipRow({
  items,
  value,
  onChange,
}: {
  items: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ height: 56 }}
      contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" }}
    >
      {items.map((it) => {
        const active = it.key === value;
        return (
          <Pressable
            key={it.key}
            testID={`chip-${it.key}`}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              onChange(it.key);
            }}
            style={{
              height: 36,
              flexShrink: 0,
              justifyContent: "center",
              paddingHorizontal: 16,
              borderRadius: radius.pill,
              backgroundColor: active ? colors.brandPrimary : colors.surface,
              borderWidth: 1,
              borderColor: active ? colors.brandPrimary : colors.border,
            }}
          >
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: active ? colors.onBrandPrimary : colors.onSurfaceSecondary }}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  icon,
  tone = "azure",
  testID,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  tone?: "azure" | "lavender" | "danger";
  testID?: string;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const bg = tone === "azure" ? colors.brandPrimary : tone === "lavender" ? colors.brand : colors.error;
  const fg = colors.onBrandPrimary;
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        if (disabled || loading) return;
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          borderRadius: radius.md,
          paddingVertical: 15,
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          ...shadow.soft,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={20} color={fg} /> : null}
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 16, color: fg }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function GhostButton({ label, onPress, icon, testID }: { label: string; onPress: () => void; icon?: string; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: colors.surfaceSecondary,
        opacity: pressed ? 0.8 : 1,
        borderRadius: radius.md,
        paddingVertical: 13,
        paddingHorizontal: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      })}
    >
      {icon ? <Icon name={icon} size={18} color={colors.brand} /> : null}
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onSurfaceSecondary }}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Empty / Loading states
// ---------------------------------------------------------------------------
export function EmptyState({ icon = "washing-machine", title, subtitle }: { icon?: string; title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: spacing["3xl"], gap: spacing.sm }}>
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 44,
          backgroundColor: colors.surfaceSecondary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={42} color={colors.brand} />
      </View>
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 16, color: colors.onSurface, marginTop: spacing.sm }}>{title}</Text>
      {subtitle ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, textAlign: "center" }}>{subtitle}</Text> : null}
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: spacing["3xl"], alignItems: "center" }}>
      <ActivityIndicator size="large" color={colors.brandPrimary} />
    </View>
  );
}

export function Skeleton({ height = 80, style }: { height?: number; style?: ViewStyle }) {
  const { colors } = useTheme();
  return <View style={[{ height, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary }, style]} />;
}
