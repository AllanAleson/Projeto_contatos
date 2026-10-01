import { useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import api, { errorMessage } from "../lib/api";
import type { Contato, DadosContato } from "../types/Contato";
import Foto from "./Foto";
import { Action, ErrorText, Field } from "./UI";
import { global } from "../styles/global";
type Props = {
  valores?: Partial<Contato>;
  onSubmit: (dados: DadosContato) => Promise<void>;
};
export default function FormContato({ valores, onSubmit }: Props) {
  const [nome, setNome] = useState(valores?.nome || "");
  const [email, setEmail] = useState(valores?.email || "");
  const [telefone, setTelefone] = useState(valores?.telefone || "");
  const [endereco, setEndereco] = useState(valores?.endereco || "");
  const [fotoId, setFotoId] = useState<string | null>(valores?.fotoId || null);
  const [imagem, setImagem] = useState<ImagePicker.ImagePickerAsset | null>(
    null,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const saving = useRef(false);
  const escolherImagem = async () => {
    setError("");
    setPicking(true);
    try {
      if (Platform.OS !== "web") {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted)
          throw new Error(
            "Permita o acesso à galeria para selecionar uma foto.",
          );
      }
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (resultado.canceled) return;
      const image = resultado.assets[0];
      if (image.fileSize && image.fileSize > 5 * 1024 * 1024)
        throw new Error("A foto deve ter até 5 MB.");
      if (
        image.mimeType &&
        !["image/jpeg", "image/png", "image/webp"].includes(image.mimeType)
      )
        throw new Error("Escolha uma foto JPG, PNG ou WebP.");
      setImagem(image);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPicking(false);
    }
  };
  const enviar = async () => {
    if (saving.current) return;
    if (!nome.trim()) {
      setError("Preencha o nome do contato.");
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Preencha um e-mail válido ou deixe em branco.");
      return;
    }
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      let selectedId = fotoId;
      if (imagem) {
        const form = new FormData();
        if (Platform.OS === "web") {
          const blob = imagem.file || (await (await fetch(imagem.uri)).blob());
          form.append("foto", blob, imagem.fileName || "foto.jpg");
        } else {
          form.append("foto", {
            uri: imagem.uri,
            name: imagem.fileName || "foto.jpg",
            type: imagem.mimeType || "image/jpeg",
          } as unknown as Blob);
        }
        // O runtime define o boundary do multipart.
        const { data } = await api.post("/upload", form, { timeout: 60000 });
        if (!data.fileId) throw new Error("A API não retornou o ID da foto.");
        selectedId = data.fileId;
        setFotoId(selectedId);
        setImagem(null);
      }
      await onSubmit({
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim(),
        endereco: endereco.trim(),
        fotoId: selectedId,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  return (
    <View style={global.card}>
      <View style={{ alignItems: "center", gap: 12 }}>
        <Foto fotoId={fotoId} localUri={imagem?.uri} nome={nome} size={100} />
        <Text style={global.subtitle}>
          Foto opcional · JPG, PNG ou WebP · até 5 MB
        </Text>
      </View>
      <Action
        title="Selecionar foto"
        secondary
        busy={picking}
        disabled={busy}
        onPress={() => void escolherImagem()}
      />
      {(fotoId || imagem) && (
        <Action
          title="Remover foto"
          secondary
          disabled={busy || picking}
          onPress={() => {
            setFotoId(null);
            setImagem(null);
          }}
        />
      )}
      <Field
        label="Nome *"
        placeholder="Nome do contato"
        value={nome}
        onChangeText={setNome}
        maxLength={120}
        editable={!busy}
      />
      <Field
        label="Telefone"
        placeholder="(11) 99999-9999"
        value={telefone}
        onChangeText={setTelefone}
        maxLength={40}
        keyboardType="phone-pad"
        editable={!busy}
      />
      <Field
        label="E-mail"
        placeholder="contato@exemplo.com"
        value={email}
        onChangeText={setEmail}
        maxLength={254}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
      />
      <Field
        label="Endereço"
        placeholder="Rua, número e cidade"
        value={endereco}
        onChangeText={setEndereco}
        maxLength={300}
        editable={!busy}
      />
      <ErrorText message={error} />
      <Action
        title="Salvar contato"
        busy={busy}
        disabled={picking}
        onPress={() => void enviar()}
      />
    </View>
  );
}
