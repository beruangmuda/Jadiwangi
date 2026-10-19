import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { ActivityIndicator, LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { AuthProvider, Role, useAuth } from "@/src/auth";
import { useTheme } from "@/src/theme";
import { flushOrderSync } from "@/src/orderSync";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded] = useFonts({
    "Poppins-Medium": require("../assets/fonts/Poppins-Medium.ttf"),
    "Poppins-SemiBold": require("../assets/fonts/Poppins-SemiBold.ttf"),
    "Poppins-Bold": require("../assets/fonts/Poppins-Bold.ttf"),
    "Nunito-Regular": require("../assets/fonts/Nunito-Regular.ttf"),
    "Nunito-SemiBold": require("../assets/fonts/Nunito-SemiBold.ttf"),
    "Nunito-Bold": require("../assets/fonts/Nunito-Bold.ttf"),
    "Nunito-ExtraBold": require("../assets/fonts/Nunito-ExtraBold.ttf"),
    MaterialDesignIcons: require("@react-native-vector-icons/material-design-icons/fonts/MaterialDesignIcons.ttf"),
  });

  useEffect(() => {
    void flushOrderSync();
    const timer = setInterval(() => void flushOrderSync(), 30000);
    return () => clearInterval(timer);
  }, []);

  if (!loaded) return <View style={{ flex: 1, backgroundColor: "#FAFAFF" }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <KeyboardProvider>
              <AuthProvider>
                <AuthGate fontsLoaded={loaded}>
                  <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FAFAFF" } }}>
                    <Stack.Screen name="order-baru" options={{ presentation: "modal" }} />
                  </Stack>
                </AuthGate>
              </AuthProvider>
            </KeyboardProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const roleHome: Record<Role, string> = { owner: "/(owner)", pegawai: "/(employee)", pelanggan: "/(customer)" };
const employeeRoutes = new Set(["(employee)", "hari-ini", "siap-diambil", "timbang", "proses"]);
const ownerRoutes = new Set(["(owner)", "manage", "topup"]);
const customerRoutes = new Set(["(customer)"]);
const staffRoutes = new Set(["order-baru"]);

function AuthGate({ children, fontsLoaded }: { children: React.ReactNode; fontsLoaded: boolean }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const { colors } = useTheme();
  const firstRoute = segments[0] || "index";
  const isLogin = firstRoute === "login";
  const roleMismatch = !!session && ((employeeRoutes.has(firstRoute) && session.role !== "pegawai") || (ownerRoutes.has(firstRoute) && session.role !== "owner") || (customerRoutes.has(firstRoute) && session.role !== "pelanggan") || (staffRoutes.has(firstRoute) && !["owner", "pegawai"].includes(session.role)));
  const mustRedirectToLogin = !loading && !session && !isLogin;
  const mustRedirectToRoleHome = !loading && !!session && (isLogin || firstRoute === "index" || roleMismatch);

  useEffect(() => {
    if (!fontsLoaded || loading) return;
    SplashScreen.hideAsync().catch(() => {});
    if (mustRedirectToLogin) router.replace("/login");
    if (mustRedirectToRoleHome && session) router.replace(roleHome[session.role] as any);
  }, [fontsLoaded, loading, mustRedirectToLogin, mustRedirectToRoleHome, router, session]);

  if (!fontsLoaded || loading || mustRedirectToLogin || mustRedirectToRoleHome) {
    return <View testID="auth-session-loading" style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}><ActivityIndicator size="large" color={colors.brandPrimary} /></View>;
  }
  return <>{children}</>;
}
