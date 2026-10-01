import { useEffect, useState } from "react";
import { Image, Platform, Text, View } from "react-native";
import api, { getImageUrl } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function Foto({
  fotoId,
  nome = "",
  size = 64,
  localUri,
}: {
  fotoId?: string | null;
  nome?: string;
  size?: number;
  localUri?: string;
}) {
  const { token } = useAuth();
  const [webUri, setWebUri] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    setWebUri(undefined);
    if (Platform.OS !== "web" || !fotoId || localUri) return;
    let active = true;
    let objectUrl: string | undefined;
    const controller = new AbortController();
    // O elemento img do navegador não envia Authorization; buscamos o Blob antes.
    api
      .get(`/upload/${fotoId}`, {
        responseType: "blob",
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (active) {
          objectUrl = URL.createObjectURL(data);
          setWebUri(objectUrl);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fotoId, token, localUri]);
  const uri =
    localUri || (Platform.OS === "web" ? webUri : getImageUrl(fotoId));
  const style = { width: size, height: size, borderRadius: size / 3 };
  if (!uri || failed)
    return (
      <View
        style={[
          style,
          {
            backgroundColor: "#E9EEFB",
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <Text
          style={{ color: "#285AE8", fontSize: size / 3, fontWeight: "700" }}
        >
          {nome.trim().slice(0, 1).toUpperCase() || "?"}
        </Text>
      </View>
    );
  return (
    <Image
      accessibilityLabel={`Foto de ${nome || "contato"}`}
      source={{
        uri,
        ...(Platform.OS !== "web" && !localUri && token
          ? { headers: { Authorization: `Bearer ${token}` } }
          : {}),
      }}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}
