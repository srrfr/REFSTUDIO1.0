'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserAccount } from '@/types/refstudio';
import { DbService, DEFAULT_USERS } from '@/lib/repository/db-service';

const SESSION_USER_KEY = 'refstudio_auth_username_v1';

// L'amministratore è esclusivamente lo user @samueleromini
export function isSamueleRominiAdmin(user: UserAccount | null | undefined): boolean {
  if (!user || !user.username) return false;
  return user.username.toLowerCase().trim() === 'samueleromini';
}

interface AuthContextType {
  user: UserAccount | null;
  isAdmin: boolean;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  login: (username: string, pass: string) => Promise<{ success: boolean; message?: string }>;
  register: (data: {
    username: string;
    password?: string;
    displayName: string;
    email?: string;
    sectionAia: string;
    refereeRole: any;
    categoryAia?: string;
  }) => Promise<{ success: boolean; message?: string }>;
  approveUser: (username: string) => Promise<boolean>;
  rejectUser: (username: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (updates: Partial<UserAccount>) => Promise<boolean>;
  availableUsers: UserAccount[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [availableUsers, setAvailableUsers] = useState<UserAccount[]>(DEFAULT_USERS);

  // isAdmin è true SOLO ED ESCLUSIVAMENTE per lo user @samueleromini
  const isAdmin = Boolean(isSamueleRominiAdmin(user));

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
          // Se non è approvato, resetta sessione
          if (found.isApproved === false || found.status === 'PENDING') {
            localStorage.removeItem(SESSION_USER_KEY);
          } else {
            setUser(found);
            return;
          }
        }
      }

      // Se non c'è sessione salvata, inizializza con samueleromini come predefinito
      const defaultUser = profiles[0] || DEFAULT_USERS[0];
      setUser(defaultUser);
      localStorage.setItem(SESSION_USER_KEY, defaultUser.username);
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

    // Verifica stato validazione profilo
    if (found.isApproved === false || found.status === 'PENDING') {
      return {
        success: false,
        message: 'Il tuo profilo è in attesa di validazione da parte dell\'amministratore (rominisamuele@gmail.com). Ti verrà confermato l\'accesso appena convalidato.',
      };
    }

    if (found.status === 'REJECTED') {
      return {
        success: false,
        message: 'La richiesta di accesso per questo profilo è stata rifiutata dall\'amministratore.',
      };
    }

    setUser(found);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_USER_KEY, found.username);
    }
    setIsLoginModalOpen(false);
    return { success: true };
  };

  const register = async (data: {
    username: string;
    password?: string;
    displayName: string;
    email?: string;
    sectionAia: string;
    refereeRole: any;
    categoryAia?: string;
  }): Promise<{ success: boolean; message?: string }> => {
    try {
      const newProfile = DbService.registerProfile(data);
      setAvailableUsers(DbService.getProfiles());

      // Invia notifica email al validatore rominisamuele@gmail.com tramite API
      try {
        await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } catch (mailErr) {
        console.warn('Errore chiamata invio notifica email:', mailErr);
      }

      return {
        success: true,
        message:
          'Richiesta registrata con successo! È stata inviata una notifica a rominisamuele@gmail.com per validare il tuo accesso.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Errore durante la registrazione del profilo.',
      };
    }
  };

  const approveUser = async (username: string): Promise<boolean> => {
    try {
      DbService.approveProfile(username);
      setAvailableUsers(DbService.getProfiles());
      return true;
    } catch {
      return false;
    }
  };

  const rejectUser = async (username: string): Promise<boolean> => {
    try {
      DbService.rejectProfile(username);
      setAvailableUsers(DbService.getProfiles());
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    setUser(null);
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
      setAvailableUsers(DbService.getProfiles());
      return true;
    } catch (err) {
      console.error('Errore aggiornamento profilo:', err);
      return false;
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
        register,
        approveUser,
        rejectUser,
        logout,
        updateProfile,
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
