"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Panel } from "@/components/layout/panel";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "citation-agent-pwa-dismissed";

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    if (isIos()) setShowIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const dismiss = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  }, [deferredPrompt, dismiss]);

  if (isStandalone() || dismissed) return null;
  if (!deferredPrompt && !showIosHint) return null;

  return (
    <Panel className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-3 right-3 z-40 mx-auto max-w-lg border-[#f5c842]/25 bg-[#111111]/95 p-4 shadow-lg md:bottom-6 md:left-auto md:right-6">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[#f5c842]/30 bg-[#f5c842]/10">
          {showIosHint && !deferredPrompt ? <Share size={16} className="text-[#f5c842]" /> : <Download size={16} className="text-[#f5c842]" />}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold tracking-wide">Install Citation Agent</p>
          <p className="text-xs font-mono text-muted-foreground leading-relaxed">
            {deferredPrompt
              ? "Add this app to your home screen for quick access to payments and the marketplace."
              : "On Safari: tap Share, then Add to Home Screen."}
          </p>
          <div className="flex flex-wrap gap-2">
            {deferredPrompt && (
              <Button type="button" size="sm" onClick={() => void install()} className="gap-1.5">
                <Download size={14} />
                Install
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Dismiss install prompt"
        >
          <X size={16} />
        </button>
      </div>
    </Panel>
  );
}