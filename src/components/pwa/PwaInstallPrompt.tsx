'use client';

import React, { useState, useEffect } from 'react';
import { Download, X, Share2, Smartphone, Monitor, CheckCircle, Sparkles } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  useEffect(() => {
    // 1. Verifica se l'app è già in esecuzione a tutto schermo / standalone
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(isStandaloneMode);
      return isStandaloneMode;
    };

    const standalone = checkStandalone();
    if (standalone) return; // Non mostrare prompt se è già installata e aperta a tutto schermo

    // 2. Rileva iOS / iPadOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice =
      /iphone|ipad|ipod/.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIos(isAppleDevice);

    // Controlla se l'utente ha chiuso il prompt nelle ultime 24 ore
    const dismissedAt = localStorage.getItem('refstudio_pwa_dismissed');
    const isDismissedRecently =
      dismissedAt && Date.now() - parseInt(dismissedAt, 10) < 24 * 60 * 60 * 1000;

    // 3. Ascolta l'evento prima dell'installazione di Chrome/Android
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!isDismissedRecently) {
        // Mostra il banner con un leggero ritardo per non interferire con il primo rendering
        setTimeout(() => setShowPrompt(true), 2500);
      }
    };

    // 4. Ascolta l'evento di installazione completata
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowPrompt(false);
      setInstalledSuccess(true);
      setTimeout(() => setInstalledSuccess(false), 5000);
      console.log('[PWA] RefStudio installata con successo sulla Schermata Home!');
    };

    // 5. Ascolta richieste di installazione manuale dalla Sidebar o Header
    const handleManualTrigger = () => {
      if (isAppleDevice) {
        setShowIosGuide(true);
      } else if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            setShowPrompt(false);
          }
        });
      } else {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('pwa-install-trigger', handleManualTrigger);

    // Se è iOS e non aperto in standalone e non ignorato recentemente, mostra suggerimento opzionale
    if (isAppleDevice && !isDismissedRecently) {
      const timer = setTimeout(() => setShowPrompt(true), 3500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
        window.removeEventListener('pwa-install-trigger', handleManualTrigger);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pwa-install-trigger', handleManualTrigger);
    };
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    if (!deferredPrompt) {
      // Se il browser non ha fornito l'evento nativo (es. browser desktop o Chrome già promptato)
      alert(
        'Per installare RefStudio: tocca i 3 puntini in alto a destra su Chrome e seleziona "Aggiungi a schermata Home" oppure "Installa applicazione".'
      );
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('[PWA] Utente ha accettato l\'installazione');
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('refstudio_pwa_dismissed', Date.now().toString());
  };

  // Se l'app gira già in standalone (a tutto schermo senza barra Chrome), non mostrare nulla
  if (isStandalone) {
    return null;
  }

  return (
    <>
      {/* Toast di successo installazione */}
      {installedSuccess && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 bg-[#0D1017] border border-[#CCFF00] rounded-2xl shadow-[0_0_25px_rgba(204,255,0,0.3)] text-slate-100 text-xs font-bold animate-in fade-in slide-in-from-top duration-300">
          <CheckCircle className="w-5 h-5 text-[#CCFF00]" />
          <span>RefStudio installata! Ora puoi aprirla a schermo intero dalla schermata Home.</span>
        </div>
      )}

      {/* Floating Bottom / Tablet Install Banner */}
      {showPrompt && (
        <aside
          aria-label="Notifica installazione applicazione"
          className="fixed bottom-20 md:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-[#0C0E14]/95 backdrop-blur-xl border border-[#CCFF00]/40 rounded-2xl p-4 shadow-[0_10px_35px_rgba(0,0,0,0.8),0_0_20px_rgba(204,255,0,0.15)] animate-in slide-in-from-bottom duration-300 select-none"
        >
          <div className="flex items-start gap-3.5">
            {/* App Icon */}
            <div className="w-12 h-12 rounded-xl bg-[#08090C] border border-[#CCFF00]/60 p-1.5 shrink-0 flex items-center justify-center shadow-[0_0_15px_rgba(204,255,0,0.25)]">
              <img
                src="/icons/icon-192x192.png"
                alt="RefStudio Icon"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>

            {/* Information */}
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-black text-white tracking-tight flex items-center gap-1.5">
                  RefStudio App
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/40">
                    PWA
                  </span>
                </h3>
              </div>
              <p className="text-xs text-slate-300 leading-snug">
                {isIos
                  ? 'Aggiungi RefStudio alla schermata Home per usarla a schermo intero senza barre del browser.'
                  : 'Installa sul tuo telefono o tablet: si apre a schermo intero, senza la barra di ricerca di Chrome!'}
              </p>

              {/* Action Buttons */}
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handleInstallClick}
                  className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-[#CCFF00] hover:bg-[#D8FF33] text-black font-black text-xs transition-all shadow-[0_0_15px_rgba(204,255,0,0.3)] active:scale-95 cursor-pointer"
                >
                  {isIos ? (
                    <>
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Come Installare</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Installa Subito</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleDismiss}
                  className="px-3 py-2 rounded-xl bg-[#141824] hover:bg-[#1D2335] text-slate-400 hover:text-white text-xs font-semibold border border-[#212638] transition-colors"
                >
                  Più tardi
                </button>
              </div>
            </div>

            {/* Close Cross */}
            <button
              onClick={handleDismiss}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#141824] transition-colors -mr-1 -mt-1"
              title="Chiudi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </aside>
      )}

      {/* Modal Guida per iOS (iPhone / iPad) */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0C0E14] border border-[#212638] w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1B1F2C]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#CCFF00]/15 border border-[#CCFF00]/40 flex items-center justify-center text-[#CCFF00]">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 className="font-black text-white text-sm">Installa su iPhone o iPad</h3>
              </div>
              <button
                onClick={() => setShowIosGuide(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-[#181D2A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ol className="space-y-3 text-xs text-slate-300">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#161B26] border border-[#242C40] flex items-center justify-center font-mono font-bold text-[#CCFF00] shrink-0 text-[10px]">
                  1
                </span>
                <span>
                  Tocca l&apos;icona <strong>Condividi</strong>{' '}
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-sky-400 font-mono text-[10px]">
                    <Share2 className="w-3 h-3 inline mr-1" /> Condividi
                  </span>{' '}
                  nella barra del browser Safari o Chrome.
                </span>
              </li>

              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#161B26] border border-[#242C40] flex items-center justify-center font-mono font-bold text-[#CCFF00] shrink-0 text-[10px]">
                  2
                </span>
                <span>
                  Scorri l&apos;elenco e seleziona <strong>&quot;Aggiungi alla schermata Home&quot;</strong>.
                </span>
              </li>

              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#161B26] border border-[#242C40] flex items-center justify-center font-mono font-bold text-[#CCFF00] shrink-0 text-[10px]">
                  3
                </span>
                <span>
                  Conferma premendo <strong>Aggiungi</strong> in alto a destra. L&apos;icona apparirà sulla schermata Home e si aprirà a schermo intero senza barre!
                </span>
              </li>
            </ol>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 rounded-xl bg-[#CCFF00] text-black font-black text-xs shadow-md hover:bg-[#D8FF33] transition-all"
            >
              Ho capito
            </button>
          </div>
        </div>
      )}
    </>
  );
};
