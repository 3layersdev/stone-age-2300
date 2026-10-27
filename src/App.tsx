import { useState } from "react";
import { StartMenu } from "@/components/StartMenu";
import { GameScreen } from "@/components/GameScreen";
import { Game } from "@/game/engine";
import { readSave } from "@/game/save";

export default function App() {
  const [session, setSession] = useState<{ game: Game; slot: number; key: number } | null>(null);

  if (session) {
    return (
      <GameScreen
        key={session.key}
        game={session.game}
        slot={session.slot}
        onExit={() => setSession(null)}
      />
    );
  }

  return (
    <StartMenu
      onNew={(d, slot, size) =>
        setSession({
          game: new Game(Math.floor(Math.random() * 1e6), d, size),
          slot,
          key: Date.now(),
        })
      }
      onLoad={(slot) => {
        const s = readSave(slot);
        if (s) setSession({ game: Game.load(s), slot, key: Date.now() });
      }}
    />
  );
}
