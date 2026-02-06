import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { registerPushSubscription } from "@/lib/push-notifications";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string | null;
  createdVia?: string | null;
  companyId?: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  company: Company | null;
  token: string | null;
  allowedPages: string[];
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, companyName: string, plan?: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [allowedPages, setAllowedPages] = useState<string[]>([]);
  const [_, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(true);

  const clearAllCaches = async () => {
    try {
      queryClient.clear();
      queryClient.removeQueries();
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.clear();
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
    } catch (e) {
      console.error('Error clearing caches:', e);
    }
  };

  useEffect(() => {
    const headers: HeadersInit = {};
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken) {
      headers['Authorization'] = `Bearer ${storedToken}`;
    }
    
    fetch('/api/auth/me', { 
      credentials: 'include',
      headers 
    })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Not authenticated');
      })
      .then(data => {
        setUser(data.user);
        setAllowedPages(data.permissions);
        if (data.company) setCompany(data.company);
        registerPushSubscription();
      })
      .catch(async () => {
        await clearAllCaches();
        setUser(null);
        setCompany(null);
        setAllowedPages([]);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    queryClient.clear();
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Invalid credentials');
      }

      const data = await response.json();
      setUser(data.user);
      setAllowedPages(data.permissions);
      
      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        setToken(data.token);
      }
      
      if (data.company) setCompany(data.company);
      
      registerPushSubscription();
      
      if (data.user.createdVia === 'employee_onboarding') {
        setLocation("/employee-portal");
      } else {
        setLocation("/");
      }
    } catch (error: any) {
      alert(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (name: string, email: string, password: string, companyName: string, plan?: string) => {
    setIsLoading(true);
    queryClient.clear();
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, companyName, plan }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Signup failed');
      }

      const data = await response.json();
      setUser(data.user);
      setAllowedPages(data.permissions);
      
      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        setToken(data.token);
      }
      
      if (data.company) setCompany(data.company);
      
      registerPushSubscription();
      setLocation("/");
    } catch (error: any) {
      alert(error.message || 'Signup failed. Please try again.');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    await clearAllCaches();
    setUser(null);
    setCompany(null);
    setToken(null);
    setAllowedPages([]);
    setLocation("/login");
  };

  return (
    <AuthContext.Provider value={{ user, company, token, allowedPages, login, signup, logout, isLoading }}>
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
