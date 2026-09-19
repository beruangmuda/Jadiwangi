import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { useTheme } from "@/src/theme";

export default function Index() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/login");
    } else if (session.role === "owner") {
      router.replace("/(owner)");
    } else if (session.role === "pegawai") {
      router.replace("/(employee)");
    } else {
      router.replace("/customer");
    }
  }, [session, loading]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
      <ActivityIndicator size="large" color={colors.brandPrimary} />
    </View>
  );
}
