import React, { useState } from "react";
import { View, Text, Pressable, TextInput, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, shadow, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { PrimaryButton } from "@/src/components/ui";

export default function Login() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const fail = (msg: string) => {
    setError(msg);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  const doLogin = async () => {
    if (!username.trim() || !password) return fail("Isi username dan kata sandi");
    setBusy(true); setError("");
    try {
      await login(username.trim(), password);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/");
    } catch (e: any) {
      fail(e?.message || "Gagal masuk");
    } finally { setBusy(false); }
  };

  const doRegister = async () => {
    if (!name.trim() || phone.trim().length < 7 || password.length < 6)
      return fail("Lengkapi nama, no. HP, dan kata sandi (min. 6 karakter)");
    setBusy(true); setError("");
    try {
      await register(name.trim(), phone.trim(), password);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/");
    } catch (e: any) {
      fail(e?.message || "Gagal mendaftar");
    } finally { setBusy(false); }
  };

  const isLogin = mode === "login";

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <LinearGradient colors={["#C4B5FD", "#A78BFA", "#0096FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}>
        <View style={styles.logoWrap}>
          <Image source={require("../assets/images/jadiwangi-logo.png")} style={styles.logoImg} contentFit="contain" />
        </View>
        <Text style={styles.tagline}>Jadi Lebih Mudah dengan Jadi Wangi App</Text>
      </LinearGradient>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xl }]}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown} style={{ gap: spacing.md }}>
          <Text style={styles.heading}>{isLogin ? "Masuk" : "Daftar Akun"}</Text>
          <Text style={styles.hint}>
            {isLogin ? "Masuk dengan username / no. HP dan kata sandi Anda." : "Buat akun pelanggan untuk mulai order laundry."}
          </Text>

          {!isLogin && (
            <View style={styles.field}>
              <Text style={styles.label}>Nama Lengkap</Text>
              <View style={styles.inputRow}>
                <Icon name="account" size={20} color={colors.muted} />
                <TextInput testID="reg-name" value={name} onChangeText={setName} placeholder="Nama Anda" placeholderTextColor={colors.muted} style={styles.input} />
              </View>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>{isLogin ? "Username / No. HP" : "No. HP"}</Text>
            <View style={styles.inputRow}>
              <Icon name={isLogin ? "account-circle" : "phone"} size={20} color={colors.muted} />
              <TextInput
                testID={isLogin ? "login-username" : "reg-phone"}
                value={isLogin ? username : phone}
                onChangeText={isLogin ? setUsername : setPhone}
                placeholder={isLogin ? "username atau 08xxxx" : "08xxxxxxxxxx"}
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                keyboardType={isLogin ? "default" : "phone-pad"}
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Kata Sandi</Text>
            <View style={styles.inputRow}>
              <Icon name="lock" size={20} color={colors.muted} />
              <TextInput
                testID="login-password"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••"
                placeholderTextColor={colors.muted}
                secureTextEntry={!showPass}
                autoCapitalize="none"
                style={styles.input}
                onSubmitEditing={isLogin ? doLogin : doRegister}
              />
              <Pressable testID="toggle-pass" onPress={() => setShowPass((s) => !s)} hitSlop={8}>
                <Icon name={showPass ? "eye-off" : "eye"} size={20} color={colors.muted} />
              </Pressable>
            </View>
          </View>

          {error ? <Text testID="login-error" style={styles.error}>{error}</Text> : null}

          <PrimaryButton
            label={isLogin ? "Masuk" : "Daftar & Masuk"}
            icon={isLogin ? "login" : "account-plus"}
            onPress={isLogin ? doLogin : doRegister}
            loading={busy}
            testID={isLogin ? "login-submit" : "register-submit"}
          />

          <Pressable
            testID="toggle-mode"
            onPress={() => { setMode(isLogin ? "register" : "login"); setError(""); }}
            style={styles.switchRow}
          >
            <Text style={styles.switchText}>
              {isLogin ? "Belum punya akun? " : "Sudah punya akun? "}
              <Text style={styles.switchLink}>{isLogin ? "Daftar sebagai Pelanggan" : "Masuk"}</Text>
            </Text>
          </Pressable>
        </Animated.View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  hero: { paddingHorizontal: spacing.xl, paddingBottom: spacing["2xl"], borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, alignItems: "center", gap: spacing.sm },
  logoWrap: { backgroundColor: "#FFFFFF", borderRadius: radius.lg, padding: spacing.sm, ...shadow.soft },
  logoImg: { width: 104, height: 104 },
  tagline: { fontFamily: fonts.bodyBold, fontSize: 13, color: "rgba(255,255,255,0.95)" },
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  heading: { fontFamily: fonts.displayBold, fontSize: 24, color: c.onSurface },
  hint: { fontFamily: fonts.body, fontSize: 13, color: c.muted, marginBottom: spacing.sm },
  field: { gap: spacing.xs },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.onSurfaceSecondary },
  inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.md },
  input: { flex: 1, paddingVertical: 14, fontFamily: fonts.body, fontSize: 15, color: c.onSurface },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.error, textAlign: "center" },
  switchRow: { alignItems: "center", paddingVertical: spacing.sm },
  switchText: { fontFamily: fonts.body, fontSize: 14, color: c.muted },
  switchLink: { fontFamily: fonts.bodyBold, color: c.brandPrimary },
}));
