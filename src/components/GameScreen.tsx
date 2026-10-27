import { useEffect, useReducer, useRef, useState } from "react";
import {
  Wheat, TreePine, Mountain, Coins, Users, Pause, Play, FastForward, Menu, Home, Axe, Pickaxe, Gem, Warehouse,
  Route, Swords, BrickWall, TowerControl, Store, Landmark, Hammer, Castle, User, Shield, Crown, Trash2, Flag, Sun, Moon, AlertTriangle, Target, Wrench, ArrowUpCircle, Shovel, Flame, Bone, Droplets, Boxes, Hexagon, Beef, BarChart3, X, Map as MapIcon, Move, ChevronDown, ChevronUp,
  Volume2, VolumeX, Fish, Crosshair, Sparkles, PackageCheck, ShieldAlert, Bell, UserCheck, CloudRain, ZoomIn, ZoomOut,
  Snowflake, Wind, Thermometer, ShieldCheck,
  Flower2, Apple, Carrot, Layers, Grid, Footprints, Leaf,
  Globe, Handshake, BookOpen,
} from "lucide-react";
import pVillager from "@/assets/portrait-villager.jpg";
import pWarrior from "@/assets/portrait-warrior.jpg";
import pRaider from "@/assets/portrait-raider.jpg";
import pElder from "@/assets/portrait-elder.jpg";
import { Game, type StoryEvent } from "@/game/engine";
import { AGES, BUILDINGS, MW, RANKS, RES_NAME, SUBCATS, T, UNITS, type Res, type ResKey } from "@/game/data";
import { MISSIONS } from "@/game/missions";
import { SLOTS, readMeta, readSave, writeSave } from "@/game/save";
import { audio } from "@/game/audio";
import { WEATHER_CONFIGS, type WeatherType } from "@/game/weather";
import { isAssetsReady, preloadGameAssets } from "@/game/render";
import { TechTreeModal } from "./TechTreeModal";
import { uiSpriteStyle, PAINTED_RES } from "../game/uiSprite";
import { DiplomacyModal } from "./DiplomacyModal";
import { MultiplayerModal } from "./MultiplayerModal";
import { IntroModal } from "./IntroModal";
import { testConnection, ensureAuthUser } from "@/lib/firebase";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  house: Home, farm: Wheat, fishery: Fish, lumber: Axe, quarry: Pickaxe, clayPit: Shovel,
  kiln: Flame, mine: Gem, well: Droplets, granary: Warehouse, stockpile: PackageCheck,
  workshop: Wrench, market: Store, shaman: Sparkles, temple: Landmark, forge: Hammer,
  barracks: Swords, range: Crosshair, armory: ShieldAlert, tower: TowerControl, wall: BrickWall,
  road: Route, townCenter: Castle, hunter: Bone,
  fence: Grid, totem: Sparkles, garden: Flower2, brazier: Flame, shrine_decor: Landmark,
  pasture: Footprints, orchard: Apple, vegGarden: Carrot, herbHut: Leaf,
};

const RES_ICON: Record<ResKey, React.ComponentType<{ className?: string }>> = {
  food: Wheat, wood: TreePine, stone: Mountain, gold: Coins, tools: Wrench, clay: Hexagon, bricks: Boxes, meat: Beef,
  herbs: Leaf, fruits: Apple, vegetables: Carrot, wool: Layers,
};

function Cost({ c }: { c: Partial<Res> }) {
  return (
    <span className="inline-flex flex-wrap gap-2 text-xs">
      {(Object.keys(c) as ResKey[]).map((k) => {
        const I = RES_ICON[k];
        return (
          <span key={k} className="inline-flex items-center gap-0.5 rounded bg-black/40 px-1 py-0.5 font-medium">
            <I className="h-3 w-3 text-primary" />
            <span>{c[k]}</span>
          </span>
        );
      })}
    </span>
  );
}

interface Cmd {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  img?: string;
  hot?: string;
  cost?: Partial<Res>;
  desc: string;
  disabled?: boolean;
  active?: boolean;
  run: () => void;
}

