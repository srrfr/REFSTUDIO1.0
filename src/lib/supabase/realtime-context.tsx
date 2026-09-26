'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { getSupabaseClient, isSupabaseConfigured } from './client';
import { DbService } from '@/lib/repository/db-service';
import { SupabaseService } from './supabase-service';

export interface RealtimeEventInfo {
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  timestamp: Date;
  summary: string;
}

interface RealtimeContextType {
  isConfigured: boolean;
  isConnected: boolean;
  onlineRefereesCount: number;
  lastEvent: RealtimeEventInfo | null;
  syncNow: () => Promise<boolean>;
  lastSyncTime: Date | null;
}

const RealtimeContext = createContext<RealtimeContextType>({
  isConfigured: false,
  isConnected: false,
  onlineRefereesCount: 1,
  lastEvent: null,
  syncNow: async () => false,
  lastSyncTime: null,
});

export const RealtimeSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConfigured, setIsConfigured] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineRefereesCount, setOnlineRefereesCount] = useState(1);
  const [lastEvent, setLastEvent] = useState<RealtimeEventInfo | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  const getEventSummary = (table: string, eventType: string, newRecord: any): string => {
    switch (table) {
      case 'notes':
        if (eventType === 'DELETE') {
          return 'Nota arbitrale eliminata';
        }
        return eventType === 'INSERT'
          ? `Nuova nota arbitrale su ${newRecord?.target_name || 'soggetto'}`
          : `Nota modificata per ${newRecord?.target_name || 'soggetto'}`;
      case 'matches':
        return `Partita aggiornata: ${newRecord?.home_team_name || 'Casa'} vs ${newRecord?.away_team_name || 'Trasferta'} (${newRecord?.home_score ?? '-'}:${newRecord?.away_score ?? '-'})`;
      case 'players':
        return `Calciatore aggiornato: ${newRecord?.first_name || ''} ${newRecord?.last_name || ''} (${newRecord?.team_name || ''})`;
      case 'teams':
        return `Dati squadra aggiornati: ${newRecord?.name || ''}`;
      case 'videos':
        if (eventType === 'DELETE') {
          return 'Video clip eliminato';
        }
        return `Nuova clip video caricata: ${newRecord?.title || ''}`;
      case 'standings':
        return `Classifica girone ${newRecord?.girone || ''} aggiornata`;
      default:
        return `Dati ${table} aggiornati in tempo reale`;
    }
  };

  const syncNow = useCallback(async (): Promise<boolean> => {
    const success = await DbService.syncWithSupabase();
    if (success) {
      setLastSyncTime(new Date());
    }
    return success;
  }, []);

  useEffect(() => {
    const configured = isSupabaseConfigured();
    setIsConfigured(configured);

    // Canale Broadcast per sincronizzazione multi-tab istantanea sullo stesso dispositivo
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel('refstudio_realtime_bus');
      broadcastChannelRef.current = bc;
      bc.onmessage = (msg) => {
        if (msg.data?.type === 'REALTIME_UPDATE') {
          setLastEvent(msg.data.event);
          setLastSyncTime(new Date());
          window.dispatchEvent(new CustomEvent('refstudio-sync-update', { detail: msg.data.event }));
        }
      };
    }

    if (!configured) {
      // In assenza di Supabase, esegue sincronizzazione locale
      DbService.initSupabaseSync();
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) return;

    // 1. Idratazione iniziale dai dati Supabase
    syncNow();

    // 2. Iscrizione al Canale Supabase Realtime con Presence per contare i dispositivi collegati
    const randomUserId = `ref-${Math.random().toString(36).substring(2, 8)}`;
    const channel = supabase.channel('refstudio-network-live', {
      config: {
        presence: { key: randomUserId },
      },
    });

    channel
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload: any) => {
        const table = payload.table;
        const eventType = payload.eventType;
        const newRecord = payload.new;
        const oldRecord = payload.old;
        const activeRecord = eventType === 'DELETE' ? oldRecord : (newRecord || oldRecord);

        // Aggiorna lo stato in-memory e localStorage
        (DbService as any).handleRealtimeEvent?.({
          table,
          eventType,
          newRecord,
          oldRecord,
        });

        const summary = getEventSummary(table, eventType, activeRecord);
        const eventInfo: RealtimeEventInfo = {
          table,
          eventType,
          timestamp: new Date(),
          summary,
        };

        setLastEvent(eventInfo);
        setLastSyncTime(new Date());

        // Invia notifica agli altri tab dello stesso dispositivo
        broadcastChannelRef.current?.postMessage({
          type: 'REALTIME_UPDATE',
          event: eventInfo,
        });

        // Trigger evento DOM per i componenti React attivi
        window.dispatchEvent(new CustomEvent('refstudio-sync-update', { detail: eventInfo }));
      })
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const count = Object.keys(presenceState).length;
        setOnlineRefereesCount(Math.max(count, 1));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          channel.track({
            onlineAt: new Date().toISOString(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'device',
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setIsConnected(false);
        }
      });

    // 3. Auto-risincronizzazione quando l'utente torna sulla scheda (Visibility / Focus)
    // Con throttling per evitare re-sync istantanei a seguito di finestre di dialogo (es. confirm())
    let lastFocusSync = Date.now();

    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusSync < 10000) return;
      lastFocusSync = now;
      syncNow();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastFocusSync < 10000) return;
        lastFocusSync = now;
        syncNow();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      broadcastChannelRef.current?.close();
      supabase.removeChannel(channel);
    };
  }, [syncNow]);

  return (
    <RealtimeContext.Provider
      value={{
        isConfigured,
        isConnected,
        onlineRefereesCount,
        lastEvent,
        syncNow,
        lastSyncTime,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => useContext(RealtimeContext);

/**
 * Hook per sottoscrivere un componente ai cambiamenti Realtime del database.
 * Quando un qualsiasi dispositivo o utente modifica un dato, il callback viene invocato all'istante.
 */
export function useRealtimeSync(onUpdate?: (event?: RealtimeEventInfo) => void) {
  const context = useRealtime();

  useEffect(() => {
    if (!onUpdate) return;

    const handler = (e: any) => {
      onUpdate(e.detail);
    };

    window.addEventListener('refstudio-sync-update', handler);
    return () => {
      window.removeEventListener('refstudio-sync-update', handler);
    };
  }, [onUpdate]);

  return context;
}
