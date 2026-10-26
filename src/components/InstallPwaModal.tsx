import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share, PlusSquare, Check } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function InstallPwaModal() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone (installed) mode
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    // Check if iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);

      // Check if user previously dismissed in last 24 hours
      const lastDismissed = localStorage.getItem('sunshine_pwa_dismissed');
      const shouldSuppress = lastDismissed && (Date.now() - parseInt(lastDismissed, 10)) < 24 * 60 * 60 * 1000;

      if (!shouldSuppress) {
        // Small delay so user sees app first
        const timer = setTimeout(() => {
          setShowPopup(true);
        }, 2000);
        return () => clearTimeout(timer);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed
    const handleAppInstalled = () => {
      setInstalled(true);
      setShowPopup(false);
      setDeferredPrompt(null);
      setIsStandalone(true);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
        setShowPopup(false);
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosGuide(true);
    }
  };

  const handleDismiss = () => {
    setShowPopup(false);
    setShowIosGuide(false);
    localStorage.setItem('sunshine_pwa_dismissed', Date.now().toString());
  };

  // If already running standalone or installed, don't show prompt
  if (isStandalone || installed) {
    return null;
  }

  return (
    <>
      {/* ── Auto Popup / Modal ───────────────────────────────── */}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleDismiss} />
          
          <div className="relative bg-white w-full max-w-md rounded-t-[32px] sm:rounded-3xl shadow-2xl p-6 z-10 animate-scale-in border border-slate-100">
            {/* Close button */}
            <button 
              onClick={handleDismiss}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* App Icon & Details */}
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-white fill-white" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 leading-tight">Install Sunshine ERP</h3>
                <p className="text-xs font-semibold text-indigo-600 mt-0.5">Sunshine Polyfilm Industries</p>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 font-medium">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                  Fast · Offline Support · Full Screen
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Install Sunshine ERP directly on your phone or desktop home screen for instant access without opening a browser.
            </p>

            {isIos ? (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-4 text-xs text-slate-700 space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <Share className="w-4 h-4 text-indigo-600" />
                  <span>iPhone / iPad instructions:</span>
                </div>
                <p>1. Tap the <strong>Share</strong> button at the bottom of Safari.</p>
                <p>2. Scroll down and tap <strong>Add to Home Screen</strong> (<PlusSquare className="w-3.5 h-3.5 inline text-indigo-600" />).</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={handleInstallClick}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-indigo-600/30 transition-all transform active:scale-95 text-base"
                >
                  <Download className="w-5 h-5" />
                  <span>Install App Now</span>
                </button>
                <button
                  onClick={handleDismiss}
                  className="w-full py-2.5 text-center text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── iOS Instruction Modal if clicked manually ────────── */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowIosGuide(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 z-10 animate-scale-in">
            <h3 className="text-lg font-black text-slate-900 mb-2">Install on iPhone</h3>
            <p className="text-xs text-slate-600 mb-4">Follow these simple steps in Safari:</p>
            <div className="space-y-3 text-sm text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">1</span>
                <span>Tap the <strong>Share</strong> button in Safari's bottom toolbar.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">2</span>
                <span>Scroll down and select <strong>Add to Home Screen</strong>.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">3</span>
                <span>Tap <strong>Add</strong> in the top-right corner.</span>
              </div>
            </div>
            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full mt-5 bg-indigo-600 text-white font-bold py-3 rounded-2xl shadow-md"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Header Install App Pill Button (always visible when not installed)
export function HeaderInstallButton() {
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandaloneMode) return;

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    if (isIosDevice) {
      setCanInstall(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setCanInstall(false);
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosGuide(true);
    } else {
      // Trigger native browser install or show info
      alert('To install Sunshine ERP, tap your browser menu (⋮) and select "Add to Home screen" or "Install App".');
    }
  };

  if (!canInstall) return null;

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold text-xs px-3 py-1.5 rounded-full shadow-md shadow-indigo-600/20 transition-all transform active:scale-95"
        title="Install App"
      >
        <Download className="w-3.5 h-3.5 animate-bounce" />
        <span className="hidden xs:inline sm:inline">Install App</span>
      </button>

      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowIosGuide(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 z-10 animate-scale-in">
            <h3 className="text-lg font-black text-slate-900 mb-2">Install on iPhone</h3>
            <p className="text-xs text-slate-600 mb-4">Follow these simple steps in Safari:</p>
            <div className="space-y-3 text-sm text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">1</span>
                <span>Tap the <strong>Share</strong> button in Safari's bottom toolbar.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">2</span>
                <span>Scroll down and select <strong>Add to Home Screen</strong>.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">3</span>
                <span>Tap <strong>Add</strong> in the top-right corner.</span>
              </div>
            </div>
            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full mt-5 bg-indigo-600 text-white font-bold py-3 rounded-2xl shadow-md"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
