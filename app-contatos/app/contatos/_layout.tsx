import { Stack } from "expo-router";
export default function ContatosLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: "#F4F7FC" },
        headerTintColor: "#17243B",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Minha agenda" }} />
      <Stack.Screen name="novo" options={{ title: "Novo contato" }} />
      <Stack.Screen name="[id]" options={{ title: "Editar contato" }} />
    </Stack>
  );
}
