'use client';

import React, { useState, useEffect } from 'react';
import { Download, X, Share2, Smartphone, CheckCircle, MoreVertical, Sparkles } from 'lucide-react';

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
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  useEffect(() => {
    // 1. Verifica se l'app è già avviata da Schermata Home / Standalone / Fullscreen
    const checkStandalone = () => {
      if (typeof window === 'undefined') return false;
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(isStandaloneMode);
      return isStandaloneMode;
    };

    if (checkStandalone()) return;

    // 2. Rilevamento piattaforma
    const ua = window.navigator.userAgent.toLowerCase();
    const isApple =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIos(isApple);

    // 3. Ascolta prima dell'evento installazione Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      console.log('[PWA] Evento beforeinstallprompt catturato con successo da Chrome');
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // 4. Installazione completata
    const handleAppInstalled = () => {
      console.log('[PWA] Applicazione installata con successo!');
      setDeferredPrompt(null);
      setShowPrompt(false);
      setShowGuideModal(false);
      setInstalledSuccess(true);
      setTimeout(() => setInstalledSuccess(false), 5000);
    };

    // 5. Trigger manuale da Header o Sidebar
    const handleManualTrigger = () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            setShowPrompt(false);
          }
        });
      } else {
        setShowGuideModal(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('pwa-install-trigger', handleManualTrigger);

    // Mostra il banner dopo 1 secondo se non è stato chiuso in questa sessione
    const dismissedThisSession = sessionStorage.getItem('refstudio_pwa_dismissed');
    if (!dismissedThisSession) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 1000);
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
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setShowPrompt(false);
          setShowGuideModal(false);
        }
        setDeferredPrompt(null);
        return;
      } catch (err) {
        console.warn('[PWA] Errore prompt:', err);
      }
    }

    // Se deferredPrompt non è disponibile immediatamente, mostra la guida chiara
    setShowGuideModal(true);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem('refstudio_pwa_dismissed', 'true');
  };

  if (isStandalone) {
    return null;
  }

  return (
    <>
      {/* Toast notifica installazione completata */}
      {installedSuccess && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 bg-[#0D1017] border border-[#CCFF00] rounded-2xl shadow-[0_0_25px_rgba(204,255,0,0.3)] text-slate-100 text-xs font-bold animate-in fade-in slide-in-from-top duration-300">
          <CheckCircle className="w-5 h-5 text-[#CCFF00]" />
          <span>RefStudio installata! Ora aprila dalla schermata Home per lo schermo intero.</span>
        </div>
      )}

      {/* Floating Bottom Banner su Mobile/Tablet */}
      {showPrompt && (
        <aside
          aria-label="Installazione PWA RefStudio"
          className="fixed bottom-20 md:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-[#0C0E14]/95 backdrop-blur-xl border border-[#CCFF00]/50 rounded-2xl p-4 shadow-[0_12px_40px_rgba(0,0,0,0.85),0_0_25px_rgba(204,255,0,0.2)] animate-in slide-in-from-bottom duration-300 select-none"
        >
          <div className="flex items-start gap-3.5">
            {/* Logo Icon */}
            <div className="w-12 h-12 rounded-xl bg-[#08090C] border border-[#CCFF00]/60 p-1.5 shrink-0 flex items-center justify-center shadow-[0_0_15px_rgba(204,255,0,0.3)]">
              <img
                src="/icons/icon-192x192.png"
                alt="RefStudio Icon"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>

            {/* Testi e pulsanti */}
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-1.5 mb-1">
                <h3 className="text-sm font-black text-white tracking-tight">
                  Installa RefStudio App
                </h3>
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-[#CCFF00]/20 text-[#CCFF00] border border-[#CCFF00]/50">
                  SCHERMO INTERO
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-snug">
                Usala come vera app nativa: <strong>senza la barra di ricerca o URL di Chrome</strong> e ad avvio rapido dalla schermata Home!
              </p>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handleInstallClick}
                  className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-[#CCFF00] hover:bg-[#D8FF33] text-black font-black text-xs transition-all shadow-[0_0_15px_rgba(204,255,0,0.35)] active:scale-95 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-black" strokeWidth={2.5} />
                  <span>Installa Subito</span>
                </button>

                <button
                  onClick={handleDismiss}
                  className="px-3 py-2 rounded-xl bg-[#141824] hover:bg-[#1D2335] text-slate-400 hover:text-white text-xs font-semibold border border-[#212638] transition-colors cursor-pointer"
                >
                  Più tardi
                </button>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#141824] transition-colors -mr-1 -mt-1 cursor-pointer"
              title="Chiudi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </aside>
      )}

      {/* Modal Guida Installazione Interattiva (per Chrome/Android o iOS) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0C0E14] border border-[#CCFF00]/40 w-full max-w-sm rounded-3xl p-5 shadow-[0_0_40px_rgba(0,0,0,0.9),0_0_20px_rgba(204,255,0,0.15)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1B1F2C]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#CCFF00]/15 border border-[#CCFF00]/40 flex items-center justify-center text-[#CCFF00]">
                  <Smartphone className="w-5 h-5 text-[#CCFF00]" />
                </div>
                <div>
                  <h3 className="font-black text-white text-sm">
                    {isIos ? 'Installa su iPhone o iPad' : 'Installa su Chrome (Android / Tablet)'}
                  </h3>
                  <p className="text-[10px] text-[#CCFF00] font-bold">Schermo intero senza barra Chrome</p>
                </div>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#181D2A] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Istruzioni per Chrome / Android */}
            {!isIos ? (
              <ol className="space-y-3 text-xs text-slate-200">
                <li className="flex items-start gap-3 bg-[#11141D] p-2.5 rounded-xl border border-[#212638]">
                  <span className="w-6 h-6 rounded-lg bg-[#CCFF00] text-black flex items-center justify-center font-mono font-black shrink-0 text-xs shadow-[0_0_10px_rgba(204,255,0,0.3)]">
                    1
                  </span>
                  <div>
                    <span>Tocca i <strong>3 puntini verticali</strong> in alto a destra su Chrome:</span>
                    <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#181C28] border border-[#2B3142] text-white font-mono text-[11px]">
                      <MoreVertical className="w-3.5 h-3.5 text-[#CCFF00]" /> Menu Chrome
                    </div>
                  </div>
                </li>

                <li className="flex items-start gap-3 bg-[#11141D] p-2.5 rounded-xl border border-[#212638]">
                  <span className="w-6 h-6 rounded-lg bg-[#CCFF00] text-black flex items-center justify-center font-mono font-black shrink-0 text-xs shadow-[0_0_10px_rgba(204,255,0,0.3)]">
                    2
                  </span>
                  <div>
                    <span>Seleziona <strong>&quot;Installa applicazione&quot;</strong> (oppure <strong>&quot;Aggiungi a schermata Home&quot;</strong>).</span>
                  </div>
                </li>

                <li className="flex items-start gap-3 bg-[#11141D] p-2.5 rounded-xl border border-[#212638]">
                  <span className="w-6 h-6 rounded-lg bg-[#CCFF00] text-black flex items-center justify-center font-mono font-black shrink-0 text-xs shadow-[0_0_10px_rgba(204,255,0,0.3)]">
                    3
                  </span>
                  <div>
                    <span>Premi <strong>Installa</strong> nel popup di conferma. L&apos;app apparirà tra le app del tuo dispositivo e all&apos;avvio <strong>funzionerà a schermo intero senza barra di navigazione</strong>!</span>
                  </div>
                </li>
              </ol>
            ) : (
              /* Istruzioni per iOS (iPhone/iPad Safari/Chrome) */
              <ol className="space-y-3 text-xs text-slate-200">
                <li className="flex items-start gap-3 bg-[#11141D] p-2.5 rounded-xl border border-[#212638]">
                  <span className="w-6 h-6 rounded-lg bg-[#CCFF00] text-black flex items-center justify-center font-mono font-black shrink-0 text-xs">
                    1
                  </span>
                  <div>
                    <span>Tocca il tasto <strong>Condividi</strong>:</span>
                    <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#181C28] border border-[#2B3142] text-sky-400 font-mono text-[11px]">
                      <Share2 className="w-3 h-3 text-sky-400 inline" /> Condividi
                    </div>
                  </div>
                </li>

                <li className="flex items-start gap-3 bg-[#11141D] p-2.5 rounded-xl border border-[#212638]">
                  <span className="w-6 h-6 rounded-lg bg-[#CCFF00] text-black flex items-center justify-center font-mono font-black shrink-0 text-xs">
                    2
                  </span>
                  <div>
                    <span>Scorri e seleziona <strong>&quot;Aggiungi alla schermata Home&quot;</strong>.</span>
                  </div>
                </li>

                <li className="flex items-start gap-3 bg-[#11141D] p-2.5 rounded-xl border border-[#212638]">
                  <span className="w-6 h-6 rounded-lg bg-[#CCFF00] text-black flex items-center justify-center font-mono font-black shrink-0 text-xs">
                    3
                  </span>
                  <div>
                    <span>Premi <strong>Aggiungi</strong> in alto a destra per completare l&apos;installazione a schermo intero.</span>
                  </div>
                </li>
              </ol>
            )}

            {deferredPrompt && (
              <button
                onClick={handleInstallClick}
                className="w-full py-2.5 rounded-xl bg-[#CCFF00] text-black font-black text-xs shadow-[0_0_15px_rgba(204,255,0,0.35)] hover:bg-[#D8FF33] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Installa Subito con 1 Click</span>
              </button>
            )}

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2 rounded-xl bg-[#181C28] hover:bg-[#222838] text-slate-300 font-bold text-xs transition-colors cursor-pointer"
            >
              Ho capito
            </button>
          </div>
        </div>
      )}
    </>
  );
};
