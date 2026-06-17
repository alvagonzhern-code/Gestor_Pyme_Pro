import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "../services/api";

type AuthContextValue = {
  isAuthenticated: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() =>
    localStorage.getItem("gestor_pyme_token"),
  );
  const [username, setUsername] = useState(() =>
    localStorage.getItem("gestor_pyme_user"),
  );

  const logout = () => {
    localStorage.removeItem("gestor_pyme_token");
    localStorage.removeItem("gestor_pyme_user");
    setToken(null);
    setUsername(null);
  };

  useEffect(() => {
    window.addEventListener("auth-expired", logout);
    return () => window.removeEventListener("auth-expired", logout);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(token),
      username,
      async login(user, password) {
        const response = await api.post<{
          token: string;
          user: { username: string };
        }>("/auth/login", { username: user, password });
        localStorage.setItem("gestor_pyme_token", response.token);
        localStorage.setItem("gestor_pyme_user", response.user.username);
        setToken(response.token);
        setUsername(response.user.username);
      },
      logout,
    }),
    [token, username],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}
