import { useRouter } from "expo-router";
import { Text } from "react-native";
import FormContato from "../../components/FormContato";
import { Page } from "../../components/UI";
import api from "../../lib/api";
import { global } from "../../styles/global";
import type { DadosContato } from "../../types/Contato";
export default function NovoContato() {
  const router = useRouter();
  const salvar = async (dados: DadosContato) => {
    await api.post("/contatos", dados);
    router.replace("/contatos");
  };
  return (
    <Page>
      <Text style={global.subtitle}>
        Preencha os dados. Apenas o nome é obrigatório.
      </Text>
      <FormContato onSubmit={salvar} />
    </Page>
  );
}
