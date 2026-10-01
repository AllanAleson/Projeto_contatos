import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import api, { errorMessage } from "../lib/api";
import { Action, ErrorText, Field, Page } from "../components/UI";
import { global } from "../styles/global";
export default function Cadastro() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const registrar = async () => {
    if (busy) return;
    if (!nome.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Preencha o nome e um e-mail válido.");
      return;
    }
    if (senha.length < 8) {
      setError("Use uma senha com pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      setError("As senhas não coincidem.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await api.post("/usuarios/registrar", {
        nome: nome.trim(),
        email: email.trim(),
        senha,
      });
      setSuccess(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  if (success)
    return (
      <Page>
        <View style={global.card}>
          <Text style={global.title}>Conta criada!</Text>
          <Text style={global.subtitle}>
            Agora entre com seu e-mail e senha.
          </Text>
          <Action title="Ir para o login" onPress={() => router.replace("/")} />
        </View>
      </Page>
    );
  return (
    <Page>
      <Text style={global.title}>Vamos começar.</Text>
      <Text style={global.subtitle}>
        Crie sua conta para guardar os contatos.
      </Text>
      <View style={global.card}>
        <Field
          label="Nome"
          value={nome}
          onChangeText={setNome}
          maxLength={100}
          editable={!busy}
          autoComplete="name"
        />
        <Field
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          maxLength={254}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          autoComplete="email"
        />
        <Field
          label="Senha (mínimo 8 caracteres)"
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
          maxLength={72}
          editable={!busy}
          autoComplete="new-password"
        />
        <Field
          label="Confirmar senha"
          value={confirmacao}
          onChangeText={setConfirmacao}
          secureTextEntry
          maxLength={72}
          editable={!busy}
        />
        <ErrorText message={error} />
        <Action
          title="Criar conta"
          busy={busy}
          onPress={() => void registrar()}
        />
      </View>
    </Page>
  );
}
