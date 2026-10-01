import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "../lib/auth";
import { global } from "../styles/global";
function Routes() {
  const { token, loading } = useAuth();
  if (loading)
    return (
      <View style={global.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "#F4F7FC" },
          headerTintColor: "#17243B",
          contentStyle: global.container,
        }}
      >
        <Stack.Protected guard={!token}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="cadastro" options={{ title: "Criar conta" }} />
        </Stack.Protected>
        <Stack.Protected guard={!!token}>
          <Stack.Screen name="contatos" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
export default function RootLayout() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  );
}
