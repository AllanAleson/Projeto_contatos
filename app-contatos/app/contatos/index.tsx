import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import api, { errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Action, ErrorText, Field } from "../../components/UI";
import Foto from "../../components/Foto";
import { colors, global } from "../../styles/global";
import type { Contato } from "../../types/Contato";
export default function ListaContatos() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<Contato | null>(null);
  const [deleting, setDeleting] = useState(false);
  const carregar = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get<Contato[]>("/contatos", { signal });
      if (!signal?.aborted) setContatos(data);
    } catch (err) {
      if (!signal?.aborted) setError(errorMessage(err));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      void carregar(controller.signal);
      return () => controller.abort();
    }, [carregar]),
  );
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return contatos.filter((contato) =>
      [contato.nome, contato.email, contato.telefone].some((value) =>
        value?.toLocaleLowerCase("pt-BR").includes(termo),
      ),
    );
  }, [contatos, busca]);
  const excluir = async () => {
    if (!selecionado || deleting) return;
    setDeleting(true);
    setError("");
    try {
      await api.delete(`/contatos/${selecionado._id}`);
      setContatos((current) =>
        current.filter((item) => item._id !== selecionado._id),
      );
      setSelecionado(null);
    } catch (err) {
      setError(errorMessage(err));
      setSelecionado(null);
    } finally {
      setDeleting(false);
    }
  };
  return (
    <SafeAreaView edges={["bottom"]} style={global.container}>
      <FlatList
        contentContainerStyle={global.content}
        data={filtrados}
        keyExtractor={(item) => item._id}
        refreshing={loading}
        onRefresh={() => void carregar()}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <View style={[global.row, { justifyContent: "space-between" }]}>
              <View style={{ flex: 1 }}>
                <Text style={global.title}>Seus contatos</Text>
                <Text style={global.subtitle}>
                  {contatos.length}{" "}
                  {contatos.length === 1
                    ? "pessoa na sua agenda"
                    : "pessoas na sua agenda"}
                </Text>
              </View>
              <Action
                title="Sair"
                secondary
                onPress={() => {
                  void signOut().catch((err) => setError(errorMessage(err)));
                }}
              />
            </View>
            <Action
              title="+ Novo contato"
              onPress={() => router.push("/contatos/novo")}
            />
            <Field
              label="Buscar contato"
              placeholder="Nome, telefone ou e-mail"
              value={busca}
              onChangeText={setBusca}
            />
            <ErrorText message={error} />
            {error ? (
              <Action
                title="Tentar novamente"
                secondary
                onPress={() => void carregar()}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 24 }} />
          ) : !error ? (
            <View style={[global.card, { alignItems: "center" }]}>
              <Text
                style={{ fontSize: 18, color: colors.ink, fontWeight: "600" }}
              >
                {busca ? "Nenhum resultado" : "Sua agenda começa aqui"}
              </Text>
              <Text style={global.subtitle}>
                {busca
                  ? "Tente outro nome, e-mail ou telefone."
                  : "Toque em “Novo contato” para adicionar a primeira pessoa."}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={global.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Editar ${item.nome}`}
              onPress={() =>
                router.push({
                  pathname: "/contatos/[id]",
                  params: { id: item._id },
                })
              }
              style={global.row}
            >
              <Foto fotoId={item.fotoId} nome={item.nome} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  style={{ fontSize: 18, fontWeight: "600", color: colors.ink }}
                >
                  {item.nome}
                </Text>
                {item.telefone ? (
                  <Text style={global.subtitle}>{item.telefone}</Text>
                ) : null}
                {item.email ? (
                  <Text style={global.subtitle}>{item.email}</Text>
                ) : null}
                {item.endereco ? (
                  <Text style={global.subtitle}>{item.endereco}</Text>
                ) : null}
              </View>
            </Pressable>
            <View style={global.row}>
              <View style={{ flex: 1 }}>
                <Action
                  title="Editar"
                  secondary
                  onPress={() =>
                    router.push({
                      pathname: "/contatos/[id]",
                      params: { id: item._id },
                    })
                  }
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Excluir ${item.nome}`}
                onPress={() => setSelecionado(item)}
                style={{ padding: 14 }}
              >
                <Text style={{ color: colors.danger, fontWeight: "600" }}>
                  Excluir
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      />
      <Modal
        transparent
        visible={!!selecionado}
        animationType="fade"
        onRequestClose={() => {
          if (!deleting) setSelecionado(null);
        }}
      >
        <View style={[global.center, { backgroundColor: "#17243B99" }]}>
          <View style={[global.card, { width: "100%", maxWidth: 400 }]}>
            <Text
              style={{ fontSize: 22, fontWeight: "700", color: colors.ink }}
            >
              Excluir contato?
            </Text>
            <Text style={global.subtitle}>
              “{selecionado?.nome}” será removido da sua agenda. Essa ação não
              pode ser desfeita.
            </Text>
            <Action
              title="Sim, excluir"
              busy={deleting}
              onPress={() => void excluir()}
            />
            <Action
              title="Cancelar"
              secondary
              disabled={deleting}
              onPress={() => setSelecionado(null)}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
