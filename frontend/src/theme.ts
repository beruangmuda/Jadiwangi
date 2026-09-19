// Design tokens for Jadiwangi App. Light theme (Tactile / Playful personality).
// Colors mirror the "color" block of /app/design_guidelines.json.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FAFAFF",
  onSurface: "#1E1A34",
  surfaceSecondary: "#F2EFFF",
  onSurfaceSecondary: "#3D3664",
  surfaceTertiary: "#E4E0FA",
  onSurfaceTertiary: "#2C264D",
  surfaceInverse: "#1E1A34",
  onSurfaceInverse: "#FFFFFF",
  muted: "#6B648C",

  brand: "#A78BFA",
  onBrand: "#FFFFFF",
  brandPrimary: "#0096FF",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#C4B5FD",
  onBrandSecondary: "#1E1A34",
  brandTertiary: "#E0F2FE",
  onBrandTertiary: "#0369A1",

  success: "#0F9D6B",
  onSuccess: "#FFFFFF",
  warning: "#B45309",
  onWarning: "#FFFFFF",
  error: "#E11D48",
  onError: "#FFFFFF",
  info: "#0096FF",
  onInfo: "#FFFFFF",

  border: "#E4E0FA",
  borderStrong: "#C4B5FD",
  divider: "#F2EFFF",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export const fonts = {
  display: "Fredoka-SemiBold",
  displayMedium: "Fredoka-Medium",
  displayBold: "Fredoka-Bold",
  body: "Nunito-Regular",
  bodySemi: "Nunito-SemiBold",
  bodyBold: "Nunito-Bold",
  bodyExtra: "Nunito-ExtraBold",
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 } as const;
export const radius = { sm: 12, md: 16, lg: 24, pill: 999 } as const;

export const shadow = {
  soft: {
    shadowColor: "#5B4B9E",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  card: {
    shadowColor: "#5B4B9E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
};

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}
setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
