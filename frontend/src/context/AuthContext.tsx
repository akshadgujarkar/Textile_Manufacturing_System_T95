import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, BusinessRole } from '../types';
import { api } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, role?: BusinessRole) => Promise<void>;
  logout: () => void;
  switchRole: (role: BusinessRole) => void;
  hasRole: (...roles: BusinessRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default test user profile when logging in locally or via quick switcher
const DEFAULT_ROLES_META: Record<BusinessRole, { name: string; designation: string }> = {
  admin: { name: 'Admin Administrator', designation: 'Chief System Administrator' },
  owner: { name: 'Rajesh Singhania', designation: 'Mill Managing Director & Owner' },
  accounts: { name: 'Priya Mehta', designation: 'Chief Financial Accountant' },
  production_manager: { name: 'Vikram Joshi', designation: 'Plant Production Manager' },
  operator: { name: 'Suresh Patil', designation: 'Weaving Section Machine Operator' },
  quality_checker: { name: 'Anjali Sharma', designation: 'Senior Quality Inspector' },
  gate_store: { name: 'Ramesh Verma', designation: 'Gate Inward & Store Clerk' },
  dispatch: { name: 'Manoj Shinde', designation: 'Warehouse & Dispatch Supervisor' },
  sales: { name: 'Kavita Deshmukh', designation: 'Sales & Customer Relationship Manager' },
  staff_readonly: { name: 'Internal Auditor', designation: 'Compliance & Audit Observer' },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Restore session from localStorage
    const savedToken = localStorage.getItem('tms_auth_token');
    const savedUser = localStorage.getItem('tms_auth_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('tms_auth_token');
        localStorage.removeItem('tms_auth_user');
      }
    }
    setIsLoading(false);

    // Listen for session expiry event from API client
    const handleSessionExpired = () => {
      setUser(null);
      setToken(null);
    };
    window.addEventListener('tms_session_expired', handleSessionExpired);
    return () => window.removeEventListener('tms_session_expired', handleSessionExpired);
  }, []);

  const login = async (username: string, selectedRole: BusinessRole = 'admin') => {
    setIsLoading(true);
    try {
      // Attempt backend authentication
      try {
        const res = await api.auth.login({ username, password: 'Password@123' });
        if (res.token) {
          const authUser: User = {
            userId: res.user?.userId || 1,
            username: res.user?.username || username,
            roles: res.user?.roles || [selectedRole],
            fullName: DEFAULT_ROLES_META[selectedRole]?.name || username,
          };
          setToken(res.token);
          setUser(authUser);
          localStorage.setItem('tms_auth_token', res.token);
          localStorage.setItem('tms_auth_user', JSON.stringify(authUser));
          setIsLoading(false);
          return;
        }
      } catch (apiErr) {
        // Fallback to demo mode for offline testing
        console.warn('Backend login endpoint offline or refused; continuing in resilient client mode.', apiErr);
      }

      // Offline resilient login fallback
      const demoToken = `mock_jwt_${selectedRole}_${Date.now()}`;
      const demoUser: User = {
        userId: 1,
        username,
        roles: [selectedRole],
        fullName: DEFAULT_ROLES_META[selectedRole]?.name || username,
      };

      setToken(demoToken);
      setUser(demoUser);
      localStorage.setItem('tms_auth_token', demoToken);
      localStorage.setItem('tms_auth_user', JSON.stringify(demoUser));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('tms_auth_token');
    localStorage.removeItem('tms_auth_user');
  };

  const switchRole = (newRole: BusinessRole) => {
    if (!user) return;
    const updatedUser: User = {
      ...user,
      roles: [newRole],
      fullName: DEFAULT_ROLES_META[newRole]?.name || user.username,
    };
    setUser(updatedUser);
    localStorage.setItem('tms_auth_user', JSON.stringify(updatedUser));
  };

  const hasRole = (...requiredRoles: BusinessRole[]) => {
    if (!user || !user.roles) return false;
    return user.roles.some((r) => requiredRoles.includes(r) || r === 'admin' || r === 'owner');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        logout,
        switchRole,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
