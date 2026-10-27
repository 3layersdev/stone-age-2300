import { AGES, BUILDINGS, RES_COLOR, MAP_SIZES, MH, MW, NAMES, RANKS, T, TER, UNITS, setMapSize, type MapSize, type Res, type ResKey } from "./data";
import { unlockChapter } from "./save";
import { MISSIONS } from "./missions";
import { drawBuilding, drawUnit, groundPattern, natureSprite, drawAnimal, drawCamp, drawDecor, drawFarmPlot, drawRingFx, drawSpriteParts } from "./render";
import { audio } from "./audio";
import { WeatherSystem, WEATHER_CONFIGS, type WeatherType } from "./weather";
import { TECHNOLOGIES, type TechItem } from "./techTree";
import { INITIAL_TRIBES, type RivalTribe } from "./diplomacy";

export interface Building {
  id: number; type: string; x: number; y: number; progress: number; hp: number; maxHp: number;
  alert?: { kind: "idle" | "input" | "depleted"; res?: ResKey | undefined } | undefined; fire: number; queue: string[]; qt: number; cd: number; seed: number; level: number;
  rallyPoint?: { x: number; y: number };
}
export interface Unit {
  id: number; kind: "villager" | "soldier" | "archer" | "chieftain" | "raider"; x: number; y: number; hp: number; maxHp: number;
  state: string; job: number; gx: number; gy: number; carry: number; carryType: ResKey | null;
  timer: number; dir: number; moving: boolean; anim: number; target: number; cd: number; name: string; wave: number;
  stance?: "patrol" | "guard" | "aggressive";
  patrolAnchor?: { x: number; y: number };
  patrolAngle?: number;
  huntTarget?: number;
  sheltered?: boolean;
  srcTile?: number;
  tribeId?: string;
  homeCamp?: string;
  campTarget?: string;
  ally?: boolean;
}
export type AnimalKind = "sheep" | "cow" | "pig" | "deer" | "boar" | "wolf" | "bear" | "rabbit" | "eagle" | "raven";
export interface Animal {
  id: number; kind: AnimalKind; domestic: boolean; x: number; y: number; hp: number; maxHp: number;
  dir: number; moving: boolean; anim: number; timer: number; state: "graze" | "wander" | "flee" | "hunt";
  gx: number; gy: number; name: string; pastureId?: number;
}
interface Proj { x: number; y: number; target: number; dmg: number; sx: number; sy: number; t: number; }
interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: "smoke" | "fire" | "dust" | "spark" | "debris"; }
interface Floater { x: number; y: number; text: string; life: number; color: string; }
export interface CampBuilding { img: string; dx: number; dy: number; scale: number; }
export interface Camp {
  tribeId: string; x: number; y: number; hp: number; maxHp: number;
  buildings: CampBuilding[]; alive: boolean; warPartyT: number; guardT: number; smokeT: number;
}
export interface RingFx { x: number; y: number; fr: string; life: number; max: number; rot: number; }
export interface Msg { id: number; text: string; type: "info" | "good" | "bad" | "warn"; t: number; }
export interface StoryEvent { kind: "story" | "defeat" | "victory"; chapter: string; title: string; text: string; }

export type Difficulty = "peaceful" | "normal" | "hard";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function hash(x: number, y: number, s: number) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x: number, y: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, s: number) {
  let t = 0, amp = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { t += vnoise(x * f, y * f, s + i) * amp; f *= 2; amp *= 0.5; }
  return t / 0.9375;
}

export class Game {
  seed: number;
  difficulty: Difficulty;
  mapSize: MapSize;
  terrain!: Uint8Array;
  vari!: Float32Array;
  road!: Uint8Array;
  occ!: Int32Array;
  rank = 0;
  buildings: Building[] = [];
  units: Unit[] = [];
  animals: Animal[] = [];
  projs: Proj[] = [];
  parts: Part[] = [];
  floaters: Floater[] = [];
  messages: Msg[] = [];
  res: Res = { food: 250, wood: 250, stone: 120, gold: 60, tools: 0, clay: 0, bricks: 0, meat: 30, herbs: 20, fruits: 35, vegetables: 35, wool: 0 };
  /** smoothed net production per minute */
  rate: Record<ResKey, number> = { food: 0, wood: 0, stone: 0, gold: 0, tools: 0, clay: 0, bricks: 0, meat: 0, herbs: 0, fruits: 0, vegetables: 0, wool: 0 };
  flow: Record<ResKey, number> = { food: 0, wood: 0, stone: 0, gold: 0, tools: 0, clay: 0, bricks: 0, meat: 0, herbs: 0, fruits: 0, vegetables: 0, wool: 0 };
  flowT = 0;
  wildlifeTimer = 0;
  /** resources currently blocking production somewhere */
  short = new Set<ResKey>();
  age = 0; ageProgress = -1; time = 0; missionIndex = 0; nid = 1; msgId = 1;
  stats = { soldiersTrained: 0, villagersTrained: 0, raidsDefeated: 0, buildingsBuilt: 0 };
  nextRaid = 300; nextDisaster = 200; raidWave = 0; raidActive = false; raidWarn = 0; raidDir = "";
  drought = 0; flood = 0; shake = 0; lowFX = false; private _cc: string[] = []; private _ccDrought = false; disasterBanner = ""; disasterT = 0; meteor: { x: number; y: number; t: number } | null = null;
  cam = { x: 0, y: 0 }; zoom = 1; vw = 1280; vh = 720;
  edgePan = true;
  placing: string | null = null; dragStart: { x: number; y: number } | null = null;
  hover = { x: 0, y: 0, sx: -1, sy: -1 };
  selected: { kind: "b" | "u" | "a" | "c"; id: number } | null = null;
  selectedCampId: string | null = null;
  selectedUnits: number[] = [];
  dragBox: { startX: number; startY: number; currentX: number; currentY: number } | null = null;
  rallyTargetBuildingId: number | null = null;
  paused = false; speed = 1; over = false;
  keys = new Set<string>();
  onStory?: (e: StoryEvent) => void;
  minimapBase: ImageData | null = null;
  weatherSystem = new WeatherSystem();
  alarmActive = false;
  researchedTechs = new Set<string>();
  tribes: RivalTribe[] = JSON.parse(JSON.stringify(INITIAL_TRIBES));
  tradeIncomeTimer = 0;
  resAmt!: Float32Array;
  camps: Camp[] = [];
  ringFx: RingFx[] = [];
  decor: { x: number; y: number; img: string; s: number }[] = [];
  alertT = 4;
  floraT = 6;
  warWith = new Set<string>();

  constructor(seed: number, difficulty: Difficulty, mapSize: MapSize = "large") {
    this.seed = seed;
    this.mapSize = mapSize;
    setMapSize(MAP_SIZES[mapSize]);
    this.terrain = new Uint8Array(MW * MH); this.vari = new Float32Array(MW * MH);
    this.road = new Uint8Array(MW * MH); this.occ = new Int32Array(MW * MH);
    this.resAmt = new Float32Array(MW * MH);
    this.difficulty = difficulty;
    if (difficulty === "hard") { this.nextRaid = 220; }
    this.generate();
  }

