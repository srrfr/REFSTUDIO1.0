'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserAccount } from '@/types/refstudio';
import { DbService, DEFAULT_USERS } from '@/lib/repository/db-service';
import { checkIsAdminSession, saveAdminSession, clearAdminSession, verifyAdminCode } from './admin-guard';

const SESSION_USER_KEY = 'refstudio_auth_username_v1';

interface AuthContextType {
  user: UserAccount | null;
  isAdmin: boolean;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  login: (username: string, pass: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  updateProfile: (updates: Partial<UserAccount>) => Promise<boolean>;
  elevateToAdmin: (pin: string) => { success: boolean; message?: string };
  revokeAdmin: () => void;
  availableUsers: UserAccount[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [availableUsers, setAvailableUsers] = useState<UserAccount[]>(DEFAULT_USERS);

  // Caricamento profilo salvato
  useEffect(() => {
    try {
      const profiles = DbService.getProfiles();
      setAvailableUsers(profiles);

      const savedUsername = localStorage.getItem(SESSION_USER_KEY);
      if (savedUsername) {
        const found = profiles.find(
          (p) => p.username.toLowerCase() === savedUsername.toLowerCase()
        );
        if (found) {
          setUser(found);
          setIsAdmin(found.role === 'admin' || checkIsAdminSession());
          return;
        }
      }

      // Se non c'è sessione salvata, inizializza con samueleromini come predefinito
      const defaultUser = profiles[0] || DEFAULT_USERS[0];
      setUser(defaultUser);
      localStorage.setItem(SESSION_USER_KEY, defaultUser.username);
      setIsAdmin(defaultUser.role === 'admin' || checkIsAdminSession());
    } catch (err) {
      console.warn('Errore inizializzazione auth:', err);
      setUser(DEFAULT_USERS[0]);
    }
  }, []);

  // Ascolta aggiornamenti realtime sui profili
  useEffect(() => {
    const handleSync = () => {
      const updatedProfiles = DbService.getProfiles();
      setAvailableUsers(updatedProfiles);
      if (user) {
        const fresh = updatedProfiles.find(
          (p) => p.username.toLowerCase() === user.username.toLowerCase()
        );
        if (fresh) {
          setUser(fresh);
          setIsAdmin(fresh.role === 'admin' || checkIsAdminSession());
        }
      }
    };

    window.addEventListener('refstudio-sync-update', handleSync);
    return () => window.removeEventListener('refstudio-sync-update', handleSync);
  }, [user]);

  const login = async (
    usernameInput: string,
    passInput: string
  ): Promise<{ success: boolean; message?: string }> => {
    const cleanUser = usernameInput.trim().toLowerCase();
    const cleanPass = passInput.trim();

    const profiles = DbService.getProfiles();
    const found = profiles.find((p) => p.username.toLowerCase() === cleanUser);

    if (!found) {
      return { success: false, message: 'Nome utente non trovato.' };
    }

    if (found.password && found.password !== cleanPass) {
      return { success: false, message: 'Password errata.' };
    }

    setUser(found);
    setIsAdmin(found.role === 'admin' || checkIsAdminSession());
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_USER_KEY, found.username);
    }
    setIsLoginModalOpen(false);
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    setIsAdmin(false);
    clearAdminSession();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_USER_KEY);
    }
    setIsLoginModalOpen(true);
  };

  const updateProfile = async (updates: Partial<UserAccount>): Promise<boolean> => {
    if (!user) return false;
    try {
      const updated = DbService.updateProfile(user.username, updates);
      setUser(updated);
      setIsAdmin(updated.role === 'admin' || checkIsAdminSession());
      setAvailableUsers(DbService.getProfiles());
      return true;
    } catch (err) {
      console.error('Errore aggiornamento profilo:', err);
      return false;
    }
  };

  const elevateToAdmin = (pin: string) => {
    if (verifyAdminCode(pin)) {
      setIsAdmin(true);
      saveAdminSession();
      if (user) {
        const updated = DbService.updateProfile(user.username, { role: 'admin' });
        setUser(updated);
      }
      return { success: true };
    }
    return { success: false, message: 'Codice PIN Amministratore non valido.' };
  };

  const revokeAdmin = () => {
    setIsAdmin(false);
    clearAdminSession();
    if (user && user.username !== 'samueleromini') {
      const updated = DbService.updateProfile(user.username, { role: 'arbitro' });
      setUser(updated);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isLoginModalOpen,
        openLoginModal: () => setIsLoginModalOpen(true),
        closeLoginModal: () => setIsLoginModalOpen(false),
        login,
        logout,
        updateProfile,
        elevateToAdmin,
        revokeAdmin,
        availableUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
