import React, { createContext, useContext, useState, useEffect } from "react";

export type Role = "client" | "operator" | "approver" | "viewer" | "engineer";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarColor: string;
}

interface AuthContextType {
  user: MockUser | null;
  loading: boolean;
  login: (role?: Role) => Promise<void>;
  switchRole: (role: Role) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  switchRole: () => {},
  logout: async () => {},
});

const ROLE_PRESETS: Record<Role, { name: string; email: string; color: string }> = {
  operator: { name: "Studio Operator", email: "operator@808szn.com", color: "#a3e635" },
  approver: { name: "Executive Approver", email: "alex.approver@808szn.com", color: "#fbbf24" },
  client: { name: "Lead Artist / Client", email: "artist@808szn.com", color: "#38bdf8" },
  engineer: { name: "Mastering Engineer", email: "dsp.engineer@808szn.com", color: "#c084fc" },
  viewer: { name: "Auditor / Viewer", email: "audit@808szn.com", color: "#94a3b8" }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<MockUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load from localStorage or set default
    const saved = localStorage.getItem("mock_user");
    if (saved) {
      setUser(JSON.parse(saved));
    }
    setLoading(false);
  }, []);

  const login = async (role: Role = "operator") => {
    const preset = ROLE_PRESETS[role] || ROLE_PRESETS.operator;
    const mockUser: MockUser = {
      id: `user_${role}_${Date.now().toString(36).substring(4)}`,
      name: preset.name,
      email: preset.email,
      role,
      avatarColor: preset.color
    };
    setUser(mockUser);
    localStorage.setItem("mock_user", JSON.stringify(mockUser));
  };

  const switchRole = (role: Role) => {
    const preset = ROLE_PRESETS[role] || ROLE_PRESETS.operator;
    const updatedUser: MockUser = {
      id: user?.id || `user_${role}_${Date.now().toString(36).substring(4)}`,
      name: preset.name,
      email: preset.email,
      role,
      avatarColor: preset.color
    };
    setUser(updatedUser);
    localStorage.setItem("mock_user", JSON.stringify(updatedUser));
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem("mock_user");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, switchRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