export function GameScreen({ game, slot, onExit }: { game: Game; slot: number; onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const floatMiniRef = useRef<HTMLCanvasElement>(null);
  const [subcat, setSubcat] = useState<string>("all");
  const [, tick] = useReducer((n: number) => n + 1, 0);
  const [story, setStory] = useState<StoryEvent | null>(null);
  const [tab, setTab] = useState<"eco" | "mil" | "civ">("eco");
  const [hoverCmd, setHoverCmd] = useState<Cmd | null>(null);
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [miniOpen, setMiniOpen] = useState(false);
  const [resOpen, setResOpen] = useState(false);
  const [missionOpen, setMissionOpen] = useState(false);
  const [deckCollapsed, setDeckCollapsed] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [audioSettings, setAudioSettings] = useState(audio.settings);
  const [weatherModalOpen, setWeatherModalOpen] = useState(false);
  const [techOpen, setTechOpen] = useState(false);
  const [diplomacyOpen, setDiplomacyOpen] = useState(false);
  const [multiplayerOpen, setMultiplayerOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(() => {
    try {
      return !localStorage.getItem("stone_age_intro_seen");
    } catch {
      return true;
    }
  });
  const [assetsReady, setAssetsReady] = useState(() => isAssetsReady());

  useEffect(() => {
    testConnection();
  }, []);
  const [uiScale, setUiScale] = useState<number>(() => {
    try {
      const s = localStorage.getItem("stone_age_ui_scale");
      return s ? parseFloat(s) : 0.75;
    } catch {
      return 0.75;
    }
  });

  useEffect(() => {
    if (!assetsReady) {
      preloadGameAssets().then(() => setAssetsReady(true));
    }
  }, [assetsReady]);

  const changeUiScale = (s: number) => {
    setUiScale(s);
    try {
      localStorage.setItem("stone_age_ui_scale", String(s));
    } catch {
      // ignore
    }
    audio.play("click");
  };
  const moveRef = useRef(false);
  moveRef.current = moveMode;
  const g = game;

  useEffect(() => {
    return audio.subscribe(() => setAudioSettings({ ...audio.settings }));
  }, []);

  const save = (s: number) => {
    writeSave(s, g.serialize(), { age: g.age, pop: g.pop(), mission: g.missionIndex, time: g.time });
    setToast(`Saved to slot ${s}`);
    setTimeout(() => setToast(""), 1800);
  };

  useEffect(() => {
    g.onStory = (e) => { setStory(e); g.paused = true; };
    if (g.time < 1 && g.missionIndex === 0) {
      const m = MISSIONS[0];
      g.onStory({ kind: "story", chapter: m.chapter, title: m.title, text: m.story });
    }
    const cv = canvasRef.current!;
    const ctx = cv.getContext("2d")!;
    let raf = 0, last = performance.now(), hudT = 0, autoT = 0, alive = true;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = window.innerWidth * dpr;
      cv.height = window.innerHeight * dpr;
      cv.style.width = window.innerWidth + "px";
      cv.style.height = window.innerHeight + "px";
      g.vw = window.innerWidth;
      g.vh = window.innerHeight;
    };
    resize();
    if (new URLSearchParams(window.location.search).has("debug")) {
      const el = document.createElement("div");
      el.style.cssText = "position:fixed;top:90px;right:10px;z-index:99999;background:#000d;color:#fff;font:11px monospace;padding:8px;border-radius:6px;line-height:1.7";
      document.body.appendChild(el);
      const jump = (e: Event) => {
        const t = e.target as HTMLElement;
        const d = t.dataset?.jump;
        if (!d) return;
        const [x, y] = d.split(",").map(Number);
        g.cam.x = Math.max(0, Math.min((MW - 1) * T, x - g.vw / 2 / g.zoom));
        g.cam.y = Math.max(0, Math.min((MW - 1) * T, y - g.vh / 2 / g.zoom));
      };
      el.addEventListener("click", jump);
      const iv = window.setInterval(() => {
        if (!document.body.contains(el)) { window.clearInterval(iv); return; }
        const camps = g.camps.filter((c) => c.alive).map((c) =>
          `${c.tribeId} <button data-jump="${Math.round(c.x)},${Math.round(c.y)}" style="color:#fc5">GO</button>`
        );
        const kinds: Record<string, number> = {};
        for (const a of g.animals) kinds[a.kind] = (kinds[a.kind] ?? 0) + 1;
        el.innerHTML = `CAMPS ALIVE: ${camps.length}<br>${camps.join("<br>")}<br>ANIMALS: ${JSON.stringify(kinds)}<br>NEXT RAID: ${Math.ceil(g.nextRaid)}s<br>TRIBES: ${g.tribes.map((t) => `${t.id.slice(0, 5)}:${t.relation}`).join(" ")}`;
      }, 4000);
    }
    const loop = (now: number) => {
      if (!alive) return;
      const dt = (now - last) / 1000;
      last = now;
      g.update(dt);
      if (isAssetsReady()) {
        g.render(ctx, Math.min(2, window.devicePixelRatio || 1));
      }
      hudT += dt;
      autoT += dt;
      if (hudT > 0.2) {
        hudT = 0;
        tick();
        if (miniRef.current) g.drawMinimap(miniRef.current);
        if (floatMiniRef.current) g.drawMinimap(floatMiniRef.current);
      }
      if (autoT > 60 && !g.paused && !g.over) {
        autoT = 0;
        writeSave(slot, g.serialize(), { age: g.age, pop: g.pop(), mission: g.missionIndex, time: g.time });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    let rightDown: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;
    let leftDown: { x: number; y: number; moved: boolean; shift: boolean } | null = null;
    let lastTouch = 0;
    const md = (e: MouseEvent) => {
      if (performance.now() - lastTouch < 800) return;
      if (e.button === 0) {
        if (g.placing) {
          g.clickAt(e.clientX, e.clientY, e.shiftKey);
        } else {
          leftDown = { x: e.clientX, y: e.clientY, moved: false, shift: e.shiftKey };
        }
      }
      if (e.button === 2 || e.button === 1) rightDown = { x: e.clientX, y: e.clientY, cx: g.cam.x, cy: g.cam.y, moved: false };
    };
    const mm = (e: MouseEvent) => {
      if (performance.now() - lastTouch < 800) return;
      g.edgePan = true;
      g.hover.x = e.clientX; g.hover.y = e.clientY; g.hover.sx = e.clientX; g.hover.sy = e.clientY;
      if (leftDown && !g.placing) {
        const dx = e.clientX - leftDown.x, dy = e.clientY - leftDown.y;
        if (Math.abs(dx) + Math.abs(dy) > 8) leftDown.moved = true;
        if (leftDown.moved) {
          g.dragBox = { startX: leftDown.x, startY: leftDown.y, currentX: e.clientX, currentY: e.clientY };
        }
      }
      if (rightDown) {
        const dx = e.clientX - rightDown.x, dy = e.clientY - rightDown.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) rightDown.moved = true;
        if (rightDown.moved) {
          g.cam.x = rightDown.cx - dx / g.zoom;
          g.cam.y = rightDown.cy - dy / g.zoom;
        }
      }
    };
    const mu = (e: MouseEvent) => {
      if (performance.now() - lastTouch < 800) return;
      if (e.button === 0) {
        if (g.placing) {
          g.releaseAt(e.clientX, e.clientY);
        } else if (leftDown) {
          if (leftDown.moved) {
            g.selectUnitsInBox(leftDown.x, leftDown.y, e.clientX, e.clientY, leftDown.shift);
          } else {
            g.clickAt(e.clientX, e.clientY, leftDown.shift);
          }
          g.dragBox = null;
          leftDown = null;
        }
      }
      if ((e.button === 2 || e.button === 1) && rightDown) {
        if (!rightDown.moved && e.button === 2) g.rightClick(e.clientX, e.clientY);
        rightDown = null;
      }
    };
    const leave = () => { g.hover.sx = -1; };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
      if (e.ctrlKey) {
        // Ctrl + wheel / trackpad pinch: zoom
        g.zoomAt(e.clientX, e.clientY, e.deltaY * k);
        return;
      }
      // Plain wheel / two-finger scroll: pan the map (natural direction)
      const spd = 1.35 / g.zoom;
      g.cam.x += (e.deltaX || 0) * k * spd;
      g.cam.y += e.deltaY * k * spd;
    };
    const ctxm = (e: Event) => e.preventDefault();

    // Touch handling
    const pts = new Map<number, { x: number; y: number }>();
    let tStart: { x: number; y: number; cx: number; cy: number; moved: boolean; t: number; drag: boolean } | null = null;
    let pinch = 0, lp: ReturnType<typeof setTimeout> | null = null;
    const hov = (x: number, y: number) => { g.hover.x = x; g.hover.y = y; g.hover.sx = x; g.hover.sy = y; };
    const pd = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      lastTouch = performance.now();
      g.edgePan = false;
      cv.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) {
        hov(e.clientX, e.clientY);
        const drag = !!(g.placing && BUILDINGS[g.placing].drag);
        if (drag) g.clickAt(e.clientX, e.clientY, false);
        tStart = { x: e.clientX, y: e.clientY, cx: g.cam.x, cy: g.cam.y, moved: false, t: performance.now(), drag };
        lp = setTimeout(() => {
          if (tStart && !tStart.moved && !tStart.drag) {
            g.rightClick(tStart.x, tStart.y);
            navigator.vibrate?.(20);
            tStart = null;
          }
        }, 550);
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
        tStart = null;
        if (lp) clearTimeout(lp);
        if (g.dragStart) g.dragStart = null;
      }
    };
    const pm = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || !pts.has(e.pointerId)) return;
      lastTouch = performance.now();
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0 && d > 0) g.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, -Math.log(d / pinch) / 0.0015);
        pinch = d;
        return;
      }
      if (!tStart) return;
      const dx = e.clientX - tStart.x, dy = e.clientY - tStart.y;
      if (!tStart.moved && Math.hypot(dx, dy) > 10) {
        tStart.moved = true;
        if (lp) clearTimeout(lp);
      }
      if (tStart.drag) {
        hov(e.clientX, e.clientY);
        return;
      }
      if (tStart.moved) {
        g.cam.x = tStart.cx - dx / g.zoom;
        g.cam.y = tStart.cy - dy / g.zoom;
      } else if (g.placing) {
        hov(e.clientX, e.clientY);
      }
    };
    const pu = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      lastTouch = performance.now();
      if (lp) clearTimeout(lp);
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = 0;
      if (!tStart) return;
      const s0 = tStart;
      tStart = null;
      if (s0.drag) { g.releaseAt(e.clientX, e.clientY); return; }
      if (s0.moved) return;
      hov(e.clientX, e.clientY);
      if (moveRef.current) {
        g.rightClick(e.clientX, e.clientY);
        setMoveMode(false);
        return;
      }
      g.clickAt(e.clientX, e.clientY, false);
    };
    cv.addEventListener("pointerdown", pd); cv.addEventListener("pointermove", pm);
    cv.addEventListener("pointerup", pu); cv.addEventListener("pointercancel", pu);
    cv.addEventListener("mousedown", md); window.addEventListener("mousemove", mm); window.addEventListener("mouseup", mu);
    cv.addEventListener("mouseleave", leave); cv.addEventListener("wheel", wheel, { passive: false }); cv.addEventListener("contextmenu", ctxm);
    window.addEventListener("resize", resize);
    return () => {
      alive = false; cancelAnimationFrame(raf);
      cv.removeEventListener("mousedown", md); window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu);
      cv.removeEventListener("pointerdown", pd); cv.removeEventListener("pointermove", pm); cv.removeEventListener("pointerup", pu); cv.removeEventListener("pointercancel", pu);
      cv.removeEventListener("mouseleave", leave); cv.removeEventListener("wheel", wheel); cv.removeEventListener("contextmenu", ctxm);
      window.removeEventListener("resize", resize);
    };
  }, [g, slot]);

  // Command generation
  const sel = g.selected;
  const selB = sel?.kind === "b" ? g.byId(sel.id) : undefined;
  const selU = sel?.kind === "u" ? g.unitById(sel.id) : undefined;
  const selA = sel?.kind === "a" ? g.animalById(sel.id) : undefined;
  const selC = sel?.kind === "c" ? g.camps.find((c) => c.alive && c.tribeId === g.selectedCampId) : undefined;
  const startPlace = (t: string) => { g.placing = t; g.selected = null; g.selectedUnits = []; };
  let cmds: Cmd[] = [];

  // Group Multi-Unit commands
  if (g.selectedUnits.length > 1) {
    cmds = [
      {
        id: "mv",
        label: "Move Formation",
        icon: Move,
        hot: "M",
        desc: "Right-click or tap destination to march group in formation (units maintain spacing).",
        active: moveMode,
        run: () => setMoveMode((m) => !m),
      },
      {
        id: "patrol",
        label: "Patrol",
        icon: Shield,
        desc: "Autonomous perimeter patrol: units scout around this area and intercept hostiles.",
        run: () => g.setStanceForSelected("patrol"),
      },
      {
        id: "guard",
        label: "Guard Ground",
        icon: ShieldCheck,
        desc: "Hold position firmly: units defend immediate ground and do not wander.",
        run: () => g.setStanceForSelected("guard"),
      },
      {
        id: "aggressive",
        label: "Aggressive",
        icon: Swords,
        desc: "Aggressive posture: units detect and pursue raiders or wildlife over a wide area.",
        run: () => g.setStanceForSelected("aggressive"),
      },
      {
        id: "army",
        label: "Select Entire Army",
        icon: Swords,
        desc: "Select all warrior, archer, and chieftain units across the territory.",
        run: () => g.selectAllMilitary(),
      },
      {
        id: "clear_sel",
        label: "Deselect",
        icon: X,
        desc: "Clear unit selection.",
        run: () => { g.selectedUnits = []; g.selected = null; },
      },
    ];
  } else if (selB && selB.progress >= 1 && selB.type === "townCenter") {
    cmds = [
      { id: "v", label: "Train Villager", icon: User, hot: "V", cost: UNITS.villager.cost, desc: `Trains a worker (${UNITS.villager.time}s).`, run: () => g.train(selB.id, "villager") },
      ...(g.age < 2 ? [{ id: "age", label: `Advance to ${AGES[g.age + 1].name}`, icon: Crown, hot: "U", cost: AGES[g.age + 1].cost, desc: "Unlocks advanced epoch structures, units, and bonuses (30s).", disabled: g.ageProgress >= 0, run: () => g.advanceAge() }] : []),
      {
        id: "barter",
        label: "Barter for Meat",
        icon: Beef,
        desc: "Trade 35 Food, 25 Fruits, or 25 Vegetables for +20 Meat from passing nomad traders.",
        run: () => g.barterMeat(),
      },
      {
        id: "rally",
        label: selB.rallyPoint ? "Move Rally Flag" : "Set Rally Point",
        icon: Flag,
        desc: "Set arrival rally point for newly trained villagers (or right-click anywhere on the map).",
        run: () => {
          g.rallyTargetBuildingId = selB.id;
          g.msg("Click anywhere on the map to place the Rally Point flag", "info");
        },
      },
      ...(selB.rallyPoint ? [{
        id: "clear_rally",
        label: "Clear Rally Flag",
        icon: X,
        desc: "Remove rally point so new units spawn locally.",
        run: () => g.clearRallyPoint(selB.id),
      }] : []),
      { id: "alarm", label: "Town Bell Alarm", icon: Bell, hot: "B", desc: "Sound the central alarm! Villagers take shelter and militia stands ready.", run: () => g.soundAlarm() },
      { id: "idle", label: "Find Idle Worker", icon: UserCheck, hot: ".", desc: `Focus on an idle villager seeking orders (${g.idleVillagers().length} idle).`, run: () => g.selectNextIdleVillager() },
    ];
  } else if (selB && selB.progress >= 1 && selB.type === "barracks") {
    cmds = [
      { id: "s", label: "Train Spear Warrior", icon: Shield, hot: "V", cost: UNITS.soldier.cost, desc: `Fearless melee tribal warrior (${UNITS.soldier.time}s).`, run: () => g.train(selB.id, "soldier") },
      ...(g.age >= 1 ? [{ id: "chieftain", label: "Train War Chieftain", icon: Crown, hot: "C", cost: UNITS.chieftain.cost, desc: `Heroic commander with battle aura (+35% combat efficiency to nearby warriors, ${UNITS.chieftain.time}s).`, run: () => g.train(selB.id, "chieftain") }] : []),
      {
        id: "rally",
        label: selB.rallyPoint ? "Move Rally Flag" : "Set Rally Point",
        icon: Flag,
        desc: "Newly trained warriors march directly to this rally flag (or right-click map).",
        run: () => {
          g.rallyTargetBuildingId = selB.id;
          g.msg("Click anywhere on the map to place the Rally Point flag", "info");
        },
      },
      ...(selB.rallyPoint ? [{
        id: "clear_rally",
        label: "Clear Rally Flag",
        icon: X,
        desc: "Remove rally point.",
        run: () => g.clearRallyPoint(selB.id),
      }] : []),
    ];
  } else if (selB && selB.progress >= 1 && selB.type === "range") {
    cmds = [
      { id: "archer", label: "Train Tribal Archer", icon: Crosshair, hot: "V", cost: UNITS.archer.cost, desc: `Ranged bow hunter that strikes raiders from a safe distance (${UNITS.archer.time}s).`, run: () => g.train(selB.id, "archer") },
      {
        id: "rally",
        label: selB.rallyPoint ? "Move Rally Flag" : "Set Rally Point",
        icon: Flag,
        desc: "Newly trained archers march directly to this rally flag (or right-click map).",
        run: () => {
          g.rallyTargetBuildingId = selB.id;
          g.msg("Click anywhere on the map to place the Rally Point flag", "info");
        },
      },
      ...(selB.rallyPoint ? [{
        id: "clear_rally",
        label: "Clear Rally Flag",
        icon: X,
        desc: "Remove rally point.",
        run: () => g.clearRallyPoint(selB.id),
      }] : []),
    ];
  } else if (selB && selB.progress >= 1 && selB.type === "shaman") {
    cmds = [
      { id: "bless", label: "Sanctuary Blessing", icon: Sparkles, hot: "B", desc: "Ancestral spirits heal tribe units (+5.5 HP/s nearby) and ward against disasters.", run: () => { g.puff(g.center(selB).x, g.center(selB).y, 30, "spark"); g.msg("Ancestral spirits bless the sanctuary", "good"); audio.play("rankup"); } },
    ];
  } else if (selA) {
    cmds = [
      {
        id: "interact",
        label: selA.domestic ? "Pet Animal" : "Track Animal",
        icon: Footprints,
        desc: selA.domestic
          ? `${selA.name} is peaceful and domesticated. Produces resources periodically.`
          : `Wild ${selA.kind} (${selA.state}). Natural wildlife roaming the wilderness. Right-click with military units to hunt for meat!`,
        run: () => {
          if (selA.domestic) {
            g.msg(`${selA.name} nudges your hand gently.`, "good");
            audio.play("harvest");
          } else {
            g.msg(`Observing wild ${selA.kind} (${selA.state}). Right-click with warriors to hunt!`, "info");
            audio.play("click");
          }
        },
      },
    ];
  } else {
    cmds = Object.entries(BUILDINGS).filter(([k, d]) => d.cat === tab && k !== "townCenter" && (subcat === "all" || d.subcat === subcat)).map(([k, d]) => ({
      id: k, label: d.name, icon: ICONS[k] ?? Home, hot: d.key, cost: d.cost, desc: d.age > g.age ? `${d.desc} Requires ${AGES[d.age].name}.` : d.desc,
      disabled: d.age > g.age, active: g.placing === k, run: () => startPlace(k),
    }));
  }

  if (selB && selB.progress >= 1) {
    if (selB.type === "pasture") {
      cmds.push({
        id: "butcher",
        label: "Butcher Livestock",
        icon: Beef,
        desc: "Harvest an animal for an immediate +22-30 Meat lump sum. A young replacement animal respawns automatically.",
        run: () => g.butcherLivestock(selB.id),
      });
    }
    if (selB.type === "market") {
      cmds.push({
        id: "barter",
        label: "Barter Provisions",
        icon: Beef,
        desc: "Trade 35 Food, 25 Fruits, or 25 Vegetables for +20 Meat from merchants.",
        run: () => g.barterMeat(),
      });
    }
    const tiers = BUILDINGS[selB.type].tiers;
    if (tiers && selB.level < tiers.length) {
      const nx = tiers[selB.level];
      cmds.push({ id: "up", label: `Upgrade to ${nx.name}`, icon: ArrowUpCircle, hot: "U", cost: nx.cost, desc: `Tier ${selB.level + 1}: higher capacity, production and durability.${selB.level >= 2 && g.age < 1 ? " Requires Bronze Age." : ""}`, disabled: selB.level >= 2 && g.age < 1, run: () => g.upgrade(selB.id) });
    }
    if (selB.type === "fence" && BUILDINGS.fence.tiers && selB.level < BUILDINGS.fence.tiers.length) {
      const nx = BUILDINGS.fence.tiers[selB.level];
      cmds.push({
        id: "up_all",
        label: `Upgrade Connected`,
        icon: ArrowUpCircle,
        cost: nx.cost,
        desc: `Upgrade this fence and all touching adjacent fence segments to ${nx.name}.`,
        disabled: selB.level >= 2 && g.age < 1,
        run: () => g.upgradeConnectedFences(selB.id),
      });
    }
  }

  if (selU && selU.kind !== "raider" && g.selectedUnits.length <= 1) {
    if (selU.kind === "soldier" || selU.kind === "archer" || selU.kind === "chieftain") {
      cmds = [
        { id: "mv", label: "Move Order", icon: Move, hot: "M", desc: "March unit to tile (or right-click ground / right-click animal to hunt).", active: moveMode, run: () => setMoveMode((m) => !m) },
        { id: "patrol", label: "Patrol", icon: Shield, img: "stance_patrol", active: selU.stance === "patrol", desc: "Autonomous perimeter patrol around this anchor point.", run: () => { g.selectedUnits = [selU.id]; g.setStanceForSelected("patrol"); } },
        { id: "guard", label: "Guard Ground", icon: ShieldCheck, img: "stance_guard", active: selU.stance === "guard", desc: "Hold position firmly and strictly guard immediate ground.", run: () => { g.selectedUnits = [selU.id]; g.setStanceForSelected("guard"); } },
        { id: "aggressive", label: "Aggressive", icon: Swords, img: "stance_aggr", active: selU.stance === "aggressive", desc: "Pursue and strike any raiders or animals across range.", run: () => { g.selectedUnits = [selU.id]; g.setStanceForSelected("aggressive"); } },
        { id: "army", label: "Select Army", icon: Swords, desc: "Select all defenders across your realm.", run: () => g.selectAllMilitary() },
      ];
    } else {
      cmds = [
        { id: "mv", label: "Move Order", icon: Move, hot: "M", desc: "Click/tap any tile to march this unit there (or right-click).", active: moveMode, run: () => setMoveMode((m) => !m) },
        { id: "idle_all", label: "Select Idles", icon: UserCheck, desc: "Select all idle workers without tasks.", run: () => g.selectAllIdleVillagers() },
      ];
    }
  }

  if (selB && selB.type !== "townCenter") {
    cmds.push({ id: "del", label: "Demolish", icon: Trash2, hot: "Delete", desc: "Clear this structure.", run: () => { g.demolish(selB.id); } });
  }

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (story || menu) return;
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) g.keys.add(k);
      if (k === "escape") { if (g.placing) g.placing = null; else if (g.selected) g.selected = null; else setMenu(true); }
      if (k === " ") {
        const tc = g.tc();
        if (tc) { const c = g.center(tc); g.cam.x = c.x - g.vw / 2 / g.zoom; g.cam.y = c.y - g.vh / 2 / g.zoom; }
        e.preventDefault();
      }
      if (k === "p") g.paused = !g.paused;
      if (k === ".") g.selectNextIdleVillager();
      if (["w", "a", "s", "d"].includes(k)) return;
      const c = cmds.find((c) => c.hot?.toLowerCase() === k);
      if (c && !c.disabled) { c.run(); return; }
      const bk = Object.keys(BUILDINGS).find((t) => BUILDINGS[t].key.toLowerCase() === k);
      if (bk && BUILDINGS[bk].age <= g.age) { setTab(BUILDINGS[bk].cat); startPlace(bk); }
      if (k === "delete") cmds.find((c) => c.id === "del")?.run();
    };
    const ku = (e: KeyboardEvent) => g.keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  });

  const mission = MISSIONS[g.missionIndex];
  const [mp, mt] = mission ? mission.progress(g) : [1, 1];
  const night = g.isNight();
  const tip = hoverCmd;
  const placingDef = g.placing ? BUILDINGS[g.placing] : null;
  const idleCount = g.idleVillagers().length;

  const centerOnTown = () => {
    const tc = g.tc();
    if (tc) {
      const c = g.center(tc);
      g.cam.x = c.x - g.vw / 2 / g.zoom;
      g.cam.y = c.y - g.vh / 2 / g.zoom;
    }
  };

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-background text-foreground font-sans">
      <canvas ref={canvasRef} style={{ touchAction: "none" }} className={`absolute inset-0 ${g.placing ? "cursor-crosshair" : "cursor-default"}`} />

      {/* Asset Preloading Veil: ensures the canvas is never seen until sprites are 100% ready */}
      {!assetsReady && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#151210] text-[#f2ede6]">
          <div className="flex flex-col items-center gap-3">
            <Castle className="h-10 w-10 text-primary drop-shadow-[0_0_15px_rgba(234,179,8,0.5)] animate-pulse" />
            <span className="font-display text-xs sm:text-sm tracking-[0.25em] uppercase bronze-text">
              Entering The Valley...
            </span>
          </div>
        </div>
      )}

      
      {/* Floating Strategic Radar Minimap Modal (Quick Action) */}
      {miniOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 pointer-events-auto">
          {/* Backdrop: tap anywhere to close */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => { setMiniOpen(false); audio.play("click"); }}
          />
          {/* Modal Container */}
          <div className="hud-panel relative z-10 flex flex-col rounded-lg p-3 sm:p-4 shadow-2xl border-primary/70 bg-background/95 max-w-[min(22rem,92vw)] animate-in fade-in zoom-in-95 duration-150">
            {/* Header with Title and Prominent Close Button */}
            <div className="mb-2 flex items-center justify-between border-b border-hud-edge/60 pb-1.5">
              <div className="flex items-center gap-1.5">
                <MapIcon className="h-4 w-4 text-primary" />
                <span className="font-display text-xs sm:text-sm font-bold tracking-wider bronze-text">
                  STRATEGIC RADAR
                </span>
              </div>
              <button
                onClick={() => { setMiniOpen(false); audio.play("click"); }}
                aria-label="Close Strategic Map"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive/20 text-destructive border border-destructive/50 hover:bg-destructive hover:text-white transition-colors"
                title="Close Map"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Minimap Canvas */}
            <div className="relative mx-auto">
              <canvas
                ref={floatMiniRef}
                width={MW}
                height={MW}
                className="h-56 w-56 sm:h-60 sm:w-60 cursor-crosshair rounded border border-hud-edge [image-rendering:pixelated]"
                onMouseDown={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const mx = ((e.clientX - r.left) / r.width) * MW;
                  const my = ((e.clientY - r.top) / r.height) * MW;
                  g.cam.x = mx * T - g.vw / 2 / g.zoom;
                  g.cam.y = my * T - g.vh / 2 / g.zoom;
                }}
                onTouchStart={(e) => {
                  if (e.touches[0]) {
                    const r = e.currentTarget.getBoundingClientRect();
                    const mx = ((e.touches[0].clientX - r.left) / r.width) * MW;
                    const my = ((e.touches[0].clientY - r.top) / r.height) * MW;
                    g.cam.x = mx * T - g.vw / 2 / g.zoom;
                    g.cam.y = my * T - g.vh / 2 / g.zoom;
                  }
                }}
                onTouchMove={(e) => {
                  if (e.touches[0]) {
                    const r = e.currentTarget.getBoundingClientRect();
                    const mx = ((e.touches[0].clientX - r.left) / r.width) * MW;
                    const my = ((e.touches[0].clientY - r.top) / r.height) * MW;
                    g.cam.x = mx * T - g.vw / 2 / g.zoom;
                    g.cam.y = my * T - g.vh / 2 / g.zoom;
                  }
                }}
              />
            </div>

            {/* View Navigation Buttons */}
            <div className="mt-2.5 flex items-center justify-between gap-1.5">
              <button
                onClick={() => { centerOnTown(); audio.play("click"); }}
                className="bronze-btn flex flex-1 items-center justify-center gap-1 rounded py-1 text-xs font-display text-primary"
              >
                <Castle className="h-3.5 w-3.5" />
                <span>Center Capital</span>
              </button>
              <button
                onClick={() => g.zoomAt(g.vw / 2, g.vh / 2, -200)}
                title="Zoom In"
                className="bronze-btn flex h-7 w-7 items-center justify-center rounded text-primary"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                onClick={() => g.zoomAt(g.vw / 2, g.vh / 2, 200)}
                title="Zoom Out"
                className="bronze-btn flex h-7 w-7 items-center justify-center rounded text-primary"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
            </div>

            {/* Explicit Close Button */}
            <button
              onClick={() => { setMiniOpen(false); audio.play("click"); }}
              className="mt-2 w-full bronze-btn rounded py-1.5 text-center font-display text-xs text-muted-foreground hover:text-foreground"
            >
              Close Strategic Radar
            </button>
          </div>
        </div>
      )}

      {/* Scaled HUD Layer (Shrunk by 25% by default: 0.75 scale for maximum playfield view) */}
      <div
        className="hud-ui-layer pointer-events-none absolute left-0 top-0 overflow-hidden"
        style={{
          width: `${100 / uiScale}%`,
          height: `${100 / uiScale}%`,
          transform: `scale(${uiScale})`,
          transformOrigin: "top left",
        }}
      >
        <header className="hud-panel pointer-events-auto absolute inset-x-0 top-0 z-20 flex h-10 sm:h-12 items-center justify-between border-x-0 border-t-0 px-1.5 sm:px-4 shadow-xl">
        {/* Left: Empire Earth 3 Crest & Epoch laurel */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button
            onClick={centerOnTown}
            title="Center on Capital (Space)"
            className="flex items-center gap-1 cursor-pointer rounded p-1 hover:bg-black/30 transition-colors"
          >
            <PSprite name={["age_stone", "age_bronze", "age_iron"][g.age] ?? "age_stone"} w={26} />
            <div className="hidden sm:flex flex-col text-left">
              <span className="font-display text-xs font-bold tracking-widest bronze-text leading-tight">STONE AGE</span>
              <span className="text-[10px] text-muted-foreground tracking-wider uppercase">{AGES[g.age].name}</span>
            </div>
          </button>

          {/* Age advancement progress gauge */}
          {g.ageProgress >= 0 && (
            <div className="flex items-center gap-1 rounded bg-black/40 px-1.5 py-0.5 border border-hud-edge">
              <Crown className="h-3 w-3 text-warning animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[8px] sm:text-[9px] font-bold text-warning uppercase truncate max-w-[70px] sm:max-w-none">
                  {AGES[g.age + 1]?.name}
                </span>
                <div className="h-1 w-12 sm:w-20 overflow-hidden rounded bg-black/60">
                  <div className="h-full bg-warning transition-all" style={{ width: `${g.ageProgress * 100}%` }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Center: Live Resource Stream (Primary 4 on mobile, all on tablet/desktop) */}
        <div className="flex min-w-0 flex-1 items-center justify-start md:justify-center gap-1 sm:gap-2 overflow-x-auto px-1 [scrollbar-width:none]">
          {(Object.keys(RES_NAME) as ResKey[]).map((k) => {
            const isPrimary = k === "food" || k === "wood" || k === "stone" || k === "gold";
            const I = RES_ICON[k];
            const painted = PAINTED_RES[k];
            const rt = Math.round(g.rate[k]);
            const sh = g.short.has(k);
            return (
              <button
                key={k}
                onClick={() => setResOpen((o) => !o)}
                title={`${RES_NAME[k]}: ${Math.floor(g.res[k])} (${rt >= 0 ? "+" : ""}${rt}/min)`}
                className={`flex shrink-0 items-center gap-0.5 sm:gap-1 rounded border px-1 sm:px-1.5 py-0.5 text-xs font-semibold transition-all ${
                  !isPrimary ? "hidden md:flex" : ""
                } ${
                  sh
                    ? "border-destructive bg-destructive/25 text-destructive animate-pulse"
                    : "border-hud-edge/50 bg-black/35 hover:bg-black/60 hover:border-primary/60"
                }`}
              >
                {painted ? <PSprite name={painted} w={14} /> : <I className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${sh ? "text-destructive" : "text-primary"}`} />}
                <span className="font-mono text-[11px] sm:text-xs">{Math.floor(g.res[k])}</span>
                {rt !== 0 && (
                  <span className={`hidden sm:inline text-[9px] sm:text-[10px] font-mono ${rt > 0 ? "text-success font-bold" : "text-destructive"}`}>
                    {rt > 0 ? "+" : ""}{rt}
                  </span>
                )}
              </button>
            );
          })}

          {/* More resources indicator badge for mobile */}
          <button
            onClick={() => setResOpen((o) => !o)}
            title="Open Stockpile Ledger"
            className="flex md:hidden shrink-0 items-center gap-0.5 rounded border border-hud-edge/40 bg-black/30 px-1 py-0.5 text-[10px] font-mono text-muted-foreground hover:text-primary"
          >
            <Boxes className="h-3 w-3 text-primary/70" />
            <span>+{Math.max(0, (Object.keys(g.res) as ResKey[]).length - 4)}</span>
          </button>

          {/* Population meter */}
          <div
            title={`Tribe Population: ${g.pop()} / ${g.popCap()} capacity`}
            className={`flex shrink-0 items-center gap-1 rounded border border-hud-edge/50 bg-black/40 px-1.5 py-0.5 text-[11px] sm:text-xs font-semibold ${
              g.pop() >= g.popCap() ? "border-destructive text-destructive animate-pulse" : "text-foreground"
            }`}
          >
            <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />
            <span className="font-mono">{g.pop()}/{g.popCap()}</span>
          </div>
        </div>

        {/* Right: EE3 Tactical Controls (Idle, Alarm, Speed, Audio, Menu) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Quick Idle Villager selector */}
          <button
            onClick={() => { g.selectNextIdleVillager(); audio.play("click"); }}
            title={`Idle Villagers (${idleCount}). Press [.] to select.`}
            className={`bronze-btn relative flex h-7 sm:h-8 items-center gap-1 rounded px-1.5 sm:px-2 text-xs font-display ${
              idleCount > 0 ? "border-warning text-warning bg-warning/15 shadow-[0_0_8px_rgba(234,179,8,0.3)]" : "text-muted-foreground"
            }`}
          >
            <UserCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span className="hidden sm:inline">Idle</span>
            {idleCount > 0 && (
              <span className="rounded-full bg-warning px-1 font-mono text-[9px] font-black text-black">
                {idleCount}
              </span>
            )}
          </button>

          {/* Quick Town Bell Alarm */}
          <button
            onClick={() => g.soundAlarm()}
            title={g.alarmActive ? `Town Bell Alarm Active (${g.shelteredVillagersCount()} sheltered). Click to sound all-clear.` : "Sound Town Bell Alarm: recalls villagers to take shelter inside the Town Hall"}
            className={`bronze-btn flex h-7 sm:h-8 items-center gap-1 rounded px-1.5 sm:px-2 text-xs font-display transition-all ${
              g.alarmActive
                ? "border-destructive bg-destructive/30 text-destructive animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                : "text-primary hover:text-warning"
            }`}
          >
            {g.alarmActive ? <ShieldAlert className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-destructive" /> : <Bell className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
            <span className="hidden sm:inline">{g.alarmActive ? `Shelter (${g.shelteredVillagersCount()})` : "Alarm"}</span>
          </button>

          {/* Tech Tree Modal Trigger */}
          <button
            onClick={() => { setTechOpen(true); audio.play("click"); }}
            title="Civilization Tech Tree & Tier Research"
            className="bronze-btn flex h-7 sm:h-8 items-center gap-1 rounded px-1.5 sm:px-2 text-xs font-display text-primary hover:text-foreground"
          >
            <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-300" />
            <span className="hidden xl:inline">Tech</span>
          </button>

          {/* Rival Tribes & Diplomacy Trigger */}
          <button
            onClick={() => { setDiplomacyOpen(true); audio.play("click"); }}
            title="Rival Tribes & Diplomacy: tributes, trade pacts & alliances"
            className="bronze-btn flex h-7 sm:h-8 items-center gap-1 rounded px-1.5 sm:px-2 text-xs font-display text-primary hover:text-foreground"
          >
            <Handshake className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-400" />
            <span className="hidden xl:inline">Tribes</span>
          </button>

          {/* Multiplayer & Cloud Leaderboard Trigger */}
          <button
            onClick={() => { setMultiplayerOpen(true); audio.play("click"); }}
            title="Online Lobbies, Leaderboards & Cloud Sync"
            className="bronze-btn flex h-7 sm:h-8 items-center gap-1 rounded px-1.5 sm:px-2 text-xs font-display text-primary hover:text-foreground"
          >
            <Globe className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-sky-400" />
            <span className="hidden xl:inline">Online</span>
          </button>

          {/* Lore & Survival Guide Trigger */}
          <button
            onClick={() => { setIntroOpen(true); audio.play("click"); }}
            title="Valley Lore & Survival Guide"
            className="bronze-btn flex h-7 sm:h-8 items-center gap-1 rounded px-1.5 sm:px-2 text-xs font-display text-primary hover:text-foreground"
          >
            <BookOpen className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-200" />
          </button>

          {/* Dynamic Weather & Climate Indicator */}
          {(() => {
            const currentW = g.weatherSystem.current;
            const wMeta = WEATHER_CONFIGS[currentW];
            return (
              <button
                onClick={() => { setWeatherModalOpen(true); audio.play("click"); }}
                title={`Climate: ${wMeta.name} (${Math.ceil(g.weatherSystem.timer)}s left). Tap for survival breakdown & forecast.`}
                className={`flex h-7 sm:h-8 items-center gap-1 sm:gap-1.5 rounded border px-1.5 sm:px-2.5 text-xs font-display transition-all hover:brightness-125 active:scale-95 cursor-pointer shadow-sm ${wMeta.badgeBg}`}
              >
                {currentW === "rain" ? (
                  <CloudRain className="h-3.5 w-3.5 text-sky-300 animate-bounce" />
                ) : currentW === "snow" ? (
                  <Snowflake className="h-3.5 w-3.5 text-sky-100 animate-spin" style={{ animationDuration: "8s" }} />
                ) : currentW === "ash_storm" ? (
                  <Flame className="h-3.5 w-3.5 text-orange-400 animate-pulse" />
                ) : night ? (
                  <Moon className="h-3.5 w-3.5 text-sky-300" />
                ) : (
                  <Sun className="h-3.5 w-3.5 text-amber-300" />
                )}
                <span className="hidden md:inline font-semibold tracking-wide">{wMeta.name}</span>
                <span className="font-mono text-[10px] sm:text-[11px] font-bold opacity-85">
                  {Math.ceil(g.weatherSystem.timer)}s
                </span>
              </button>
            );
          })()}

          {/* Audio toggle - hidden on small mobile, accessible via Menu */}
          <div className="hidden sm:block">
            <IconBtn label={audioSettings.muted ? "Unmute Audio" : "Mute Audio"} onClick={() => { audio.toggleMute(); audio.play("click"); }}>
              {audioSettings.muted ? <VolumeX className="h-3.5 w-3.5 text-destructive" /> : <Volume2 className="h-3.5 w-3.5" />}
            </IconBtn>
          </div>

          {/* Pause */}
          <IconBtn label={g.paused ? "Resume" : "Pause"} onClick={() => { g.paused = !g.paused; audio.play("click"); }}>
            {g.paused ? <Play className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <Pause className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
          </IconBtn>

          {/* Speed */}
          <IconBtn label="Game Speed" onClick={() => { g.speed = g.speed === 1 ? 2 : g.speed === 2 ? 3 : 1; audio.play("click"); }}>
            <span className="font-mono text-[10px] sm:text-[11px] font-bold text-primary">{g.speed}x</span>
          </IconBtn>

          {/* Menu */}
          <IconBtn label="Settings & Save Menu" onClick={() => { setMenu(true); g.paused = true; audio.play("click"); }}>
            <Menu className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </IconBtn>
        </div>
      </header>

      {/* =========================================================================
          SIMCITY DETAILED STOCKPILE & PRODUCTION COMMERCE LEDGER MODAL
          ========================================================================= */}
      {resOpen && (
        <div className="hud-panel pointer-events-auto absolute right-2 top-14 z-30 w-[min(26rem,calc(100vw-1rem))] rounded-md p-3.5 shadow-2xl">
          <div className="mb-2.5 flex items-center justify-between border-b border-hud-edge pb-2">
            <span className="flex items-center gap-2 font-display text-sm font-bold text-primary">
              <BarChart3 className="h-4 w-4" />
              Tribal Stockpile & Flow Ledger
            </span>
            <button aria-label="Close" onClick={() => setResOpen(false)}>
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(RES_NAME) as ResKey[]).map((k) => {
              const I = RES_ICON[k];
              const rt = Math.round(g.rate[k]);
              const sh = g.short.has(k);
              const prod = g.buildings.filter((b) => b.progress >= 1 && BUILDINGS[b.type].produce === k).length;
              return (
                <div
                  key={k}
                  className={`flex items-center gap-2 rounded border px-2.5 py-1.5 text-xs transition-colors ${
                    sh ? "border-destructive bg-destructive/20 text-destructive" : "border-hud-edge/60 bg-black/40"
                  }`}
                >
                  <I className={`h-4 w-4 shrink-0 ${sh ? "text-destructive" : "text-primary"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-1">
                      <span className="truncate font-semibold">{RES_NAME[k]}</span>
                      <b className="font-mono text-foreground">{Math.floor(g.res[k])}</b>
                    </div>
                    <div className="flex justify-between gap-1 text-[10px] text-muted-foreground">
                      <span className={rt > 0 ? "text-success font-bold" : rt < 0 ? "text-destructive font-bold" : ""}>
                        {rt > 0 ? "+" : ""}{rt}/min
                      </span>
                      <span>{prod} sites{sh ? " · SHORTAGE" : ""}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Buildings requiring attention */}
          {(() => {
            const al = g.buildings.filter((b) => b.alert);
            return al.length > 0 && (
              <div className="mt-3 border-t border-hud-edge/50 pt-2">
                <div className="mb-1.5 flex items-center gap-1 font-display text-[11px] font-bold tracking-widest text-warning">
                  <AlertTriangle className="h-3 w-3" />
                  REQUIRES CITIZEN ATTENTION ({al.length})
                </div>
                <div className="flex max-h-36 flex-col gap-1 overflow-y-auto">
                  {al.slice(0, 10).map((b) => {
                    const a = b.alert!;
                    return (
                      <button
                        key={b.id}
                        className="flex items-center gap-2 rounded bg-black/40 px-2 py-1 text-left text-xs hover:bg-black/70 border border-transparent hover:border-hud-edge"
                        onClick={() => {
                          const c = g.center(b);
                          g.cam.x = c.x - g.vw / 2 / g.zoom;
                          g.cam.y = c.y - g.vh / 2 / g.zoom;
                          g.selected = { kind: "b", id: b.id };
                          setResOpen(false);
                        }}
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${a.kind === "input" ? "bg-destructive animate-ping" : a.kind === "idle" ? "bg-warning" : "bg-muted-foreground"}`} />
                        <span className="truncate">
                          {g.tierName(b)}: {a.kind === "input" ? `Needs ${RES_NAME[a.res!]}` : a.kind === "idle" ? "No workers assigned" : `No nearby ${a.res ? RES_NAME[a.res] : "resources"}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          <div className="mt-2.5 text-[10px] text-muted-foreground leading-tight">
            Tip: Build Granaries near farms & hunters; place Stockpiles near mines & lumber mills for faster hauling.
          </div>
        </div>
      )}


      {/* =========================================================================
          MISSION / OBJECTIVE DOSSIER (COMPACT & COLLAPSIBLE ON MOBILE)
          ========================================================================= */}
      {mission && (
        <div className="hud-panel pointer-events-auto absolute left-1.5 top-11 sm:left-3 sm:top-14 z-10 w-[min(18rem,calc(100vw-4.5rem))] sm:w-[min(19rem,calc(100vw-1rem))] rounded-md p-1.5 sm:p-2.5 shadow-lg border-primary/40">
          <button className="flex w-full items-center gap-1.5 text-left" onClick={() => setMissionOpen((o) => !o)} aria-label="Toggle mission">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 font-display text-[9px] sm:text-[10px] font-bold tracking-widest text-primary">
                <Flag className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0 text-accent" />
                <span className="truncate uppercase">{mission.chapter}</span>
                {!missionOpen && (
                  <span className="text-muted-foreground font-mono text-[9px] ml-auto pr-1">
                    {Math.round((mp / mt) * 100)}%
                  </span>
                )}
              </span>
              <span className="block truncate font-display text-xs sm:text-sm text-foreground font-bold leading-tight">{mission.title}</span>
            </span>
            {missionOpen ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          </button>
          {missionOpen && (
            <div className="mt-1.5 flex items-start gap-1 text-[11px] sm:text-xs text-muted-foreground leading-snug">
              <Target className="h-3 w-3 shrink-0 text-accent mt-0.5" />
              <span>{mission.goal}</span>
            </div>
          )}
          <div className="mt-1.5 h-1 sm:h-1.5 overflow-hidden rounded bg-black/60 border border-hud-edge/40">
            <div className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300" style={{ width: `${Math.min(100, (mp / mt) * 100)}%` }} />
          </div>
          {missionOpen && (
            <div className="mt-1 flex justify-between gap-2 text-[10px] sm:text-xs font-mono text-muted-foreground">
              <span>{Math.floor(mp)} / {mt}</span>
              <span className="truncate font-sans">Reward: <Cost c={mission.reward} /></span>
            </div>
          )}
        </div>
      )}

      {/* Active Notifications & Tickers */}
      <div className={`pointer-events-none absolute left-1.5 z-10 flex max-w-[260px] sm:max-w-xs flex-col gap-1 sm:left-3 transition-all duration-200 ${missionOpen ? "top-34 sm:top-48" : "top-21 sm:top-28"}`}>
        {g.messages.filter((m) => g.time - m.t < 8).slice(0, g.vw < 640 ? 2 : 4).map((m) => (
          <div
            key={m.id}
            className={`rounded border px-2 py-0.5 text-[11px] shadow-md backdrop-blur-sm sm:text-xs font-medium leading-tight ${
              m.type === "bad"
                ? "border-destructive/80 bg-destructive/30 text-destructive-foreground"
                : m.type === "good"
                ? "border-success/80 bg-success/20 text-success"
                : m.type === "warn"
                ? "border-warning/80 bg-warning/25 text-warning"
                : "border-hud-edge bg-background/85 text-foreground"
            }`}
          >
            {m.text}
          </div>
        ))}
      </div>

      {/* Cataclysm / Disaster Banners */}
      {g.disasterBanner && (
        <div className="pointer-events-none absolute left-1/2 top-16 sm:top-20 z-20 -translate-x-1/2 text-center">
          <div className="font-display text-xl sm:text-4xl font-black tracking-[0.25em] text-accent drop-shadow-[0_5px_15px_rgba(239,68,68,0.8)] animate-pulse">
            {g.disasterBanner}
          </div>
        </div>
      )}
      {(g.raidWarn > 0 || g.raidActive) && (
        <div className="pointer-events-none absolute left-1/2 top-11 sm:top-14 z-30 -translate-x-1/2 animate-pulse">
          <div className="relative flex items-center justify-center">
            <PSprite name="ui_raid_banner" w={280} />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pt-2">
              <span className="font-display text-xs sm:text-sm font-black tracking-widest text-red-50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                {g.raidActive ? `RAID WAVE ${g.raidWave}` : "RAID INBOUND"}
              </span>
              <span className="text-[10px] sm:text-xs font-bold text-red-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                {g.raidActive ? `${g.raiders().length} raiders attack!` : `${g.raidDir} · ${Math.ceil(g.nextRaid)}s`}
              </span>
            </div>
          </div>
        </div>
      )}

      {g.paused && !story && !menu && (
        <div className="pointer-events-none absolute left-1/2 top-1/3 z-20 -translate-x-1/2 font-display text-2xl font-black tracking-[0.4em] bronze-text sm:text-5xl drop-shadow-2xl">
          PAUSED
        </div>
      )}
      {toast && (
        <div className="hud-panel pointer-events-auto absolute left-1/2 top-12 sm:top-14 z-40 -translate-x-1/2 rounded-md px-3 py-1.5 text-xs sm:text-sm font-display bronze-text shadow-2xl">
          {toast}
        </div>
      )}

      {/* Floating Tactical Controls for Mobile Viewport */}
      <div className="pointer-events-auto absolute right-1.5 top-12 z-20 flex flex-col gap-1 md:hidden">
        <button
          onClick={() => setMiniOpen((o) => !o)}
          aria-label="Toggle Strategic Map"
          className="hud-panel flex h-8 w-8 items-center justify-center rounded text-primary shadow-lg border-hud-edge active:scale-95"
          title="Strategic Map"
        >
          <MapIcon className="h-4 w-4" />
        </button>
        <button
          onClick={() => { setTechOpen(true); audio.play("click"); }}
          aria-label="Tech Tree"
          className="hud-panel flex h-8 w-8 items-center justify-center rounded text-amber-300 shadow-lg border-hud-edge active:scale-95"
          title="Civilization Tech Tree"
        >
          <Sparkles className="h-4 w-4" />
        </button>
        <button
          onClick={() => { setDiplomacyOpen(true); audio.play("click"); }}
          aria-label="Rival Tribes"
          className="hud-panel flex h-8 w-8 items-center justify-center rounded text-emerald-400 shadow-lg border-hud-edge active:scale-95"
          title="Rival Tribes & Diplomacy"
        >
          <Handshake className="h-4 w-4" />
        </button>
        <button
          onClick={() => { setMultiplayerOpen(true); audio.play("click"); }}
          aria-label="Online Lobbies"
          className="hud-panel flex h-8 w-8 items-center justify-center rounded text-sky-400 shadow-lg border-hud-edge active:scale-95"
          title="Online Lobbies & Leaderboard"
        >
          <Globe className="h-4 w-4" />
        </button>
        <button
          onClick={() => g.zoomAt(g.vw / 2, g.vh / 2, -200)}
          aria-label="Zoom In"
          className="hud-panel flex h-8 w-8 items-center justify-center rounded text-primary shadow-lg border-hud-edge active:scale-95"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={() => g.zoomAt(g.vw / 2, g.vh / 2, 200)}
          aria-label="Zoom Out"
          className="hud-panel flex h-8 w-8 items-center justify-center rounded text-primary shadow-lg border-hud-edge active:scale-95"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={centerOnTown}
          aria-label="Center Capital"
          className="hud-panel flex h-8 w-8 items-center justify-center rounded text-primary shadow-lg border-hud-edge active:scale-95"
          title="Center Capital"
        >
          <Castle className="h-4 w-4" />
        </button>
      </div>

      {/* =========================================================================
          EMPIRE EARTH 3 + SIMCITY BOTTOM COMMAND DECK
          3-Panel Bridge (Desktop) / Streamlined Collapsible Drawer (Mobile)
          ========================================================================= */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex flex-col items-stretch px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] md:h-[190px] md:flex-row md:items-stretch md:gap-2 md:px-2 md:pb-2">
        {/* Mobile Collapse / Expand Handle Tab */}
        <button
          onClick={() => setDeckCollapsed(!deckCollapsed)}
          className="md:hidden self-center flex items-center gap-1 rounded-t-md border-x border-t border-hud-edge bg-background/95 px-3 py-0.5 text-[10px] font-display font-bold text-primary shadow-lg active:scale-95 transition-all"
          aria-label="Toggle Command Deck"
        >
          {deckCollapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          <span>{deckCollapsed ? "EXPAND COMMAND DECK" : "COLLAPSE"}</span>
        </button>

        {!deckCollapsed && (
          <div className="flex flex-col gap-1 w-full md:flex-row md:items-stretch md:gap-2">
            {/* Left Panel: Strategic Radar Minimap with View Controls */}
            <div className="hud-panel rounded-md p-2 hidden md:flex flex-col justify-between shrink-0">
              <div className="relative">
                <canvas
                  ref={miniRef}
                  width={MW}
                  height={MW}
                  className="h-36 w-36 cursor-crosshair rounded [image-rendering:pixelated]"
                  onMouseDown={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    const mx = ((e.clientX - r.left) / r.width) * MW, my = ((e.clientY - r.top) / r.height) * MW;
                    g.cam.x = mx * T - g.vw / 2 / g.zoom;
                    g.cam.y = my * T - g.vh / 2 / g.zoom;
                  }}
                  onTouchStart={(e) => {
                    if (e.touches[0]) {
                      const r = e.currentTarget.getBoundingClientRect();
                      const mx = ((e.touches[0].clientX - r.left) / r.width) * MW;
                      const my = ((e.touches[0].clientY - r.top) / r.height) * MW;
                      g.cam.x = mx * T - g.vw / 2 / g.zoom;
                      g.cam.y = my * T - g.vh / 2 / g.zoom;
                    }
                  }}
                  onTouchMove={(e) => {
                    if (e.touches[0]) {
                      const r = e.currentTarget.getBoundingClientRect();
                      const mx = ((e.touches[0].clientX - r.left) / r.width) * MW;
                      const my = ((e.touches[0].clientY - r.top) / r.height) * MW;
                      g.cam.x = mx * T - g.vw / 2 / g.zoom;
                      g.cam.y = my * T - g.vh / 2 / g.zoom;
                    }
                  }}
                />
                <PSprite name="ui_minimap_frame" w={172} className="pointer-events-none absolute -left-[14px] -top-[14px] z-10" />
              </div>
              <div className="mt-1 flex items-center justify-between gap-1">
                <button
                  onClick={centerOnTown}
                  title="Home Camera (Space)"
                  className="bronze-btn flex flex-1 items-center justify-center gap-1 rounded py-0.5 text-[11px] font-display text-primary"
                >
                  <Castle className="h-3 w-3" />
                  <span>Capital</span>
                </button>
                <button
                  onClick={() => g.zoomAt(g.vw / 2, g.vh / 2, -200)}
                  title="Zoom In"
                  className="bronze-btn flex h-6 w-6 items-center justify-center rounded text-primary"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => g.zoomAt(g.vw / 2, g.vh / 2, 200)}
                  title="Zoom Out"
                  className="bronze-btn flex h-6 w-6 items-center justify-center rounded text-primary"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Center Panel: Entity Dossier & Inspector */}
            {/* On mobile: Hidden if nothing is selected to give full breathing room! */}
            {(g.selectedUnits.length > 1 || selB || selU || selA || placingDef || tip || g.vw >= 768) && (
              <div className="hud-panel flex min-h-[56px] sm:min-h-[72px] min-w-0 flex-1 flex-col justify-center rounded-md p-2 sm:p-3 text-xs sm:text-sm md:h-auto md:p-3.5">
                {placingDef && (!tip || g.vw < 768) ? (
                  <div className="flex w-full min-w-0 items-start gap-2 sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-display text-xs sm:text-sm font-bold text-primary">Placing:</span>
                        <span className="font-display text-sm sm:text-base font-bold text-foreground truncate">{placingDef.name}</span>
                      </div>
                      <div className="my-0.5 sm:my-1"><Cost c={placingDef.cost} /></div>
                      <p className="line-clamp-1 text-[11px] sm:text-xs text-muted-foreground">{placingDef.desc}</p>
                    </div>
                    <button
                      className="bronze-btn flex shrink-0 items-center gap-1 rounded px-2.5 py-1.5 font-display text-xs text-destructive hover:border-destructive"
                      onClick={() => { g.placing = null; g.dragStart = null; }}
                    >
                      <X className="h-3.5 w-3.5" />Cancel
                    </button>
                  </div>
                ) : tip ? (
                  <div className="space-y-0.5 sm:space-y-1">
                    <div className="flex items-center gap-2 font-display text-sm sm:text-base text-primary font-bold">
                      <span>{tip.label}</span>
                      {tip.hot && <span className="rounded bg-black/50 px-1 py-0.2 text-[10px] font-mono text-muted-foreground border border-hud-edge/40">[{tip.hot}]</span>}
                    </div>
                    {tip.cost && <div><Cost c={tip.cost} /></div>}
                    <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug line-clamp-2">{tip.desc}</p>
                  </div>
                ) : g.selectedUnits.length > 1 ? (
                  (() => {
                    const group = g.selectedUnits.map((id) => g.unitById(id)).filter((u): u is typeof g.units[0] => !!u);
                    const totalHp = group.reduce((a, u) => a + u.hp, 0);
                    const maxHp = group.reduce((a, u) => a + u.maxHp, 0);
                    const warriors = group.filter((u) => u.kind === "soldier").length;
                    const archers = group.filter((u) => u.kind === "archer").length;
                    const chieftains = group.filter((u) => u.kind === "chieftain").length;
                    const workers = group.filter((u) => u.kind === "villager").length;
                    const primaryStance = group[0]?.stance ?? "patrol";
                    return (
                      <div className="flex min-w-0 gap-2 sm:gap-4 items-center">
                        <Portrait>
                          <div className="h-full w-full flex items-center justify-center bg-black/50 text-primary">
                            <Swords className="h-7 w-7" />
                          </div>
                        </Portrait>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-display text-sm sm:text-base font-bold text-primary truncate">
                              {group.length} Units Grouped
                            </span>
                            <span className="text-[10px] rounded bg-primary/20 text-primary border border-primary/40 px-1.5 py-0.2 uppercase font-mono">
                              {primaryStance}
                            </span>
                          </div>
                          <Bar v={totalHp} max={maxHp} />
                          <div className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground flex flex-wrap gap-x-2">
                            {warriors > 0 && <span>{warriors} Warriors</span>}
                            {archers > 0 && <span>{archers} Archers</span>}
                            {chieftains > 0 && <span>{chieftains} Chieftains</span>}
                            {workers > 0 && <span>{workers} Workers</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : selC ? (() => {
                  const tr = g.tribes.find((t) => t.id === selC.tribeId);
                  if (!tr) return null;
                  const pendant = tr.id === "sunwatchers" ? "tribe_tribalfire" : tr.id === "ironclads" ? "tribe_warhut" : "tribe_shed";
                  const war = g.isAtWar(tr.id);
                  const rel = Math.round(tr.relation);
                  const relPct = (rel + 100) / 2;
                  const warparty = g.units.filter((u) => u.kind === "raider" && u.tribeId === tr.id).length;
                  return (
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <Portrait><PSprite name={pendant} w={44} /></Portrait>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-display text-xs sm:text-sm font-bold text-foreground">{tr.name}</span>
                            <span className={`shrink-0 rounded border px-1.5 text-[9px] font-bold uppercase ${war ? "border-destructive bg-destructive/25 text-destructive" : tr.defenseAlliance ? "border-success bg-success/25 text-success" : "border-hud-edge bg-black/40 text-muted-foreground"}`}>
                              {war ? "War" : tr.defenseAlliance ? "Ally" : "Neutral"}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">{tr.leader} · {tr.title}</div>
                          <div className="mt-1 w-full max-w-44">
                            <div className="h-1.5 overflow-hidden rounded border border-hud-edge/40 bg-black/60">
                              <div className={`h-full ${rel < -30 ? "bg-destructive" : rel > 30 ? "bg-success" : "bg-warning"}`} style={{ width: `${relPct}%` }} />
                            </div>
                            <div className="text-[9px] font-mono text-muted-foreground mt-0.5">Relations {rel > 0 ? "+" : ""}{rel} / 100</div>
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-muted-foreground">{tr.ethos}</div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => { setDiplomacyOpen(true); audio.play("click"); }}
                          className="bronze-btn rounded px-2 py-1 text-[11px] font-semibold text-primary hover:text-foreground"
                        >
                          Open Council
                        </button>
                        <button
                          onClick={() => {
                            const mil = g.selectedUnits.length > 0 ? g.selectedUnits.map((id) => g.unitById(id)).filter((u) => u && u.kind !== "villager") : g.soldiers();
                            if (mil.length === 0) { g.msg("Select warriors first, then assault the camp!", "warn"); return; }
                            for (const u of mil) { if (!u) continue; (u as import("../game/engine").Unit).campTarget = tr.id; (u as import("../game/engine").Unit).huntTarget = 0; u.state = "guard"; }
                            g.attackCamp(tr.id);
                            g.msg(`Assaulting ${tr.name} with ${mil.length} warrior(s)!`, "warn");
                            audio.play("horn");
                          }}
                          className="bronze-btn rounded px-2 py-1 text-[11px] font-semibold text-destructive hover:text-foreground"
                        >
                          Assault Camp
                        </button>
                      </div>
                      <div className="text-[9px] font-mono text-muted-foreground">Camp HP {Math.ceil(selC.hp)} / {selC.maxHp} · {warparty} war party in field</div>
                    </div>
                  );
                })() : selB ? (
                  <SelectedBuilding g={g} b={selB} />
                ) : selA ? (
                  <SelectedAnimal g={g} a={selA} />
                ) : selU ? (
                  <div className="flex min-w-0 gap-2 sm:gap-4 items-center">
                    <Portrait>
                      <img
                        src={
                          selU.kind === "villager"
                            ? pVillager
                            : selU.kind === "soldier" || selU.kind === "archer"
                            ? pWarrior
                            : selU.kind === "chieftain"
                            ? pElder
                            : pRaider
                        }
                        alt=""
                        width={96}
                        height={96}
                        className="h-full w-full object-cover"
                      />
                    </Portrait>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-display text-sm sm:text-base font-bold text-primary truncate">
                          {selU.kind === "raider"
                            ? "Rustfang Marauder"
                            : selU.kind === "soldier"
                            ? "Spear Warrior"
                            : selU.kind === "archer"
                            ? "Tribal Archer"
                            : selU.kind === "chieftain"
                            ? "War Chieftain"
                            : "Villager"}
                        </span>
                        {selU.kind !== "raider" && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-serif text-muted-foreground">{selU.name}</span>
                            {selU.stance && (
                              <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-black/40 text-primary border border-primary/30">
                                {selU.stance}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <Bar v={selU.hp} max={selU.maxHp} />
                      <div className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="capitalize truncate">
                          {({
                            toBuild: "Heading to site",
                            building: "Building structure",
                            toWork: "Traveling to work",
                            working: "Harvesting & Gathering",
                            toDrop: `Hauling to storage`,
                            wander: "Idle",
                            flee: "Retreating!",
                            guard: "On guard",
                            move: "Moving",
                            idle: "Awaiting tasks",
                          } as Record<string, string>)[selU.state] ?? selU.state}
                        </span>
                        {selU.carry > 0 && selU.carryType && (
                          <span className="rounded bg-black/40 px-1 py-0.2 text-primary text-[9px] font-mono shrink-0">
                            +{selU.carry} {RES_NAME[selU.carryType]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="min-w-0 text-muted-foreground flex flex-col justify-center">
                    <div className="flex items-center gap-2 font-display text-sm sm:text-base font-bold text-primary">
                      <span>The Emberkin Realm</span>
                      <span className="text-xs font-normal text-muted-foreground">· {AGES[g.age].name}</span>
                    </div>
                    <div className="text-xs mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>{g.villagers().length} Villagers</span>
                      <span>{g.soldiers().length} Defenders</span>
                      <span>{g.buildings.length} Structures</span>
                    </div>
                    <div className="mt-1 hidden md:block text-xs text-muted-foreground">
                      {g.drought > 0
                        ? "Drought alert: crops grow slowly. Build Wells and Granaries."
                        : g.flood > 0
                        ? "Flood alert: lowland tiles flooded. Keep watch on fisheries and docks."
                        : "Citizens automatically seek work and haul goods. Direct construction using the deck on the right."}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Right Panel: SimCity Categorized Construction Deck */}
            <div className="hud-panel w-full rounded-md p-1.5 sm:p-2 md:w-[320px] lg:w-[360px] flex flex-col justify-between shrink-0">
              {selB || selU || selA || g.selectedUnits.length > 0 ? (
                <div className="mb-1 flex items-center justify-between border-b border-hud-edge/50 pb-1 px-0.5">
                  <div className="flex items-center gap-1.5 font-display text-[10px] sm:text-[11px] font-bold text-primary truncate">
                    {selB ? (
                      <>
                        <Castle className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate">{g.tierName(selB)}</span>
                      </>
                    ) : g.selectedUnits.length > 1 ? (
                      <>
                        <Swords className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate">{g.selectedUnits.length} Units Grouped</span>
                      </>
                    ) : selU ? (
                      <>
                        <User className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate">{selU.name} ({selU.kind})</span>
                      </>
                    ) : (
                      <>
                        <Footprints className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate">{selA?.name ?? "Wildlife"}</span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      g.selected = null;
                      g.selectedUnits = [];
                      setHoverCmd(null);
                      audio.play("click");
                    }}
                    className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-display text-muted-foreground hover:text-foreground hover:bg-black/40 border border-hud-edge/30 transition-colors"
                    title="Deselect (Escape)"
                  >
                    <X className="h-3 w-3" />
                    <span>Deselect</span>
                  </button>
                </div>
              ) : (
                <div className="mb-1 space-y-1">
                  {/* Main Category Tabs */}
                  <div className="grid grid-cols-3 gap-1">
                    {(["eco", "mil", "civ"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => { setTab(t); setSubcat("all"); audio.play("click"); }}
                        className={`rounded px-1 py-0.5 sm:py-1 font-display text-[9px] sm:text-[11px] font-bold tracking-wider transition-colors ${
                          tab === t
                            ? "bg-primary text-primary-foreground shadow"
                            : "bronze-btn text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {{ eco: "ECONOMY", mil: "MILITARY", civ: "CIVIC" }[t]}
                      </button>
                    ))}
                  </div>

                  {/* Subcategories Filter Chips with Count Badges */}
                  <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] py-0.5">
                    {SUBCATS[tab].map((sc) => {
                      const count = Object.entries(BUILDINGS).filter(
                        ([k, d]) => d.cat === tab && k !== "townCenter" && (sc.id === "all" || d.subcat === sc.id)
                      ).length;
                      const isSelected = subcat === sc.id;
                      return (
                        <button
                          key={sc.id}
                          onClick={() => { setSubcat(sc.id); audio.play("click"); }}
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[8.5px] sm:text-[9.5px] font-display transition-all border flex items-center gap-1 ${
                            isSelected
                              ? "border-primary bg-primary/25 text-primary font-bold shadow-[0_0_6px_rgba(234,179,8,0.3)]"
                              : "border-hud-edge/40 bg-black/30 text-muted-foreground hover:text-foreground hover:border-primary/40"
                          }`}
                        >
                          <span>{sc.label}</span>
                          <span className={`text-[8px] font-mono px-1 rounded ${isSelected ? "bg-primary/30 text-foreground" : "bg-black/40 text-muted-foreground"}`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action buttons grid */}
              <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] md:grid md:grid-cols-4 md:max-h-[114px] md:overflow-y-auto">
                {cmds.length === 0 ? (
                  <div className="flex h-12 w-full items-center justify-center col-span-4 rounded border border-dashed border-hud-edge/40 bg-black/25 text-center text-[10px] text-muted-foreground italic px-2">
                    No items in this subcategory
                  </div>
                ) : (
                  cmds.map((c) => {
                    const I = c.icon;
                    const cant = c.cost ? !g.afford(c.cost) : false;
                    return (
                      <button
                        key={c.id}
                        disabled={c.disabled}
                        onPointerEnter={(e) => e.pointerType === "mouse" && setHoverCmd(c)}
                        onPointerLeave={() => setHoverCmd(null)}
                        onClick={() => {
                          audio.play("click");
                          c.run();
                          if (g.vw < 768) setHoverCmd(null);
                        }}
                        className={`bronze-btn relative flex aspect-square h-12 w-12 sm:h-14 sm:w-14 shrink-0 flex-col items-center justify-center rounded md:h-auto md:w-auto p-1 text-center transition-all ${
                          c.active ? "ring-2 ring-primary border-primary shadow-[0_0_8px_rgba(234,179,8,0.4)]" : ""
                        } ${cant ? "text-destructive/80 opacity-75" : "text-primary"}`}
                        aria-label={c.label}
                      >
                        {c.img ? <PSprite name={c.img} w={22} /> : <I className="h-5 w-5 sm:h-6 sm:w-6 drop-shadow" />}
                        <span className="mt-0.5 max-w-full truncate text-[8px] sm:text-[9px] leading-tight text-foreground font-medium">
                          {c.label.split(" ")[0]}
                        </span>
                        {c.hot && c.hot.length === 1 && (
                          <span className="absolute right-1 top-0.5 hidden md:block text-[9px] font-mono font-bold text-muted-foreground">
                            {c.hot}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* =========================================================================
          WEATHER & CLIMATE FORECAST MODAL (FULL-VIEW OVERLAY)
          ========================================================================= */}
      {weatherModalOpen && (
        <div
          className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
          onClick={() => setWeatherModalOpen(false)}
        >
          <div
            className="hud-panel relative w-full max-w-lg rounded-lg p-4 sm:p-5 shadow-2xl border-primary/50 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-hud-edge pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg border ${WEATHER_CONFIGS[g.weatherSystem.current].badgeBg}`}>
                  {g.weatherSystem.current === "rain" ? (
                    <CloudRain className="h-6 w-6 text-sky-400 animate-bounce" />
                  ) : g.weatherSystem.current === "snow" ? (
                    <Snowflake className="h-6 w-6 text-sky-200 animate-spin" style={{ animationDuration: "8s" }} />
                  ) : g.weatherSystem.current === "ash_storm" ? (
                    <Flame className="h-6 w-6 text-orange-400 animate-pulse" />
                  ) : (
                    <Sun className="h-6 w-6 text-amber-400" />
                  )}
                </div>
                <div>
                  <h3 className="font-display text-base sm:text-lg font-bold text-primary flex items-center gap-2">
                    {WEATHER_CONFIGS[g.weatherSystem.current].name}
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-black/50 border border-hud-edge text-muted-foreground">
                      {Math.ceil(g.weatherSystem.timer)}s left
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {WEATHER_CONFIGS[g.weatherSystem.current].subtitle} · Day {Math.floor(g.time / 300) + 1}
                  </p>
                </div>
              </div>
              <button
                aria-label="Close"
                onClick={() => setWeatherModalOpen(false)}
                className="rounded p-1 text-muted-foreground hover:bg-black/40 hover:text-foreground cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Cycle Progress bar */}
            <div className="mt-3">
              <div className="flex justify-between text-[11px] text-muted-foreground mb-1 font-mono">
                <span>Front Progression</span>
                <span>{Math.round(((g.weatherSystem.duration - g.weatherSystem.timer) / g.weatherSystem.duration) * 100)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded bg-black/60 border border-hud-edge/40">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, ((g.weatherSystem.duration - g.weatherSystem.timer) / g.weatherSystem.duration) * 100))}%` }}
                />
              </div>
            </div>

            {/* Atmosphere summary */}
            <p className="mt-3 text-xs sm:text-sm text-foreground/90 leading-relaxed bg-black/35 p-3 rounded border border-hud-edge/40 italic">
              "{WEATHER_CONFIGS[g.weatherSystem.current].desc}"
            </p>

            {/* Tactical Production Modifiers */}
            <div className="mt-4">
              <div className="text-[11px] font-display font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                Resource & Labor Yield Modifiers
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {WEATHER_CONFIGS[g.weatherSystem.current].buffs.map((b, i) => (
                  <div key={i} className="flex items-start gap-1.5 p-2 rounded bg-emerald-950/25 border border-emerald-500/30 text-emerald-300">
                    <span className="font-bold text-emerald-400">▲</span>
                    <span>{b}</span>
                  </div>
                ))}
                {WEATHER_CONFIGS[g.weatherSystem.current].debuffs.map((d, i) => (
                  <div key={i} className="flex items-start gap-1.5 p-2 rounded bg-rose-950/25 border border-rose-500/30 text-rose-300">
                    <span className="font-bold text-rose-400">▼</span>
                    <span>{d}</span>
                  </div>
                ))}
                {WEATHER_CONFIGS[g.weatherSystem.current].buffs.length === 0 && WEATHER_CONFIGS[g.weatherSystem.current].debuffs.length === 0 && (
                  <div className="col-span-2 text-xs text-muted-foreground p-2 rounded bg-black/30 border border-hud-edge/30">
                    All work and harvest activities operate at normal baseline rates.
                  </div>
                )}
              </div>
            </div>

            {/* Durability & Structural Integrity */}
            <div className="mt-4 p-3 rounded bg-amber-950/20 border border-amber-600/30 text-xs text-amber-200/90 leading-relaxed">
              <div className="font-display font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" />
                Structural Integrity & Shelter Advice
              </div>
              <p>{WEATHER_CONFIGS[g.weatherSystem.current].durabilityDesc}</p>
              <div className="mt-2 text-[11px] text-muted-foreground flex flex-col gap-1 border-t border-amber-600/20 pt-1.5">
                <div>• <b className="text-foreground">Stone Wells:</b> Provide runoff drainage and prevent moisture decay nearby.</div>
                <div>• <b className="text-foreground">Shaman Groves:</b> Spiritual warmth and barrier shields nearby structures from all cataclysm wear.</div>
                <div>• <b className="text-foreground">Stone/Brick Upgrades:</b> Fortified structures have stone foundations impervious to weather erosion.</div>
                <div>• <b className="text-foreground">Citizen Repair:</b> Idle villagers automatically reinforce buildings below 95% HP.</div>
              </div>
            </div>

            {/* Meteorological Forecast */}
            <div className="mt-4 flex items-center justify-between p-2.5 rounded bg-black/45 border border-hud-edge text-xs">
              <div className="flex items-center gap-2">
                <Wind className="h-4 w-4 text-primary" />
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase font-bold block">Next Weather Front</span>
                  <span className="font-bold text-foreground">{WEATHER_CONFIGS[g.weatherSystem.nextWeather].name}</span>
                </div>
              </div>
              <span className="font-mono text-xs text-primary font-bold">
                in {Math.ceil(g.weatherSystem.timer)}s
              </span>
            </div>

            {/* Manual Weather Selector for Sandbox/Testing */}
            <div className="mt-4 border-t border-hud-edge/60 pt-3">
              <span className="text-[10px] font-display font-bold text-muted-foreground tracking-widest uppercase block mb-2">
                Direct Climate Shift (Sandbox / Test)
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {(["clear", "rain", "snow", "ash_storm"] as WeatherType[]).map((wKey) => {
                  const cfg = WEATHER_CONFIGS[wKey];
                  const isActive = g.weatherSystem.current === wKey;
                  return (
                    <button
                      key={wKey}
                      onClick={() => {
                        g.weatherSystem.setWeather(wKey);
                        audio.play(wKey === "rain" ? "flood" : wKey === "ash_storm" ? "wildfire" : "click");
                        g.banner(cfg.bannerTitle, cfg.bannerText);
                        tick();
                      }}
                      className={`bronze-btn text-[11px] font-display py-1.5 px-1 rounded flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        isActive ? "border-primary text-primary font-bold bg-primary/20" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {wKey === "rain" ? <CloudRain className="h-4 w-4 text-sky-400" /> : wKey === "snow" ? <Snowflake className="h-4 w-4 text-sky-200" /> : wKey === "ash_storm" ? <Flame className="h-4 w-4 text-orange-400" /> : <Sun className="h-4 w-4 text-amber-400" />}
                      <span className="truncate max-w-full text-[10px]">{cfg.name.split(" ")[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          NARRATIVE CHRONICLE / DIALOGUE MODAL
          ========================================================================= */}
      {story && (
        <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="hud-panel flex max-h-[92dvh] w-[min(760px,94vw)] flex-col gap-4 overflow-y-auto rounded-lg p-5 sm:flex-row sm:gap-6 sm:p-8 shadow-2xl border-primary/50">
            <img
              src={story.kind === "defeat" ? pRaider : pElder}
              alt=""
              width={180}
              height={180}
              className="h-24 w-24 shrink-0 rounded-md border-2 border-hud-edge object-cover sm:h-44 sm:w-44 shadow-lg"
            />
            <div className="flex-1">
              <div className="font-display text-xs tracking-[0.3em] font-bold text-accent uppercase">{story.chapter}</div>
              <h2 className="mt-1 font-display text-2xl font-bold bronze-text sm:text-3xl">{story.title}</h2>
              <p className="mt-3 text-sm sm:text-base leading-relaxed text-foreground/90">{story.text}</p>
              {story.kind === "story" && mission && (
                <div className="mt-4 rounded bg-black/40 p-2.5 border border-hud-edge/50">
                  <span className="font-display text-xs font-bold text-primary">OBJECTIVE: </span>
                  <span className="text-xs text-foreground">{mission.goal}</span>
                </div>
              )}
              <div className="mt-5 flex gap-3">
                {story.kind === "defeat" ? (
                  <button className="bronze-btn rounded-md px-6 py-2.5 font-display text-sm font-bold text-primary cursor-pointer" onClick={() => { audio.play("click"); onExit(); }}>
                    Return to Menu
                  </button>
                ) : (
                  <button className="bronze-btn rounded-md px-6 py-2.5 font-display text-sm font-bold text-primary cursor-pointer" onClick={() => { audio.play("click"); setStory(null); g.paused = false; }}>
                    Continue Expedition
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          GAME MENU & SOUND SETTINGS MODAL
          ========================================================================= */}
      {menu && (
        <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="hud-panel max-h-[92dvh] w-[min(22rem,94vw)] overflow-y-auto rounded-lg p-6 shadow-2xl border-primary/40">
            <h2 className="mb-4 text-center font-display text-2xl font-bold bronze-text">Tribal Council Menu</h2>
            <div className="grid gap-2.5">
              <button className="bronze-btn rounded-md py-2.5 font-display text-sm font-bold text-primary cursor-pointer" onClick={() => { setMenu(false); g.paused = false; audio.play("click"); }}>
                Resume Game
              </button>

              {/* UI Scale Adjustment Selector */}
              <div className="my-1 rounded-md border border-hud-edge bg-black/50 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between font-display text-primary font-bold">
                  <span>UI Scaling (Dimensiune HUD)</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{Math.round(uiScale * 100)}%</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 font-display text-[11px]">
                  {[
                    { s: 0.75, l: "75% (-25%)" },
                    { s: 0.85, l: "85% (-15%)" },
                    { s: 1.0, l: "100% (1:1)" },
                  ].map(({ s, l }) => (
                    <button
                      key={s}
                      onClick={() => changeUiScale(s)}
                      className={`rounded py-1 px-1 text-center font-bold transition-all cursor-pointer ${
                        Math.abs(uiScale - s) < 0.01
                          ? "bg-primary text-primary-foreground shadow"
                          : "bronze-btn text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Reduced by 25% (75%) for expanded strategic view of the realm.
                </div>
              </div>

              {/* Audio Controls */}
              <div className="my-1 rounded-md border border-hud-edge bg-black/50 p-3 space-y-2.5 text-xs">
                <div className="flex items-center justify-between font-display text-primary font-bold">
                  <span>Audio & Acoustic Ambiance</span>
                  <button onClick={() => { audio.toggleMute(); audio.play("click"); }} className="flex items-center gap-1 text-[11px] hover:text-foreground cursor-pointer">
                    {audioSettings.muted ? <VolumeX className="h-3.5 w-3.5 text-destructive" /> : <Volume2 className="h-3.5 w-3.5" />}
                    <span>{audioSettings.muted ? "Unmute" : "Mute"}</span>
                  </button>
                </div>
                <div>
                  <div className="flex justify-between mb-1 text-muted-foreground text-[11px]">
                    <span>Tribal Ambient Music</span>
                    <span className="font-mono">{Math.round(audioSettings.musicVol * 100)}%</span>
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
                  <div className="flex justify-between mb-1 text-muted-foreground text-[11px]">
                    <span>Sound Effects (SFX)</span>
                    <span className="font-mono">{Math.round(audioSettings.sfxVol * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={audioSettings.sfxVol}
                    onChange={(e) => { audio.setSfxVol(parseFloat(e.target.value)); audio.play("click"); }}
                    className="w-full accent-primary cursor-pointer"
                  />
                </div>
              </div>

              {SLOTS.map((s) => {
                const m = readMeta(s);
                return (
                  <button key={s} className="bronze-btn rounded-md py-2 font-display text-xs text-muted-foreground hover:text-primary cursor-pointer" onClick={() => { save(s); audio.play("click"); }}>
                    Save to Slot {s}{m ? ` (${AGES[m.age].name} · Pop ${m.pop})` : ""}
                  </button>
                );
              })}
              <div className="text-center text-[11px] text-muted-foreground">Progress autosaves continuously to slot {slot}.</div>
              <button className="bronze-btn mt-2 rounded-md py-2.5 font-display text-sm font-bold text-destructive hover:border-destructive cursor-pointer" onClick={() => { save(slot); audio.play("click"); onExit(); }}>
                Save & Exit to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Tech Tree & Civilization Upgrades Modal */}
      {techOpen && (
        <TechTreeModal
          game={g}
          onClose={() => setTechOpen(false)}
        />
      )}

      {/* Rival Tribes & Tribal Diplomacy Modal */}
      {diplomacyOpen && (
        <DiplomacyModal
          game={g}
          onClose={() => setDiplomacyOpen(false)}
        />
      )}

      {/* Firebase Cloud Multiplayer & Global Leaderboard */}
      {multiplayerOpen && (
        <MultiplayerModal
          game={g}
          onClose={() => setMultiplayerOpen(false)}
        />
      )}

      {/* Valley Lore & Survival Intro Guide */}
      {introOpen && (
        <IntroModal
          onClose={() => setIntroOpen(false)}
        />
      )}
    </div>
  );
}

function SelectedBuilding({ g, b }: { g: Game; b: NonNullable<ReturnType<Game["byId"]>> }) {
  const d = BUILDINGS[b.type];
  const I = ICONS[b.type] ?? Castle;
  const workers = g.villagers().filter((v) => v.job === b.id).length;
  const slots = g.slots(b);
  return (
    <div className="flex min-w-0 gap-2 sm:gap-4 items-center">
      <Portrait>
        <I className="h-8 w-8 sm:h-12 sm:w-12 text-primary drop-shadow" />
      </Portrait>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="font-display text-sm sm:text-base md:text-lg font-bold text-primary truncate">
            {g.tierName(b)}
          </span>
          {d.tiers && (
            <span className="rounded bg-black/50 px-1 py-0.2 sm:px-1.5 sm:py-0.5 text-[9px] sm:text-[10px] font-mono text-muted-foreground border border-hud-edge/50">
              T{b.level}/{d.tiers.length}
            </span>
          )}
        </div>
        {b.progress < 1 ? (
          <>
            <div className="text-[11px] sm:text-xs text-warning font-medium">Under construction · {Math.floor(b.progress * 100)}%</div>
            <Bar v={b.progress} max={1} gold />
          </>
        ) : (
          <Bar v={b.hp} max={b.maxHp} />
        )}
        <div className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5">
          {slots > 0 && (
            <span className={workers === 0 ? "text-warning font-semibold" : ""}>
              Workforce: {workers}/{slots}
            </span>
          )}
          {b.type === "house" && <span>Housing +{[0, 5, 8, 12][b.level]}</span>}
          {d.pop && b.type !== "house" && <span>Housing +{d.pop}</span>}
          {b.fire > 0 && <span className="text-destructive font-bold animate-pulse">ON FIRE!</span>}
          {b.alert && (
            <span className="text-warning font-medium truncate">
              {b.alert.kind === "input"
                ? `Needs ${RES_NAME[b.alert.res!]}`
                : b.alert.kind === "idle"
                ? "No workers"
                : "Resource depleted"}
            </span>
          )}
        </div>
        {b.queue.length > 0 && (
          <div className="mt-1 flex items-center gap-1">
            <span className="text-[9px] sm:text-[10px] font-display text-muted-foreground">Queue:</span>
            {b.queue.map((q, i) => (
              <span key={i} className="bronze-btn flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded text-primary" title={UNITS[q as keyof typeof UNITS]?.name}>
                {q === "villager" ? <User className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : q === "archer" ? <Crosshair className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : q === "chieftain" ? <Crown className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <Shield className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
              </span>
            ))}
            <span className="ml-0.5 text-[10px] font-mono text-primary font-bold">
              {Math.floor((b.qt / UNITS[b.queue[0] as keyof typeof UNITS].time) * 100)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function SelectedAnimal({ g, a }: { g: Game; a: NonNullable<ReturnType<Game["animalById"]>> }) {
  const speciesNames: Record<string, string> = {
    sheep: "Domestic Sheep",
    cow: "Dairy Cattle",
    pig: "Farm Swine",
    deer: "Wild Forest Stag",
    boar: "Wild Razorback Boar",
    wolf: "Timber Wolf",
  };
  const pasture = a.pastureId ? g.byId(a.pastureId) : undefined;
  return (
    <div className="flex min-w-0 gap-2 sm:gap-4 items-center">
      <Portrait>
        <Footprints className="h-8 w-8 sm:h-12 sm:w-12 text-primary drop-shadow" />
      </Portrait>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="font-display text-sm sm:text-base md:text-lg font-bold text-primary truncate">
            {a.name}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[9px] sm:text-[10px] font-mono border ${
              a.domestic
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : a.kind === "wolf"
                ? "bg-red-500/20 text-red-300 border-red-500/40"
                : "bg-amber-500/20 text-amber-300 border-amber-500/40"
            }`}
          >
            {a.domestic ? "Domesticated" : a.kind === "wolf" ? "Predator" : "Wild Game"}
          </span>
        </div>
        <Bar v={a.hp} max={a.maxHp} />
        <div className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5">
          <span>Species: {speciesNames[a.kind] ?? a.kind}</span>
          <span>Status: <b className="capitalize text-foreground">{a.state}</b></span>
          {pasture && <span>Pasture #{pasture.id}</span>}
          {a.domestic && (
            <span className="text-emerald-400">
              Yields: {a.kind === "sheep" ? "Wool & Meat" : a.kind === "cow" ? "Food & Leather" : "Food & Bacon"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function PSprite({ name, w, className, style }: { name: string; w: number; className?: string; style?: React.CSSProperties }) {
  const st = uiSpriteStyle(name, w);
  if (!st) return null;
  return <div aria-hidden className={`shrink-0 ${className ?? ""}`} style={{ ...st, ...style }} />;
}

function Portrait({ children }: { children: React.ReactNode }) {
  return (
    <div className="portrait flex h-14 w-14 sm:h-20 sm:w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-hud-edge bg-black/60 shadow-inner">
      {children}
    </div>
  );
}

function Bar({ v, max, gold }: { v: number; max: number; gold?: boolean }) {
  const k = Math.max(0, Math.min(1, v / max));
  return (
    <div className="mt-0.5 sm:mt-1 w-full max-w-44 sm:max-w-56">
      <div className="h-1.5 sm:h-2 overflow-hidden rounded bg-black/60 border border-hud-edge/40">
        <div
          className={`h-full transition-all duration-200 ${
            gold ? "bg-gradient-to-r from-amber-400 to-amber-600" : k > 0.5 ? "bg-success" : k > 0.25 ? "bg-warning" : "bg-destructive"
          }`}
          style={{ width: `${k * 100}%` }}
        />
      </div>
      {!gold && <div className="text-[9px] sm:text-[10px] font-mono text-muted-foreground mt-0.5">{Math.ceil(v)} / {max} HP</div>}
    </div>
  );
}

function IconBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className="bronze-btn flex h-7 sm:h-8 items-center gap-1 rounded px-1.5 sm:px-2 text-primary hover:text-foreground">
      {children}
    </button>
  );
}