  // ---------- world ----------
  generate() {
    const s = this.seed, cx = MW / 2, cy = MH / 2;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const i = y * MW + x;
      const d = Math.hypot(x - cx, y - cy);
      let e = fbm(x / 26, y / 26, s) + 0.15 - Math.max(0, d - (MW / 2 - 12)) * 0.02;
      const m = fbm(x / 13 + 50, y / 13 + 50, s + 7);
      const r = hash(x, y, s + 3);
      let t: number = TER.GRASS;
      if (e < 0.33) t = TER.WATER;
      else if (e < 0.37) t = TER.SAND;
      else if (e > 0.86) t = TER.MOUNTAIN;
      else if (e < 0.44 && m > 0.52) t = TER.MARSH;
      else if (m > 0.6) t = TER.FOREST;
      else if (e > 0.8 && r < 0.8) t = TER.STONE;
      else if (e > 0.72 && m < 0.3 && r < 0.5) t = TER.GOLD;
      else if (m > 0.53 && r < 0.12) t = TER.BERRY;
      if (d < 9) t = TER.GRASS;
      this.terrain[i] = t;
      this.vari[i] = fbm(x / 6, y / 6, s + 11) * 0.75 + r * 0.25;
    }
    // rivers: random walks from map edge toward the valley
    const rivers = MW >= 192 ? 3 : 2;
    for (let r = 0; r < rivers; r++) {
      const a = hash(r, 1, s) * Math.PI * 2;
      let x = cx + Math.cos(a) * (MW / 2 - 2), y = cy + Math.sin(a) * (MH / 2 - 2);
      let dir = a + Math.PI;
      for (let k = 0; k < MW * 0.42; k++) {
        dir += (vnoise(k / 9, r * 10, s) - 0.5) * 0.5;
        x += Math.cos(dir); y += Math.sin(dir);
        if (Math.hypot(x - cx, y - cy) < 14) break;
        const w = 1 + (k > MW * 0.2 ? 0 : 1);
        for (let j = -w; j <= w; j++) for (let i = -w; i <= w; i++) {
          const tx = Math.round(x) + i, ty = Math.round(y) + j;
          if (tx > 0 && ty > 0 && tx < MW - 1 && ty < MH - 1) {
            const ii = ty * MW + tx;
            this.terrain[ii] = Math.abs(i) + Math.abs(j) <= w ? TER.WATER : this.terrain[ii] === TER.WATER ? TER.WATER : TER.SAND;
          }
        }
      }
    }
    const blob = (bx: number, by: number, rad: number, t: number) => {
      for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
        if (x * x + y * y <= rad * rad * (0.7 + hash(x, y, s) * 0.5)) this.terrain[(by + y) * MW + bx + x] = t;
      }
    };
    blob(cx + 14, cy - 5, 5, TER.FOREST); blob(cx - 15, cy - 9, 4, TER.FOREST);
    blob(cx - 12, cy + 10, 2, TER.STONE); blob(cx + 9, cy + 14, 2, TER.GOLD);
    blob(cx + 4, cy - 13, 2, TER.BERRY);
    blob(cx - 8, cy - 14, 2, TER.FRUIT_TREE);
    blob(cx + 10, cy + 8, 2, TER.VEG_PATCH);
    blob(cx - 10, cy + 16, 2, TER.HERB_PATCH);
    // resource node amounts (depletion model)
    for (let i = 0; i < MW * MH; i++) {
      const t = this.terrain[i];
      if (t === TER.FOREST) this.resAmt[i] = 55 + Math.random() * 25;
      else if (t === TER.STONE) this.resAmt[i] = 110 + Math.random() * 40;
      else if (t === TER.GOLD) this.resAmt[i] = 80 + Math.random() * 30;
      else if (t === TER.SAND) this.resAmt[i] = 160;
      else if (t === TER.FRUIT_TREE) this.resAmt[i] = 45;
      else if (t === TER.BERRY) this.resAmt[i] = 30;
      else if (t === TER.VEG_PATCH) this.resAmt[i] = 30;
      else if (t === TER.HERB_PATCH) this.resAmt[i] = 30;
    }
    // painted decor: flowerbeds & lone trees on open grass
    for (let k = 0; k < (MW / 64) * 7; k++) {
      const a = hash(k, 41, s) * Math.PI * 2, r = 14 + hash(k, 42, s) * (MW / 2 - 20);
      const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
      if (this.tile(x, y) === TER.GRASS) {
        this.decor.push({ x: x * T + T / 2, y: y * T + T, img: hash(k, 43, s) < 0.5 ? "tile_flowers" : "tile_meadow", s: 0.9 + hash(k, 44, s) * 0.3 });
      }
    }
    // distant rich deposits & wild flora reward expansion
    for (let k = 0; k < (MW / 64) * 4; k++) {
      const a = hash(k, 7, s) * Math.PI * 2, r = 18 + hash(k, 8, s) * (MW / 2 - 28);
      const bx = Math.round(cx + Math.cos(a) * r), by = Math.round(cy + Math.sin(a) * r);
      blob(bx, by, 2 + Math.floor(hash(k, 9, s) * 2), [TER.GOLD, TER.STONE, TER.FOREST, TER.FRUIT_TREE, TER.VEG_PATCH, TER.HERB_PATCH][k % 6]);
    }
    // spawn wild fauna: deer herds, wild boars, wolves
    for (let i = 0; i < 14; i++) {
      const a = hash(i, 21, s) * Math.PI * 2, r = 12 + hash(i, 22, s) * (MW / 2 - 24);
      const x = clamp((cx + Math.cos(a) * r) * T, 60, (MW - 2) * T);
      const y = clamp((cy + Math.sin(a) * r) * T, 60, (MH - 2) * T);
      this.spawnAnimal("deer", x, y, false);
    }
    for (let i = 0; i < 7; i++) {
      const a = hash(i, 25, s) * Math.PI * 2, r = 16 + hash(i, 26, s) * (MW / 2 - 22);
      const x = clamp((cx + Math.cos(a) * r) * T, 60, (MW - 2) * T);
      const y = clamp((cy + Math.sin(a) * r) * T, 60, (MH - 2) * T);
      this.spawnAnimal("boar", x, y, false);
    }
    for (let i = 0; i < 5; i++) {
      const a = hash(i, 29, s) * Math.PI * 2, r = 24 + hash(i, 30, s) * (MW / 2 - 18);
      const x = clamp((cx + Math.cos(a) * r) * T, 60, (MW - 2) * T);
      const y = clamp((cy + Math.sin(a) * r) * T, 60, (MH - 2) * T);
      this.spawnAnimal("wolf", x, y, false);
    }
    for (let i = 0; i < 4; i++) {
      const a = hash(i, 33, s) * Math.PI * 2, r = 20 + hash(i, 34, s) * (MW / 2 - 24);
      this.spawnAnimal("bear", clamp((cx + Math.cos(a) * r) * T, 60, (MW - 2) * T), clamp((cy + Math.sin(a) * r) * T, 60, (MH - 2) * T), false);
    }
    for (let i = 0; i < 10; i++) {
      const a = hash(i, 35, s) * Math.PI * 2, r = 10 + hash(i, 36, s) * (MW / 2 - 20);
      this.spawnAnimal("rabbit", clamp((cx + Math.cos(a) * r) * T, 60, (MW - 2) * T), clamp((cy + Math.sin(a) * r) * T, 60, (MH - 2) * T), false);
    }
    for (let i = 0; i < 3; i++) this.spawnAnimal("eagle", (20 + i * 10) * T, (12 + hash(i, 37, s) * 8) * T, false);
    for (let i = 0; i < 6; i++) {
      const a = hash(i, 38, s) * Math.PI * 2, r = 16 + hash(i, 39, s) * (MW / 2 - 22);
      this.spawnAnimal("raven", clamp((cx + Math.cos(a) * r) * T, 60, (MW - 2) * T), clamp((cy + Math.sin(a) * r) * T, 60, (MH - 2) * T), false);
    }
    this.spawnCamps(cx, cy);

    this.addBuilding("townCenter", cx - 2, cy - 2, true);
    for (let i = 0; i < 6; i++) this.spawnUnit("villager", (cx + (i % 3) - 1) * T, (cy + 3 + Math.floor(i / 3)) * T);
    this.cam.x = cx * T - this.vw / 2; this.cam.y = cy * T - this.vh / 2;
  }

  tile(x: number, y: number) { return x < 0 || y < 0 || x >= MW || y >= MH ? TER.WATER : this.terrain[y * MW + x]; }

  addBuilding(type: string, x: number, y: number, done = false) {
    const def = BUILDINGS[type];
    const b: Building = { id: this.nid++, type, x, y, progress: done ? 1 : 0, hp: done ? def.hp : def.hp * 0.1, maxHp: def.hp, fire: 0, queue: [], qt: 0, cd: 0, seed: Math.random(), level: 1 };
    this.buildings.push(b);
    for (let j = 0; j < def.h; j++) for (let i = 0; i < def.w; i++) this.occ[(y + j) * MW + x + i] = b.id;
    if (done && type === "pasture") {
      const pc = this.center(b);
      this.spawnAnimal("sheep", pc.x - 14, pc.y - 12, true, b.id);
      this.spawnAnimal("sheep", pc.x + 14, pc.y - 10, true, b.id);
      this.spawnAnimal("cow", pc.x + 6, pc.y + 12, true, b.id);
      this.spawnAnimal("pig", pc.x - 12, pc.y + 14, true, b.id);
    }
    return b;
  }

  spawnAnimal(kind: AnimalKind, x: number, y: number, domestic = false, pastureId?: number): Animal {
    const hpMap: Record<AnimalKind, number> = { sheep: 35, cow: 80, pig: 45, deer: 40, boar: 65, wolf: 55, bear: 130, rabbit: 8, eagle: 20, raven: 6 };
    const nameMap: Record<AnimalKind, string[]> = {
      sheep: ["Bella", "Woolly", "Fluff", "Daisy", "Snowball", "Baa-rbara"],
      cow: ["Bessie", "Daisy", "Buttercup", "Spot", "Clarabelle", "Moo-na"],
      pig: ["Pip", "Oinky", "Truffle", "Barnaby", "Rosie", "Hamlet"],
      deer: ["Wild Stag", "Forest Hind", "Swift Doe", "Wild Roe", "Red Deer"],
      boar: ["Razorback", "Tusk", "Grom", "Ironhide", "Old Tusker"],
      wolf: ["Shadow", "Fang", "Grey Ghost", "Grim", "Moonstalker"],
      bear: ["Old Grizzle", "Thunderpaw", "Ridge Breaker", "Honeybiter", "Stone Claw"],
      rabbit: ["Nibbles", "Hop", "Cotton", "Scamper", "Whiskers"],
      eagle: ["Skyhunter", "Windwing", "High Talon"],
      raven: ["Quoth", "Blackwing", "Nevermore", "Shade"],
    };
    const names = nameMap[kind];
    const name = names[Math.floor(Math.random() * names.length)];
    const hp = hpMap[kind];
    const a: Animal = {
      id: this.nid++,
      kind,
      domestic,
      x,
      y,
      gx: x + (Math.random() - 0.5) * 40,
      gy: y + (Math.random() - 0.5) * 40,
      hp,
      maxHp: hp,
      dir: Math.random() < 0.5 ? 1 : -1,
      moving: false,
      anim: Math.random() * 10,
      timer: 2 + Math.random() * 4,
      state: "graze",
      name,
      pastureId,
    };
    this.animals.push(a);
    return a;
  }

  animalById(id: number) { return this.animals.find((a) => a.id === id); }
  domesticAnimals() { return this.animals.filter((a) => a.domestic); }
  wildAnimals() { return this.animals.filter((a) => !a.domestic); }

  spawnUnit(kind: Unit["kind"], x: number, y: number, wave = 0, opts?: { tribeId?: string; homeCamp?: string; ally?: boolean }): Unit {
    const hp = kind === "villager" ? UNITS.villager.hp : kind === "soldier" ? UNITS.soldier.hp : kind === "archer" ? UNITS.archer.hp : kind === "chieftain" ? UNITS.chieftain.hp : 70 + wave * 12;
    const u: Unit = {
      id: this.nid++,
      kind,
      x,
      y,
      hp,
      maxHp: hp,
      state: "idle",
      job: 0,
      gx: x,
      gy: y,
      carry: 0,
      carryType: null,
      timer: Math.random() * 2,
      dir: 1,
      moving: false,
      anim: Math.random() * 10,
      target: 0,
      cd: 0,
      name: NAMES[Math.floor(Math.random() * NAMES.length)],
      wave,
      stance: kind === "villager" ? undefined : "patrol",
      patrolAnchor: { x, y },
      patrolAngle: Math.random() * Math.PI * 2,
      tribeId: opts?.tribeId,
      homeCamp: opts?.homeCamp,
      ally: opts?.ally,
    };
    this.units.push(u);
    return u;
  }

  // ---------- rival tribe camps ----------
  spawnCamps(cx: number, cy: number) {
    const layout: Record<string, CampBuilding[]> = {
      sunwatchers: [
        { img: "camp_tents", dx: -70, dy: -20, scale: 0.42 },
        { img: "adv_stall", dx: 55, dy: 30, scale: 0.42 },
        { img: "camp_campfire", dx: -10, dy: 65, scale: 0.5 },
      ],
      ironclads: [
        { img: "camp_fort", dx: -20, dy: -45, scale: 0.38 },
        { img: "iron_gate", dx: -105, dy: 70, scale: 0.4 },
        { img: "iron_keep", dx: 95, dy: 55, scale: 0.38 },
      ],
      riverfolk: [
        { img: "adv_house", dx: -20, dy: -55, scale: 0.36 },
        { img: "camp_tents", dx: -105, dy: 55, scale: 0.36 },
        { img: "adv_stall", dx: 90, dy: 40, scale: 0.4 },
      ],
    };
    const angles: Record<string, number> = { sunwatchers: 0.6, ironclads: 2.5, riverfolk: 4.4 };
    for (const tr of this.tribes) {
      const a0 = angles[tr.id] ?? 0.6;
      const rad = MW / 2 - 20;
      let bx = Math.round(cx + Math.cos(a0) * rad), by = Math.round(cy + Math.sin(a0) * rad);
      // walk toward center until we find dry land for the camp
      for (let s = 0; s < 30; s++) {
        let ok = true;
        for (let y = by - 4; y <= by + 4 && ok; y++) for (let x = bx - 4; x <= bx + 4 && ok; x++)
          if (this.tile(x, y) === TER.WATER) ok = false;
        if (ok) break;
        bx -= Math.round(Math.cos(a0) * 3); by -= Math.round(Math.sin(a0) * 3);
      }
      // flatten & clear the camp area
      for (let y = by - 4; y <= by + 4; y++) for (let x = bx - 4; x <= bx + 4; x++) {
        const i = y * MW + x;
        if (this.terrain[i] !== TER.WATER) { this.terrain[i] = TER.GRASS; this.occ[i] = 0; }
      }
      const camp: Camp = {
        tribeId: tr.id, x: (bx + 0.5) * T, y: (by + 0.5) * T,
        hp: 600, maxHp: 600, alive: true, warPartyT: 60, guardT: 45, smokeT: 0,
        buildings: layout[tr.id] ?? layout.sunwatchers,
      };
      this.camps.push(camp);
      for (let g = 0; g < 3; g++) {
        const gx = camp.x + (Math.random() - 0.5) * 90, gy = camp.y + (Math.random() - 0.5) * 90;
        this.spawnUnit("raider", gx, gy, 1, { tribeId: tr.id, homeCamp: tr.id });
      }
      this.minimapBase = null;
    }
  }

  campOf(tribeId: string) { return this.camps.find((c) => c.tribeId === tribeId && c.alive); }
  isAtWar(tribeId: string) { return this.warWith.has(tribeId); }

  attackCamp(tribeId: string) {
    const tr = this.tribes.find((t) => t.id === tribeId);
    if (!tr) return;
    if (!this.isAtWar(tribeId)) {
      this.warWith.add(tribeId);
      tr.relation = Math.min(tr.relation, -60);
      tr.tradePact = false; tr.defenseAlliance = false;
      this.msg(`You attacked ${tr.name}! Their warriors rise in defense.`, "bad");
    }
  }

  destroyCamp(camp: Camp) {
    camp.alive = false;
    this.puff(camp.x, camp.y, 40, "debris");
    this.puff(camp.x, camp.y - 20, 20, "fire");
    this.ringFx.push({ x: camp.x, y: camp.y, fr: "vfx_blast", life: 0, max: 1.2, rot: Math.random() * 6.28 });
    this.res.gold += 150;
    const tr = this.tribes.find((t) => t.id === camp.tribeId);
    for (const u of [...this.units]) if (u.homeCamp === camp.tribeId) { this.puff(u.x, u.y, 8, "dust"); this.units = this.units.filter((o) => o !== u); }
    this.msg(`${tr?.name ?? "The rival tribe"}'s camp lies in ruins! +150 gold`, "good");
    audio.play("victory");
  }

  updateCamps(dt: number) {
    for (const camp of this.camps) {
      if (!camp.alive) continue;
      camp.smokeT -= dt;
      if (camp.smokeT <= 0) { camp.smokeT = 0.4 + Math.random() * 0.4; this.parts.push({ x: camp.x + (Math.random() - 0.5) * 30, y: camp.y + 40, vx: (Math.random() - 0.5) * 4, vy: -14 - Math.random() * 8, life: 0, max: 2.2, size: 8, color: "#888", kind: "smoke" }); }
      const atWar = this.isAtWar(camp.tribeId);
      if (atWar) {
        // war parties march from the camp
        camp.warPartyT -= dt;
        if (camp.warPartyT <= 0) {
          camp.warPartyT = 130 + Math.random() * 40;
          const n = 2 + this.age + Math.floor(this.raidWave / 3);
          for (let i = 0; i < n; i++) {
            const u = this.spawnUnit("raider", camp.x + (Math.random() - 0.5) * 70, camp.y + 50 + (Math.random() - 0.5) * 40, this.raidWave + 1, { tribeId: camp.tribeId });
            u.wave = Math.max(1, this.raidWave);
          }
          const tr = this.tribes.find((t) => t.id === camp.tribeId);
          this.msg(`War party marching from ${tr?.name ?? "rival camp"}!`, "warn");
          audio.play("horn");
        }
        // reinforcements keep the camp defended
        camp.guardT -= dt;
        if (camp.guardT <= 0) {
          camp.guardT = 55;
          const guards = this.units.filter((u) => u.homeCamp === camp.tribeId).length;
          if (guards < 3) this.spawnUnit("raider", camp.x + (Math.random() - 0.5) * 60, camp.y + (Math.random() - 0.5) * 60, 1, { tribeId: camp.tribeId, homeCamp: camp.tribeId });
        }
      }
    }
  }

  villagers() { return this.units.filter((u) => u.kind === "villager"); }
  soldiers() { return this.units.filter((u) => u.kind === "soldier" || u.kind === "archer" || u.kind === "chieftain"); }
  archers() { return this.units.filter((u) => u.kind === "archer"); }
  chieftains() { return this.units.filter((u) => u.kind === "chieftain"); }
  raiders() { return this.units.filter((u) => u.kind === "raider"); }
  idleVillagers() { return this.units.filter((u) => u.kind === "villager" && (u.state === "wander" || (u.state === "idle" && !u.job))); }

  // ---------- group control, formations & stances ----------
  selectAllMilitary() {
    const s = this.soldiers();
    if (s.length === 0) { this.msg("No military warriors in service.", "info"); return; }
    this.selectedUnits = s.map((u) => u.id);
    this.selected = { kind: "u", id: s[0].id };
    this.msg(`Selected Army (${s.length} warriors)`, "good");
    audio.play("click");
  }

  selectAllIdleVillagers() {
    const idles = this.idleVillagers();
    if (idles.length === 0) { this.msg("All villagers are currently assigned to tasks.", "info"); return; }
    this.selectedUnits = idles.map((u) => u.id);
    this.selected = { kind: "u", id: idles[0].id };
    this.msg(`Selected ${idles.length} idle workers`, "info");
    audio.play("click");
  }

  selectAllOfKind(kind: Unit["kind"]) {
    const matching = this.units.filter((u) => u.kind === kind);
    if (matching.length === 0) return;
    this.selectedUnits = matching.map((u) => u.id);
    this.selected = { kind: "u", id: matching[0].id };
    audio.play("click");
  }

  setStanceForSelected(stance: "patrol" | "guard" | "aggressive") {
    const ids = this.selectedUnits.length > 0 ? this.selectedUnits : (this.selected?.kind === "u" ? [this.selected.id] : []);
    let count = 0;
    for (const id of ids) {
      const u = this.unitById(id);
      if (u && u.kind !== "villager" && u.kind !== "raider") {
        u.stance = stance;
        u.patrolAnchor = { x: u.x, y: u.y };
        count++;
      }
    }
    if (count > 0) {
      const label = stance === "patrol" ? "Perimeter Patrol" : stance === "guard" ? "Hold Ground / Guard" : "Aggressive Stalker";
      this.msg(`Set ${count} warrior${count > 1 ? "s" : ""} to: ${label}`, "info");
      audio.play("click");
    }
  }

  selectUnitsInBox(x1: number, y1: number, x2: number, y2: number, shift = false) {
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    const inside = this.units.filter(
      (u) => u.kind !== "raider" && u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY
    );

    if (inside.length > 0) {
      const ids = inside.map((u) => u.id);
      if (shift) {
        const set = new Set([...this.selectedUnits, ...ids]);
        this.selectedUnits = Array.from(set);
      } else {
        this.selectedUnits = ids;
      }
      this.selected = { kind: "u", id: this.selectedUnits[0] };
      audio.play("click");
      this.msg(`Selected ${this.selectedUnits.length} units`, "info");
      return true;
    }
    return false;
  }

  moveUnitsTo(unitIds: number[], tx: number, ty: number) {
    const active = this.units.filter((u) => unitIds.includes(u.id) && u.kind !== "raider");
    if (active.length === 0) return;

    const count = active.length;
    const cols = Math.ceil(Math.sqrt(count));
    const spacing = 16;

    active.forEach((u, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const offsetX = (col - (cols - 1) / 2) * spacing;
      const offsetY = (row - Math.floor(count / cols) / 2) * spacing;

      u.gx = clamp(tx + offsetX, 20, (MW - 2) * T);
      u.gy = clamp(ty + offsetY, 20, (MH - 2) * T);
      u.state = "move";
      u.target = 0;
      u.huntTarget = 0;
      if (u.kind === "villager") u.job = 0;
      u.patrolAnchor = { x: u.gx, y: u.gy };
    });

    this.puff(tx, ty, 6, "dust");
  }

  // ---------- unit separation / non-overlap physics ----------
  applyUnitSeparation(dt: number) {
    const units = this.units;
    const n = units.length;
    const minDist = 13;
    const minDistSq = minDist * minDist;

    for (let i = 0; i < n; i++) {
      const u1 = units[i];
      for (let j = i + 1; j < n; j++) {
        const u2 = units[j];
        const dx = u2.x - u1.x;
        const dy = u2.y - u1.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < minDistSq && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          const push = overlap * 0.5 * Math.min(1, dt * 18);

          u1.x -= nx * push;
          u1.y -= ny * push;
          u2.x += nx * push;
          u2.y += ny * push;
        } else if (distSq <= 0.01) {
          const ang = ((u1.id * 1.7 + u2.id * 3.1) % 6.28);
          u1.x += Math.cos(ang) * 2;
          u1.y += Math.sin(ang) * 2;
          u2.x -= Math.cos(ang) * 2;
          u2.y -= Math.sin(ang) * 2;
        }
      }
    }
  }

  // ---------- rally point management ----------
  setRallyPoint(bid: number, x: number, y: number) {
    this.ringFx.push({ x, y, fr: "vfx_ring_blue", life: 0, max: 1.1, rot: 0 });
    const b = this.byId(bid);
    if (!b) return;
    b.rallyPoint = { x, y };
    this.puff(x, y, 14, "spark");
    this.msg(`Rally point checkpoint established for ${BUILDINGS[b.type].name}`, "info");
    audio.play("click");
  }

  clearRallyPoint(bid: number) {
    const b = this.byId(bid);
    if (!b) return;
    delete b.rallyPoint;
    this.msg("Rally point cleared", "info");
    audio.play("click");
  }

  // ---------- livestock meat harvest & emergency barter ----------
  butcherLivestock(pastureId: number): boolean {
    const p = this.byId(pastureId);
    if (!p || p.type !== "pasture" || p.progress < 1) return false;
    const animals = this.animals.filter((a) => a.pastureId === pastureId);
    const candidate = animals.find((a) => a.kind === "pig" || a.kind === "cow") ?? animals[0];
    if (!candidate) {
      this.msg("No livestock ready in this pasture.", "warn");
      return false;
    }
    const meatGain = candidate.kind === "cow" ? 30 : candidate.kind === "pig" ? 22 : 14;
    const foodGain = candidate.kind === "cow" ? 25 : 12;
    this.res.meat += meatGain;
    this.res.food += foodGain;
    this.flow.meat += meatGain;
    this.floaters.push({ x: candidate.x, y: candidate.y - 15, text: `+${meatGain} Meat +${foodGain} Food`, life: 0, color: RES_COLOR.meat });
    this.puff(candidate.x, candidate.y, 8, "dust");
    this.animals = this.animals.filter((a) => a.id !== candidate.id);
    this.msg(`Harvested ${candidate.name} (+${meatGain} Meat, +${foodGain} Food). A new animal will arrive soon.`, "good");
    audio.play("harvest");
    // Respawn replacement animal after 20s
    setTimeout(() => {
      if (this.buildings.some((b) => b.id === pastureId)) {
        const pc = this.center(p);
        this.spawnAnimal(candidate.kind, pc.x + (Math.random() - 0.5) * 20, pc.y + (Math.random() - 0.5) * 20, true, pastureId);
      }
    }, 20000);
    return true;
  }

  barterMeat(): boolean {
    const canPayFood = this.res.food >= 35;
    const canPayFruits = this.res.fruits >= 25;
    const canPayVeg = this.res.vegetables >= 25;

    if (!canPayFood && !canPayFruits && !canPayVeg) {
      this.msg("Need 35 Food, 25 Fruits, or 25 Vegetables to barter for meat.", "warn");
      return false;
    }

    if (canPayFood) this.res.food -= 35;
    else if (canPayFruits) this.res.fruits -= 25;
    else this.res.vegetables -= 25;

    this.res.meat += 20;
    this.flow.meat += 20;
    this.msg("Bartered provisions with nomad traders: +20 Meat received!", "good");
    const tc = this.tc();
    if (tc) {
      const c = this.center(tc);
      this.floaters.push({ x: c.x, y: c.y - 15, text: "+20 Meat", life: 0, color: RES_COLOR.meat });
    }
    audio.play("harvest");
    return true;
  }

  selectNextIdleVillager() {
    const idles = this.idleVillagers();
    if (idles.length === 0) return null;
    const curIdx = this.selected?.kind === "u" ? idles.findIndex((u) => u.id === this.selected?.id) : -1;
    const next = idles[(curIdx + 1) % idles.length];
    this.selected = { kind: "u", id: next.id };
    this.cam.x = next.x - this.vw / 2 / this.zoom;
    this.cam.y = next.y - this.vh / 2 / this.zoom;
    this.clampCam();
    audio.play("click");
    return next;
  }

  soundAlarm() {
    const tc = this.tc();
    if (!tc) return;
    const c = this.center(tc);
    if (!this.alarmActive) {
      this.alarmActive = true;
      for (const u of this.units) {
        if (u.kind === "villager") {
          u.state = "flee";
          u.timer = 120;
          u.gx = c.x + (Math.random() - 0.5) * 16;
          u.gy = c.y + 20 + Math.random() * 16;
        }
      }
      this.msg("The Town Bell tolls! Villagers take cover INSIDE the Town Center!", "warn");
      audio.play("horn");
    } else {
      this.alarmActive = false;
      let count = 0;
      for (const u of this.units) {
        if (u.kind === "villager") {
          if (u.sheltered) {
            u.sheltered = false;
            u.x = c.x + (Math.random() - 0.5) * 44;
            u.y = c.y + 45 + Math.random() * 20;
            count++;
          }
          u.state = "idle";
          u.timer = 0;
        }
      }
      this.msg(`All Clear! ${count} villagers leave the Town Center and return to work.`, "good");
      audio.play("rankup");
    }
  }

  shelteredVillagersCount(): number {
    return this.units.filter((u) => u.kind === "villager" && u.sheltered).length;
  }

  assignBuildersToSite(bid: number) {
    const b = this.byId(bid);
    if (!b || b.progress >= 1) return;
    const vs = this.villagers().filter((v) => !v.sheltered);
    const current = vs.filter((v) => v.job === bid && (v.state === "toBuild" || v.state === "building")).length;
    const maxBuilders = b.fire > 0 ? 6 : 4;
    const needed = Math.max(0, maxBuilders - current);
    if (needed <= 0) return;

    const pool = vs.filter((v) => v.job !== bid && (v.state === "idle" || v.state === "wander"));
    if (pool.length < needed) {
      const busy = vs.filter((v) => v.job !== bid && v.state !== "toBuild" && v.state !== "building");
      pool.push(...busy);
    }
    const c = this.center(b);
    pool.sort((a, d) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(d.x - c.x, d.y - c.y));
    for (let i = 0; i < Math.min(needed, pool.length); i++) {
      const u = pool[i];
      u.job = bid;
      u.state = "toBuild";
      this.setApproach(u, b);
    }
  }

  slots(b: Building) { const d = BUILDINGS[b.type]; return d.slots ? d.slots + (b.level - 1) : 0; }
  tierName(b: Building) { return BUILDINGS[b.type].tiers?.[b.level - 1]?.name ?? BUILDINGS[b.type].name; }
  upgrade(bid: number) {
    const b = this.byId(bid); if (!b || b.progress < 1) return;
    const t = BUILDINGS[b.type].tiers; if (!t || b.level >= t.length) return;
    const next = t[b.level];
    if (b.level >= 2 && this.age < 1) { this.msg("Requires the Bronze Age", "warn"); return; }
    if (!this.afford(next.cost)) { this.msg(`Not enough resources for ${next.name}`, "bad"); return; }
    this.pay(next.cost);
    b.level++;
    b.progress = b.type === "fence" ? 1 : 0.35;
    b.maxHp = Math.round(b.maxHp * 1.5);
    if (b.type === "fence") b.hp = b.maxHp;
    if (b.type === "pasture") {
      const pc = this.center(b);
      this.spawnAnimal("sheep", pc.x + 8, pc.y - 12, true, b.id);
      this.spawnAnimal("cow", pc.x - 10, pc.y + 10, true, b.id);
    }
    // Automatically dispatch builders to finish upgrading
    if (b.progress < 1) {
      this.assignBuildersToSite(bid);
    }
    this.msg(`Upgraded to ${next.name}!`, "info");
    audio.play("upgrade");
  }

  upgradeConnectedFences(bid: number) {
    const start = this.byId(bid);
    if (!start || start.type !== "fence") return;
    const queue = [start];
    const visited = new Set<number>([start.id]);
    const toUpgrade: Building[] = [];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur.level < (BUILDINGS[cur.type].tiers?.length ?? 1)) {
        toUpgrade.push(cur);
      }
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = cur.x + dx, ny = cur.y + dy;
        const nb = this.buildings.find((o) => o.x === nx && o.y === ny && o.type === "fence");
        if (nb && !visited.has(nb.id)) {
          visited.add(nb.id);
          queue.push(nb);
        }
      }
    }
    let count = 0;
    for (const b of toUpgrade) {
      const t = BUILDINGS[b.type].tiers;
      if (!t || b.level >= t.length) continue;
      const next = t[b.level];
      if (b.level >= 2 && this.age < 1) continue;
      if (!this.afford(next.cost)) break;
      this.pay(next.cost);
      b.level++;
      b.progress = 1;
      b.maxHp = Math.round(b.maxHp * 1.5);
      b.hp = b.maxHp;
      count++;
    }
    if (count > 0) {
      this.msg(`Upgraded ${count} connected fence segments!`, "good");
      audio.play("upgrade");
    } else {
      this.msg("Not enough resources to upgrade fences", "warn");
    }
  }

  researchTech(techId: string) {
    const tech = TECHNOLOGIES.find((t) => t.id === techId);
    if (!tech) return false;
    if (this.researchedTechs.has(techId)) {
      this.msg(`${tech.name} is already researched.`, "info");
      return false;
    }
    if (tech.age > this.age) {
      this.msg(`Requires ${AGES[tech.age].name}.`, "warn");
      return false;
    }
    if (!this.afford(tech.cost)) {
      this.msg(`Not enough resources for ${tech.name}.`, "bad");
      return false;
    }
    this.pay(tech.cost);
    this.researchedTechs.add(techId);
    this.msg(`Researched ${tech.name}: ${tech.effectLabel}!`, "good");
    audio.play("rankup");
    const tc = this.tc();
    if (tc) {
      const c = this.center(tc);
      this.puff(c.x, c.y, 30, "spark");
    }
    return true;
  }

  sendTribute(tribeId: string, resKey: ResKey, amount: number) {
    const tr = this.tribes.find((t) => t.id === tribeId);
    if (!tr) return false;
    if (this.res[resKey] < amount) {
      this.msg(`Not enough ${resKey} to send tribute.`, "bad");
      return false;
    }
    this.res[resKey] -= amount;
    const isFav = tr.preferredGift === resKey;
    const bonus = isFav ? 25 : 15;
    tr.relation = Math.min(100, tr.relation + bonus);
    tr.tributeGiven += amount;
    if (this.isAtWar(tribeId) && tr.relation > -20) {
      this.warWith.delete(tribeId);
      this.msg(`${tr.name} accepts your gifts — peace is restored.`, "good");
    }
    this.msg(`Sent ${amount} ${resKey} to ${tr.name}. Relations: ${tr.relation > 0 ? "+" : ""}${tr.relation}!`, "good");
    audio.play("harvest");
    return true;
  }

  signTradePact(tribeId: string) {
    const tr = this.tribes.find((t) => t.id === tribeId);
    if (!tr) return false;
    if (tr.tradePact) return true;
    if (tr.relation < 15) {
      this.msg(`${tr.name} rejects trade. Requires at least +15 relations. Send tribute first!`, "warn");
      return false;
    }
    tr.tradePact = true;
    tr.relation = Math.min(100, tr.relation + 10);
    this.msg(`Signed Trade Agreement with ${tr.name}! Periodic trade convoys will arrive.`, "good");
    audio.play("rankup");
    return true;
  }

  signDefenseAlliance(tribeId: string) {
    const tr = this.tribes.find((t) => t.id === tribeId);
    if (!tr) return false;
    if (tr.defenseAlliance) return true;
    if (tr.relation < 55) {
      this.msg(`${tr.name} refuses defense alliance. Requires at least +55 relations.`, "warn");
      return false;
    }
    tr.defenseAlliance = true;
    tr.relation = Math.min(100, tr.relation + 15);
    this.msg(`Formed Defense Alliance with ${tr.name}! They will aid your realm in battle.`, "good");
    audio.play("victory");
    return true;
  }

  declareWar(tribeId: string) {
    const tr = this.tribes.find((t) => t.id === tribeId);
    if (!tr) return false;
    this.warWith.add(tribeId);
    const camp = this.campOf(tribeId);
    if (camp) camp.warPartyT = 12;
    tr.tradePact = false;
    tr.defenseAlliance = false;
    tr.relation = -80;
    this.msg(`War declared on ${tr.name}! Diplomatic ties severed.`, "bad");
    audio.play("horn");
    return true;
  }

  /** true if a finished well or brazier protects this building */
  guarded(b: Building) {
    const c = this.center(b);
    return this.buildings.some((o) => o.progress >= 1 && BUILDINGS[o.type].guard && Math.hypot(this.center(o).x - c.x, this.center(o).y - c.y) < (BUILDINGS[o.type].guard ?? 0) * T);
  }
  /** recompute "needs attention" flags for producer buildings */
  updateAlerts() {
    this.short.clear();
    this.refreshAlerts();
    if (this.res.food < 30 && this.rate.food <= 0) this.short.add("food");
    if (this.res.meat < UNITS.soldier.cost.meat! && this.rate.meat <= 0 && this.buildings.some((b) => b.type === "barracks")) this.short.add("meat");
  }
  refreshAlerts() {
    for (const b of this.buildings) {
      const d = BUILDINGS[b.type];
      if (b.progress < 1 || !d.produce) { b.alert = undefined; continue; }
      const workers = this.units.filter((u) => u.job === b.id).length;
      if (d.recipe) {
        const miss = (Object.keys(d.recipe) as ResKey[]).find((k) => this.res[k] < (d.recipe![k] ?? 0));
        if (miss) { b.alert = { kind: "input", res: miss }; this.short.add(miss); continue; }
      }
      if (d.need !== undefined && this.countNear(b.x + d.w / 2, b.y + d.h / 2, 7, d.need) === 0) { b.alert = { kind: "depleted", res: d.produce }; continue; }
      b.alert = workers === 0 ? { kind: "idle", res: d.produce } : undefined;
    }
  }
  roadCount() { let n = 0; for (let i = 0; i < this.road.length; i++) n += this.road[i]; return n; }
  popCap() {
    let c = 0;
    for (const b of this.buildings) if (b.progress >= 1) c += b.type === "house" ? [0, 5, 8, 12][b.level] : BUILDINGS[b.type].pop ?? 0;
    return Math.min(200, c);
  }
  pop() { return this.units.filter((u) => u.kind !== "raider").length + this.buildings.reduce((n, b) => n + b.queue.length, 0); }
  tc() { return this.buildings.find((b) => b.type === "townCenter"); }
  byId(id: number) { return this.buildings.find((b) => b.id === id); }
  unitById(id: number) { return this.units.find((u) => u.id === id); }
  center(b: Building) { const d = BUILDINGS[b.type]; return { x: (b.x + d.w / 2) * T, y: (b.y + d.h / 2) * T }; }

  msg(text: string, type: Msg["type"] = "info") {
    this.messages.unshift({ id: this.msgId++, text, type, t: this.time });
    this.messages = this.messages.slice(0, 6);
  }
  afford(c: Partial<Res>) { return (Object.keys(c) as ResKey[]).every((k) => this.res[k] >= (c[k] ?? 0)); }
  pay(c: Partial<Res>) { for (const k of Object.keys(c) as ResKey[]) this.res[k] -= c[k] ?? 0; }

  canPlace(type: string, x: number, y: number): boolean {
    const def = BUILDINGS[type];
    if (def.age > this.age) return false;
    for (let j = 0; j < def.h; j++) for (let i = 0; i < def.w; i++) {
      const tx = x + i, ty = y + j;
      if (tx < 1 || ty < 1 || tx >= MW - 1 || ty >= MH - 1) return false;
      const t = this.terrain[ty * MW + tx];
      if (t !== TER.GRASS && t !== TER.SAND && t !== TER.BERRY && t !== TER.FRUIT_TREE && t !== TER.VEG_PATCH && t !== TER.HERB_PATCH) return false;
      if (this.occ[ty * MW + tx]) return false;
      if (type !== "road" && this.road[ty * MW + tx]) return false;
      if (type === "road" && this.road[ty * MW + tx]) return false;
    }
    if (def.need !== undefined && this.countNear(x + def.w / 2, y + def.h / 2, 6, def.need) < 3) return false;
    return true;
  }
  countNear(cx: number, cy: number, r: number, t: number) {
    let n = 0;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (this.tile(x, y) === t) n++;
    return n;
  }

  place(type: string, x: number, y: number) {
    const def = BUILDINGS[type];
    if (!this.afford(def.cost)) { this.msg(`Not enough resources for ${def.name}`, "bad"); return false; }
    if (!this.canPlace(type, x, y)) return false;
    this.pay(def.cost);
    // Clear wild plants when constructing buildings
    for (let j = 0; j < def.h; j++) for (let i = 0; i < def.w; i++) {
      const idx = (y + j) * MW + x + i;
      const t = this.terrain[idx];
      if (t === TER.BERRY || t === TER.FRUIT_TREE || t === TER.VEG_PATCH || t === TER.HERB_PATCH) {
        this.terrain[idx] = TER.GRASS;
      }
    }
    if (type === "road") {
      this.road[y * MW + x] = 1;
      this.puff((x + 0.5) * T, (y + 0.5) * T, 4, "dust");
      audio.play("place_road");
    } else {
      const nb = this.addBuilding(type, x, y);
      this.assignBuildersToSite(nb.id);
      this.puff((x + def.w / 2) * T, (y + def.h / 2) * T, 10, "dust");
      if (def.cost.stone && ((def.cost.stone ?? 0) >= (def.cost.wood ?? 0))) {
        audio.play("place_stone");
      } else {
        audio.play("place_wood");
      }
    }
    return true;
  }

  dragLine(a: { x: number; y: number }, b: { x: number; y: number }) {
    const pts: { x: number; y: number }[] = [];
    const sx = Math.sign(b.x - a.x), sy = Math.sign(b.y - a.y);
    let x = a.x, y = a.y;
    pts.push({ x, y });
    while (x !== b.x) { x += sx; pts.push({ x, y }); }
    while (y !== b.y) { y += sy; pts.push({ x, y }); }
    return pts;
  }

  demolish(id: number) {
    const b = this.byId(id);
    if (!b || b.type === "townCenter") return;
    const def = BUILDINGS[b.type];
    if (b.progress < 1) for (const k of Object.keys(def.cost) as ResKey[]) this.res[k] += Math.floor((def.cost[k] ?? 0) * 0.75);
    this.destroyBuilding(b, false);
    audio.play("demolish");
  }

  destroyBuilding(b: Building, loud = true) {
    const def = BUILDINGS[b.type];
    for (let j = 0; j < def.h; j++) for (let i = 0; i < def.w; i++) this.occ[(b.y + j) * MW + b.x + i] = 0;
    this.buildings = this.buildings.filter((o) => o !== b);
    const c = this.center(b);
    this.puff(c.x, c.y, 25, "debris"); this.puff(c.x, c.y, 15, "smoke");
    for (const u of this.units) if (u.job === b.id) { u.job = 0; u.state = "idle"; }
    if (b.type === "pasture") {
      this.animals = this.animals.filter((a) => a.pastureId !== b.id);
    }
    if (this.selected?.kind === "b" && this.selected.id === b.id) this.selected = null;
    if (loud) this.msg(`${def.name} was destroyed!`, "bad");
    if (b.type === "townCenter" && !this.over) {
      this.over = true;
      this.onStory?.({ kind: "defeat", chapter: "The Fire Fades", title: "Defeat", text: "The Town Center has fallen. The Emberkin scatter into the ruins... but legends speak of those who return." });
      audio.play("defeat");
    }
  }

  train(bid: number, kind: keyof typeof UNITS) {
    const b = this.byId(bid); if (!b || b.progress < 1) return;
    const def = UNITS[kind];
    if (b.queue.length >= 5) return;
    if (this.pop() >= this.popCap()) { this.msg("Need more housing — build Huts", "warn"); return; }
    if (!this.afford(def.cost)) { this.msg(`Not enough resources for ${def.name}`, "bad"); return; }
    this.pay(def.cost);
    b.queue.push(kind);
    audio.play("click");
  }

  advanceAge() {
    if (this.age >= 2 || this.ageProgress >= 0) return;
    const c = AGES[this.age + 1].cost;
    if (!this.afford(c)) { this.msg(`Need more resources to reach the ${AGES[this.age + 1].name}`, "bad"); return; }
    this.pay(c);
    this.ageProgress = 0;
    this.msg(`Advancing to the ${AGES[this.age + 1].name}...`, "info");
  }

  puff(x: number, y: number, n: number, kind: Part["kind"]) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * (kind === "debris" ? 90 : 30);
      const colors = { smoke: "120,115,110", fire: "255,140,40", dust: "180,150,110", spark: "255,220,120", debris: "110,80,55" };
      this.parts.push({ x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (kind === "smoke" || kind === "fire" ? 20 : 0), life: 0, max: kind === "smoke" ? 2.5 : 0.6 + Math.random() * 0.8, size: kind === "smoke" ? 6 + Math.random() * 6 : 2 + Math.random() * 3, color: colors[kind], kind });
    }
  }

  // ---------- update ----------
  update(rawDt: number) {
    const panSpeed = 700 / this.zoom;
    const d = Math.min(rawDt, 0.05);
    if (this.keys.has("w") || this.keys.has("arrowup")) this.cam.y -= panSpeed * d;
    if (this.keys.has("s") || this.keys.has("arrowdown")) this.cam.y += panSpeed * d;
    if (this.keys.has("a") || this.keys.has("arrowleft")) this.cam.x -= panSpeed * d;
    if (this.keys.has("d") || this.keys.has("arrowright")) this.cam.x += panSpeed * d;
    if (this.hover.sx >= 0 && this.edgePan) {
      const m = 10;
      if (this.hover.sx < m) this.cam.x -= panSpeed * d; else if (this.hover.sx > this.vw - m) this.cam.x += panSpeed * d;
      if (this.hover.sy < m) this.cam.y -= panSpeed * d; else if (this.hover.sy > this.vh - m) this.cam.y += panSpeed * d;
    }
    this.clampCam();
    if (this.paused || this.over) return;
    const dt = d * this.speed;
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 2);

    // dynamic weather update
    const weatherRes = this.weatherSystem.update(dt, this.vw, this.vh);
    if (weatherRes.changed) {
      const meta = WEATHER_CONFIGS[this.weatherSystem.current];
      this.banner(meta.bannerTitle, meta.bannerText);
      if (this.weatherSystem.current === "rain") audio.play("flood");
      else if (this.weatherSystem.current === "ash_storm") audio.play("wildfire");
      else if (this.weatherSystem.current === "snow") audio.play("rankup");
    }

    // food consumption & flow tracking
    const eaters = this.units.filter((u) => u.kind !== "raider").length;
    const foodConsumed = eaters * 0.035 * dt;
    this.res.food = Math.max(0, this.res.food - foodConsumed);
    this.flow.food -= foodConsumed;

    // Shaman sanctuary healing aura
    const shamans = this.buildings.filter((b) => b.type === "shaman" && b.progress >= 1);
    for (const sh of shamans) {
      const sc = this.center(sh);
      for (const u of this.units) {
        if (u.kind !== "raider" && u.hp < u.maxHp && Math.hypot(u.x - sc.x, u.y - sc.y) < 7 * T) {
          u.hp = Math.min(u.maxHp, u.hp + dt * 5.5);
          if (Math.random() < dt * 0.3) this.puff(u.x, u.y - 10, 1, "spark");
        }
      }
    }

    // age
    if (this.ageProgress >= 0) {
      this.ageProgress += dt / 30;
      if (this.ageProgress >= 1) {
        this.age++; this.ageProgress = -1;
        this.msg(`Your tribe has entered the ${AGES[this.age].name}!`, "good");
        { const tc1 = this.tc(); if (tc1) { const c1 = this.center(tc1); this.ringFx.push({ x: c1.x, y: c1.y, fr: "vfx_ring_green", life: 0, max: 1.6, rot: 0 }); this.puff(c1.x, c1.y, 40, "spark"); } }
        const tc = this.tc(); if (tc) { const c = this.center(tc); this.puff(c.x, c.y, 40, "spark"); tc.maxHp += 600; tc.hp += 600; }
      }
    }

    for (const b of this.buildings) this.updateBuilding(b, dt);
    this.flowT += dt;
    if (this.flowT >= 5) {
      for (const k of Object.keys(this.rate) as ResKey[]) { this.rate[k] = this.rate[k] * 0.55 + (this.flow[k] * 60 / this.flowT) * 0.45; this.flow[k] = 0; }
      this.flowT = 0; this.updateAlerts();
    }

    // Periodic tribal trade agreements income
    this.tradeIncomeTimer += dt;
    if (this.tradeIncomeTimer >= 45) {
      this.tradeIncomeTimer = 0;
      for (const tr of this.tribes) {
        if (tr.tradePact) {
          if (tr.id === "sunwatchers") {
            this.res.fruits += 25; this.res.food += 30;
            this.msg(`Trade convoy from ${tr.name}: +30 Food, +25 Fruits!`, "good");
          } else if (tr.id === "ironclads") {
            this.res.gold += 20; this.res.tools += 3;
            this.msg(`Ore caravan from ${tr.name}: +20 Gold, +3 Tools!`, "good");
          } else if (tr.id === "riverfolk") {
            this.res.herbs += 20; this.res.clay += 25;
            this.msg(`River barge from ${tr.name}: +20 Herbs, +25 Clay!`, "good");
          }
        }
      }
    }
    for (const u of [...this.units]) this.updateUnit(u, dt);
    this.applyUnitSeparation(dt);
    this.units = this.units.filter((u) => u.hp > 0);
    this.updateAnimals(dt);
    this.updateProjs(dt);
    this.updateEvents(dt);
    this.updateCamps(dt);
    // slow tick: building alerts refresh (depleted nodes etc.)
    this.alertT -= dt;
    if (this.alertT <= 0) { this.alertT = 4; this.refreshAlerts(); }
    // slow tick: flora regrowth
    this.floraT -= dt;
    if (this.floraT <= 0) {
      this.floraT = 6;
      for (let i = 0; i < MW * MH; i += 3) {
        const t = this.terrain[i];
        if (t === TER.BERRY || t === TER.FRUIT_TREE || t === TER.VEG_PATCH || t === TER.HERB_PATCH) {
          const max = t === TER.FRUIT_TREE ? 45 : 30;
          if (this.resAmt[i] < max) this.resAmt[i] = Math.min(max, this.resAmt[i] + 0.5);
        }
      }
    }
    for (const r of this.ringFx) r.life += dt;
    this.ringFx = this.ringFx.filter((r) => r.life < r.max);

    for (const p of this.parts) {
      p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const k = p.kind === "smoke" ? 0.6 : 3; p.vx *= Math.exp(-k * dt); p.vy *= Math.exp(-k * dt);
      if (p.kind === "smoke") p.size += dt * 4;
    }
    this.parts = this.parts.filter((p) => p.life < p.max).slice(-900);
    for (const f of this.floaters) { f.life += dt; f.y -= 22 * dt; }
    this.floaters = this.floaters.filter((f) => f.life < 1.4);

    // settlement rank milestones
    const pop = this.units.filter((u) => u.kind !== "raider").length;
    const rk = RANKS.reduce((r, k, i) => (pop >= k.pop ? i : r), 0);
    if (rk > this.rank) { this.rank = rk; this.banner(RANKS[rk].name.toUpperCase(), `Your settlement has grown into a ${RANKS[rk].name}!`); const tc = this.tc(); if (tc) { const c = this.center(tc); this.ringFx.push({ x: c.x, y: c.y, fr: "vfx_ring_green", life: 0, max: 1.4, rot: 0 }); this.puff(c.x, c.y, 50, "spark"); } }
    // missions
    if (this.missionIndex < MISSIONS.length) {
      const m = MISSIONS[this.missionIndex];
      const [a, b] = m.progress(this);
      if (a >= b) {
        for (const k of Object.keys(m.reward) as ResKey[]) this.res[k] += m.reward[k] ?? 0;
        this.msg(`Mission complete: ${m.title}`, "good");
        this.missionIndex++;
        unlockChapter(this.missionIndex < MISSIONS.length ? MISSIONS[this.missionIndex].chapter : "Epilogue");
        if (this.missionIndex < MISSIONS.length) {
          const n = MISSIONS[this.missionIndex];
          this.onStory?.({ kind: "story", chapter: n.chapter, title: n.title, text: n.story });
        } else {
          this.onStory?.({ kind: "victory", chapter: "Epilogue", title: "The Fire Endures", text: "The Emberkin have become a nation of iron and faith. The Rustfang flee, the earth is tamed. Your valley shines as the first true city of the new world. Continue building your legacy." });
          audio.play("victory");
        }
      }
    }
  }

  clampCam() {
    const vw = this.vw / this.zoom, vh = this.vh / this.zoom;
    this.cam.x = clamp(this.cam.x, -100, MW * T - vw + 100);
    this.cam.y = clamp(this.cam.y, -100, MH * T - vh + 260 / this.zoom);
  }

  updateBuilding(b: Building, dt: number) {
    const def = BUILDINGS[b.type];
    const c = this.center(b);
    if (b.fire > 0) {
      const wet = this.guarded(b);
      b.fire -= dt * (wet ? 2.5 : 1); b.hp -= 9 * dt;
      if (Math.random() < dt * 14) this.puff(c.x, c.y, 1, "fire");
      if (Math.random() < dt * 4) this.puff(c.x, c.y - 10, 1, "smoke");
      if (!wet && Math.random() < dt * 0.06) {
        const n = this.buildings.find((o) => o !== b && o.fire <= 0 && Math.hypot(this.center(o).x - c.x, this.center(o).y - c.y) < 5 * T);
        if (n && !this.guarded(n)) n.fire = 18;
      }
    }
    if (b.hp <= 0) { this.destroyBuilding(b); return; }
    if (b.progress < 1) return;

    // Environmental weather wear (rain erosion, snow roof load, ash tempest corrosion)
    if (this.difficulty !== "peaceful") {
      const wear = this.weatherSystem.getDurabilityWear(b, this.guarded(b));
      if (wear > 0) {
        b.hp = Math.max(1, b.hp - wear * dt);
        if (b.hp < b.maxHp * 0.45 && Math.random() < dt * 0.2) {
          this.puff(c.x, c.y, 1, this.weatherSystem.current === "ash_storm" ? "smoke" : "dust");
        }
      }
    }

    if (b.hp < b.maxHp * 0.4 && Math.random() < dt * 2) this.puff(c.x, c.y, 1, "smoke");
    if (b.type === "house" && Math.random() < dt * 0.6) this.parts.push({ x: b.x * T + 46, y: b.y * T + 12, vx: 4, vy: -14, life: 0, max: 2.6, size: 3, color: "200,195,190", kind: "smoke" });
    if (b.queue.length) {
      const k = b.queue[0] as keyof typeof UNITS;
      b.qt += dt;
      if (b.qt >= UNITS[k].time) {
        b.qt = 0; b.queue.shift();
        const u = this.spawnUnit(k, c.x + (Math.random() - 0.5) * 20, (b.y + def.h) * T + 10);
        if (b.rallyPoint) {
          u.gx = b.rallyPoint.x + (Math.random() - 0.5) * 16;
          u.gy = b.rallyPoint.y + (Math.random() - 0.5) * 16;
          u.state = "move";
          u.patrolAnchor = { x: b.rallyPoint.x, y: b.rallyPoint.y };
          if (k !== "villager") this.stats.soldiersTrained++;
          else this.stats.villagersTrained++;
        } else if (k !== "villager") {
          this.stats.soldiersTrained++;
          u.gx = u.x; u.gy = u.y + 20;
          u.state = "guard";
          u.patrolAnchor = { x: u.x, y: u.y + 20 };
        } else {
          this.stats.villagersTrained++;
        }
        this.msg(`${UNITS[k].name} ${u.name} is ready`, "good");
        audio.play("rankup");
      }
    }
    if (b.type === "tower" || b.type === "townCenter") {
      b.cd -= dt;
      if (b.cd <= 0) {
        const sheltered = b.type === "townCenter" ? this.shelteredVillagersCount() : 0;
        const range = (b.type === "tower" ? 7 + b.level : 6 + Math.min(4, Math.floor(sheltered / 2))) * T;
        const t = this.nearest(c.x, c.y, (u) => u.kind === "raider", range);
        if (t) {
          const dmg = b.type === "tower" ? 12 + this.age * 6 + b.level * 6 : 10 + this.age * 5 + sheltered * 2.5;
          this.projs.push({ x: c.x, y: c.y - 30, sx: c.x, sy: c.y - 30, target: t.id, dmg, t: 0 });
          b.cd = b.type === "tower" ? 1.3 - b.level * 0.15 : Math.max(0.5, 2 - sheltered * 0.12);
        }
      }
    }
  }

  nearest(x: number, y: number, f: (u: Unit) => boolean, range: number) {
    let best: Unit | null = null, bd = range;
    for (const u of this.units) if (f(u)) { const d = Math.hypot(u.x - x, u.y - y); if (d < bd) { bd = d; best = u; } }
    return best;
  }

  moveTo(u: Unit, x: number, y: number, dt: number, base = 46) {
    const dx = x - u.x, dy = y - u.y, dist = Math.hypot(dx, dy);
    if (dist < 4) { u.moving = false; return true; }
    const tx = Math.floor(u.x / T), ty = Math.floor(u.y / T);
    const onRoad = this.road[ty * MW + tx] === 1;
    const tt = this.tile(tx, ty);
    const totemNearby = this.buildings.some((b) => b.type === "totem" && b.progress >= 1 && Math.hypot(this.center(b).x - u.x, this.center(b).y - u.y) < 6 * T);
    const groundMult = (onRoad ? 1.7 : this.weatherSystem.getOpenGroundSpeedMultiplier()) * (totemNearby ? 1.15 : 1);
    const sp = base * groundMult * (tt === TER.FOREST ? 0.75 : tt === TER.MARSH ? 0.5 : tt === TER.MOUNTAIN ? 0.45 : tt === TER.WATER ? 0.6 : 1);
    const step = Math.min(dist, sp * dt);
    u.x += (dx / dist) * step; u.y += (dy / dist) * step;
    if (Math.abs(dx) > 1) u.dir = dx > 0 ? 1 : -1;
    u.moving = true; u.anim += dt * sp * 0.25;
    return false;
  }

  nearestDrop(x: number, y: number, type: ResKey) {
    let best: Building | null = null, bd = Infinity;
    const isEdible = type === "food" || type === "meat" || type === "fruits" || type === "vegetables" || type === "herbs";
    for (const b of this.buildings) {
      const d = BUILDINGS[b.type];
      if (b.progress < 1 || !d.drop) continue;
      if (b.type === "granary" && !isEdible) continue;
      if (b.type === "stockpile" && isEdible) continue;
      if (d.produce && d.produce !== type && b.type !== "townCenter" && b.type !== "stockpile" && b.type !== "granary") continue;
      const c = this.center(b), dd = Math.hypot(c.x - x, c.y - y);
      if (dd < bd) { bd = dd; best = b; }
    }
    return best;
  }

  findJob(u: Unit) {
    if (u.sheltered) return;
    const vs = this.villagers().filter((v) => !v.sheltered);
    const sites = this.buildings.filter((b) => b.progress < 1 || b.fire > 0 || (b.hp < b.maxHp * 0.95 && b.type !== "townCenter") || (b.type === "townCenter" && b.hp < b.maxHp * 0.9));
    if (sites.length) {
      let best: Building | null = null, bd = Infinity;
      for (const b of sites) {
        const n = vs.filter((v) => v.job === b.id && (v.state === "toBuild" || v.state === "building")).length;
        if (n >= (b.fire > 0 ? 6 : b.progress < 1 ? 5 : 3)) continue;
        const c = this.center(b), dd = Math.hypot(c.x - u.x, c.y - u.y) - (b.fire > 0 ? 4000 : b.progress < 1 ? 2000 : 0);
        if (dd < bd) { bd = dd; best = b; }
      }
      if (best) { u.job = best.id; u.state = "toBuild"; this.setApproach(u, best); return; }
    }
    let best: Building | null = null, bs = Infinity;
    for (const b of this.buildings) {
      const d = BUILDINGS[b.type];
      if (b.progress < 1 || !d.slots) continue;
      const n = vs.filter((v) => v.job === b.id && v.state !== "toBuild" && v.state !== "building").length;
      if (n >= this.slots(b)) continue;
      const c = this.center(b);
      const score = n * 3000 + Math.hypot(c.x - u.x, c.y - u.y) + (d.produce === "food" && this.res.food < 100 ? -4000 : 0);
      if (score < bs) { bs = score; best = b; }
    }
    if (best) { u.job = best.id; this.setGather(u, best); u.state = "toWork"; return; }
    u.job = 0; u.state = "wander";
    const tc = this.tc();
    const c = tc ? this.center(tc) : { x: u.x, y: u.y };
    u.gx = c.x + (Math.random() - 0.5) * 220; u.gy = c.y + 80 + Math.random() * 80; u.timer = 3 + Math.random() * 3;
  }

  setApproach(u: Unit, b: Building) {
    const d = BUILDINGS[b.type];
    const side = Math.floor(Math.random() * 4), r = Math.random();
    const x0 = b.x * T, y0 = b.y * T, w = d.w * T, h = d.h * T;
    if (side === 0) { u.gx = x0 + r * w; u.gy = y0 - 6; }
    else if (side === 1) { u.gx = x0 + r * w; u.gy = y0 + h + 6; }
    else if (side === 2) { u.gx = x0 - 6; u.gy = y0 + r * h; }
    else { u.gx = x0 + w + 6; u.gy = y0 + r * h; }
  }

  setGather(u: Unit, b: Building) {
    const d = BUILDINGS[b.type];
    if (d.need === undefined) {
      u.gx = (b.x + 0.4 + Math.random() * (d.w - 0.8)) * T; u.gy = (b.y + 0.4 + Math.random() * (d.h - 0.8)) * T; return;
    }
    const cx = b.x + d.w / 2, cy = b.y + d.h / 2;
    const searchRad = b.type === "hunter" ? 18 : 7;
    const cands: { x: number; y: number; d: number }[] = [];
    for (let y = Math.floor(cy - searchRad); y <= cy + searchRad; y++) for (let x = Math.floor(cx - searchRad); x <= cx + searchRad; x++)
      if (this.tile(x, y) === d.need) cands.push({ x, y, d: Math.hypot(x - cx, y - cy) });
    cands.sort((a, c) => a.d - c.d);
    const harvestable = cands.filter((c) => this.resAmt[c.y * MW + c.x] > 0);
    const pool = harvestable.length ? harvestable : cands;
    const p = pool[Math.floor(Math.random() * Math.min(6, pool.length))];
    if (p) {
      u.gx = (p.x + 0.5) * T; u.gy = (p.y + 0.85) * T;
      u.srcTile = p.y * MW + p.x;
    } else {
      // Reliable fallback for hunters or harvesters so gathering never soft-locks
      u.gx = (b.x + (Math.random() - 0.5) * 5) * T;
      u.gy = (b.y + d.h + 0.5 + Math.random() * 2) * T;
    }
  }

  updateUnit(u: Unit, dt: number) {
    if (u.kind === "villager") return this.updateVillager(u, dt);
    u.cd -= dt;
    const hasForge = this.buildings.some((b) => b.type === "forge" && b.progress >= 1);
    const hasArmory = this.buildings.some((b) => b.type === "armory" && b.progress >= 1);
    const chieftainNearby = this.units.some((o) => o.kind === "chieftain" && o.id !== u.id && Math.hypot(o.x - u.x, o.y - u.y) < 6 * T);
    const buff = (hasForge ? 1.6 : 1) * (hasArmory ? 1.25 : 1) * (chieftainNearby ? 1.35 : 1);

    // Hunting wild game order
    if (u.huntTarget) {
      const prey = this.animalById(u.huntTarget);
      if (prey && prey.hp > 0) {
        const d = Math.hypot(prey.x - u.x, prey.y - u.y);
        const range = u.kind === "archer" ? 6.5 * T : 20;
        if (d > range) {
          this.moveTo(u, prey.x, prey.y, dt, u.kind === "soldier" ? 58 : u.kind === "archer" ? 54 : 64);
        } else {
          u.moving = false;
          u.dir = prey.x > u.x ? 1 : -1;
          if (u.cd <= 0) {
            u.cd = u.kind === "archer" ? 1.15 : 0.92;
            if (u.kind === "archer") {
              this.projs.push({ x: u.x, y: u.y - 8, sx: u.x, sy: u.y - 8, target: prey.id, dmg: (12 + this.age * 5) * buff, t: 0 });
            } else {
              this.hitAnimal(prey, (u.kind === "soldier" ? 16 : 24) * buff, u);
            }
          }
        }
        return;
      } else {
        u.huntTarget = 0;
      }
    }

    // ordered assault on a rival camp
    if (u.campTarget) {
      const camp = this.camps.find((c) => c.tribeId === u.campTarget && c.alive);
      if (!camp) { u.campTarget = undefined; }
      else {
        const dist = Math.hypot(camp.x - u.x, camp.y - u.y);
        if (dist > 46) { this.moveTo(u, camp.x, camp.y, dt, u.kind === "chieftain" ? 62 : 56); }
        else {
          u.moving = false; u.dir = camp.x > u.x ? 1 : -1;
          if (u.cd <= 0) {
            u.cd = 0.95;
            const dmg = (u.kind === "chieftain" ? 34 : u.kind === "archer" ? 16 : 18) + this.age * 6;
            camp.hp -= dmg;
            this.attackCamp(camp.tribeId);
            this.puff(camp.x + (Math.random() - 0.5) * 50, camp.y + (Math.random() - 0.5) * 30, 3, "debris");
            if (camp.hp <= 0) { this.destroyCamp(camp); u.campTarget = undefined; }
          }
        }
        return;
      }
    }

    // allied helper: return home when the raid is over
    if (u.ally && u.homeCamp) {
      const camp = this.campOf(u.homeCamp);
      if (!this.raidActive) {
        if (camp) {
          const d = Math.hypot(camp.x - u.x, camp.y - u.y);
          if (d > 60) { this.moveTo(u, camp.x, camp.y, dt, 52); return; }
          this.units = this.units.filter((o) => o !== u);
          this.puff(camp.x, camp.y, 4, "dust");
          return;
        }
      }
    }

    if (u.kind === "soldier") {
      const tc = this.tc();
      let t = u.target ? this.unitById(u.target) : undefined;
      const aggroRad = u.stance === "guard" ? 3.5 * T : u.stance === "aggressive" ? 16 * T : 11 * T;
      if (!t || t.hp <= 0) {
        t = this.nearest(u.x, u.y, (o) => o.kind === "raider", aggroRad) ?? (tc && u.stance !== "guard" ? this.nearest(this.center(tc).x, this.center(tc).y, (o) => o.kind === "raider", 16 * T) : null) ?? undefined;
        u.target = t?.id ?? 0;
      }
      if (t && u.state !== "move") {
        if (Math.hypot(t.x - u.x, t.y - u.y) > 18) this.moveTo(u, t.x, t.y, dt, 58);
        else { u.moving = false; u.dir = t.x > u.x ? 1 : -1; if (u.cd <= 0) { u.cd = 0.9; this.hit(t, (14 + this.age * 5) * buff, u); } }
      } else if (u.state === "move") {
        if (this.moveTo(u, u.gx, u.gy, dt, 58)) { u.state = "guard"; u.anim += dt; }
      } else if (u.stance === "patrol") {
        // Autonomous perimeter patrol
        u.timer -= dt;
        if (!u.patrolAnchor) u.patrolAnchor = { x: u.gx || u.x, y: u.gy || u.y };
        if (u.timer <= 0) {
          u.timer = 5 + Math.random() * 5;
          u.patrolAngle = (u.patrolAngle ?? 0) + 1.2 + Math.random() * 0.8;
          const rad = (3.5 + (u.id % 3) * 1.5) * T;
          u.gx = clamp(u.patrolAnchor.x + Math.cos(u.patrolAngle) * rad, 30, (MW - 2) * T);
          u.gy = clamp(u.patrolAnchor.y + Math.sin(u.patrolAngle) * rad, 30, (MH - 2) * T);
        }
        this.moveTo(u, u.gx, u.gy, dt, 38);
      } else {
        if (!u.patrolAnchor) u.patrolAnchor = { x: u.x, y: u.y };
        if (Math.hypot(u.patrolAnchor.x - u.x, u.patrolAnchor.y - u.y) > 10) this.moveTo(u, u.patrolAnchor.x, u.patrolAnchor.y, dt, 42);
        else u.moving = false;
      }
      if (u.hp < u.maxHp && !t) u.hp = Math.min(u.maxHp, u.hp + dt * 2.5);
      return;
    }

    if (u.kind === "archer") {
      const tc = this.tc();
      let t = u.target ? this.unitById(u.target) : undefined;
      const range = 7.5 * T;
      const aggroRad = u.stance === "guard" ? range : u.stance === "aggressive" ? 16 * T : range + 2 * T;
      if (!t || t.hp <= 0) {
        t = this.nearest(u.x, u.y, (o) => o.kind === "raider", aggroRad) ?? (tc && u.stance !== "guard" ? this.nearest(this.center(tc).x, this.center(tc).y, (o) => o.kind === "raider", 14 * T) : null) ?? undefined;
        u.target = t?.id ?? 0;
      }
      if (t && u.state !== "move") {
        const d = Math.hypot(t.x - u.x, t.y - u.y);
        u.dir = t.x > u.x ? 1 : -1;
        if (d > range) this.moveTo(u, t.x, t.y, dt, 54);
        else {
          u.moving = false;
          if (u.cd <= 0) {
            u.cd = 1.15;
            this.projs.push({ x: u.x, y: u.y - 8, sx: u.x, sy: u.y - 8, target: t.id, dmg: (12 + this.age * 5) * buff, t: 0 });
          }
        }
      } else if (u.state === "move") {
        if (this.moveTo(u, u.gx, u.gy, dt, 54)) { u.state = "guard"; u.anim += dt; }
      } else if (u.stance === "patrol") {
        u.timer -= dt;
        if (!u.patrolAnchor) u.patrolAnchor = { x: u.gx || u.x, y: u.gy || u.y };
        if (u.timer <= 0) {
          u.timer = 6 + Math.random() * 5;
          u.patrolAngle = (u.patrolAngle ?? 0) + 1.2 + Math.random() * 0.8;
          const rad = (3.5 + (u.id % 3) * 1.5) * T;
          u.gx = clamp(u.patrolAnchor.x + Math.cos(u.patrolAngle) * rad, 30, (MW - 2) * T);
          u.gy = clamp(u.patrolAnchor.y + Math.sin(u.patrolAngle) * rad, 30, (MH - 2) * T);
        }
        this.moveTo(u, u.gx, u.gy, dt, 36);
      } else {
        if (!u.patrolAnchor) u.patrolAnchor = { x: u.x, y: u.y };
        if (Math.hypot(u.patrolAnchor.x - u.x, u.patrolAnchor.y - u.y) > 10) this.moveTo(u, u.patrolAnchor.x, u.patrolAnchor.y, dt, 40);
        else u.moving = false;
      }
      if (u.hp < u.maxHp && !t) u.hp = Math.min(u.maxHp, u.hp + dt * 2);
      return;
    }

    if (u.kind === "chieftain") {
      const tc = this.tc();
      let t = u.target ? this.unitById(u.target) : undefined;
      const aggroRad = u.stance === "guard" ? 4 * T : u.stance === "aggressive" ? 18 * T : 13 * T;
      if (!t || t.hp <= 0) {
        t = this.nearest(u.x, u.y, (o) => o.kind === "raider", aggroRad) ?? (tc && u.stance !== "guard" ? this.nearest(this.center(tc).x, this.center(tc).y, (o) => o.kind === "raider", 16 * T) : null) ?? undefined;
        u.target = t?.id ?? 0;
      }
      if (t && u.state !== "move") {
        if (Math.hypot(t.x - u.x, t.y - u.y) > 20) this.moveTo(u, t.x, t.y, dt, 64);
        else { u.moving = false; u.dir = t.x > u.x ? 1 : -1; if (u.cd <= 0) { u.cd = 0.95; this.hit(t, (25 + this.age * 8) * buff, u); } }
      } else if (u.state === "move") {
        if (this.moveTo(u, u.gx, u.gy, dt, 64)) { u.state = "guard"; u.anim += dt; }
      } else if (u.stance === "patrol") {
        u.timer -= dt;
        if (!u.patrolAnchor) u.patrolAnchor = { x: u.gx || u.x, y: u.gy || u.y };
        if (u.timer <= 0) {
          u.timer = 5 + Math.random() * 4;
          u.patrolAngle = (u.patrolAngle ?? 0) + 1.1 + Math.random() * 0.7;
          const rad = 4 * T;
          u.gx = clamp(u.patrolAnchor.x + Math.cos(u.patrolAngle) * rad, 30, (MW - 2) * T);
          u.gy = clamp(u.patrolAnchor.y + Math.sin(u.patrolAngle) * rad, 30, (MH - 2) * T);
        }
        this.moveTo(u, u.gx, u.gy, dt, 40);
      } else {
        if (!u.patrolAnchor) u.patrolAnchor = { x: u.x, y: u.y };
        if (Math.hypot(u.patrolAnchor.x - u.x, u.patrolAnchor.y - u.y) > 10) this.moveTo(u, u.patrolAnchor.x, u.patrolAnchor.y, dt, 44);
        else u.moving = false;
      }
      if (u.hp < u.maxHp && !t) u.hp = Math.min(u.maxHp, u.hp + dt * 4);
      return;
    }
    // raider
    if (u.tribeId && u.homeCamp && !this.isAtWar(u.tribeId)) {
      // rival camp guard at peace: patrol the camp, never initiate violence
      const camp = this.campOf(u.tribeId);
      if (camp) {
        u.timer -= dt;
        if (u.timer <= 0) {
          u.timer = 4 + Math.random() * 4;
          u.patrolAngle = (u.patrolAngle ?? Math.random() * 6.28) + 1.1 + Math.random() * 0.9;
          const rad = (2.5 + (u.id % 3)) * T;
          u.gx = clamp(camp.x + Math.cos(u.patrolAngle) * rad, 30, (MW - 2) * T);
          u.gy = clamp(camp.y + Math.sin(u.patrolAngle) * rad, 30, (MH - 2) * T);
        }
        if (!camp.alive) { this.units = this.units.filter((o) => o !== u); return; }
        this.moveTo(u, u.gx, u.gy, dt, 34);
        return;
      }
    }
    let t: Unit | Building | undefined;
    if (u.target) t = this.unitById(u.target) ?? this.byId(u.target);
    if (!t || u.timer <= 0) {
      u.timer = 1.2;
      const near = this.nearest(u.x, u.y, (o) => o.kind !== "raider", 5 * T);
      if (near) t = near;
      else {
        let bd = Infinity, bb: Building | undefined;
        for (const b of this.buildings) { const c = this.center(b), dd = Math.hypot(c.x - u.x, c.y - u.y) - (b.type === "wall" ? 60 : 0); if (dd < bd) { bd = dd; bb = b; } }
        t = bb;
      }
      u.target = t?.id ?? 0;
    }
    u.timer -= dt;
    if (!t) return;
    if ("kind" in t) {
      if (Math.hypot(t.x - u.x, t.y - u.y) > 16) this.moveTo(u, t.x, t.y, dt, 44);
      else { u.moving = false; if (u.cd <= 0) { u.cd = 1.1; this.hit(t, 9 + u.wave * 1.5, u); } }
    } else {
      const d = BUILDINGS[t.type];
      const px = clamp(u.x, t.x * T, (t.x + d.w) * T), py = clamp(u.y, t.y * T, (t.y + d.h) * T);
      if (Math.hypot(px - u.x, py - u.y) > 14) this.moveTo(u, px, py, dt, 44);
      else {
        u.moving = false;
        if (u.cd <= 0) {
          u.cd = 1.2; t.hp -= 14 + u.wave * 2; this.puff(px, py, 3, "debris");
          if (Math.random() < 0.06 && t.fire <= 0 && t.type !== "wall") { t.fire = 15; this.msg(`Raiders set fire to a ${BUILDINGS[t.type].name}!`, "bad"); }
        }
      }
    }
  }

  hit(t: Unit, dmgRaw: number, from?: Unit) {
    const ARMOR: Record<string, number> = { villager: 0, soldier: 5, archer: 2, chieftain: 10, raider: 3 };
    const CRIT: Record<string, number> = { villager: 0, soldier: 0.08, archer: 0.12, chieftain: 0.15, raider: 0.1 };
    let dmg = dmgRaw;
    const armor = ARMOR[t.kind] ?? 0;
    dmg = Math.max(1, dmg - armor * 0.6);
    if (from && CRIT[from.kind] && Math.random() < CRIT[from.kind]) {
      dmg = Math.round(dmg * 1.75);
      this.floaters.push({ x: t.x, y: t.y - 22, text: "CRIT " + dmg, life: 0, color: "#ff5d3a" });
      this.puff(t.x, t.y - 8, 5, "spark");
    }
    t.hp -= dmg;
    this.puff(t.x, t.y - 6, 2, "spark");
    if (from && t.kind === "villager") { t.state = "flee"; t.timer = 4; }
    if (t.hp <= 0) {
      this.puff(t.x, t.y, 8, "dust");
      if (t.kind === "raider") this.floaters.push({ x: t.x, y: t.y - 10, text: "+5 gold", life: 0, color: "#f5c542" }), (this.res.gold += 5);
      else this.msg(`${t.kind === "soldier" ? "Warrior" : "Villager"} ${t.name} has fallen`, "bad");
      if (this.selected?.kind === "u" && this.selected.id === t.id) this.selected = null;
      if (this.selectedUnits.includes(t.id)) this.selectedUnits = this.selectedUnits.filter((x) => x !== t.id);
    }
  }

  hitAnimal(a: Animal, dmg: number, from?: Unit) {
    a.hp -= dmg;
    this.puff(a.x, a.y - 4, 3, "spark");
    if (a.kind === "deer" || a.domestic) {
      a.state = "flee";
      a.timer = 5;
      if (from) {
        const dx = a.x - from.x, dy = a.y - from.y;
        const dist = Math.hypot(dx, dy) || 1;
        a.gx = clamp(a.x + (dx / dist) * 130, 40, (MW - 2) * T);
        a.gy = clamp(a.y + (dy / dist) * 130, 40, (MH - 2) * T);
      }
    } else if (a.kind === "boar" || a.kind === "wolf") {
      if (from && a.hp > 0 && Math.hypot(from.x - a.x, from.y - a.y) < 22) {
        from.hp -= 10;
        this.puff(from.x, from.y - 4, 2, "debris");
      }
    } else if (a.kind === "bear") {
      // wounded bears fight back hard
      if (from && a.hp > 0) { a.state = "hunt"; from.hp -= 18; this.puff(from.x, from.y - 4, 3, "debris"); this.msg(`The bear mauls ${from.name}!`, "warn"); }
    } else if (a.kind === "rabbit") {
      a.state = "flee"; a.timer = 5;
      if (from) {
        const dx = a.x - from.x, dy = a.y - from.y, dist = Math.hypot(dx, dy) || 1;
        a.gx = clamp(a.x + (dx / dist) * 150, 40, (MW - 2) * T);
        a.gy = clamp(a.y + (dy / dist) * 150, 40, (MH - 2) * T);
      }
    }
    if (a.hp <= 0) {
      this.puff(a.x, a.y, 10, "dust");
      if (a.kind === "deer") {
        this.res.meat += 12; this.res.food += 8;
        this.floaters.push({ x: a.x, y: a.y - 12, text: "+12 Meat +8 Food", life: 0, color: RES_COLOR.meat });
      } else if (a.kind === "boar") {
        this.res.meat += 18; this.res.food += 10;
        this.floaters.push({ x: a.x, y: a.y - 12, text: "+18 Meat", life: 0, color: RES_COLOR.meat });
      } else if (a.kind === "wolf") {
        this.res.gold += 15;
        this.floaters.push({ x: a.x, y: a.y - 12, text: "+15 Gold Bounty", life: 0, color: RES_COLOR.gold });
      } else if (a.kind === "sheep") {
        this.res.wool += 8; this.res.meat += 8;
        this.floaters.push({ x: a.x, y: a.y - 12, text: "+8 Wool +8 Meat", life: 0, color: RES_COLOR.wool });
      } else if (a.kind === "cow") {
        this.res.food += 20; this.res.meat += 14;
        this.floaters.push({ x: a.x, y: a.y - 12, text: "+20 Food +14 Meat", life: 0, color: RES_COLOR.food });
      } else if (a.kind === "pig") {
        this.res.meat += 18;
        this.floaters.push({ x: a.x, y: a.y - 12, text: "+18 Meat", life: 0, color: RES_COLOR.meat });
      } else if (a.kind === "bear") {
        this.res.meat += 45; this.res.food += 20;
        this.floaters.push({ x: a.x, y: a.y - 12, text: "+45 Meat +20 Food", life: 0, color: RES_COLOR.meat });
      } else if (a.kind === "rabbit") {
        this.res.meat += 6;
        this.floaters.push({ x: a.x, y: a.y - 12, text: "+6 Meat", life: 0, color: RES_COLOR.meat });
      } else if (a.kind === "eagle" || a.kind === "raven") {
        this.res.food += 4;
        this.floaters.push({ x: a.x, y: a.y - 12, text: "+4 Food", life: 0, color: RES_COLOR.food });
      }
      this.animals = this.animals.filter((o) => o !== a);
      if (this.selected?.kind === "a" && this.selected.id === a.id) this.selected = null;
    }
  }

  updateAnimals(dt: number) {
    this.wildlifeTimer += dt;
    if (this.wildlifeTimer > 18) {
      this.wildlifeTimer = 0;
      const wildDeer = this.animals.filter((a) => !a.domestic && a.kind === "deer").length;
      const wildBoar = this.animals.filter((a) => !a.domestic && a.kind === "boar").length;
      const cx = MW / 2, cy = MH / 2;
      if (wildDeer < 14) {
        const a = Math.random() * Math.PI * 2, r = 18 + Math.random() * (MW / 2 - 28);
        this.spawnAnimal("deer", (cx + Math.cos(a) * r) * T, (cy + Math.sin(a) * r) * T, false);
      }
      if (wildBoar < 8) {
        const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * (MW / 2 - 26);
        this.spawnAnimal("boar", (cx + Math.cos(a) * r) * T, (cy + Math.sin(a) * r) * T, false);
      }
      const rabbits = this.animals.filter((a) => a.kind === "rabbit").length;
      if (rabbits < 10) {
        const a = Math.random() * Math.PI * 2, r = 16 + Math.random() * (MW / 2 - 24);
        this.spawnAnimal("rabbit", (cx + Math.cos(a) * r) * T, (cy + Math.sin(a) * r) * T, false);
      }
      const bears = this.animals.filter((a) => a.kind === "bear").length;
      if (bears < 3) {
        const a = Math.random() * Math.PI * 2, r = 22 + Math.random() * (MW / 2 - 26);
        this.spawnAnimal("bear", (cx + Math.cos(a) * r) * T, (cy + Math.sin(a) * r) * T, false);
      }
    }

    for (const a of [...this.animals]) {
      a.timer -= dt;
      a.anim += dt * (a.moving ? 5 : 1);

      // EAGLE: high soaring ambient hunter — circles far above
      if (a.kind === "eagle") {
        if (a.timer <= 0) {
          a.timer = 6 + Math.random() * 6;
          const a2 = Math.random() * Math.PI * 2, r2 = 30 + Math.random() * (MW / 2 - 40);
          a.gx = clamp((MW / 2 + Math.cos(a2) * r2) * T, 40, (MW - 2) * T);
          a.gy = clamp((MH / 2 + Math.sin(a2) * r2) * T, 40, (MH - 2) * T);
        }
        const dx = a.gx - a.x, dy = a.gy - a.y, dist = Math.hypot(dx, dy);
        if (dist > 10) { a.x += (dx / dist) * 70 * dt; a.y += (dy / dist) * 70 * dt; a.dir = dx > 0 ? 1 : -1; a.moving = true; }
        else a.moving = false;
        continue;
      }

      // RAVEN: hops around, pecks at the ground, flutters away from crowds
      if (a.kind === "raven") {
        const threat = this.units.find((u) => Math.hypot(u.x - a.x, u.y - a.y) < 50);
        if (threat && a.state !== "flee") {
          a.state = "flee"; a.timer = 4;
          const dx = a.x - threat.x, dy = a.y - threat.y, dist = Math.hypot(dx, dy) || 1;
          a.gx = clamp(a.x + (dx / dist) * 120, 40, (MW - 2) * T);
          a.gy = clamp(a.y + (dy / dist) * 120, 40, (MH - 2) * T);
        }
        if (a.state === "flee") {
          const dx = a.gx - a.x, dy = a.gy - a.y, dist = Math.hypot(dx, dy);
          if (dist > 4) { a.x += (dx / dist) * 55 * dt; a.y += (dy / dist) * 55 * dt; a.dir = dx > 0 ? 1 : -1; a.moving = true; }
          else { a.moving = false; a.state = "graze"; a.timer = 3 + Math.random() * 3; }
        } else if (a.timer <= 0) {
          a.timer = 3 + Math.random() * 4;
          a.gx = clamp(a.x + (Math.random() - 0.5) * 60, 40, (MW - 2) * T);
          a.gy = clamp(a.y + (Math.random() - 0.5) * 60, 40, (MH - 2) * T);
          a.state = "wander";
        }
        if (a.state === "wander") {
          const dx = a.gx - a.x, dy = a.gy - a.y, dist = Math.hypot(dx, dy);
          if (dist > 3) { a.x += (dx / dist) * 26 * dt; a.y += (dy / dist) * 26 * dt; a.dir = dx > 0 ? 1 : -1; a.moving = true; }
          else { a.moving = false; a.state = "graze"; }
        } else a.moving = false;
        continue;
      }

      // RABBIT: timid — always flees approaching units
      if (a.kind === "rabbit") {
        const threat = this.units.find((u) => Math.hypot(u.x - a.x, u.y - a.y) < 80);
        if (threat && a.state !== "flee") {
          a.state = "flee"; a.timer = 4;
          const dx = a.x - threat.x, dy = a.y - threat.y, dist = Math.hypot(dx, dy) || 1;
          a.gx = clamp(a.x + (dx / dist) * 150, 40, (MW - 2) * T);
          a.gy = clamp(a.y + (dy / dist) * 150, 40, (MH - 2) * T);
        }
        if (a.state === "flee") {
          const dx = a.gx - a.x, dy = a.gy - a.y, dist = Math.hypot(dx, dy);
          if (dist > 4) { a.x += (dx / dist) * 78 * dt; a.y += (dy / dist) * 78 * dt; a.dir = dx > 0 ? 1 : -1; a.moving = true; }
          else { a.moving = false; a.state = "graze"; a.timer = 2 + Math.random() * 3; }
        } else if (a.timer <= 0) {
          a.timer = 2 + Math.random() * 3;
          a.gx = clamp(a.x + (Math.random() - 0.5) * 50, 40, (MW - 2) * T);
          a.gy = clamp(a.y + (Math.random() - 0.5) * 50, 40, (MH - 2) * T);
          a.state = "wander";
        }
        if (a.state === "wander") {
          const dx = a.gx - a.x, dy = a.gy - a.y, dist = Math.hypot(dx, dy);
          if (dist > 3) { a.x += (dx / dist) * 30 * dt; a.y += (dy / dist) * 30 * dt; a.dir = dx > 0 ? 1 : -1; a.moving = true; }
          else { a.moving = false; a.state = "graze"; }
        } else a.moving = false;
        continue;
      }

      // BEAR: territorial apex beast — attacks units that stray too close
      if (a.kind === "bear") {
        const prey = this.units.find((u) => u.kind !== "raider" && Math.hypot(u.x - a.x, u.y - a.y) < 55);
        if (prey) {
          a.state = "hunt";
          const dx = prey.x - a.x, dy = prey.y - a.y, dist = Math.hypot(dx, dy);
          if (dist > 16) { a.x += (dx / dist) * 46 * dt; a.y += (dy / dist) * 46 * dt; a.dir = dx > 0 ? 1 : -1; a.moving = true; }
          else {
            a.moving = false;
            prey.hp -= 14 * dt;
            this.puff(prey.x, prey.y - 4, 1, "debris");
            if (prey.hp <= 0) this.hit(prey, 1);
          }
          continue;
        } else if (a.state === "hunt") { a.state = "graze"; a.timer = 2 + Math.random() * 3; }
      }

      if (a.state === "flee") {
        const speed = a.kind === "deer" ? 64 : 48;
        const dx = a.gx - a.x, dy = a.gy - a.y, dist = Math.hypot(dx, dy);
        if (dist > 4) {
          a.x += (dx / dist) * speed * dt;
          a.y += (dy / dist) * speed * dt;
          a.dir = dx > 0 ? 1 : -1;
          a.moving = true;
        } else {
          a.moving = false;
        }
        if (a.timer <= 0) {
          a.state = "graze";
          a.timer = 3 + Math.random() * 4;
        }
        continue;
      }

      // Check proximity to threats (villagers, soldiers, wolves) for wild deer
      if (a.kind === "deer" && !a.domestic) {
        const threat = this.units.find((u) => Math.hypot(u.x - a.x, u.y - a.y) < 110)
          ?? this.animals.find((o) => o.kind === "wolf" && Math.hypot(o.x - a.x, o.y - a.y) < 120);
        if (threat) {
          a.state = "flee";
          a.timer = 5;
          const dx = a.x - threat.x, dy = a.y - threat.y;
          const dist = Math.hypot(dx, dy) || 1;
          a.gx = clamp(a.x + (dx / dist) * 140, 40, (MW - 2) * T);
          a.gy = clamp(a.y + (dy / dist) * 140, 40, (MH - 2) * T);
          continue;
        }
      }

      // Wolves hunt stray deer or unescorted sheep
      if (a.kind === "wolf") {
        const prey = this.animals.find((o) => (o.kind === "deer" || (o.domestic && o.kind === "sheep")) && Math.hypot(o.x - a.x, o.y - a.y) < 130);
        if (prey) {
          const dx = prey.x - a.x, dy = prey.y - a.y, dist = Math.hypot(dx, dy);
          if (dist > 18) {
            a.x += (dx / dist) * 44 * dt;
            a.y += (dy / dist) * 44 * dt;
            a.dir = dx > 0 ? 1 : -1;
            a.moving = true;
          } else {
            a.moving = false;
            this.hitAnimal(prey, 16 * dt);
          }
          continue;
        }
      }

      // Domestic animals or peaceful wild animals wandering / grazing
      if (a.state === "wander") {
        const speed = a.domestic ? 22 : 32;
        const dx = a.gx - a.x, dy = a.gy - a.y, dist = Math.hypot(dx, dy);
        if (dist > 3) {
          a.x += (dx / dist) * speed * dt;
          a.y += (dy / dist) * speed * dt;
          a.dir = dx > 0 ? 1 : -1;
          a.moving = true;
        } else {
          a.moving = false;
          a.state = "graze";
          a.timer = 3 + Math.random() * 5;
        }
      } else {
        // grazing
        a.moving = false;
        if (a.timer <= 0) {
          a.state = "wander";
          a.timer = 4 + Math.random() * 5;
          if (a.domestic && a.pastureId) {
            const pb = this.byId(a.pastureId);
            const c = pb ? this.center(pb) : { x: a.x, y: a.y };
            a.gx = c.x + (Math.random() - 0.5) * 60;
            a.gy = c.y + (Math.random() - 0.5) * 60;
          } else {
            a.gx = clamp(a.x + (Math.random() - 0.5) * 80, 50, (MW - 2) * T);
            a.gy = clamp(a.y + (Math.random() - 0.5) * 80, 50, (MH - 2) * T);
          }
        }
      }
    }
  }

  updateVillager(u: Unit, dt: number) {
    if (u.sheltered) {
      u.moving = false;
      return;
    }
    const job = u.job ? this.byId(u.job) : undefined;
    if (u.state === "flee") {
      const tc = this.tc();
      if (tc) {
        const c = this.center(tc);
        const dist = Math.hypot(c.x - u.x, c.y - u.y);
        if (this.alarmActive && dist < 40) {
          u.sheltered = true;
          u.moving = false;
          u.x = c.x;
          u.y = c.y;
          this.puff(c.x, c.y + 15, 2, "dust");
          return;
        }
        this.moveTo(u, c.x, c.y + 24, dt, 64);
      }
      if (!this.alarmActive) {
        u.timer -= dt;
        if (u.timer <= 0) u.state = "idle";
      }
      return;
    }
    if (u.state === "move") { if (this.moveTo(u, u.gx, u.gy, dt)) u.state = "idle"; return; }
    if (u.state === "idle" || (u.state !== "wander" && u.state !== "toDrop" && !job)) { this.findJob(u); return; }
    if (u.state === "wander") {
      if (this.moveTo(u, u.gx, u.gy, dt, 30)) { u.timer -= dt; if (u.timer <= 0) u.state = "idle"; }
      else if (Math.random() < dt * 0.5) u.timer -= 1;
      return;
    }
    if (!job && u.state !== "toDrop") return;
    if (u.state === "toBuild" && job) {
      if (this.moveTo(u, u.gx, u.gy, dt)) u.state = "building";
    } else if (u.state === "building" && job) {
      u.moving = false; u.anim += dt * 6;
      const d = BUILDINGS[job.type];
      const c = this.center(job); u.dir = c.x > u.x ? 1 : -1;
      if (Math.random() < dt * 3) this.puff(u.x + u.dir * 8, u.y - 4, 1, "dust");
      if (job.fire > 0) { job.fire -= dt * 1.5; if (job.fire <= 0) { job.fire = 0; this.msg("Fire extinguished", "good"); } }
      else if (job.progress < 1) {
        const p = dt / Math.max(1, d.build);
        job.progress = Math.min(1, job.progress + p); job.hp = Math.min(job.maxHp, job.hp + job.maxHp * 0.9 * p);
        if (job.progress >= 1) {
          this.stats.buildingsBuilt++;
          this.msg(`${d.name} completed`, "good");
          this.puff(c.x, c.y, 18, "spark");
          if (job.type === "pasture" && !this.animals.some((a) => a.pastureId === job.id)) {
            const pc = this.center(job);
            this.spawnAnimal("sheep", pc.x - 14, pc.y - 12, true, job.id);
            this.spawnAnimal("sheep", pc.x + 14, pc.y - 10, true, job.id);
            this.spawnAnimal("cow", pc.x + 6, pc.y + 12, true, job.id);
            this.spawnAnimal("pig", pc.x - 12, pc.y + 14, true, job.id);
            this.msg("Livestock pasture stocked with sheep, cows, and pigs!", "good");
          }
          // Automatically chain to next unfinished construction site or repair
          const nextSite = this.buildings.find((o) => o.id !== job.id && (o.progress < 1 || o.fire > 0 || o.hp < o.maxHp * 0.9));
          if (nextSite) {
            u.job = nextSite.id;
            u.state = "toBuild";
            this.setApproach(u, nextSite);
          } else {
            u.state = "idle";
            u.job = 0;
          }
        }
      } else if (job.hp < job.maxHp) {
        job.hp = Math.min(job.maxHp, job.hp + 25 * dt);
      } else {
        const nextSite = this.buildings.find((o) => o.id !== job.id && (o.progress < 1 || o.fire > 0 || o.hp < o.maxHp * 0.9));
        if (nextSite) {
          u.job = nextSite.id;
          u.state = "toBuild";
          this.setApproach(u, nextSite);
        } else {
          u.state = "idle";
          u.job = 0;
        }
      }
    } else if (u.state === "toWork" && job) {
      if (this.moveTo(u, u.gx, u.gy, dt)) {
        const d = BUILDINGS[job.type];
        const cycleBase = (d.produce === "food" && this.drought > 0 ? 13 : 5.5) * (job.type === "farm" ? [1, 1, 0.8, 0.6][job.level] : 1);
        u.state = "working";
        u.timer = cycleBase * this.weatherSystem.getCycleTimeMultiplier(job.type, d.produce);
      }
    } else if (u.state === "working" && job) {
      u.moving = false; u.anim += dt * 7; u.timer -= dt;
      const d = BUILDINGS[job.type];
      if (Math.random() < dt * 2) this.puff(u.x + u.dir * 6, u.y - 2, 1, d.produce === "wood" ? "debris" : "dust");
      if (u.timer <= 0) {
        if (d.recipe) {
          if (!this.afford(d.recipe)) { u.timer = 2; job.alert = { kind: "input", res: (Object.keys(d.recipe) as ResKey[]).find((k) => this.res[k] < (d.recipe![k] ?? 0)) }; if (Math.random() < 0.3) this.puff(u.x, u.y - 10, 1, "smoke"); return; }
          this.pay(d.recipe); for (const k of Object.keys(d.recipe) as ResKey[]) this.flow[k] -= d.recipe[k] ?? 0;
        }
        // resource node depletion: consume from the source tile
        if (d.need !== undefined && u.srcTile !== undefined) {
          const ti = u.srcTile;
          if (this.resAmt[ti] > 0) {
            this.resAmt[ti] -= 1;
            if (this.resAmt[ti] <= 0) {
              const t = this.terrain[ti];
              const wx = (ti % MW + 0.5) * T, wy = (Math.floor(ti / MW) + 0.6) * T;
              if (t === TER.FOREST || t === TER.STONE || t === TER.GOLD || t === TER.SAND) {
                this.terrain[ti] = TER.GRASS;
                this.minimapBase = null;
                this.puff(wx, wy, 6, "dust");
                this.floaters.push({ x: wx, y: wy - 16, text: "Depleted!", life: 0, color: "#e8b04b" });
              } else {
                this.floaters.push({ x: wx, y: wy - 16, text: "Exhausted — regrowing", life: 0, color: "#9fd49f" });
              }
              this.alertT = Math.min(this.alertT, 1.5);
            }
          } else {
            this.setGather(u, job);
            u.state = "toWork";
            return;
          }
        }
        const base = d.yield ?? (d.produce === "gold" ? 4 : 7);
        let carry = base + (job.level - 1) * Math.max(1, Math.round(base * 0.45));
        if (job.type === "market") carry = 3 + this.age;
        carry = Math.max(1, Math.round(carry * this.weatherSystem.getYieldMultiplier(d.produce, job.type)));
        u.carryType = d.produce!;
        u.carry = carry;
        if (job.type === "pasture" && Math.random() < 0.45) {
          this.res.food += 5;
          this.floaters.push({ x: u.x + 8, y: u.y - 20, text: "+5 Milk", life: 0, color: RES_COLOR.food });
        }
        if (d.drop) { u.state = "toDrop"; this.setApproach(u, job); }
        else {
          const drop = this.nearestDrop(u.x, u.y, d.produce!);
          if (drop) { u.state = "toDrop"; this.setApproach(u, drop); }
        }
      }
    } else if (u.state === "toDrop") {
      if (this.moveTo(u, u.gx, u.gy, dt)) {
        if (u.carryType) {
          this.res[u.carryType] += u.carry;
          this.flow[u.carryType] += u.carry;
          this.floaters.push({ x: u.x, y: u.y - 14, text: `+${u.carry}`, life: 0, color: RES_COLOR[u.carryType] });
          if (job?.type === "pasture") {
            const extraMeat = 3 + (job.level - 1) * 2;
            this.res.meat += extraMeat;
            this.flow.meat += extraMeat;
            this.floaters.push({ x: u.x - 10, y: u.y - 24, text: `+${extraMeat} Meat`, life: 0, color: RES_COLOR.meat });
          } else if (job?.type === "fishery") {
            const fishMeat = 2 + (job.level - 1);
            this.res.meat += fishMeat;
            this.flow.meat += fishMeat;
            this.floaters.push({ x: u.x - 10, y: u.y - 24, text: `+${fishMeat} Meat`, life: 0, color: RES_COLOR.meat });
          }
        }
        u.carry = 0; u.carryType = null;
        if (job) { this.setGather(u, job); u.state = "toWork"; } else u.state = "idle";
      }
    }
  }

  updateProjs(dt: number) {
    for (const p of this.projs) {
      const t = this.unitById(p.target);
      p.t += dt;
      if (!t) { p.t = 99; continue; }
      const dx = t.x - p.x, dy = t.y - 6 - p.y, dist = Math.hypot(dx, dy);
      if (dist < 8) { this.hit(t, p.dmg); p.t = 99; continue; }
      p.x += (dx / dist) * 420 * dt; p.y += (dy / dist) * 420 * dt;
    }
    this.projs = this.projs.filter((p) => p.t < 4);
  }

  updateEvents(dt: number) {
    this.drought = Math.max(0, this.drought - dt);
    this.flood = Math.max(0, this.flood - dt);
    this.disasterT = Math.max(0, this.disasterT - dt);
    if (this.disasterT <= 0) this.disasterBanner = "";
    // raids
    if (this.difficulty !== "peaceful") {
      audio.setBattleMode(this.raidActive);
      this.nextRaid -= dt;
      if (this.nextRaid < 25 && this.raidWarn <= 0 && !this.raidActive) {
        this.raidWarn = 1; this.raidDir = ["north", "south", "east", "west"][Math.floor(Math.random() * 4)];
        this.msg(`War horns! Rustfang raiders approach from the ${this.raidDir}!`, "warn");
        audio.play("horn");
      }
      if (this.nextRaid <= 0) {
        this.raidWave++; this.raidActive = true; this.raidWarn = 0;
        audio.setBattleMode(true);
        const n = (this.difficulty === "hard" ? 5 : 3) + this.raidWave * 2;
        const cx = MW / 2, cy = MH / 2;
        const off = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[this.raidDir as "north"] ?? [0, -1];
        for (let i = 0; i < n; i++) {
          const far = MW / 2 - 10;
          const sx = (cx + off[0] * far + (off[1] !== 0 ? (Math.random() - 0.5) * 20 : 0)) * T;
          const sy = (cy + off[1] * far + (off[0] !== 0 ? (Math.random() - 0.5) * 20 : 0)) * T;
          this.spawnUnit("raider", sx + Math.random() * 40, sy + Math.random() * 40, this.raidWave);
        }
        this.nextRaid = (this.difficulty === "hard" ? 160 : 210) + Math.random() * 60;
        // allied camps send warriors to help defend
        let aided = 0;
        for (const tr of this.tribes) {
          if (!tr.defenseAlliance) continue;
          const camp = this.campOf(tr.id);
          if (!camp) continue;
          for (let i = 0; i < 2; i++) this.spawnUnit("soldier", camp.x + (Math.random() - 0.5) * 70, camp.y + (Math.random() - 0.5) * 70, 0, { ally: true, homeCamp: tr.id });
          aided++;
        }
        if (aided > 0) this.msg(`Allied warriors march to your aid (${aided} tribe${aided > 1 ? "s" : ""})!`, "good");
      }
      if (this.raidActive && this.raiders().length === 0) {
        this.raidActive = false; this.stats.raidsDefeated++;
        audio.setBattleMode(false);
        this.res.gold += 30 * this.raidWave;
        this.msg(`Raid ${this.raidWave} repelled! +${30 * this.raidWave} gold`, "good");
        audio.play("victory");
        const tc0 = this.tc();
        if (tc0) { const c0 = this.center(tc0); this.ringFx.push({ x: c0.x, y: c0.y, fr: "vfx_ring_green", life: 0, max: 1.4, rot: 0 }); this.puff(c0.x, c0.y, 30, "spark"); }
      }
    }
    // disasters
    this.nextDisaster -= dt;
    if (this.nextDisaster <= 0) {
      this.nextDisaster = 170 + Math.random() * 120;
      const pick = Math.floor(Math.random() * 6);
      const nearT = (b: Building, t: number, r: number) => { const d = BUILDINGS[b.type]; return this.countNear(b.x + d.w / 2, b.y + d.h / 2, r, t) > 0; };
      const built = this.buildings.filter((b) => b.progress >= 1 && b.type !== "townCenter");
      if (pick === 0) {
        this.shake = 2.5; this.banner("EARTHQUAKE", "The ground splits — buildings damaged!");
        for (const b of this.buildings) { b.hp -= b.maxHp * (0.1 + Math.random() * 0.2); const c = this.center(b); this.puff(c.x, c.y, 6, "dust"); }
      } else if (pick === 1 && built.length) {
        const b = built[Math.floor(Math.random() * built.length)];
        b.fire = 25; this.banner("WILDFIRE", `A ${BUILDINGS[b.type].name} is burning! Villagers rush to help.`);
      } else if (pick === 2) {
        this.drought = 70; this.banner("DROUGHT", "The rains have failed. Farms produce slowly.");
      } else if (pick === 4) {
        this.banner("FLOOD", "Rivers burst their banks — buildings near water are damaged!");
        this.flood = 8;
        for (const b of this.buildings) if (nearT(b, TER.WATER, 3)) { b.hp -= b.maxHp * 0.35; b.fire = 0; const c = this.center(b); this.puff(c.x, c.y, 8, "dust"); }
      } else if (pick === 5) {
        this.shake = 1.2; this.banner("ROCKSLIDE", "Boulders tumble from the mountains!");
        for (const b of this.buildings) if (nearT(b, TER.MOUNTAIN, 4)) { b.hp -= b.maxHp * 0.4; const c = this.center(b); this.puff(c.x, c.y, 18, "debris"); }
      } else {
        const tc = this.tc(); const c = tc ? this.center(tc) : { x: MW * T / 2, y: MH * T / 2 };
        const a = Math.random() * Math.PI * 2, r = (6 + Math.random() * 12) * T;
        this.meteor = { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r, t: 0 };
        this.banner("SKYFIRE", "A fragment of the old satellites falls from the sky!");
      }
    }
    if (this.meteor) {
      this.meteor.t += dt;
      if (this.meteor.t >= 2.2) {
        const { x, y } = this.meteor; this.meteor = null; this.shake = 1.6;
        this.puff(x, y, 40, "fire"); this.puff(x, y, 30, "smoke"); this.puff(x, y, 30, "debris");
        for (const b of this.buildings) { const c = this.center(b), d = Math.hypot(c.x - x, c.y - y); if (d < 4 * T) { b.hp -= 500 * (1 - d / (4 * T)); b.fire = 12; } }
        for (const u of this.units) if (Math.hypot(u.x - x, u.y - y) < 3 * T) u.hp -= 60;
        const tx = Math.floor(x / T), ty = Math.floor(y / T);
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const k = (ty + j) * MW + tx + i; if (!this.occ[k] && this.terrain[k] !== TER.WATER && Math.random() < 0.7) this.terrain[k] = TER.GOLD; }
        this.minimapBase = null;
        this.msg("The impact left glittering ore behind", "info");
      }
    }
  }

  banner(title: string, text: string) {
    this.disasterBanner = title;
    this.disasterT = 6;
    this.msg(text, "warn");
    if (title === "EARTHQUAKE" || title === "ROCKSLIDE") audio.play("earthquake");
    else if (title === "WILDFIRE") audio.play("wildfire");
    else if (title === "SKYFIRE") audio.play("skyfire");
    else if (title === "FLOOD" || title === "DROUGHT") audio.play("flood");
    else audio.play("rankup");
  }

  // ---------- input ----------
  screenToWorld(sx: number, sy: number) { return { x: sx / this.zoom + this.cam.x, y: sy / this.zoom + this.cam.y }; }
  zoomAt(sx: number, sy: number, dy: number) {
    const next = clamp(this.zoom * Math.exp(-dy * 0.0015), 0.45, 2.2);
    const w = this.screenToWorld(sx, sy);
    this.zoom = next;
    this.cam.x = w.x - sx / next; this.cam.y = w.y - sy / next;
    this.clampCam();
  }

  clickAt(sx: number, sy: number, shift: boolean) {
    const w = this.screenToWorld(sx, sy);
    const tx = Math.floor(w.x / T), ty = Math.floor(w.y / T);

    if (this.rallyTargetBuildingId !== null && this.rallyTargetBuildingId > 0) {
      this.setRallyPoint(this.rallyTargetBuildingId, w.x, w.y);
      this.rallyTargetBuildingId = null;
      return;
    }

    if (this.placing) {
      const def = BUILDINGS[this.placing];
      if (def.drag) { this.dragStart = { x: tx, y: ty }; return; }
      const bx = tx - Math.floor(def.w / 2), by = ty - Math.floor(def.h / 2);
      if (!this.canPlace(this.placing, bx, by)) { this.msg("Can't build there", "bad"); return; }
      if (this.place(this.placing, bx, by) && !shift) this.placing = null;
      return;
    }

    let best: Unit | null = null, bd = 18;
    for (const u of this.units) { const d = Math.hypot(u.x - w.x, u.y - 6 - w.y); if (d < bd) { bd = d; best = u; } }
    if (best) {
      if (shift) {
        if (this.selectedUnits.includes(best.id)) {
          this.selectedUnits = this.selectedUnits.filter((id) => id !== best!.id);
          this.selected = this.selectedUnits.length > 0 ? { kind: "u", id: this.selectedUnits[0] } : null;
        } else {
          this.selectedUnits.push(best.id);
          this.selected = { kind: "u", id: best.id };
        }
      } else {
        this.selectedUnits = [best.id];
        this.selected = { kind: "u", id: best.id };
      }
      return;
    }

    let bestA: Animal | null = null, bad = 20;
    for (const a of this.animals) { const d = Math.hypot(a.x - w.x, a.y - 4 - w.y); if (d < bad) { bad = d; bestA = a; } }
    if (bestA) {
      this.selectedUnits = [];
      this.selected = { kind: "a", id: bestA.id };
      return;
    }

    const clickedCamp = this.camps.find((c) => c.alive && Math.hypot(c.x - w.x, c.y - w.y) < 78);
    if (clickedCamp) {
      this.selectedUnits = [];
      this.selected = { kind: "c", id: 0 };
      this.selectedCampId = clickedCamp.tribeId;
      return;
    }
    const id = this.occ[ty * MW + tx];
    if (id) {
      this.selectedUnits = [];
      this.selected = { kind: "b", id };
    } else {
      if (!shift) {
        this.selectedUnits = [];
        this.selected = null;
        this.selectedCampId = null;
      }
    }
  }

  releaseAt(sx: number, sy: number) {
    if (!this.placing || !this.dragStart) return;
    const w = this.screenToWorld(sx, sy);
    const pts = this.dragLine(this.dragStart, { x: Math.floor(w.x / T), y: Math.floor(w.y / T) });
    let n = 0;
    for (const p of pts) if (this.canPlace(this.placing, p.x, p.y) && this.afford(BUILDINGS[this.placing].cost)) { this.place(this.placing, p.x, p.y); n++; }
    this.dragStart = null;
  }

  rightClick(sx: number, sy: number) {
    if (this.placing) { this.placing = null; this.dragStart = null; return; }
    const w = this.screenToWorld(sx, sy);
    const tx = Math.floor(w.x / T), ty = Math.floor(w.y / T);

    // If rally-capable building selected: set its rally point!
    if (this.selected?.kind === "b") {
      const b = this.byId(this.selected.id);
      if (b && (b.type === "townCenter" || b.type === "barracks" || b.type === "range")) {
        this.setRallyPoint(b.id, w.x, w.y);
        return;
      }
    }

    // Active units selection
    const activeUnits = this.selectedUnits.length > 0
      ? this.selectedUnits.map((id) => this.unitById(id)).filter((u): u is Unit => !!u && u.hp > 0 && u.kind !== "raider")
      : (this.selected?.kind === "u" ? [this.unitById(this.selected.id)].filter((u): u is Unit => !!u && u.hp > 0 && u.kind !== "raider") : []);

    if (activeUnits.length > 0) {
      // Check if ordered to hunt animal
      const clickedAnimal = this.animals.find((a) => Math.hypot(a.x - w.x, a.y - 4 - w.y) < 24);
      if (clickedAnimal) {
        for (const u of activeUnits) {
          u.huntTarget = clickedAnimal.id;
          u.target = 0;
          u.state = "guard";
        }
        this.msg(`Ordered ${activeUnits.length} unit(s) to hunt ${clickedAnimal.name || clickedAnimal.kind}!`, "good");
        this.puff(clickedAnimal.x, clickedAnimal.y, 5, "spark");
        audio.play("click");
        return;
      }

      // Check if ordered to attack a rival camp (military only)
      const clickedCamp = this.camps.find((c) => c.alive && Math.hypot(c.x - w.x, c.y - w.y) < 70);
      if (clickedCamp) {
        const war = activeUnits.filter((u) => u.kind !== "villager");
        if (war.length > 0) {
          for (const u of war) { u.campTarget = clickedCamp.tribeId; u.huntTarget = 0; u.target = 0; u.state = "guard"; }
          const tr = this.tribes.find((t) => t.id === clickedCamp.tribeId);
          this.msg(`Assaulting the camp of ${tr?.name ?? "rivals"} with ${war.length} warrior(s)!`, "warn");
          audio.play("horn");
          return;
        }
      }

      // Check if ordered to attack raider
      const clickedRaider = this.units.find((u) => u.kind === "raider" && Math.hypot(u.x - w.x, u.y - 6 - w.y) < 22);
      if (clickedRaider) {
        for (const u of activeUnits) {
          u.target = clickedRaider.id;
          u.huntTarget = 0;
          u.state = "guard";
        }
        this.msg(`Attacking raider!`, "warn");
        this.puff(clickedRaider.x, clickedRaider.y, 5, "spark");
        audio.play("click");
        return;
      }

      // Single villager ordered on building or repair site
      if (activeUnits.length === 1 && activeUnits[0].kind === "villager") {
        const u = activeUnits[0];
        const occB = this.occ[ty * MW + tx];
        if (occB) {
          const b = this.byId(occB);
          if (b && (b.progress < 1 || b.fire > 0 || b.hp < b.maxHp)) {
            u.job = b.id;
            u.state = "toBuild";
            this.setApproach(u, b);
            this.msg(`Assigned worker to ${BUILDINGS[b.type].name}`, "info");
            this.puff(w.x, w.y, 4, "dust");
            return;
          }
        }
      }

      // Move group into formation
      this.moveUnitsTo(activeUnits.map((u) => u.id), w.x, w.y);
      this.puff(w.x, w.y, 4, "dust");
      audio.play("click");
    }
  }

  // ---------- render ----------
  render(ctx: CanvasRenderingContext2D, dpr: number) {
    const z = this.zoom;
    const shx = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 10 : 0, shy = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 10 : 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#1d3b4f"; ctx.fillRect(0, 0, this.vw, this.vh);
    ctx.setTransform(z * dpr, 0, 0, z * dpr, (-this.cam.x * z + shx) * dpr, (-this.cam.y * z + shy) * dpr);
    const x0 = Math.max(0, Math.floor(this.cam.x / T) - 1), y0 = Math.max(0, Math.floor(this.cam.y / T) - 1);
    const x1 = Math.min(MW - 1, Math.ceil((this.cam.x + this.vw / z) / T) + 1), y1 = Math.min(MH - 1, Math.ceil((this.cam.y + this.vh / z) / T) + 1);
    const tm = this.time;
    // ground
    const gp = groundPattern(ctx);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * MW + x, t = this.terrain[i], v = this.vari[i];
      let col: string;
      if (t === TER.WATER) {
        const s = Math.sin(tm * 1.5 + x * 0.6 + y * 0.4) * 4;
        col = `hsl(200,52%,${30 + v * 4 + s}%)`;
      } else {
        const dr = this.drought > 0;
        if (this._ccDrought !== dr) { this._ccDrought = dr; this._cc = []; }
        let cc = this._cc[i];
        if (cc === undefined) {
          if (t === TER.SAND) cc = `hsl(42,42%,${62 + v * 5}%)`;
          else if (t === TER.FOREST) cc = `hsl(98,34%,${24 + v * 4}%)`;
          else if (t === TER.MOUNTAIN) cc = `hsl(30,8%,${40 + v * 12}%)`;
          else if (t === TER.MARSH) cc = `hsl(75,28%,${26 + v * 5}%)`;
          else if (t === TER.STONE || t === TER.GOLD) cc = `hsl(80,18%,${38 + v * 5}%)`;
          else cc = `hsl(${86 + v * 16},${34 + (dr ? -12 : 0)}%,${33 + v * 8}%)`;
          this._cc[i] = cc;
        }
        col = cc;
      }
      if (gp && !this.lowFX && (t === TER.GRASS || t === TER.FOREST || t === TER.BERRY || t === TER.STONE || t === TER.GOLD || t === TER.FRUIT_TREE || t === TER.VEG_PATCH || t === TER.HERB_PATCH)) {
        ctx.fillStyle = gp; ctx.fillRect(x * T, y * T, T + 1, T + 1);
        ctx.globalAlpha = 0.42; ctx.fillStyle = col; ctx.fillRect(x * T, y * T, T + 1, T + 1); ctx.globalAlpha = 1;
      } else { ctx.fillStyle = col; ctx.fillRect(x * T, y * T, T + 1, T + 1); }
      if (t === TER.WATER && this.tile(x, y - 1) !== TER.WATER) { ctx.fillStyle = "rgba(220,240,255,0.25)"; ctx.fillRect(x * T, y * T, T, 3 + Math.sin(tm * 2 + x) * 1.5); }
      if (t === TER.GRASS && v > 0.7) { ctx.strokeStyle = "rgba(30,60,20,0.35)"; ctx.lineWidth = 1; ctx.beginPath(); const gx = x * T + v * 24, gy = y * T + 8 + v * 16; ctx.moveTo(gx, gy); ctx.lineTo(gx - 2, gy - 5); ctx.moveTo(gx + 3, gy); ctx.lineTo(gx + 4, gy - 6); ctx.stroke(); }
    }
    // roads
    ctx.fillStyle = "#9a7d58";
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!this.road[y * MW + x]) continue;
      const cx = x * T + T / 2, cy = y * T + T / 2;
      ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();
      if (this.road[y * MW + x + 1]) ctx.fillRect(cx, cy - 12, T, 24);
      if (this.road[(y + 1) * MW + x]) ctx.fillRect(cx - 12, cy, 24, T);
    }
    ctx.fillStyle = "rgba(70,55,40,0.35)";
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.road[y * MW + x]) {
      for (let k = 0; k < 4; k++) { const h = hash(x, y, k); ctx.fillRect(x * T + 6 + h * 20, y * T + 6 + hash(y, x, k) * 20, 3, 2); }
    }
    // placement preview
    if (this.placing) {
      const def = BUILDINGS[this.placing];
      const w = this.screenToWorld(this.hover.x, this.hover.y);
      const tx = Math.floor(w.x / T), ty = Math.floor(w.y / T);
      const cells = def.drag && this.dragStart ? this.dragLine(this.dragStart, { x: tx, y: ty }) : [{ x: def.drag ? tx : tx - Math.floor(def.w / 2), y: def.drag ? ty : ty - Math.floor(def.h / 2) }];
      for (const c of cells) {
        const ok = this.canPlace(this.placing, c.x, c.y) && this.afford(def.cost);
        ctx.fillStyle = ok ? "rgba(120,255,140,0.28)" : "rgba(255,80,60,0.32)";
        ctx.strokeStyle = ok ? "rgba(180,255,190,0.9)" : "rgba(255,120,100,0.9)"; ctx.lineWidth = 2;
        ctx.fillRect(c.x * T, c.y * T, def.w * T, def.h * T); ctx.strokeRect(c.x * T, c.y * T, def.w * T, def.h * T);
      }
      if (def.need !== undefined) { ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(w.x, w.y, 6 * T, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    }
    // painted grass decor (flowerbeds, meadows)
    drawDecor(ctx, this);
    // drawables sorted by y: trees/rocks + buildings + units + animals
    const items: { y: number; draw: () => void }[] = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = this.terrain[y * MW + x];
      if (t === TER.FOREST || t === TER.STONE || t === TER.GOLD || t === TER.BERRY || t === TER.MOUNTAIN || t === TER.MARSH || t === TER.FRUIT_TREE || t === TER.VEG_PATCH || t === TER.HERB_PATCH) items.push({ y: y * T + T, draw: () => drawNature(ctx, x, y, t, this.vari[y * MW + x], tm) });
    }
    for (const b of this.buildings) {
      const d = BUILDINGS[b.type];
      if ((b.x + d.w) * T < this.cam.x - 50 || b.x * T > this.cam.x + this.vw / z + 50 || (b.y + d.h) * T < this.cam.y - 50 || b.y * T > this.cam.y + this.vh / z + 100) continue;
      if (b.type === "farm" || b.type === "vegGarden") drawFarmPlot(ctx, b, d);
      items.push({ y: (b.y + d.h) * T, draw: () => drawBuilding(ctx, this, b, tm) });
    }
    for (const camp of this.camps) {
      if (camp.alive) items.push({ y: camp.y + 30, draw: () => drawCamp(ctx, this, camp, tm, this.selectedCampId === camp.tribeId) });
    }
    for (const a of this.animals) {
      if (a.x < this.cam.x - 40 || a.x > this.cam.x + this.vw / z + 40 || a.y < this.cam.y - 40 || a.y > this.cam.y + this.vh / z + 40) continue;
      items.push({ y: a.y, draw: () => drawAnimal(ctx, a, tm, this.selected?.kind === "a" && this.selected.id === a.id) });
    }
    for (const u of this.units) {
      const isSel = (this.selected?.kind === "u" && this.selected.id === u.id) || this.selectedUnits.includes(u.id);
      items.push({ y: u.y, draw: () => drawUnit(ctx, u, tm, isSel, u.job ? this.byId(u.job)?.type : undefined) });
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    // Draw rally point lines and flags
    for (const b of this.buildings) {
      if (b.rallyPoint && (b.type === "townCenter" || b.type === "barracks" || b.type === "range")) {
        const isSelBuilding = this.selected?.kind === "b" && this.selected.id === b.id;
        const bc = this.center(b);
        const rx = b.rallyPoint.x, ry = b.rallyPoint.y;

        // Animated dashed line
        ctx.save();
        ctx.strokeStyle = isSelBuilding ? "rgba(255, 220, 100, 0.85)" : "rgba(255, 220, 100, 0.4)";
        ctx.lineWidth = isSelBuilding ? 2 : 1.5;
        const dashOffset = (this.time * 24) % 16;
        ctx.setLineDash([8, 8]);
        ctx.lineDashOffset = -dashOffset;
        ctx.beginPath();
        ctx.moveTo(bc.x, bc.y);
        ctx.lineTo(rx, ry);
        ctx.stroke();
        ctx.restore();

        // Rally Flag
        ctx.save();
        ctx.strokeStyle = "#5a4128";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx, ry - 22);
        ctx.stroke();

        const wave = Math.sin(this.time * 6 + b.id) * 2;
        ctx.fillStyle = isSelBuilding ? "#f59e0b" : "#d97706";
        ctx.beginPath();
        ctx.moveTo(rx, ry - 22);
        ctx.lineTo(rx + 14 + wave, ry - 17);
        ctx.lineTo(rx, ry - 12);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "rgba(245, 158, 11, 0.75)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(rx, ry, 6, 3, 0, 0, Math.PI * 2);
        ctx.stroke();

        if (isSelBuilding) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("RALLY", rx, ry - 25);
        }
        ctx.restore();
      }
    }

    // selection outline for building (RTS style corner brackets)
    if (this.selected?.kind === "b") {
      const b = this.byId(this.selected.id);
      if (b) {
        const d = BUILDINGS[b.type];
        const bx = b.x * T, by = b.y * T, bw = d.w * T, bh = d.h * T;
        ctx.strokeStyle = "rgba(255, 215, 120, 0.95)";
        ctx.lineWidth = 2.5;
        const cornerLen = Math.min(16, Math.max(8, bw * 0.22));
        ctx.beginPath();
        // Top-left
        ctx.moveTo(bx - 3, by - 3 + cornerLen); ctx.lineTo(bx - 3, by - 3); ctx.lineTo(bx - 3 + cornerLen, by - 3);
        // Top-right
        ctx.moveTo(bx + bw + 3 - cornerLen, by - 3); ctx.lineTo(bx + bw + 3, by - 3); ctx.lineTo(bx + bw + 3, by - 3 + cornerLen);
        // Bottom-right
        ctx.moveTo(bx + bw + 3, by + bh + 3 - cornerLen); ctx.lineTo(bx + bw + 3, by + bh + 3); ctx.lineTo(bx + bw + 3 - cornerLen, by + bh + 3);
        // Bottom-left
        ctx.moveTo(bx - 3 + cornerLen, by + bh + 3); ctx.lineTo(bx - 3, by + bh + 3); ctx.lineTo(bx - 3, by + bh + 3 - cornerLen);
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 215, 120, 0.08)";
        ctx.fillRect(bx, by, bw, bh);
      }
    }
    // projectiles
    ctx.strokeStyle = "#3b2a1a"; ctx.lineWidth = 1.5;
    for (const p of this.projs) { const t = this.unitById(p.target); if (!t) continue; const a = Math.atan2(t.y - p.y, t.x - p.x); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(a) * 9, p.y - Math.sin(a) * 9); ctx.stroke(); }
    // particles
    for (const p of this.parts) {
      const k = 1 - p.life / p.max;
      const alpha = (p.kind === "smoke" ? 0.35 : 0.9) * k;
      const rad = p.size * (p.kind === "fire" ? k : 1);
      if (p.kind === "fire" || p.kind === "smoke" || p.kind === "debris") continue; // painted sprites drawn separately
      ctx.fillStyle = `rgba(${p.color},${alpha})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, Math.PI * 2); ctx.fill();
    }
    drawSpriteParts(ctx, this);
    drawRingFx(ctx, this);
    // meteor
    if (this.meteor) {
      const m = this.meteor, k = m.t / 2.2;
      ctx.strokeStyle = `rgba(255,80,40,${0.3 + k * 0.6})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(m.x, m.y, 4 * T * (1 - k * 0.3), 0, Math.PI * 2); ctx.stroke();
      const mx = m.x + (1 - k) * 600, my = m.y - (1 - k) * 900;
      const g = ctx.createRadialGradient(mx, my, 2, mx, my, 30); g.addColorStop(0, "rgba(255,240,200,1)"); g.addColorStop(1, "rgba(255,90,20,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, 30, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,150,60,0.5)"; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + 120, my - 180); ctx.stroke();
    }
    // floaters
    ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
    for (const f of this.floaters) { ctx.globalAlpha = 1 - f.life / 1.4; ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillText(f.text, f.x + 1, f.y + 1); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1;
    if (this.flood > 0) {
      ctx.fillStyle = `rgba(60,120,170,${Math.min(0.35, this.flood * 0.05)})`;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.terrain[y * MW + x] !== TER.WATER && (this.tile(x + 2, y) === TER.WATER || this.tile(x - 2, y) === TER.WATER || this.tile(x, y + 2) === TER.WATER || this.tile(x, y - 2) === TER.WATER)) ctx.fillRect(x * T, y * T, T, T);
    }
    // day / night
    const phase = (this.time % 300) / 300;
    const dd = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
    const dark = Math.max(0, (dd - 0.55) / 0.45) * 0.55;
    if (dark > 0.01) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = `rgba(12,18,48,${dark})`; ctx.fillRect(0, 0, this.vw, this.vh);
      ctx.setTransform(z * dpr, 0, 0, z * dpr, -this.cam.x * z * dpr, -this.cam.y * z * dpr);
      ctx.globalCompositeOperation = "lighter";
      for (const b of this.buildings) {
        if (b.progress < 1 || !["house", "townCenter", "tower", "temple", "barracks", "market", "forge"].includes(b.type)) continue;
        const c = this.center(b), r = b.type === "townCenter" ? 150 : 70;
        const g = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, r);
        g.addColorStop(0, `rgba(255,160,60,${dark * 0.7})`); g.addColorStop(1, "rgba(255,120,40,0)");
        ctx.fillStyle = g; ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2);
      }
      ctx.globalCompositeOperation = "source-over";
    }

    // RTS Drag-box Selection Rect in screen-space
    if (this.dragBox) {
      const box = this.dragBox;
      const bx = Math.min(box.startX, box.currentX);
      const by = Math.min(box.startY, box.currentY);
      const bw = Math.abs(box.currentX - box.startX);
      const bh = Math.abs(box.currentY - box.startY);
      if (bw > 2 || bh > 2) {
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "rgba(59, 130, 246, 0.18)";
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = "rgba(96, 165, 250, 0.95)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.restore();
      }
    }
    // Dynamic weather atmosphere overlays and particles
    this.weatherSystem.render(ctx, this.vw, this.vh, dpr);
  }

  isNight() { const phase = (this.time % 300) / 300; return phase > 0.38 && phase < 0.62; }

  drawMinimap(c: HTMLCanvasElement) {
    const ctx = c.getContext("2d"); if (!ctx) return;
    if (!this.minimapBase) {
      const img = ctx.createImageData(MW, MH);
      const pal: Record<number, [number, number, number]> = {
        0: [88, 128, 60],
        1: [40, 80, 35],
        2: [140, 140, 130],
        3: [210, 170, 60],
        4: [40, 90, 130],
        5: [200, 180, 130],
        6: [110, 140, 60],
        7: [120, 112, 104],
        8: [70, 90, 50],
        9: [55, 125, 45],
        10: [130, 85, 45],
        11: [95, 75, 140],
      };
      const defColor: [number, number, number] = [88, 128, 60];
      for (let i = 0; i < MW * MH; i++) {
        const p = pal[this.terrain[i]] ?? defColor;
        img.data[i * 4] = p[0];
        img.data[i * 4 + 1] = p[1];
        img.data[i * 4 + 2] = p[2];
        img.data[i * 4 + 3] = 255;
      }
      this.minimapBase = img;
    }
    ctx.putImageData(this.minimapBase, 0, 0);
    ctx.fillStyle = "#8a6d4a";
    for (let i = 0; i < MW * MH; i++) if (this.road[i]) ctx.fillRect(i % MW, Math.floor(i / MW), 1, 1);
    for (const b of this.buildings) { const d = BUILDINGS[b.type]; ctx.fillStyle = b.fire > 0 ? "#ff6a2a" : "#4fb3ff"; ctx.fillRect(b.x, b.y, d.w, d.h); }
    for (const u of this.units) { ctx.fillStyle = u.kind === "raider" ? "#ff3030" : "#ffffff"; ctx.fillRect(u.x / T - 0.5, u.y / T - 0.5, 1.5, 1.5); }
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1;
    ctx.lineWidth = MW / 128; ctx.strokeRect(this.cam.x / T, this.cam.y / T, this.vw / this.zoom / T, this.vh / this.zoom / T);
  }

  // ---------- save ----------
  serialize() {
    return JSON.stringify({
      v: 2, mapSize: this.mapSize, rank: this.rank, seed: this.seed, difficulty: this.difficulty, terrain: Array.from(this.terrain), road: Array.from(this.road),
      buildings: this.buildings, units: this.units,
      animals: this.animals.map((a) => ({ id: a.id, kind: a.kind, domestic: a.domestic, x: Math.round(a.x), y: Math.round(a.y), hp: a.hp, maxHp: a.maxHp, name: a.name, pastureId: a.pastureId })),
      res: this.res, age: this.age, ageProgress: this.ageProgress, time: this.time,
      missionIndex: this.missionIndex, nid: this.nid, stats: this.stats, nextRaid: this.nextRaid, nextDisaster: this.nextDisaster,
      raidWave: this.raidWave, raidActive: this.raidActive, cam: this.cam, zoom: this.zoom,
      weather: this.weatherSystem.current, weatherTimer: this.weatherSystem.timer, nextWeather: this.weatherSystem.nextWeather,
    });
  }
  static load(json: string) {
    const s = JSON.parse(json);
    const g = new Game(s.seed, s.difficulty, s.mapSize ?? "small");
    g.terrain = Uint8Array.from(s.terrain); g.road = Uint8Array.from(s.road);
    g.buildings = s.buildings.map((b: Building) => ({ ...b, level: b.level ?? 1 })); g.units = s.units;
    g.animals = (s.animals ?? []).map((a: any) => ({
      ...a, dir: 1, moving: false, anim: 0, timer: 2, state: "graze", gx: a.x, gy: a.y
    }));
    g.res = { tools: 0, clay: 0, bricks: 0, meat: 30, herbs: 20, fruits: 35, vegetables: 35, wool: 0, ...s.res };
    g.rank = s.rank ?? 0; g.age = s.age; g.ageProgress = s.ageProgress; g.time = s.time;
    g.missionIndex = s.missionIndex; g.nid = s.nid; g.stats = s.stats; g.nextRaid = s.nextRaid; g.nextDisaster = s.nextDisaster;
    g.raidWave = s.raidWave; g.raidActive = s.raidActive; g.cam = s.cam; g.zoom = s.zoom;
    if (s.weather) {
      g.weatherSystem.current = s.weather;
      g.weatherSystem.timer = s.weatherTimer ?? 60;
      if (s.nextWeather) g.weatherSystem.nextWeather = s.nextWeather;
    }
    g.occ.fill(0);
    for (const b of g.buildings) { const d = BUILDINGS[b.type]; for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) g.occ[(b.y + j) * MW + b.x + i] = b.id; }
    return g;
  }
}

