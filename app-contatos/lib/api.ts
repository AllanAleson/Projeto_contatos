import axios from "axios";
import * as SecureStore from "expo-secure-store";

export const BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api-contatos-auth-04-09-25.onrender.com"
).replace(/\/$/, "");
// O serviço no Render pode precisar de alguns segundos para despertar após ficar ocioso.
const api = axios.create({ baseURL: BASE_URL, timeout: 60000 });
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
export async function setAuthToken(token: string) {
  await SecureStore.setItemAsync(KEY, token, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
  applyToken(token);
}
export async function loadAuthToken() {
  const token = await SecureStore.getItemAsync(KEY);
  applyToken(token);
  return token;
}
export async function clearAuthToken() {
  applyToken(null);
  await SecureStore.deleteItemAsync(KEY);
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
