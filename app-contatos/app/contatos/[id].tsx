import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import FormContato from "../../components/FormContato";
import { Action, ErrorText, Page } from "../../components/UI";
import api, { errorMessage } from "../../lib/api";
import type { Contato, DadosContato } from "../../types/Contato";
export default function EditarContato() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [contato, setContato] = useState<Contato | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const carregar = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      setContato(null);
      try {
        const { data } = await api.get<Contato>(`/contatos/${id}`, { signal });
        if (!signal?.aborted) setContato(data);
      } catch (err) {
        if (!signal?.aborted) setError(errorMessage(err));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [id],
  );
  useEffect(() => {
    const controller = new AbortController();
    void carregar(controller.signal);
    return () => controller.abort();
  }, [carregar]);
  const salvar = async (dados: DadosContato) => {
    await api.put(`/contatos/${id}`, dados);
    router.replace("/contatos");
  };
  return (
    <Page>
      {loading ? (
        <ActivityIndicator size="large" />
      ) : error ? (
        <>
          <ErrorText message={error} />
          <Action title="Tentar novamente" onPress={() => void carregar()} />
        </>
      ) : contato ? (
        <FormContato key={contato._id} valores={contato} onSubmit={salvar} />
      ) : null}
    </Page>
  );
}
