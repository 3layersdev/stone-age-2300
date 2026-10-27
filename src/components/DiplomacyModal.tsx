import React, { useState } from "react";
import { uiSpriteStyle } from "../game/uiSprite";
import { X, Handshake, Shield, Swords, Coins, Gift, Check, AlertTriangle, HeartHandshake } from "lucide-react";
import { type Game } from "@/game/engine";
import { type RivalTribe } from "@/game/diplomacy";
import { RES_NAME, type ResKey } from "@/game/data";
import { audio } from "@/game/audio";

export function DiplomacyModal({
  game,
  onClose,
}: {
  game: Game;
  onClose: () => void;
}) {
  const [selectedTribeId, setSelectedTribeId] = useState<string>(game.tribes[0]?.id ?? "sunwatchers");
  const [, forceUpdate] = useState({});

  const tribe = game.tribes.find((t) => t.id === selectedTribeId) ?? game.tribes[0];

  const handleTribute = (res: ResKey, amount: number) => {
    if (game.sendTribute(tribe.id, res, amount)) {
      forceUpdate({});
    }
  };

  const handleTrade = () => {
    if (game.signTradePact(tribe.id)) {
      forceUpdate({});
    }
  };

  const handleAlliance = () => {
    if (game.signDefenseAlliance(tribe.id)) {
      forceUpdate({});
    }
  };

  const handleWar = () => {
    if (game.declareWar(tribe.id)) {
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
              <Handshake className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-sm sm:text-base font-bold text-primary">
                TRIBAL DIPLOMACY & TRADE ALLIANCES
              </h2>
              <p className="text-[11px] text-muted-foreground font-serif">
                Forge non-aggression pacts, establish recurring trade routes, or send tributes to rival chieftains.
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

        {/* Tribe Selectors */}
        <div className="grid grid-cols-3 border-b border-hud-edge/60 bg-black/40 p-1.5 gap-1.5">
          {game.tribes.map((tr) => {
            const isSelected = selectedTribeId === tr.id;
            const relColor =
              tr.relation >= 50
                ? "text-success"
                : tr.relation >= 15
                ? "text-primary"
                : tr.relation >= -15
                ? "text-warning"
                : "text-destructive";

            return (
              <button
                key={tr.id}
                onClick={() => { setSelectedTribeId(tr.id); audio.play("click"); }}
                className={`flex flex-col items-center justify-center rounded py-1.5 px-2 text-xs font-display font-bold transition-all border ${
                  isSelected
                    ? "border-primary bg-primary/25 text-primary shadow-[0_0_8px_rgba(234,179,8,0.3)]"
                    : "border-hud-edge/30 bg-black/25 text-muted-foreground hover:text-foreground hover:border-primary/30"
                }`}
              >
                <span className="truncate max-w-full">{tr.name}</span>
                <span className={`text-[10px] font-mono ${relColor}`}>
                  {tr.relation > 0 ? `+${tr.relation}` : tr.relation}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tribe Dossier */}
        {tribe && (
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
            {/* Banner card */}
            <div className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${tribe.bannerColor}`}>
              <div className="flex items-center gap-3">
                {(() => { const st = uiSpriteStyle(tribe.id === "sunwatchers" ? "tribe_tribalfire" : tribe.id === "ironclads" ? "tribe_warhut" : "tribe_shed", 46); return st ? <span className="shrink-0 hidden sm:inline-block drop-shadow" style={st} aria-hidden /> : null; })()}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-base font-bold">{tribe.name}</span>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-black/40 border border-current">
                    {tribe.relation >= 55 ? "Allied Clan" : tribe.relation >= 15 ? "Trade Partner" : tribe.relation >= -20 ? "Neutral" : "Hostile"}
                  </span>
                </div>
                <p className="text-xs font-serif opacity-80 mt-0.5">
                  Leader: <b className="font-sans">{tribe.leader}</b> · {tribe.title}
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-md">
                  {tribe.desc}
                </p>
              </div>
              </div>

              {/* Status Badges */}
              <div className="flex sm:flex-col gap-1.5 shrink-0 text-xs">
                {tribe.tradePact && (
                  <span className="flex items-center gap-1 rounded bg-success/20 border border-success/40 px-2 py-0.5 text-success font-display">
                    <Check className="h-3 w-3" /> Trade Active
                  </span>
                )}
                {tribe.defenseAlliance && (
                  <span className="flex items-center gap-1 rounded bg-primary/20 border border-primary/40 px-2 py-0.5 text-primary font-display">
                    <Shield className="h-3 w-3" /> Defense Pact
                  </span>
                )}
              </div>
            </div>

            {/* Relation Progress Bar */}
            <div className="p-3 rounded-lg border border-hud-edge/60 bg-black/35 space-y-1.5">
              <div className="flex justify-between text-xs font-display">
                <span className="text-muted-foreground">Diplomatic Standing</span>
                <span className={tribe.relation >= 50 ? "text-success font-bold" : tribe.relation >= 15 ? "text-primary" : "text-destructive font-bold"}>
                  {tribe.relation > 0 ? `+${tribe.relation}` : tribe.relation} / 100
                </span>
              </div>
              <div className="h-2 w-full rounded bg-black/60 overflow-hidden border border-hud-edge/40">
                <div
                  className={`h-full transition-all duration-300 ${
                    tribe.relation >= 50 ? "bg-success" : tribe.relation >= 15 ? "bg-primary" : "bg-destructive"
                  }`}
                  style={{ width: `${Math.max(5, (tribe.relation + 100) / 2)}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground font-serif">
                Favored tribute gift: <b className="text-foreground capitalize">{RES_NAME[tribe.preferredGift]}</b> (+25 Relations).
              </p>
            </div>

            {/* Diplomatic Actions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Send Gift / Tribute */}
              <div className="p-3 rounded-lg border border-hud-edge/60 bg-black/35 space-y-2">
                <div className="flex items-center gap-1.5 font-display text-xs font-bold text-primary">
                  <Gift className="h-4 w-4" />
                  <span>SEND TRIBUTE / GIFTS</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Present tribal offerings to raise trust and satisfy their council.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => handleTribute(tribe.preferredGift, 35)}
                    className="bronze-btn flex-1 py-1 px-2 rounded text-[11px] font-display flex items-center justify-center gap-1"
                  >
                    <span>35 {RES_NAME[tribe.preferredGift]}</span>
                    <span className="text-[10px] text-success">(+25)</span>
                  </button>
                  <button
                    onClick={() => handleTribute("gold", 30)}
                    className="bronze-btn flex-1 py-1 px-2 rounded text-[11px] font-display flex items-center justify-center gap-1"
                  >
                    <span>30 Gold</span>
                    <span className="text-[10px] text-primary">(+15)</span>
                  </button>
                </div>
              </div>

              {/* Trade Agreement */}
              <div className="p-3 rounded-lg border border-hud-edge/60 bg-black/35 space-y-2">
                <div className="flex items-center gap-1.5 font-display text-xs font-bold text-primary">
                  <Coins className="h-4 w-4" />
                  <span>TRADE CONVOY TREATY</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Requires +15 Relations. Grants periodic food, ore, or herbs every 45s.
                </p>
                <button
                  onClick={handleTrade}
                  disabled={tribe.tradePact || tribe.relation < 15}
                  className={`w-full py-1.5 px-3 rounded font-display text-xs font-bold transition-all border ${
                    tribe.tradePact
                      ? "border-success/40 bg-success/20 text-success cursor-default"
                      : tribe.relation >= 15
                      ? "bronze-btn text-primary bg-primary/20 hover:bg-primary/30"
                      : "border-hud-edge/30 bg-black/20 text-muted-foreground opacity-50 cursor-not-allowed"
                  }`}
                >
                  {tribe.tradePact ? "TRADE CONVOY ACTIVE" : tribe.relation >= 15 ? "SIGN TRADE AGREEMENT" : "REQUIRES +15 RELATIONS"}
                </button>
              </div>

              {/* Defense Alliance */}
              <div className="p-3 rounded-lg border border-hud-edge/60 bg-black/35 space-y-2">
                <div className="flex items-center gap-1.5 font-display text-xs font-bold text-primary">
                  <HeartHandshake className="h-4 w-4" />
                  <span>MILITARY DEFENSE PACT</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Requires +55 Relations. Allied clan warriors march to your aid during raids!
                </p>
                <button
                  onClick={handleAlliance}
                  disabled={tribe.defenseAlliance || tribe.relation < 55}
                  className={`w-full py-1.5 px-3 rounded font-display text-xs font-bold transition-all border ${
                    tribe.defenseAlliance
                      ? "border-primary/40 bg-primary/20 text-primary cursor-default"
                      : tribe.relation >= 55
                      ? "bronze-btn text-primary bg-primary/20 hover:bg-primary/30"
                      : "border-hud-edge/30 bg-black/20 text-muted-foreground opacity-50 cursor-not-allowed"
                  }`}
                >
                  {tribe.defenseAlliance ? "ALLIANCE FORMED" : tribe.relation >= 55 ? "FORM DEFENSE ALLIANCE" : "REQUIRES +55 RELATIONS"}
                </button>
              </div>

              {/* Declare War */}
              <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10 space-y-2">
                <div className="flex items-center gap-1.5 font-display text-xs font-bold text-destructive">
                  <Swords className="h-4 w-4" />
                  <span>DECLARE TRIBAL WAR</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Sever all agreements. Provoke conflict to seize pride and plunder.
                </p>
                <button
                  onClick={handleWar}
                  disabled={tribe.relation <= -80}
                  className="w-full py-1.5 px-3 rounded font-display text-xs font-bold transition-all border border-destructive/60 bg-destructive/25 text-destructive hover:bg-destructive/40"
                >
                  {tribe.relation <= -80 ? "AT OPEN WAR" : "SEVER TIES & DECLARE WAR"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-hud-edge p-2.5 bg-black/40 text-center text-[11px] text-muted-foreground font-serif">
          Maintaining peace with multiple tribes guarantees steady trade convoys to bolster your economy.
        </div>
      </div>
    </div>
  );
}
