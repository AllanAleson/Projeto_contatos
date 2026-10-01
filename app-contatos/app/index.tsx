import { useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import api, { errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Action, ErrorText, Field, Page } from "../components/UI";
import { global } from "../styles/global";
export default function Login() {
  const router = useRouter();
  const { signIn, message } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const entrar = async () => {
    if (busy) return;
    if (!email.trim() || !senha) {
      setError("Preencha e-mail e senha.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/usuarios/login", {
        email: email.trim(),
        senha,
      });
      if (typeof data.token !== "string" || !data.token)
        throw new Error("A API não retornou o token.");
      await signIn(data.token);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={global.container}>
      <Page>
        <View style={{ paddingTop: 44, paddingBottom: 14, gap: 10 }}>
          <Text
            style={{ color: "#285AE8", fontWeight: "700", letterSpacing: 2 }}
          >
            CONTATOS
          </Text>
          <Text style={global.title}>Sua agenda, organizada.</Text>
          <Text style={global.subtitle}>
            Entre para acessar seus contatos e manter as pessoas por perto.
          </Text>
        </View>
        <View style={global.card}>
          <Field
            label="E-mail"
            placeholder="voce@exemplo.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            editable={!busy}
          />
          <Field
            label="Senha"
            placeholder="Sua senha"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            autoComplete="current-password"
            editable={!busy}
            onSubmitEditing={() => void entrar()}
          />
          <ErrorText message={error || message} />
          <Action title="Entrar" busy={busy} onPress={() => void entrar()} />
          <Action
            title="Criar uma conta"
            secondary
            disabled={busy}
            onPress={() => router.push("/cadastro")}
          />
        </View>
      </Page>
    </SafeAreaView>
  );
}
