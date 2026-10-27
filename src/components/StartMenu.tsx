import { uiSpriteStyle } from "../game/uiSprite";
import { useEffect, useState } from "react";
import { Flame, Play, FolderOpen, BookOpen, Trash2, X, Sword, Leaf, Skull, Lock, Scroll, Map as MapIcon, Volume2, VolumeX, Sliders } from "lucide-react";
import bg from "@/assets/menu-bg-new.jpg";
import logoImg from "@/assets/menu-logo.webp";
import campfireStrip from "@/assets/campfire-strip.webp";
import campfireMeta from "@/game/campfire.json";
import { SLOTS, getChapters, deleteSave, lastSlot, readMeta, type SaveMeta } from "@/game/save";
import { AGES, MAP_SIZES, type MapSize } from "@/game/data";
import { MISSIONS } from "@/game/missions";
import type { Difficulty } from "@/game/engine";
import { audio } from "@/game/audio";
import { preloadGameAssets } from "@/game/render";

interface Props {
  onNew: (d: Difficulty, slot: number, size: MapSize) => void;
  onLoad: (slot: number) => void;
}

export function StartMenu({ onNew, onLoad }: Props) {
  const [fireFrame, setFireFrame] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setFireFrame((f) => (f + 1) % 9), 130);
    return () => clearInterval(t);
  }, []);
  const [panel, setPanel] = useState<null | "new" | "load" | "help" | "chapters">(null);
  const [size, setSize] = useState<MapSize>("large");
  const [chapters, setChapters] = useState<string[]>([]);
  const [metas, setMetas] = useState<(SaveMeta | null)[]>([]);
  const [last, setLast] = useState<number | null>(null);
  const [audioSettings, setAudioSettings] = useState(audio.settings);
  const [audioOpen, setAudioOpen] = useState(false);

  const refresh = () => { setMetas(SLOTS.map((s) => readMeta(s))); setLast(lastSlot()); setChapters(getChapters()); };

  useEffect(() => {
    preloadGameAssets();
    refresh();
    const unsub = audio.subscribe(() => setAudioSettings({ ...audio.settings }));
    const initAudioOnGesture = () => {
      audio.init();
    };
    window.addEventListener("pointerdown", initAudioOnGesture, { once: true });
    return () => {
      unsub();
      window.removeEventListener("pointerdown", initAudioOnGesture);
    };
  }, []);

  const hasLast = last !== null && metas[last - 1];

  const handleAction = (fn: () => void) => {
    audio.init();
    audio.play("click");
    fn();
  };

  return (
    <div className="page-fill relative w-screen overflow-x-hidden overflow-y-auto overscroll-contain bg-background text-foreground flex flex-col">
      <img src={bg} alt="" width={1920} height={1088} className="fixed inset-0 h-full w-full object-cover animate-slowzoom pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-to-r from-background via-background/80 to-transparent pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent pointer-events-none" />
      {Array.from({ length: 24 }).map((_, i) => (
        <span key={i} className="fixed bottom-0 h-1 w-1 rounded-full bg-primary animate-ember pointer-events-none"
          style={{ left: `${(i * 37) % 100}%`, animationDuration: `${6 + (i % 7)}s`, animationDelay: `${(i * 0.7) % 8}s` }} />
      ))}

      {/* Audio Controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={() => {
            audio.init();
            audio.toggleMute();
            audio.play("click");
          }}
          className="bronze-btn flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-display tracking-wider transition-all"
          title={audioSettings.muted ? "Unmute Audio" : "Mute Audio"}
        >
          {audioSettings.muted ? <VolumeX className="h-4 w-4 text-destructive" /> : <Volume2 className="h-4 w-4 text-primary" />}
          <span className="hidden sm:inline">{audioSettings.muted ? "Muted" : "Music & SFX"}</span>
        </button>
        <button
          onClick={() => {
            audio.init();
            setAudioOpen(!audioOpen);
            audio.play("click");
          }}
          className="bronze-btn flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-md text-primary"
          title="Audio Settings"
        >
          <Sliders className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Audio Settings Dropdown */}
      {audioOpen && (
        <div className="fixed top-14 right-4 z-30 hud-panel w-64 rounded-md p-4 text-xs shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-hud-edge">
            <span className="font-display font-semibold text-primary">Sound & Music</span>
            <button onClick={() => setAudioOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-3 mt-3">
            <div>
              <div className="flex justify-between mb-1 text-muted-foreground">
                <span>Master Volume</span>
                <span>{Math.round(audioSettings.masterVol * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={audioSettings.masterVol}
                onChange={(e) => audio.setMasterVol(parseFloat(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1 text-muted-foreground">
                <span>Tribal Ambient & Music</span>
                <span>{Math.round(audioSettings.musicVol * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={audioSettings.musicVol}
                onChange={(e) => audio.setMusicVol(parseFloat(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1 text-muted-foreground">
                <span>Sound Effects (SFX)</span>
                <span>{Math.round(audioSettings.sfxVol * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={audioSettings.sfxVol}
                onChange={(e) => {
                  audio.setSfxVol(parseFloat(e.target.value));
                  audio.play("click");
                }}
                className="w-full accent-primary cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 flex min-h-[100dvh] w-full flex-col justify-center px-5 py-6 sm:px-12 sm:py-10 md:px-24">
        <div className="my-auto flex flex-col justify-center max-w-lg">
          <p className="font-display text-[11px] sm:text-xs md:text-sm tracking-[0.35em] sm:tracking-[0.5em] text-primary/80">THE EMBERKIN CHRONICLES</p>
          <img src={logoImg} alt="Stone Age 2300" className="mt-2 w-[min(560px,88vw)] drop-shadow-2xl pointer-events-none select-none" />
          <p className="sr-only">Stone Age 2300</p>
          <p className="mt-2 sm:mt-4 text-xs sm:text-sm md:text-base text-muted-foreground leading-relaxed max-w-md">Three centuries after the Collapse, the old world rots in the jungle. Rebuild. Defend. Endure.</p>

          <nav className="mt-4 sm:mt-7 flex w-full max-w-[280px] sm:max-w-xs flex-col gap-2 sm:gap-2.5">
            {hasLast && (
              <MenuBtn icon={<Flame className="h-4 w-4 sm:h-5 sm:w-5" />} img="menu_continue" label="Continue" sub={`Slot ${last} · ${AGES[metas[last! - 1]!.age].name}`} onClick={() => handleAction(() => onLoad(last!))} primary />
            )}
            <MenuBtn icon={<Play className="h-4 w-4 sm:h-5 sm:w-5" />} img="menu_play" label="New Campaign" onClick={() => handleAction(() => setPanel("new"))} primary={!hasLast} />
            <MenuBtn icon={<FolderOpen className="h-4 w-4 sm:h-5 sm:w-5" />} img="crest_star" label="Load Game" onClick={() => handleAction(() => { refresh(); setPanel("load"); })} />
            <MenuBtn icon={<Scroll className="h-4 w-4 sm:h-5 sm:w-5" />} img="crest_feather" label="Chronicles" sub={`${chapters.length} chapters unlocked`} onClick={() => handleAction(() => { refresh(); setPanel("chapters"); })} />
            <MenuBtn icon={<BookOpen className="h-4 w-4 sm:h-5 sm:w-5" />} img="crest_question" label="How to Play" onClick={() => handleAction(() => setPanel("help"))} />
          </nav>

          <div aria-hidden className="pointer-events-none select-none fixed bottom-6 right-6 sm:bottom-8 sm:right-12 z-[5] hidden md:block">
            <div
              style={{
                width: `${(campfireMeta.frameW[fireFrame] / campfireMeta.h) * 120}px`,
                height: "120px",
                overflow: "hidden",
                position: "relative",
                filter: "drop-shadow(0 0 18px rgba(255,140,40,0.45))",
              }}
            >
              <img
                src={campfireStrip}
                alt=""
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  height: "120px",
                  width: "auto",
                  transform: `translateX(-${(campfireMeta.frameW.slice(0, fireFrame).reduce((a: number, b: number) => a + b, 0) / campfireMeta.h) * 120}px)`,
                  imageRendering: "auto",
                }}
              />
            </div>
          </div>
          <p className="mt-4 sm:mt-6 text-[11px] sm:text-xs text-muted-foreground/80">v1.2 · Progress saves on this device</p>
        </div>
      </div>

      {panel && (
        <div className="fixed inset-0 z-20 flex justify-center overflow-y-auto overscroll-contain p-3 sm:p-4 bg-background/80 backdrop-blur-sm">
          <div className="hud-panel modal-max my-auto relative w-[min(560px,94vw)] overflow-y-auto overscroll-contain rounded-md p-4 sm:p-7">
            <button onClick={() => handleAction(() => setPanel(null))} className="absolute right-3 top-3 p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors" aria-label="Close"><X className="h-5 w-5" /></button>
            {panel === "new" && (
              <>
                <h3 className="font-display text-xl sm:text-2xl bronze-text">Choose Your Fate</h3>
                <p className="mb-4 text-xs sm:text-sm text-muted-foreground">Starts in save slot 1 (autosaves every minute).</p>
                <div className="mb-4 grid grid-cols-3 gap-2">
                  {(Object.keys(MAP_SIZES) as MapSize[]).map((k) => (
                    <button key={k} onClick={() => handleAction(() => setSize(k))} className={`flex flex-col items-center justify-center rounded p-2 font-display text-xs sm:text-sm transition-all ${size === k ? "bg-primary text-primary-foreground font-bold shadow" : "bronze-btn"}`}>
                      <MapIcon className="h-4 w-4 mb-0.5" />{k[0].toUpperCase() + k.slice(1)}<span className="text-[10px] opacity-80">{MAP_SIZES[k]}×{MAP_SIZES[k]}</span>
                    </button>
                  ))}
                </div>
                <div className="grid gap-2 sm:gap-3">
                  <DiffBtn icon={<Leaf className="h-5 w-5" />} title="Peaceful" text="No raids. Only nature tests you." onClick={() => handleAction(() => onNew("peaceful", 1, size))} />
                  <DiffBtn icon={<Sword className="h-5 w-5" />} title="Chieftain" text="Balanced raids and cataclysms." onClick={() => handleAction(() => onNew("normal", 1, size))} />
                  <DiffBtn icon={<Skull className="h-5 w-5" />} title="Warlord" text="Early, brutal Rustfang raids." onClick={() => handleAction(() => onNew("hard", 1, size))} />
                </div>
              </>
            )}
            {panel === "load" && (
              <>
                <h3 className="mb-4 font-display text-xl sm:text-2xl bronze-text">Chronicles</h3>
                <div className="grid gap-2.5 sm:gap-3">
                  {SLOTS.map((s, i) => {
                    const m = metas[i];
                    return (
                      <div key={s} className="bronze-btn flex items-center gap-3 sm:gap-4 rounded p-3 sm:p-4">
                        <div className="font-display text-2xl sm:text-3xl text-primary shrink-0">{s}</div>
                        <div className="flex-1 min-w-0">
                          {m ? (
                            <>
                              <div className="font-semibold text-xs sm:text-sm truncate">{AGES[m.age].name} · Pop {m.pop}</div>
                              <div className="text-[11px] sm:text-xs text-muted-foreground truncate">Mission {m.mission + 1} · Day {Math.floor(m.time / 300) + 1} · {new Date(m.date).toLocaleDateString()}</div>
                            </>
                          ) : (
                            <div className="text-xs sm:text-sm text-muted-foreground">Empty slot</div>
                          )}
                        </div>
                        {m && <button className="bronze-btn shrink-0 rounded px-3 py-1 font-display text-xs sm:text-sm" onClick={() => handleAction(() => onLoad(s))}>Load</button>}
                        {m && <button aria-label="Delete save" className="text-muted-foreground hover:text-destructive p-1" onClick={() => handleAction(() => { deleteSave(s); refresh(); })}><Trash2 className="h-4 w-4" /></button>}
                        {!m && <button className="bronze-btn shrink-0 rounded px-3 py-1 font-display text-xs sm:text-sm" onClick={() => handleAction(() => onNew("normal", s, "large"))}>New</button>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {panel === "chapters" && (
              <>
                <h3 className="mb-4 font-display text-xl sm:text-2xl bronze-text">The Emberkin Chronicles</h3>
                <div className="grid gap-2">
                  {[...new Set([...MISSIONS.map((m) => m.chapter), "Epilogue"])].map((c, i) => {
                    const open = i === 0 || chapters.includes(c);
                    return (
                      <div key={c} className={`bronze-btn flex items-center gap-2.5 sm:gap-3 rounded p-2.5 sm:p-3 ${open ? "" : "opacity-50"}`}>
                        {open ? <Scroll className="h-4 w-4 text-primary shrink-0" /> : <Lock className="h-4 w-4 shrink-0" />}
                        <div className="flex-1 font-display text-xs sm:text-sm truncate">{open ? c : "Locked chapter"}</div>
                        {open && <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{MISSIONS.filter((m) => m.chapter === c).length || 1} missions</span>}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-[11px] sm:text-xs text-muted-foreground">Chapters unlock as you complete missions in any save.</p>
              </>
            )}
            {panel === "help" && (
              <div className="space-y-2.5 text-xs sm:text-sm leading-relaxed">
                <h3 className="font-display text-xl sm:text-2xl bronze-text">Survival Guide</h3>
                <p><b className="text-primary">Camera:</b> scroll or right-drag to pan, Ctrl+scroll to zoom, WASD / arrows / screen edges also pan, Space to return home. On touch: drag to pan, pinch to zoom, tap to select or build, long-press to send units or cancel.</p>
                <p><b className="text-primary">Build:</b> pick a building from the command card (bottom-right) or press its hotkey, then click the map. Drag for roads and palisades. Shift-click to keep placing. Right-click cancels.</p>
                <p><b className="text-primary">Villagers</b> work by themselves: they build, repair, fight fires, gather and carry goods. Camps must be placed near forest, stone or gold.</p>
                <p><b className="text-primary">Upgrades:</b> select a building and press Upgrade (U). Tier 2 needs tools from a Workshop, tier 3 also needs the Bronze Age. Gold diamonds show a building's tier.</p>
                <p><b className="text-primary">Terrain:</b> marshes and mountains slow everyone; rivers flood nearby buildings; mountains cause rockslides. Plan roads and defenses around them.</p>
                <p><b className="text-primary">Roads</b> make your people walk 70% faster.</p>
                <p><b className="text-primary">Warriors:</b> select one and right-click to move. They defend the Town Center automatically.</p>
                <p><b className="text-primary">Cataclysms:</b> earthquakes, wildfires, droughts and falling skyfire strike without warning.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MSprite({ name, w }: { name: string; w: number }) {
  const st = uiSpriteStyle(name, w);
  if (!st) return null;
  return <span className="shrink-0 inline-block" style={st} aria-hidden />;
}

function MenuBtn({ icon, label, sub, onClick, primary, img }: { icon: React.ReactNode; label: string; sub?: string; onClick: () => void; primary?: boolean; img?: string }) {
  return (
    <button onClick={onClick} className={`bronze-btn group flex items-center gap-3 rounded-md px-3.5 py-2.5 sm:px-5 sm:py-3 text-left transition-all active:scale-[0.98] ${primary ? "ring-1 ring-primary/60 shadow-lg shadow-primary/10" : ""}`}>
      <span className="text-primary shrink-0">{img ? <MSprite name={img} w={26} /> : icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block font-display text-sm sm:text-base md:text-lg tracking-wider truncate">{label}</span>
        {sub && <span className="block text-[10px] sm:text-xs text-muted-foreground truncate">{sub}</span>}
      </span>
    </button>
  );
}

function DiffBtn({ icon, title, text, onClick }: { icon: React.ReactNode; title: string; text: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="bronze-btn flex items-center gap-3 sm:gap-4 rounded-md p-3 sm:p-4 text-left transition-all active:scale-[0.98]">
      <span className="text-primary shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block font-display text-sm sm:text-base md:text-lg">{title}</span>
        <span className="text-xs sm:text-sm text-muted-foreground">{text}</span>
      </span>
    </button>
  );
}
