import axios from "axios";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export const BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000")
).replace(/\/$/, "");
const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });
const KEY = "contatos.jwt";
let currentToken: string | null = null;
let onUnauthorized: (() => void) | undefined;
export const setUnauthorizedHandler = (handler?: () => void) => {
  onUnauthorized = handler;
};
export const getAuthToken = () => currentToken;
const applyToken = (token: string | null) => {
  currentToken = token;
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
};
// SecureStore não existe no navegador. Na web, a sessão dura até fechar a aba.
export async function setAuthToken(token: string) {
  if (Platform.OS === "web") {
    if (typeof sessionStorage !== "undefined")
      sessionStorage.setItem(KEY, token);
  } else
    await SecureStore.setItemAsync(KEY, token, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
  applyToken(token);
}
export async function loadAuthToken() {
  const token =
    Platform.OS === "web"
      ? typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem(KEY)
        : null
      : await SecureStore.getItemAsync(KEY);
  applyToken(token);
  return token;
}
export async function clearAuthToken() {
  applyToken(null);
  if (Platform.OS === "web") {
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(KEY);
  } else await SecureStore.deleteItemAsync(KEY);
}
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      currentToken &&
      error.config?.headers?.Authorization === `Bearer ${currentToken}` &&
      !error.config?.url?.startsWith("/usuarios/login")
    )
      onUnauthorized?.();
    return Promise.reject(error);
  },
);
export function getImageUrl(fileId?: string | null) {
  return fileId
    ? `${BASE_URL}/upload/${encodeURIComponent(fileId)}`
    : undefined;
}
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.data?.mensagem) return error.response.data.mensagem;
    if (!error.response)
      return "Não foi possível conectar à API. Confira se ela está ligada e se o endereço no .env está correto.";
  }
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir. Tente novamente.";
}
export default api;
