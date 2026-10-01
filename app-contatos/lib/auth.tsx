import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import {
  clearAuthToken,
  loadAuthToken,
  setAuthToken,
  setUnauthorizedHandler,
} from "./api";

type Auth = {
  token: string | null;
  loading: boolean;
  message: string;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<Auth | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    loadAuthToken()
      .then((value) => {
        if (active) setToken(value);
      })
      .catch(() => {
        if (active)
          setMessage("Não foi possível recuperar a sessão. Entre novamente.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    setUnauthorizedHandler(() => {
      setToken(null);
      setMessage("Sua sessão expirou. Entre novamente.");
      void clearAuthToken().catch(() =>
        setMessage(
          "Sessão encerrada. Não foi possível limpar o armazenamento do aparelho.",
        ),
      );
    });
    return () => {
      active = false;
      setUnauthorizedHandler();
    };
  }, []);
  const signIn = async (value: string) => {
    await setAuthToken(value);
    setMessage("");
    setToken(value);
  };
  const signOut = async () => {
    try {
      await clearAuthToken();
      setMessage("");
    } finally {
      setToken(null);
    }
  };
  return (
    <AuthContext.Provider value={{ token, loading, message, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthProvider ausente.");
  return context;
}
