import React from "react";
import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { Icon } from "@/src/components/Icon";
import { fonts, useTheme } from "@/src/theme";

const ICONS: Record<string, { on: string; off: string }> = {
  index: { on: "view-dashboard", off: "view-dashboard-outline" },
  order: { on: "washing-machine", off: "washing-machine" },
  laporan: { on: "chart-box", off: "chart-box-outline" },
  gaji: { on: "cash-multiple", off: "cash-multiple" },
  setelan: { on: "cog", off: "cog-outline" },
};

export default function OwnerLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
          paddingTop: 6,
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 11 },
        tabBarIcon: ({ focused, color }) => {
          const set = ICONS[route.name] || ICONS.index;
          return <Icon name={focused ? set.on : set.off} size={24} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Beranda" }} />
      <Tabs.Screen name="order" options={{ title: "Order" }} />
      <Tabs.Screen name="laporan" options={{ title: "Laporan" }} />
      <Tabs.Screen name="gaji" options={{ title: "Gaji" }} />
      <Tabs.Screen name="setelan" options={{ title: "Setelan" }} />
    </Tabs>
  );
}
