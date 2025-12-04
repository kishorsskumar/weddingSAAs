import { createContext, useContext, useState, ReactNode } from "react";
import { User, MOCK_USERS } from "@/lib/mock-data";
import { useLocation } from "wouter";

interface AuthContextType {
  user: User | null;
  login: (userId: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [_, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  const login = (userId: string) => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      const foundUser = MOCK_USERS.find((u) => u.id === userId);
      if (foundUser) {
        setUser(foundUser);
        setLocation("/");
      }
      setIsLoading(false);
    }, 800);
  };

  const logout = () => {
    setUser(null);
    setLocation("/login");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
