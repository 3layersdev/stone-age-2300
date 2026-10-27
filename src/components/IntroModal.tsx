import React from "react";
import { Castle, Sparkles, Shield, Wheat, Crown, Globe, Bell, Play } from "lucide-react";
import { audio } from "@/game/audio";

export function IntroModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const handleStart = () => {
    try {
      localStorage.setItem("stone_age_intro_seen", "true");
    } catch {
      // ignore
    }
    audio.play("rankup");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto overscroll-contain p-3 sm:p-4 bg-black/85 backdrop-blur-md pointer-events-auto">
      <div className="hud-panel relative flex flex-col w-full max-w-2xl modal-max my-auto rounded-xl border-primary/60 shadow-[0_0_50px_rgba(234,179,8,0.25)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Banner Hero */}
        <div className="relative border-b border-hud-edge bg-gradient-to-b from-primary/20 via-black/40 to-black/80 p-3 sm:p-6 text-center">
          <div className="mx-auto flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border border-primary/50 bg-black/60 shadow-[0_0_20px_rgba(234,179,8,0.4)] mb-2 sm:mb-3">
            <Castle className="h-8 w-8 text-primary animate-pulse" />
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-black tracking-widest bronze-text uppercase">
            STONE AGE 2300: VALLEY OF EPOCHS
          </h1>
          <p className="text-xs sm:text-sm text-foreground/85 font-serif max-w-lg mx-auto mt-1 leading-relaxed">
            Lead the Emberkin tribe from the primordial Stone Age into the heights of the Iron Age. Build thriving cities, barter provisions, forge tribal alliances, and survive unforgiving seasons.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg border border-hud-edge/60 bg-black/40 space-y-1">
            <div className="flex items-center gap-2 font-display text-primary font-bold">
              <Wheat className="h-4 w-4" />
              <span>LIVING CITY ECONOMY</span>
            </div>
            <p className="text-muted-foreground leading-snug">
              Citizens autonomously haul resources to Granaries & Storehouses. Manage multi-resource diets: grain, domestic livestock meat, milk, sweet orchard fruits, and herbs.
            </p>
          </div>

          <div className="p-3 rounded-lg border border-hud-edge/60 bg-black/40 space-y-1">
            <div className="flex items-center gap-2 font-display text-primary font-bold">
              <Bell className="h-4 w-4" />
              <span>TOWN BELL GARRISON</span>
            </div>
            <p className="text-muted-foreground leading-snug">
              When raiders strike, ring the Town Bell! Villagers immediately run <i>inside</i> the Town Center for safety, firing defensive arrow volleys from the battlements.
            </p>
          </div>

          <div className="p-3 rounded-lg border border-hud-edge/60 bg-black/40 space-y-1">
            <div className="flex items-center gap-2 font-display text-primary font-bold">
              <Crown className="h-4 w-4" />
              <span>EPOCH TIERS & RESEARCH</span>
            </div>
            <p className="text-muted-foreground leading-snug">
              Advance through the Stone, Bronze, and Iron Ages. Research technological breakthroughs: the wheel, bronze plows, composite horn bows, and war chariots.
            </p>
          </div>

          <div className="p-3 rounded-lg border border-hud-edge/60 bg-black/40 space-y-1">
            <div className="flex items-center gap-2 font-display text-primary font-bold">
              <Globe className="h-4 w-4" />
              <span>DIPLOMACY & MULTIPLAYER</span>
            </div>
            <p className="text-muted-foreground leading-snug">
              Interact with 3 rival clans: send tribute, secure trade agreements, or form military defense pacts. Join global multiplayer lobbies backed by Firebase cloud servers.
            </p>
          </div>
        </div>

        {/* Footer Action */}
        <div className="border-t border-hud-edge p-4 bg-black/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[11px] text-muted-foreground font-serif text-center sm:text-left">
            <span className="sm:hidden">Drag to pan · Pinch to zoom · Tap to inspect &amp; build</span>
            <span className="hidden sm:inline">Controls: scroll or drag to pan · Ctrl+scroll to zoom · WASD also pans · Left-click to inspect &amp; build</span>
          </span>
          <button
            onClick={handleStart}
            className="w-full sm:w-auto bronze-btn px-6 py-2 rounded-lg font-display text-sm font-bold bg-primary text-primary-foreground shadow-[0_0_20px_rgba(234,179,8,0.5)] flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>ENTER THE REALM</span>
          </button>
        </div>
      </div>
    </div>
  );
}
