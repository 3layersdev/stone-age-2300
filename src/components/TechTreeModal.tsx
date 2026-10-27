import React, { useState } from "react";
import { X, Crown, CheckCircle2, Lock, Sparkles, Pickaxe, Layers, Shield, Flame, Wheat, Route, ShieldCheck, Crosshair, Hammer, Swords, Landmark } from "lucide-react";
import { AGES, type ResKey, RES_NAME } from "@/game/data";
import { TECHNOLOGIES, type TechItem } from "@/game/techTree";
import { type Game } from "@/game/engine";
import { audio } from "@/game/audio";

const TECH_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Pickaxe,
  Layers,
  Shield,
  Flame,
  Wheat,
  Route,
  ShieldCheck,
  Crosshair,
  Hammer,
  Swords,
  Landmark,
};

export function TechTreeModal({
  game,
  onClose,
}: {
  game: Game;
  onClose: () => void;
}) {
  const [selectedAge, setSelectedAge] = useState<number>(game.age);
  const [, forceUpdate] = useState({});

  const filteredTechs = TECHNOLOGIES.filter((t) => t.age === selectedAge);

  const handleResearch = (tech: TechItem) => {
    if (game.researchTech(tech.id)) {
      forceUpdate({});
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm pointer-events-auto">
      <div className="hud-panel relative flex flex-col w-full max-w-2xl max-h-[90vh] rounded-lg border-primary/50 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hud-edge p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg border border-primary/40 bg-primary/15 text-primary">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-sm sm:text-base font-bold text-primary">
                EPOCH TIERS & CIVILIZATION RESEARCH
              </h2>
              <p className="text-[11px] text-muted-foreground font-serif">
                Unlock permanent empire-wide technologies, military gear, and production mastery.
              </p>
            </div>
          </div>
          <button
            onClick={() => { onClose(); audio.play("click"); }}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-black/30"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Age Tabs */}
        <div className="grid grid-cols-3 border-b border-hud-edge/60 bg-black/40 p-1.5 gap-1.5">
          {AGES.map((age, idx) => {
            const isUnlocked = game.age >= idx;
            const isSelected = selectedAge === idx;
            return (
              <button
                key={age.name}
                onClick={() => { setSelectedAge(idx); audio.play("click"); }}
                className={`flex items-center justify-center gap-1.5 rounded py-1.5 px-2 text-xs font-display font-bold transition-all border ${
                  isSelected
                    ? "border-primary bg-primary/25 text-primary shadow-[0_0_8px_rgba(234,179,8,0.3)]"
                    : "border-hud-edge/30 bg-black/25 text-muted-foreground hover:text-foreground hover:border-primary/30"
                }`}
              >
                {!isUnlocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                <span>{age.name}</span>
                {isUnlocked && <span className="text-[9px] font-mono text-success">✓</span>}
              </button>
            );
          })}
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          {filteredTechs.map((tech) => {
            const Icon = TECH_ICONS[tech.iconName] ?? Sparkles;
            const isResearched = game.researchedTechs.has(tech.id);
            const isAgeLocked = tech.age > game.age;
            const canAfford = game.afford(tech.cost);

            return (
              <div
                key={tech.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border transition-all ${
                  isResearched
                    ? "border-success/40 bg-success/10"
                    : isAgeLocked
                    ? "border-hud-edge/30 bg-black/20 opacity-60"
                    : canAfford
                    ? "border-hud-edge/70 bg-black/40 hover:border-primary/60"
                    : "border-hud-edge/40 bg-black/30"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`p-2 rounded-lg border shrink-0 mt-0.5 ${
                    isResearched ? "border-success/50 bg-success/20 text-success" : "border-primary/30 bg-black/40 text-primary"
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-bold text-foreground truncate">
                        {tech.name}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-black/50 text-primary border border-primary/20">
                        {tech.category}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      {tech.desc}
                    </p>
                    <div className="text-xs font-semibold text-warning mt-1 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-warning shrink-0" />
                      <span>{tech.effectLabel}</span>
                    </div>
                    {!isResearched && (
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-mono">
                        {(Object.keys(tech.cost) as ResKey[]).map((res) => {
                          const cost = tech.cost[res] ?? 0;
                          const has = Math.floor(game.res[res]);
                          const isShort = has < cost;
                          return (
                            <span
                              key={res}
                              className={`rounded px-1.5 py-0.5 border ${
                                isShort ? "border-destructive/60 bg-destructive/20 text-destructive" : "border-hud-edge/50 bg-black/50 text-foreground"
                              }`}
                            >
                              {RES_NAME[res]}: {cost} ({has})
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action button */}
                <div className="shrink-0 self-end sm:self-center">
                  {isResearched ? (
                    <div className="flex items-center gap-1 text-xs font-bold text-success px-3 py-1.5 rounded bg-success/15 border border-success/30 font-display">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>RESEARCHED</span>
                    </div>
                  ) : isAgeLocked ? (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground px-3 py-1.5 rounded bg-black/40 border border-hud-edge/30 font-display">
                      <Lock className="h-3.5 w-3.5" />
                      <span>{AGES[tech.age].name}</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleResearch(tech)}
                      disabled={!canAfford}
                      className={`bronze-btn px-4 py-1.5 rounded font-display text-xs font-bold transition-all ${
                        canAfford
                          ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(234,179,8,0.4)]"
                          : "opacity-50 cursor-not-allowed"
                      }`}
                    >
                      {canAfford ? "RESEARCH" : "NEED RESOURCES"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-hud-edge p-2.5 bg-black/40 text-center text-[11px] text-muted-foreground font-serif">
          Advancing through Ages unlocks advanced tiers. Technologies persist permanently in your settlement.
        </div>
      </div>
    </div>
  );
}