function drawNature(c: CanvasRenderingContext2D, x: number, y: number, t: number, v: number, tm: number) {
  if (natureSprite(c, x, y, t, v, tm)) return;
  const px = x * T, py = y * T;
  if (t === TER.FOREST) {
    const n = v > 0.5 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const ox = px + 8 + hash(x, y, k + 9) * 16, oy = py + 10 + hash(y, x, k + 4) * 14;
      const sway = Math.sin(tm * 1.4 + x * 0.7 + y * 0.3 + k) * 1.6;
      const r = 10 + hash(x, y, k) * 5;
      c.fillStyle = "rgba(0,0,0,0.25)"; c.beginPath(); c.ellipse(ox + 5, oy + 6, r, r * 0.55, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#5a3d24"; c.fillRect(ox - 1.5, oy - 2, 3, 8);
      const hue = 105 + hash(x, y, k + 2) * 25;
      c.fillStyle = `hsl(${hue},40%,22%)`; c.beginPath(); c.arc(ox + sway * 0.5, oy - 6, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = `hsl(${hue},42%,30%)`; c.beginPath(); c.arc(ox - 2 + sway, oy - 9, r * 0.72, 0, Math.PI * 2); c.fill();
      c.fillStyle = `hsl(${hue},45%,40%)`; c.beginPath(); c.arc(ox - 4 + sway * 1.2, oy - 12, r * 0.38, 0, Math.PI * 2); c.fill();
    }
  } else if (t === TER.STONE || t === TER.GOLD) {
    for (let k = 0; k < 3; k++) {
      const ox = px + 6 + hash(x, y, k) * 20, oy = py + 8 + hash(y, x, k) * 18, r = 4 + hash(x, k, y) * 6;
      c.fillStyle = "rgba(0,0,0,0.25)"; c.beginPath(); c.ellipse(ox + 2, oy + 3, r, r * 0.6, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#7d7a74"; c.beginPath(); c.ellipse(ox, oy, r, r * 0.8, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#a6a39b"; c.beginPath(); c.ellipse(ox - r * 0.25, oy - r * 0.3, r * 0.55, r * 0.4, 0, 0, Math.PI * 2); c.fill();
      if (t === TER.GOLD) {
        const glint = 0.6 + 0.4 * Math.sin(tm * 3 + x + k * 2);
        c.fillStyle = `rgba(255,205,60,${glint})`; c.beginPath(); c.arc(ox + r * 0.2, oy, r * 0.3, 0, Math.PI * 2); c.fill();
        c.fillStyle = "#ffe9a0"; c.fillRect(ox - 1, oy - 2, 2, 2);
      }
    }
  } else if (t === TER.MOUNTAIN) {
    const h = 14 + v * 10, ox = px + 16 + (hash(x, y, 1) - 0.5) * 8, oy = py + 26;
    c.fillStyle = "rgba(0,0,0,0.3)"; c.beginPath(); c.moveTo(ox - 16, oy); c.lineTo(ox + 4, oy - h + 6); c.lineTo(ox + 22, oy + 2); c.fill();
    c.fillStyle = "#6e665e"; c.beginPath(); c.moveTo(ox - 17, oy); c.lineTo(ox, oy - h); c.lineTo(ox + 17, oy); c.fill();
    c.fillStyle = "#8f877d"; c.beginPath(); c.moveTo(ox - 17, oy); c.lineTo(ox, oy - h); c.lineTo(ox - 2, oy); c.fill();
    if (v > 0.45) { c.fillStyle = "#e9eef2"; c.beginPath(); c.moveTo(ox - 5, oy - h + 6); c.lineTo(ox, oy - h); c.lineTo(ox + 5, oy - h + 6); c.lineTo(ox, oy - h + 4); c.fill(); }
  } else if (t === TER.MARSH) {
    c.fillStyle = `rgba(60,100,110,${0.45 + Math.sin(tm + x) * 0.1})`; c.beginPath(); c.ellipse(px + 10 + v * 10, py + 18, 9, 5, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#5d7a33"; c.lineWidth = 1.2;
    for (let k = 0; k < 4; k++) { const rx = px + 4 + hash(x, y, k) * 24, ry = py + 26 - hash(y, x, k) * 10, sw = Math.sin(tm * 1.5 + k + x) * 1.5; c.beginPath(); c.moveTo(rx, ry); c.lineTo(rx + sw, ry - 9); c.stroke(); c.fillStyle = "#6b4a2a"; c.fillRect(rx + sw - 1, ry - 11, 2, 3); }
  } else if (t === TER.BERRY) {
    const ox = px + 16, oy = py + 18;
    c.fillStyle = "rgba(0,0,0,0.2)"; c.beginPath(); c.ellipse(ox + 2, oy + 4, 9, 5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#3f6b2a"; c.beginPath(); c.arc(ox, oy, 8, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#c2304a"; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(ox - 5 + hash(x, y, k) * 10, oy - 5 + hash(y, x, k) * 10, 1.6, 0, Math.PI * 2); c.fill(); }
  } else if (t === TER.FRUIT_TREE) {
    const ox = px + 16, oy = py + 26;
    c.fillStyle = "rgba(0,0,0,0.25)"; c.beginPath(); c.ellipse(ox, oy, 11, 5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#5c3d22"; c.fillRect(ox - 2.5, oy - 12, 5, 12);
    const sw = Math.sin(tm * 1.5 + x) * 1.2;
    c.fillStyle = "#2d6b24"; c.beginPath(); c.arc(ox + sw, oy - 18, 12, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#438e36"; c.beginPath(); c.arc(ox - 2 + sw, oy - 22, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#e63946";
    for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(ox - 6 + hash(x, y, k) * 12 + sw, oy - 22 + hash(y, x, k) * 10, 2, 0, Math.PI * 2); c.fill(); }
  } else if (t === TER.VEG_PATCH) {
    const ox = px + 16, oy = py + 22;
    c.fillStyle = "#543a22"; c.beginPath(); c.ellipse(ox, oy, 11, 5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#e8732a";
    c.beginPath(); c.ellipse(ox - 4, oy - 1, 3.5, 3, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(ox + 4, oy + 1, 4, 3.2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#438227";
    c.fillRect(ox - 5, oy - 5, 2, 3); c.fillRect(ox + 3, oy - 4, 2, 3);
  } else if (t === TER.HERB_PATCH) {
    const ox = px + 16, oy = py + 20;
    c.fillStyle = "#3d6e35"; c.beginPath(); c.arc(ox, oy, 7, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#9b5de5";
    for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(ox - 4 + hash(x, y, k) * 8, oy - 5 + hash(y, x, k) * 6, 1.8, 0, Math.PI * 2); c.fill(); }
  }
}
