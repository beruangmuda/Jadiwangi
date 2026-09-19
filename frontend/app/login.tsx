import React, { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { useAuth, Role } from "@/src/auth";
import { fonts, makeStyles, radius, shadow, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";

const ROLES: { key: Role; label: string; desc: string; icon: string }[] = [
  { key: "owner", label: "Owner", desc: "Akses penuh & laporan", icon: "crown" },
  { key: "pegawai", label: "Pegawai", desc: "Kelola order & produksi", icon: "account-hard-hat" },
  { key: "pelanggan", label: "Pelanggan", desc: "Order & lihat ranking", icon: "account-heart" },
];

const HINTS: Record<Role, string> = {
  owner: "PIN demo: 1234",
  pegawai: "PIN demo: 3333 (produksi) / 5555 (kurir)",
  pelanggan: "Masukkan 4 digit terakhir no. HP mana saja",
};

export default function Login() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const router = useRouter();

  const [role, setRole] = useState<Role | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const shake = useSharedValue(0);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const triggerError = (msg: string) => {
    setError(msg);
    setPin("");
    shake.value = withSequence(withTiming(-10, { duration: 50 }), withTiming(10, { duration: 50 }), withTiming(-6, { duration: 50 }), withTiming(0, { duration: 50 }));
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  const submit = async (value: string, r: Role) => {
    setBusy(true);
    setError("");
    try {
      if (r === "pelanggan") await login(r, { phone: value });
      else await login(r, { pin: value });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (r === "owner") router.replace("/(owner)");
      else if (r === "pegawai") router.replace("/(employee)");
      else router.replace("/customer");
    } catch (e: any) {
      triggerError(e?.message || "Gagal masuk");
    } finally {
      setBusy(false);
    }
  };

  const press = (digit: string) => {
    if (busy || !role) return;
    if (Platform.OS !== "web") Haptics.selectionAsync();
    const maxLen = role === "pelanggan" ? 13 : 4;
    const next = (pin + digit).slice(0, maxLen);
    setPin(next);
    setError("");
    if (role !== "pelanggan" && next.length === 4) submit(next, role);
  };
  const backspace = () => setPin((p) => p.slice(0, -1));

  const isPhone = role === "pelanggan";
  const dots = 4;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <LinearGradient colors={["#C4B5FD", "#A78BFA", "#0096FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}>
        <View style={styles.logoWrap}>
          <Image source={require("../assets/images/jadiwangi-logo.png")} style={styles.logoImg} contentFit="contain" />
        </View>
        <Text style={styles.tagline}>POS Laundry • ESTD 2021</Text>
      </LinearGradient>

      <View style={[styles.body, { paddingBottom: insets.bottom + spacing.lg }]}>
        {!role ? (
          <Animated.View entering={FadeInDown} style={{ gap: spacing.md }}>
            <Text style={styles.heading}>Masuk sebagai</Text>
            {ROLES.map((r, i) => (
              <Animated.View key={r.key} entering={FadeInDown.delay(i * 80)}>
                <Pressable testID={`role-${r.key}`} onPress={() => { setRole(r.key); setPin(""); setError(""); }} style={styles.roleCard}>
                  <View style={styles.roleIcon}>
                    <Icon name={r.icon} size={24} color={colors.onBrandPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roleLabel}>{r.label}</Text>
                    <Text style={styles.roleDesc}>{r.desc}</Text>
                  </View>
                  <Icon name="chevron-right" size={24} color={colors.muted} />
                </Pressable>
              </Animated.View>
            ))}
          </Animated.View>
        ) : (
          <View style={{ flex: 1 }}>
            <Pressable testID="back-to-roles" onPress={() => { setRole(null); setPin(""); setError(""); }} style={styles.back}>
              <Icon name="arrow-left" size={20} color={colors.onSurface} />
              <Text style={styles.backText}>{ROLES.find((x) => x.key === role)?.label}</Text>
            </Pressable>

            <Text style={styles.heading}>{isPhone ? "Nomor HP" : "Masukkan PIN"}</Text>
            <Text style={styles.hint}>{HINTS[role]}</Text>

            <Animated.View style={[styles.pinRow, shakeStyle]}>
              {isPhone ? (
                <Text style={styles.phoneText}>{pin || "0812xxxx"}</Text>
              ) : (
                Array.from({ length: dots }).map((_, i) => (
                  <View key={i} style={[styles.pinDot, i < pin.length && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]} />
                ))
              )}
            </Animated.View>
            {error ? <Text testID="login-error" style={styles.error}>{error}</Text> : <View style={{ height: 18 }} />}

            <View style={styles.keypad}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"].map((k) => {
                if (k === "clear") {
                  return isPhone ? (
                    <Key key={k} testID="key-submit" onPress={() => role && submit(pin, role)} disabled={pin.length < 4 || busy}>
                      <Icon name="check-bold" size={26} color={colors.onBrandPrimary} />
                    </Key>
                  ) : <View key={k} style={{ width: "30%" }} />;
                }
                if (k === "back") {
                  return (
                    <Key key={k} testID="key-back" onPress={backspace} variant="ghost">
                      <Icon name="backspace-outline" size={24} color={colors.onSurface} />
                    </Key>
                  );
                }
                return (
                  <Key key={k} testID={`key-${k}`} onPress={() => press(k)}>
                    <Text style={styles.keyText}>{k}</Text>
                  </Key>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function Key({ children, onPress, testID, variant = "default", disabled }: { children: React.ReactNode; onPress: () => void; testID?: string; variant?: "default" | "ghost"; disabled?: boolean }) {
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.key,
        variant === "ghost" && styles.keyGhost,
        testID === "key-submit" && styles.keySubmit,
        pressed && { transform: [{ scale: 0.94 }], opacity: 0.85 },
        disabled && { opacity: 0.4 },
      ]}
    >
      {children}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  hero: { paddingHorizontal: spacing.xl, paddingBottom: spacing["2xl"], borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, alignItems: "center", gap: spacing.sm },
  logoWrap: { backgroundColor: "#FFFFFF", borderRadius: radius.lg, padding: spacing.sm, ...shadow.soft },
  logoImg: { width: 104, height: 104 },
  tagline: { fontFamily: fonts.bodyBold, fontSize: 13, color: "rgba(255,255,255,0.95)" },
  body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  heading: { fontFamily: fonts.displayBold, fontSize: 22, color: c.onSurface, marginBottom: spacing.xs },
  hint: { fontFamily: fonts.body, fontSize: 13, color: c.muted, marginBottom: spacing.lg },
  roleCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: c.border, ...shadow.card },
  roleIcon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: c.brand, alignItems: "center", justifyContent: "center" },
  roleLabel: { fontFamily: fonts.displayBold, fontSize: 17, color: c.onSurface },
  roleDesc: { fontFamily: fonts.body, fontSize: 13, color: c.muted },
  back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.lg },
  backText: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurface },
  pinRow: { flexDirection: "row", gap: spacing.md, justifyContent: "center", alignItems: "center", marginVertical: spacing.md, minHeight: 40 },
  pinDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: c.borderStrong, backgroundColor: "transparent" },
  phoneText: { fontFamily: fonts.displayBold, fontSize: 26, color: c.onSurface, letterSpacing: 2 },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.error, textAlign: "center", height: 18 },
  keypad: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing.md, marginTop: spacing.md },
  key: { width: "30%", aspectRatio: 1.6, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceSecondary },
  keyGhost: { backgroundColor: "transparent" },
  keySubmit: { backgroundColor: c.brandPrimary, ...shadow.soft },
  keyText: { fontFamily: fonts.displayBold, fontSize: 28, color: c.onSurface },
}));
