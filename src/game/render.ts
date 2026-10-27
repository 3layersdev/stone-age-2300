import { BUILDINGS, RES_COLOR, T, MW, MH } from "./data";
import atlasUrl from "@/assets/buildings-atlas.webp";
import frames from "./atlas.json";
import natureUrl from "@/assets/nature-atlas.webp";
import grassUrl from "@/assets/grass-tex.webp";
import roadTilesUrl from "@/assets/road-tiles.webp";
import natureFrames from "./nature.json";
import unitsAtlasUrl from "@/assets/units-atlas.webp";
import animalAtlasUrl from "@/assets/animals-atlas.webp";
import unitFrames from "./units.json";
import animalFrames from "./animals.json";
import campsAtlasUrl from "@/assets/camps-atlas.webp";
import campsFrames from "./camps.json";
import vfxAtlasUrl from "@/assets/vfx-atlas.webp";
import vfxFrames from "./vfx.json";
import uiAtlasUrl from "@/assets/ui-atlas.webp";
import uiFrames from "./ui.json";
import { TER, type ResKey } from "./data";
import type { Building, Game, Unit, Animal, Camp } from "./engine";

type C = CanvasRenderingContext2D;

// ---------- sprite atlas & assets preloading ----------
const FR = frames as unknown as Record<string, [number, number, number, number]>;
let atlas: HTMLImageElement | null = null;
let atlasReady = false;
let nat: HTMLImageElement | null = null;
let natReady = false;
let grass: HTMLImageElement | null = null;
let grassReady = false;
let pattern: CanvasPattern | null = null;
let unitImg: HTMLImageElement | null = null;
let unitImgReady = false;
let animalImg: HTMLImageElement | null = null;
let animalImgReady = false;
let campsImg: HTMLImageElement | null = null;
let campsImgReady = false;
let vfxImg: HTMLImageElement | null = null;
let vfxImgReady = false;
let uiImg: HTMLImageElement | null = null;
let uiImgReady = false;
const CF = campsFrames as unknown as Record<string, [number, number, number, number]>;
const VF = vfxFrames as unknown as Record<string, [number, number, number, number]>;
const UFR = uiFrames as unknown as Record<string, [number, number, number, number]>;
const doneAt = new Map<number, number>();

let preloadPromise: Promise<boolean> | null = null;

export function isAssetsReady(): boolean {
  return atlasReady && natReady && grassReady;
}

export function preloadGameAssets(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(true);
  if (isAssetsReady()) return Promise.resolve(true);
  if (preloadPromise) return preloadPromise;

  const loadImg = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        if ("decode" in img && typeof img.decode === "function") {
          img.decode().then(() => resolve(img)).catch(() => resolve(img));
        } else {
          resolve(img);
        }
      };
      img.onerror = () => resolve(img);
      img.src = src;
    });
  };

  preloadPromise = Promise.all([
    loadImg(atlasUrl).then((img) => { atlas = img; atlasReady = true; return img; }),
    loadImg(natureUrl).then((img) => { nat = img; natReady = true; return img; }),
    loadImg(grassUrl).then((img) => { grass = img; grassReady = true; return img; }),
    loadImg(unitsAtlasUrl).then((img) => { unitImg = img; unitImgReady = true; return img; }),
    loadImg(animalAtlasUrl).then((img) => { animalImg = img; animalImgReady = true; return img; }),
    loadImg(campsAtlasUrl).then((img) => { campsImg = img; campsImgReady = true; return img; }),
    loadImg(vfxAtlasUrl).then((img) => { vfxImg = img; vfxImgReady = true; return img; }),
    loadImg(uiAtlasUrl).then((img) => { uiImg = img; uiImgReady = true; return img; }),
  ]).then(() => true);

  return preloadPromise;
}

// Auto-start asset preloading immediately when the module is imported
if (typeof window !== "undefined") {
  preloadGameAssets();
}

function getAtlas() {
  if (!atlas && typeof Image !== "undefined") {
    preloadGameAssets();
  }
  return atlasReady ? atlas : null;
}

// ---------- nature + ground ----------
const NF = natureFrames as unknown as Record<string, [number, number, number, number]>;
function loadNature() {
  if ((!nat || !grass) && typeof Image !== "undefined") {
    preloadGameAssets();
  }
}
let roadImg: HTMLImageElement | null = null; let roadReady = false;
if (typeof Image !== "undefined") { roadImg = new Image(); roadImg.onload = () => { roadReady = true; }; roadImg.src = roadTilesUrl; }
export function drawRoadTile(c: C, variant: number, dx: number, dy: number, size: number) {
  if (!roadReady || !roadImg) return false;
  c.drawImage(roadImg, variant * 96, 0, 96, 96, dx, dy, size, size);
  return true;
}

export function groundPattern(c: C) {
  loadNature();
  if (!pattern && grassReady && grass) { pattern = c.createPattern(grass, "repeat"); pattern?.setTransform(new DOMMatrix().scale(0.5)); }
  return pattern;
}
const h3 = (x: number, y: number, s: number) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); };
function nsprite(c: C, key: string, cx: number, by: number, w: number, sway = 0) {
  const [sx, sy, sw, sh] = NF[key]; const dh = (sh / sw) * w;
  if (sway) { c.save(); c.translate(cx, by); c.transform(1, 0, sway, 1, 0, 0); c.drawImage(nat!, sx, sy, sw, sh, -w / 2, -dh, w, dh); c.restore(); }
  else c.drawImage(nat!, sx, sy, sw, sh, cx - w / 2, by - dh, w, dh);
}
/** painted nature props; returns false until the atlas has loaded */
export function natureSprite(c: C, x: number, y: number, t: number, v: number, tm: number) {
  loadNature(); if (!natReady) return false;
  const px = x * T, py = y * T;
  const shadow = (cx: number, cy: number, r: number) => { c.fillStyle = "rgba(0,0,0,0.22)"; c.beginPath(); c.ellipse(cx + 4, cy, r, r * 0.42, 0, 0, Math.PI * 2); c.fill(); };
  if (t === TER.FOREST) {
    const n = v > 0.5 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const cx = px + 8 + h3(x, y, k + 9) * 16, by = py + 18 + h3(y, x, k + 4) * 14;
      const pine = h3(x, y, k + 31) < 0.45, w = (pine ? 22 : 34) + h3(x, y, k) * 10;
      shadow(cx, by, w * 0.42);
      nsprite(c, pine ? "pine" : "oak", cx, by + 2, w, Math.sin(tm * 1.3 + x * 0.7 + y * 0.3 + k) * 0.04);
    }
  } else if (t === TER.STONE) { const cx = px + 16, by = py + 28; shadow(cx, by - 2, 13); nsprite(c, "rock", cx + (h3(x, y, 1) - 0.5) * 6, by, 26 + v * 8); }
  else if (t === TER.GOLD) {
    const cx = px + 16, by = py + 28; shadow(cx, by - 2, 13); nsprite(c, "gold", cx, by, 28 + v * 6);
    const gl = 0.5 + 0.5 * Math.sin(tm * 3 + x * 2 + y); c.fillStyle = `rgba(255,236,150,${gl * 0.8})`; c.fillRect(cx - 4 + h3(x, y, 3) * 8, by - 14, 2, 2);
  } else if (t === TER.BERRY) { const cx = px + 16, by = py + 26; shadow(cx, by - 1, 10); nsprite(c, "berry", cx, by, 22, Math.sin(tm * 1.6 + x) * 0.03); }
  else if (t === TER.MOUNTAIN) { if (h3(x, y, 7) > 0.4) return true; const cx = px + 16 + (h3(x, y, 1) - 0.5) * 14, by = py + 30 + h3(y, x, 2) * 6; nsprite(c, "mountain", cx, by, 52 + v * 22); }
  else if (t === TER.FRUIT_TREE) {
    const cx = px + 16, by = py + 28; shadow(cx, by - 2, 13);
    const sw = Math.sin(tm * 1.4 + x * 0.8 + y * 0.3) * 0.04;
    nsprite(c, "oak", cx, by + 1, 30 + v * 8, sw);
    const swayPx = Math.sin(tm * 1.4 + x * 0.8 + y * 0.3) * 1.2;
    for (let k = 0; k < 6; k++) {
      const fx = cx - 8 + h3(x, y, k + 2) * 16 + swayPx, fy = by - 14 - h3(y, x, k + 5) * 14;
      c.fillStyle = k % 2 === 0 ? "#e63946" : "#ff4d6d";
      c.beginPath(); c.arc(fx, fy, 2.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#ffe066"; c.fillRect(fx - 0.5, fy - 1, 0.8, 0.8);
    }
  } else if (t === TER.VEG_PATCH) {
    const cx = px + 16, by = py + 24; shadow(cx, by, 12);
    c.fillStyle = "#5c3d22"; c.beginPath(); c.ellipse(cx, by - 2, 12, 5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#e8732a";
    c.beginPath(); c.ellipse(cx - 4, by - 3, 3.5, 3, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(cx + 4, by - 2, 4, 3.2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#438227";
    c.fillRect(cx - 5, by - 7, 2, 3); c.fillRect(cx + 3, by - 6, 2, 3);
    const sw = Math.sin(tm * 2 + x) * 1;
    c.strokeStyle = "#5a9e32"; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(cx, by - 4); c.lineTo(cx - 2 + sw, by - 9); c.moveTo(cx, by - 4); c.lineTo(cx + 2 + sw, by - 8); c.stroke();
  } else if (t === TER.HERB_PATCH) {
    const cx = px + 16, by = py + 24; shadow(cx, by - 1, 10);
    nsprite(c, "berry", cx, by, 18, Math.sin(tm * 1.6 + x) * 0.03);
    for (let k = 0; k < 5; k++) {
      const lx = cx - 6 + h3(x, y, k + 10) * 12, ly = by - 8 - h3(y, x, k + 14) * 8;
      c.fillStyle = k % 2 === 0 ? "#9b5de5" : "#7209b7";
      c.beginPath(); c.ellipse(lx, ly, 1.8, 2.8, 0, 0, Math.PI * 2); c.fill();
    }
  }
  else return false;
  return true;
}

function spriteKey(g: Game, b: Building) {
  if (b.type === "townCenter") return ["townCenter", "townCenter2", "townCenter3"][g.age];
  if (b.type === "house") return `house${b.level}`;
  return FR[b.type] ? b.type : null;
}
/** draws painted sprite; footprint-anchored, overhangs upward. Returns false when no sprite exists. */
function sprite(c: C, g: Game, b: Building, x: number, y: number, w: number, h: number, tm: number, working: boolean) {
  const img = getAtlas(); const key = spriteKey(g, b);
  if (!img || !key) return false;
  const [sx, sy, sw, sh] = FR[key];
  const scale = (w * 1.22) / sw;
  const dw = sw * scale, dh = sh * scale;
  // gentle "alive" bob for staffed buildings + completion pop
  let pop = 1;
  if (b.progress >= 1) {
    if (!doneAt.has(b.id)) doneAt.set(b.id, tm);
    const e = Math.min(1, (tm - (doneAt.get(b.id) ?? tm)) / 0.45);
    pop = 1 + Math.sin(e * Math.PI) * 0.08; // squash-pop on completion / upgrade
  } else doneAt.delete(b.id);
  const breathe = working ? 1 + Math.sin(tm * 3 + b.seed * 10) * 0.008 : 1;
  const k = pop * breathe;
  const cx = x + w / 2, by = y + h + 4;
  c.drawImage(img, sx, sy, sw, sh, cx - (dw * k) / 2, by - dh * k, dw * k, dh * k);
  return true;
}

function roof(c: C, x: number, y: number, w: number, h: number, light: string, dark: string, lines = "rgba(0,0,0,0.12)") {
  const ridge = y + h * 0.48;
  c.fillStyle = light;
  c.beginPath(); c.moveTo(x - 3, ridge); c.lineTo(x + 4, y); c.lineTo(x + w - 4, y); c.lineTo(x + w + 3, ridge); c.closePath(); c.fill();
  c.fillStyle = dark;
  c.beginPath(); c.moveTo(x - 3, ridge); c.lineTo(x + w + 3, ridge); c.lineTo(x + w + 1, y + h); c.lineTo(x - 1, y + h); c.closePath(); c.fill();
  c.strokeStyle = lines; c.lineWidth = 1;
  for (let i = 1; i < 6; i++) { const yy = y + (h * i) / 6; c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke(); }
  c.strokeStyle = "rgba(255,255,255,0.25)"; c.beginPath(); c.moveTo(x - 2, ridge); c.lineTo(x + w + 2, ridge); c.stroke();
}

function hut(c: C, g: Game, x: number, y: number, w: number, h: number, wall: string, rl: string, rd: string, night: boolean) {
  const fh = Math.max(10, h * 0.3);
  c.fillStyle = wall; c.fillRect(x + 3, y + h - fh, w - 6, fh - 2);
  c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(x + 3, y + h - fh, w - 6, 3);
  c.fillStyle = "#2b1d12"; c.fillRect(x + w / 2 - 4, y + h - fh + 3, 8, fh - 5);
  c.fillStyle = night ? "#ffc066" : "#3a2a1c";
  c.fillRect(x + 8, y + h - fh + 4, 5, 4); c.fillRect(x + w - 13, y + h - fh + 4, 5, 4);
  roof(c, x, y, w, h - fh, rl, rd);
  void g;
}

export function drawBuilding(c: C, g: Game, b: Building, tm: number) {
  const d = BUILDINGS[b.type];
  const x = b.x * T, y = b.y * T, w = d.w * T, h = d.h * T;
  const p = b.progress;
  const night = g.isNight();
  const noBigShadow =
    b.type === "farm" ||
    b.type === "wall" ||
    b.type === "road" ||
    b.type === "fence" ||
    b.type === "garden" ||
    b.type === "brazier" ||
    b.type === "totem" ||
    b.type === "shrine_decor";
  if (!noBigShadow) {
    // Soft organic ground contact shadow (no harsh rectangular box)
    const gr = c.createRadialGradient(x + w / 2, y + h * 0.78, 2, x + w / 2, y + h * 0.78, Math.max(w, h) * 0.44);
    gr.addColorStop(0, "rgba(0, 0, 0, 0.2)");
    gr.addColorStop(1, "rgba(0, 0, 0, 0)");
    c.fillStyle = gr;
    c.beginPath();
    c.ellipse(x + w / 2, y + h * 0.78, w * 0.44, h * 0.24, 0, 0, Math.PI * 2);
    c.fill();
  }
  if (p < 1) {
    c.fillStyle = "#7a6248"; c.fillRect(x + 1, y + 1, w - 2, h - 2);
    c.strokeStyle = "rgba(255,240,200,0.4)"; c.setLineDash([4, 4]); c.strokeRect(x + 2, y + 2, w - 4, h - 4); c.setLineDash([]);
    c.save();
    const top = y - w * 0.6 + (h + w * 0.6) * (1 - p);
    c.beginPath(); c.rect(x - 12, top, w + 24, y + h - top + 4); c.clip();
    const hasAtlas = !!spriteKey(g, b);
    if (!sprite(c, g, b, x, y, w, h, tm, false)) {
      if (!hasAtlas) structure(c, g, b, x, y, w, h, tm, night);
    }
    c.restore();
    // scaffolding
    c.strokeStyle = "#c79a5b"; c.lineWidth = 2;
    const poles = [x + 2, x + w / 2, x + w - 2];
    for (const px of poles) { c.beginPath(); c.moveTo(px, y + h); c.lineTo(px, y - 6); c.stroke(); }
    c.lineWidth = 1.5;
    for (let yy = y + h - 8; yy > y - 4; yy -= 12) { c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke(); }
    c.strokeStyle = "rgba(199,154,91,0.6)"; c.beginPath(); c.moveTo(x + 2, y + h); c.lineTo(x + w / 2, y - 4); c.lineTo(x + w - 2, y + h); c.stroke();
    // bar
    c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(x, y - 14, w, 6);
    c.fillStyle = "#f2b84b"; c.fillRect(x + 1, y - 13, (w - 2) * p, 4);
  } else {
    if (b.level >= 2 && b.type !== "house" && b.type !== "wall") { c.strokeStyle = b.level >= 3 ? "#c9a24a" : "#8d8577"; c.lineWidth = 3; c.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3); }
    const staffed = g.units.some((u) => u.job === b.id && u.state === "working");
    const hasAtlas = !!spriteKey(g, b);
    if (sprite(c, g, b, x, y, w, h, tm, staffed)) {
      if (night && b.type !== "road") { const gl = c.createRadialGradient(x + w / 2, y + h * 0.6, 2, x + w / 2, y + h * 0.6, w * 0.7); gl.addColorStop(0, "rgba(255,190,90,0.35)"); gl.addColorStop(1, "rgba(255,190,90,0)"); c.fillStyle = gl; c.fillRect(x - w * 0.2, y - h * 0.2, w * 1.4, h * 1.4); }
      if (b.type === "totem") {
        // living aura over the painted totem
        const tcx = x + w / 2, tcy = y + h - 14;
        const aura = 0.35 + 0.25 * Math.sin(tm * 3);
        c.strokeStyle = `rgba(56, 189, 248, ${aura})`;
        c.lineWidth = 1.2;
        c.beginPath();
        c.arc(tcx, tcy, 14 + Math.sin(tm * 2) * 2, 0, Math.PI * 2);
        c.stroke();
        const sway = Math.sin(tm * 3 + b.seed) * 2.5;
        c.strokeStyle = "rgba(56,189,248,0.8)"; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(tcx - 6, tcy - 11); c.lineTo(tcx - 10 + sway, tcy - 3); c.stroke();
        c.strokeStyle = "rgba(250,204,21,0.85)";
        c.beginPath(); c.moveTo(tcx + 6, tcy - 11); c.lineTo(tcx + 10 + sway, tcy - 3); c.stroke();
      }
      if (b.type === "brazier") {
        // animated flame over the painted brazier pit
        const fcx = x + w / 2, fcy = y + h - 16;
        const flW = 6 + Math.sin(tm * 9) * 1.2;
        const flH = 10 + Math.sin(tm * 11) * 2;
        const fgr = c.createRadialGradient(fcx, fcy - 2, 1, fcx, fcy - 5, flH);
        fgr.addColorStop(0, "rgba(255, 255, 220, 0.95)");
        fgr.addColorStop(0.35, "rgba(251, 146, 60, 0.9)");
        fgr.addColorStop(0.75, "rgba(220, 38, 38, 0.6)");
        fgr.addColorStop(1, "rgba(153, 27, 27, 0)");
        c.fillStyle = fgr;
        c.beginPath();
        c.ellipse(fcx, fcy - 4, flW, flH, 0, 0, Math.PI * 2);
        c.fill();
        if (night) {
          const lgr = c.createRadialGradient(fcx, fcy - 4, 2, fcx, fcy - 4, 40);
          lgr.addColorStop(0, "rgba(254, 215, 170, 0.4)");
          lgr.addColorStop(1, "rgba(254, 215, 170, 0)");
          c.fillStyle = lgr;
          c.beginPath();
          c.arc(fcx, fcy - 4, 40, 0, Math.PI * 2);
          c.fill();
        }
      }
      if (b.type === "shrine_decor") {
        // pulsing rune glow over the painted megalith
        const mcx = x + w / 2, mcy = y + h - 20;
        const pulse = 0.35 + 0.22 * Math.sin(tm * 2.2 + b.seed * 7);
        const gl = c.createRadialGradient(mcx, mcy - 10, 1, mcx, mcy - 10, 14 + Math.sin(tm * 2.2 + b.seed * 7) * 3);
        gl.addColorStop(0, `rgba(250, 204, 21, ${pulse})`);
        gl.addColorStop(1, "rgba(250, 204, 21, 0)");
        c.fillStyle = gl;
        c.beginPath();
        c.arc(mcx, mcy - 10, 17, 0, Math.PI * 2);
        c.fill();
        // drifting spirit motes
        for (let k = 0; k < 3; k++) {
          const ph = tm * 0.8 + k * 2.1 + b.seed * 5;
          const mx = mcx + Math.sin(ph) * 7, my = mcy - 12 - ((ph * 6 + k * 14) % 26);
          c.fillStyle = `rgba(253, 224, 71, ${0.55 - k * 0.12})`;
          c.beginPath();
          c.arc(mx, my, 1.3, 0, Math.PI * 2);
          c.fill();
        }
      }
      if (staffed && (b.type === "kiln" || b.type === "forge" || b.type === "workshop") && Math.random() < 0.15) g.puff(x + w * 0.6, y - 4, 1, "smoke");
    } else if (!hasAtlas) {
      structure(c, g, b, x, y, w, h, tm, night);
    }
    if (b.type === "tower" && b.level >= 2 && !getAtlas()) {
      for (const [cx, cy] of [[x + 4, y + 4], [x + w - 4, y + 4]]) { c.fillStyle = b.level >= 3 ? "#bdb5a6" : "#958d80"; c.beginPath(); c.arc(cx, cy, b.level >= 3 ? 6 : 4, 0, Math.PI * 2); c.fill(); }
    }
    if (b.level >= 3) {
      const fx = x + w - 6, fy = y + 2;
      c.strokeStyle = "#3a2a1a"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(fx, fy + 14); c.lineTo(fx, fy - 12); c.stroke();
      c.fillStyle = "#2f5f9e"; c.beginPath(); c.moveTo(fx, fy - 12);
      for (let i = 0; i <= 4; i++) c.lineTo(fx - i * 3, fy - 12 + Math.sin(tm * 5 + i + b.seed * 9) * 1.5);
      c.lineTo(fx, fy - 5); c.closePath(); c.fill();
    }
    if (BUILDINGS[b.type].tiers) for (let i = 0; i < b.level; i++) { c.fillStyle = "#f2c14e"; c.beginPath(); const sx = x + 6 + i * 7, sy = y + h - 5; c.moveTo(sx, sy - 3); c.lineTo(sx + 3, sy); c.lineTo(sx, sy + 3); c.lineTo(sx - 3, sy); c.fill(); }
    if (b.hp < b.maxHp * 0.6) {
      c.strokeStyle = "rgba(30,20,10,0.7)"; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(x + w * 0.3, y + h * 0.3); c.lineTo(x + w * 0.4, y + h * 0.5); c.lineTo(x + w * 0.35, y + h * 0.7); c.stroke();
    }
  }
  if (p >= 1 && b.alert) alertBubble(c, x + w / 2, y - h * 0.35 - 10, b.alert.kind, b.alert.res, tm);
  if (b.fire > 0) {
    for (let i = 0; i < 4; i++) {
      const fx = x + w * (0.2 + i * 0.2), fy = y + h * 0.4 + Math.sin(tm * 9 + i) * 3, s = 7 + Math.sin(tm * 12 + i * 2) * 3;
      const gr = c.createRadialGradient(fx, fy, 1, fx, fy, s * 2);
      gr.addColorStop(0, "rgba(255,240,150,0.95)"); gr.addColorStop(0.4, "rgba(255,120,30,0.8)"); gr.addColorStop(1, "rgba(200,40,0,0)");
      c.fillStyle = gr; c.beginPath(); c.arc(fx, fy, s * 2, 0, Math.PI * 2); c.fill();
    }
  }
  if (b.hp < b.maxHp * 0.98 && p >= 1) {
    c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(x, y - 10, w, 5);
    const k = b.hp / b.maxHp; c.fillStyle = k > 0.5 ? "#5fd35f" : k > 0.25 ? "#e8c53a" : "#e04a3a"; c.fillRect(x + 1, y - 9, (w - 2) * k, 3);
  }
  if (b.queue.length) {
    c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(x, y + h + 2, w, 4);
    c.fillStyle = "#6fc3ff"; c.fillRect(x + 1, y + h + 3, (w - 2) * Math.min(1, b.qt / (b.queue[0] === "soldier" ? 14 : 10)), 2);
  }
}

/** floating "needs attention" marker: red = missing input, amber = no workers, grey = resource exhausted */
function alertBubble(c: C, x: number, y: number, kind: "idle" | "input" | "depleted", res: ResKey | undefined, tm: number) {
  const yy = y + Math.sin(tm * 3) * 2;
  const ring = kind === "input" ? "#e04a3a" : kind === "idle" ? "#f2b84b" : "#9a948a";
  c.fillStyle = "rgba(20,14,8,0.85)"; c.beginPath(); c.arc(x, yy, 9, 0, Math.PI * 2); c.fill();
  c.lineWidth = 2; c.strokeStyle = ring; c.stroke();
  c.fillStyle = res ? RES_COLOR[res] : ring; c.beginPath(); c.arc(x, yy, 4.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = ring; c.font = "bold 9px sans-serif"; c.textAlign = "center";
  c.fillText(kind === "input" ? "!" : kind === "idle" ? "z" : "×", x + 8, yy - 6);
  c.beginPath(); c.moveTo(x - 3, yy + 8); c.lineTo(x + 3, yy + 8); c.lineTo(x, yy + 13); c.fillStyle = ring; c.fill();
}

function isFenceOrWall(g: Game, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return false;
  return g.buildings.some((b) => b.x === tx && b.y === ty && (b.type === "fence" || b.type === "wall"));
}

function structure(c: C, g: Game, b: Building, x: number, y: number, w: number, h: number, tm: number, night: boolean) {
  switch (b.type) {
    case "townCenter": {
      const a = g.age;
      // courtyard
      c.fillStyle = a >= 1 ? "#8d8577" : "#8a6d4a"; c.fillRect(x + 2, y + 2, w - 4, h - 4);
      if (a >= 1) { c.strokeStyle = "#6b655b"; c.lineWidth = 3; c.strokeRect(x + 3, y + 3, w - 6, h - 6); }
      const wall = a === 0 ? "#7b5a3a" : "#9c958a";
      const rl = a === 0 ? "#cfa75e" : a === 1 ? "#a3563a" : "#5b6876";
      const rd = a === 0 ? "#a8823f" : a === 1 ? "#7d3c26" : "#3f4a56";
      hut(c, g, x + 12, y + 14, w - 24, h - 22, wall, rl, rd, night);
      if (a >= 2) { c.strokeStyle = "#e6be4a"; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 10, y + 14 + (h - 22 - 18) * 0.48); c.lineTo(x + w - 10, y + 14 + (h - 22 - 18) * 0.48); c.stroke(); }
      // corner towers in later ages
      if (a >= 1) for (const [cx, cy] of [[x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6], [x + w - 6, y + h - 6]]) {
        c.fillStyle = "#7d776c"; c.beginPath(); c.arc(cx, cy, 7, 0, Math.PI * 2); c.fill();
        c.fillStyle = rl; c.beginPath(); c.arc(cx, cy - 2, 5, 0, Math.PI * 2); c.fill();
      }
      // flag
      const fx = x + w / 2, fy = y + 4;
      c.strokeStyle = "#3a2a1a"; c.lineWidth = 2; c.beginPath(); c.moveTo(fx, fy + 24); c.lineTo(fx, fy - 18); c.stroke();
      c.fillStyle = "#d9562b";
      c.beginPath(); c.moveTo(fx, fy - 18);
      for (let i = 0; i <= 6; i++) c.lineTo(fx + i * 3.5, fy - 18 + Math.sin(tm * 5 + i) * 2);
      for (let i = 6; i >= 0; i--) c.lineTo(fx + i * 3.5, fy - 8 + Math.sin(tm * 5 + i) * 2);
      c.closePath(); c.fill();
      // brazier
      const bx = x + w / 2, by = y + h - 4;
      c.fillStyle = "#3c3c3c"; c.beginPath(); c.arc(bx, by, 4, 0, Math.PI * 2); c.fill();
      const gr = c.createRadialGradient(bx, by - 3, 1, bx, by - 3, 9 + Math.sin(tm * 10) * 2);
      gr.addColorStop(0, "rgba(255,240,170,1)"); gr.addColorStop(1, "rgba(255,90,20,0)"); c.fillStyle = gr; c.beginPath(); c.arc(bx, by - 3, 11, 0, Math.PI * 2); c.fill();
      break;
    }
    case "house": {
      const L = b.level;
      if (L >= 2) { c.fillStyle = "#8d8577"; c.fillRect(x + 1, y + h - 8, w - 2, 7); }
      const wall = L === 1 ? "#8b6a45" : "#a39c90", rl = L === 1 ? "#d1ab62" : L === 2 ? "#b0603f" : "#4f5f72", rd = L === 1 ? "#a8823f" : L === 2 ? "#87432a" : "#36424f";
      hut(c, g, x + 3, y + 4, w - 6, h - 6, wall, rl, rd, night);
      if (L === 3) { roof(c, x + 14, y - 6, w - 28, 16, rl, rd); c.fillStyle = night ? "#ffc066" : "#2b2b2b"; c.fillRect(x + w / 2 - 3, y + 2, 6, 4); }
      c.fillStyle = "#5e5a55"; c.fillRect(x + w - 18, y + 6, 6, 8); break;
    }
    case "workshop": {
      hut(c, g, x + 2, y + 2, w - 14, h - 8, "#6e5640", "#7d8a8f", "#5d6a70", night);
      const gx = x + w - 10, gy = y + h - 14, rot = g.villagers().some((v) => v.job === b.id && v.state === "working") ? tm * 2 : 0;
      c.save(); c.translate(gx, gy); c.rotate(rot); c.fillStyle = "#b5893f";
      for (let i = 0; i < 8; i++) { c.rotate(Math.PI / 4); c.fillRect(-1.5, -9, 3, 4); }
      c.beginPath(); c.arc(0, 0, 6, 0, Math.PI * 2); c.fill(); c.fillStyle = "#3a2a1a"; c.beginPath(); c.arc(0, 0, 2, 0, Math.PI * 2); c.fill(); c.restore();
      break;
    }
    case "farm": {
      c.fillStyle = "#6d4f2e"; c.fillRect(x + 2, y + 2, w - 4, h - 4);
      const grow = (Math.sin(tm * 0.15 + b.seed * 6) + 1) / 2;
      const crop = g.drought > 0 ? `hsl(40,40%,${40 + grow * 10}%)` : `hsl(${110 - grow * 65},${50 + grow * 15}%,${34 + grow * 14}%)`;
      for (let r = 0; r < 7; r++) {
        const yy = y + 8 + r * ((h - 16) / 6);
        c.strokeStyle = "rgba(40,25,10,0.5)"; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 6, yy); c.lineTo(x + w - 6, yy); c.stroke();
        c.fillStyle = crop;
        for (let k = 0; k < 9; k++) { const sw = Math.sin(tm * 2 + k + r) * 0.8; c.beginPath(); c.arc(x + 10 + k * ((w - 20) / 8) + sw, yy - 2, 2.5 + grow * 1.5, 0, Math.PI * 2); c.fill(); }
      }
      c.strokeStyle = "#8a6a42"; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, w - 2, h - 2);
      break;
    }
    case "lumber": {
      hut(c, g, x + 2, y + 2, w - 14, h - 8, "#7a5634", "#8f6a3e", "#6e4f2c", night);
      for (let i = 0; i < 4; i++) { const lx = x + w - 10, ly = y + 12 + i * 9; c.fillStyle = "#6a4423"; c.fillRect(lx - 6, ly - 3, 14, 6); c.fillStyle = "#d8b07a"; c.beginPath(); c.arc(lx + 8, ly, 3, 0, Math.PI * 2); c.fill(); }
      break;
    }
    case "quarry": {
      hut(c, g, x + 2, y + 2, w - 14, h - 8, "#7a6e60", "#9b948a", "#7a746b", night);
      c.fillStyle = "#b5b0a6"; for (let i = 0; i < 3; i++) for (let j = 0; j <= i; j++) c.fillRect(x + w - 16 + j * 5, y + h - 10 - i * 6, 7, 5);
      break;
    }
    case "mine": {
      c.fillStyle = "#5a4c3e"; c.fillRect(x + 2, y + 2, w - 4, h - 4);
      c.fillStyle = "#1a120c"; c.beginPath(); c.arc(x + w / 2, y + h - 10, 14, Math.PI, 0); c.fill();
      c.strokeStyle = "#8a6a42"; c.lineWidth = 3; c.beginPath(); c.arc(x + w / 2, y + h - 10, 14, Math.PI, 0); c.stroke();
      c.fillStyle = "#6a6a6a"; c.fillRect(x + 6, y + h - 10, 14, 7);
      c.fillStyle = `rgba(255,210,70,${0.6 + 0.4 * Math.sin(tm * 4)})`; c.beginPath(); c.arc(x + 13, y + h - 11, 3, 0, Math.PI * 2); c.fill();
      break;
    }
    case "granary": {
      for (const [ox, oy] of [[x + 18, y + 22], [x + 44, y + 38]]) {
        c.fillStyle = "#9a7a50"; c.beginPath(); c.arc(ox, oy, 14, 0, Math.PI * 2); c.fill();
        const gr = c.createRadialGradient(ox - 4, oy - 4, 2, ox, oy, 14); gr.addColorStop(0, "#e2c27a"); gr.addColorStop(1, "#a07a3c");
        c.fillStyle = gr; c.beginPath(); c.arc(ox, oy, 11, 0, Math.PI * 2); c.fill();
      }
      break;
    }
    case "barracks": {
      c.fillStyle = "#806548"; c.fillRect(x + 2, y + h - 30, w - 4, 28);
      hut(c, g, x + 2, y + 2, w - 4, h - 36, "#6f4f33", "#9c4a34", "#7a3524", night);
      const dx = x + w - 16, dy = y + h - 14;
      c.strokeStyle = "#4b3420"; c.lineWidth = 2; c.beginPath(); c.moveTo(dx, dy + 8); c.lineTo(dx, dy - 6); c.moveTo(dx - 6, dy - 2); c.lineTo(dx + 6, dy - 2); c.stroke();
      c.fillStyle = "#d0b080"; c.beginPath(); c.arc(dx, dy - 8, 3, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "#5a5a5a"; c.beginPath(); c.moveTo(x + 10, y + h - 6); c.lineTo(x + 30, y + h - 26); c.moveTo(x + 14, y + h - 6); c.lineTo(x + 34, y + h - 26); c.stroke();
      break;
    }
    case "wall": {
      for (let i = 0; i < 4; i++) {
        const px = x + 2 + i * 7.5;
        c.fillStyle = i % 2 ? "#7a5634" : "#8a6440"; c.fillRect(px, y + 6, 6.5, T - 8);
        c.beginPath(); c.moveTo(px, y + 6); c.lineTo(px + 3.25, y); c.lineTo(px + 6.5, y + 6); c.fill();
      }
      c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(x + 2, y + T - 4, T - 4, 3);
      break;
    }
    case "tower": {
      c.fillStyle = "#857e73"; c.fillRect(x + 6, y + 10, w - 12, h - 12);
      c.fillStyle = "#a39c90"; c.fillRect(x + 4, y + 2, w - 8, h - 22);
      c.fillStyle = "#6c665d";
      for (let i = 0; i < 5; i++) { c.fillRect(x + 4 + i * ((w - 14) / 4), y - 2, 6, 6); }
      c.fillStyle = "#4a3b2c"; c.fillRect(x + w / 2 - 4, y + h - 14, 8, 12);
      const gr = c.createRadialGradient(x + w / 2, y + 16, 1, x + w / 2, y + 16, 8 + Math.sin(tm * 9) * 2);
      gr.addColorStop(0, "rgba(255,230,150,1)"); gr.addColorStop(1, "rgba(255,90,20,0)"); c.fillStyle = gr; c.beginPath(); c.arc(x + w / 2, y + 16, 10, 0, Math.PI * 2); c.fill();
      break;
    }
    case "market": {
      c.fillStyle = "#a08766"; c.fillRect(x + 2, y + 2, w - 4, h - 4);
      const cols = [["#d94f3a", "#f2e6d0"], ["#2f7ac0", "#f2e6d0"], ["#e0a630", "#f2e6d0"]];
      for (let i = 0; i < 3; i++) {
        const sx = x + 6 + (i % 2) * 46, sy = y + 6 + Math.floor(i / 2) * 46 + (i === 2 ? 0 : 0);
        for (let k = 0; k < 5; k++) { c.fillStyle = cols[i][k % 2]; c.fillRect(sx + k * 7, sy, 7, 26); }
        c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(sx, sy + 22, 35, 4);
        c.fillStyle = ["#e8c25a", "#a6c45a", "#c96a5a"][i]; c.beginPath(); c.arc(sx + 17, sy + 32, 4, 0, Math.PI * 2); c.fill();
      }
      break;
    }
    case "temple": {
      const steps = ["#b8ab92", "#c9bca2", "#d9cdb3"];
      for (let i = 0; i < 3; i++) { c.fillStyle = steps[i]; c.fillRect(x + 4 + i * 12, y + 4 + i * 12, w - 8 - i * 24, h - 8 - i * 24); c.fillStyle = "rgba(0,0,0,0.15)"; c.fillRect(x + 4 + i * 12, y + h - 8 - i * 12, w - 8 - i * 24, 4); }
      const cx = x + w / 2, cy = y + h / 2;
      c.fillStyle = "#e6be4a"; c.beginPath(); c.arc(cx, cy, 7, 0, Math.PI * 2); c.fill();
      const s = 14 + Math.sin(tm * 8) * 3;
      const gr = c.createRadialGradient(cx, cy - 4, 1, cx, cy - 4, s); gr.addColorStop(0, "rgba(255,250,200,1)"); gr.addColorStop(0.5, "rgba(255,170,50,0.7)"); gr.addColorStop(1, "rgba(255,90,20,0)");
      c.fillStyle = gr; c.beginPath(); c.arc(cx, cy - 4, s, 0, Math.PI * 2); c.fill();
      break;
    }
    case "forge": {
      hut(c, g, x + 3, y + 4, w - 6, h - 8, "#4c4640", "#5f5a55", "#45403b", night);
      c.fillStyle = "#3a3632"; c.fillRect(x + w - 22, y + 2, 10, 14);
      c.fillStyle = `rgba(255,${120 + Math.sin(tm * 6) * 40},40,0.9)`; c.fillRect(x + w - 20, y + 3, 6, 3);
      if (Math.random() < 0.15) g.parts.push({ x: x + w - 17, y: y + 2, vx: (Math.random() - 0.5) * 10, vy: -25, life: 0, max: 0.8, size: 1.5, color: "255,200,90", kind: "spark" });
      break;
    }
    case "stockpile": {
      c.fillStyle = "#6d543b"; c.fillRect(x + 2, y + 2, w - 4, h - 4);
      c.strokeStyle = "#4d3a27"; c.lineWidth = 1.5; c.strokeRect(x + 3, y + 3, w - 6, h - 6);
      const crates = [
        [x + 6, y + 6, "#b58750"], [x + 22, y + 8, "#8c7151"],
        [x + 10, y + 24, "#9c805a"], [x + 28, y + 22, "#c4985c"],
        [x + 42, y + 14, "#7a6248"], [x + 40, y + 30, "#a88556"],
      ];
      for (const [cx, cy, col] of crates as [number, number, string][]) {
        c.fillStyle = col; c.fillRect(cx, cy, 14, 14);
        c.strokeStyle = "rgba(0,0,0,0.3)"; c.strokeRect(cx, cy, 14, 14);
        c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + 14, cy + 14); c.stroke();
      }
      c.fillStyle = "#8a7d65";
      c.beginPath(); c.moveTo(x + 4, y + h - 8); c.lineTo(x + w / 2, y + 6); c.lineTo(x + w - 4, y + h - 8); c.fill();
      break;
    }
    case "fishery": {
      c.fillStyle = "#70563e"; c.fillRect(x + 4, y + 4, w - 8, h - 8);
      c.strokeStyle = "#4a3522"; c.lineWidth = 1;
      for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(x + 4, y + 8 + i * 12); c.lineTo(x + w - 4, y + 8 + i * 12); c.stroke(); }
      c.fillStyle = "#9c7c58"; c.fillRect(x + 8, y + 6, 4, 18); c.fillRect(x + w - 12, y + 6, 4, 18);
      c.fillRect(x + 8, y + 8, w - 20, 3);
      c.fillStyle = "#6ca0b8";
      for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(x + 16 + i * 12, y + 15, 3, 6, 0, 0, Math.PI * 2); c.fill(); }
      break;
    }
    case "range": {
      hut(c, g, x + 3, y + 4, w - 34, h - 8, "#7a5c3a", "#cfa75e", "#a8823f", night);
      const tx = x + w - 22, ty = y + 16;
      c.fillStyle = "#e0be70"; c.beginPath(); c.arc(tx, ty, 10, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#c93d2e"; c.beginPath(); c.arc(tx, ty, 6.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#e0be70"; c.beginPath(); c.arc(tx, ty, 3.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#c93d2e"; c.beginPath(); c.arc(tx, ty, 1.2, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "#5a3e20"; c.lineWidth = 2; c.beginPath(); c.moveTo(tx, ty + 10); c.lineTo(tx, ty + 26); c.stroke();
      break;
    }
    case "shaman": {
      const cx = x + w / 2, cy = y + h / 2;
      c.fillStyle = "#5c4028"; c.beginPath(); c.arc(cx, cy, w * 0.42, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#a8823f"; c.beginPath(); c.arc(cx, cy - 4, w * 0.38, 0, Math.PI * 2); c.fill();
      const gr = c.createRadialGradient(cx, cy, 1, cx, cy, 14 + Math.sin(tm * 9) * 3);
      gr.addColorStop(0, "rgba(140, 240, 255, 0.95)");
      gr.addColorStop(0.5, "rgba(50, 180, 220, 0.7)");
      gr.addColorStop(1, "rgba(20, 80, 180, 0)");
      c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, 14, 0, Math.PI * 2); c.fill();
      if (Math.random() < 0.2) g.parts.push({ x: cx, y: cy - 6, vx: (Math.random() - 0.5) * 8, vy: -20, life: 0, max: 1.2, size: 2, color: "140,230,255", kind: "spark" });
      break;
    }
    case "armory": {
      c.fillStyle = "#5c564f"; c.fillRect(x + 2, y + 2, w - 4, h - 4);
      c.strokeStyle = "#383430"; c.lineWidth = 2; c.strokeRect(x + 3, y + 3, w - 6, h - 6);
      hut(c, g, x + 4, y + 6, w - 8, h - 12, "#4a443e", "#70685e", "#524c44", night);
      c.fillStyle = "#d49a37"; c.beginPath(); c.ellipse(x + w / 2, y + h - 10, 7, 9, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "#875f1b"; c.lineWidth = 1.5; c.stroke();
      break;
    }
    case "fence": {
      const cx = x + w / 2, cy = y + h / 2;
      const n = isFenceOrWall(g, b.x, b.y - 1);
      const s = isFenceOrWall(g, b.x, b.y + 1);
      const wSide = isFenceOrWall(g, b.x - 1, b.y);
      const eSide = isFenceOrWall(g, b.x + 1, b.y);
      const lvl = b.level || 1;

      // Small ground contact shadow
      c.fillStyle = "rgba(0,0,0,0.18)";
      c.beginPath();
      c.ellipse(cx, cy + 6, 7, 3, 0, 0, Math.PI * 2);
      c.fill();

      if (lvl === 1) {
        // --- Level 1: Wattle Fence (woven hazel twigs & rustic stakes) ---
        c.strokeStyle = "#7c5535";
        c.lineWidth = 1.8;
        if (n) { c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx, y - 2); c.stroke(); }
        if (s) { c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx, y + h + 2); c.stroke(); }
        if (wSide) {
          c.beginPath();
          c.moveTo(cx, cy - 2); c.lineTo(x - 2, cy - 2);
          c.moveTo(cx, cy + 3); c.lineTo(x - 2, cy + 3);
          c.stroke();
        }
        if (eSide) {
          c.beginPath();
          c.moveTo(cx, cy - 2); c.lineTo(x + w + 2, cy - 2);
          c.moveTo(cx, cy + 3); c.lineTo(x + w + 2, cy + 3);
          c.stroke();
        }
        // Central stake
        c.fillStyle = "#8a6340";
        c.fillRect(cx - 3, cy - 10, 6, 18);
        c.fillStyle = "#634426";
        c.beginPath();
        c.moveTo(cx - 3, cy - 10); c.lineTo(cx, cy - 15); c.lineTo(cx + 3, cy - 10);
        c.fill();
      } else if (lvl === 2) {
        // --- Level 2: Timber Palisade Fence (sharpened sturdy oak posts with cross ties) ---
        c.strokeStyle = "#5a3a1f";
        c.lineWidth = 3.5;
        if (n) { c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx, y - 2); c.stroke(); }
        if (s) { c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx, y + h + 2); c.stroke(); }
        if (wSide) {
          c.beginPath();
          c.moveTo(cx, cy - 3); c.lineTo(x - 2, cy - 3);
          c.moveTo(cx, cy + 4); c.lineTo(x - 2, cy + 4);
          c.stroke();
        }
        if (eSide) {
          c.beginPath();
          c.moveTo(cx, cy - 3); c.lineTo(x + w + 2, cy - 3);
          c.moveTo(cx, cy + 4); c.lineTo(x + w + 2, cy + 4);
          c.stroke();
        }
        // Main timber log post
        c.fillStyle = "#744b28";
        c.fillRect(cx - 4, cy - 12, 8, 20);
        c.fillStyle = "#9c6b3e";
        c.fillRect(cx - 2, cy - 11, 3, 18);
        // Sharpened cone top
        c.fillStyle = "#5c391b";
        c.beginPath();
        c.moveTo(cx - 4, cy - 12); c.lineTo(cx, cy - 18); c.lineTo(cx + 4, cy - 12);
        c.fill();
        // Iron ring binding
        c.fillStyle = "#2d2d2d";
        c.fillRect(cx - 4.5, cy - 4, 9, 2.5);
      } else {
        // --- Level 3: Fortified Iron Fence (hewn stone plinth + wrought iron spear finial) ---
        c.fillStyle = "#615c54";
        c.fillRect(cx - 5, cy + 2, 10, 8);
        c.fillStyle = "#7b756c";
        c.fillRect(cx - 4, cy + 2, 8, 2);

        c.strokeStyle = "#2e3238";
        c.lineWidth = 2.5;
        if (n) { c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx, y - 2); c.stroke(); }
        if (s) { c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx, y + h + 2); c.stroke(); }
        if (wSide) {
          c.beginPath();
          c.moveTo(cx, cy - 4); c.lineTo(x - 2, cy - 4);
          c.moveTo(cx, cy + 2); c.lineTo(x - 2, cy + 2);
          c.stroke();
          c.fillStyle = "#343840";
          c.fillRect(cx - 9, cy - 8, 2, 12);
        }
        if (eSide) {
          c.beginPath();
          c.moveTo(cx, cy - 4); c.lineTo(x + w + 2, cy - 4);
          c.moveTo(cx, cy + 2); c.lineTo(x + w + 2, cy + 2);
          c.stroke();
          c.fillStyle = "#343840";
          c.fillRect(cx + 7, cy - 8, 2, 12);
        }
        // Main dark iron post
        c.fillStyle = "#26292e";
        c.fillRect(cx - 2.5, cy - 14, 5, 18);
        // Spearhead finial
        c.fillStyle = "#8d99ae";
        c.beginPath();
        c.moveTo(cx, cy - 20);
        c.lineTo(cx + 3.5, cy - 14);
        c.lineTo(cx - 3.5, cy - 14);
        c.fill();
      }
      break;
    }
    case "totem": {
      const cx = x + w / 2, cy = y + h - 6;
      c.fillStyle = "rgba(0,0,0,0.22)";
      c.beginPath();
      c.ellipse(cx, cy, 10, 4, 0, 0, Math.PI * 2);
      c.fill();

      c.fillStyle = "#5c564f";
      c.beginPath();
      c.ellipse(cx, cy - 2, 9, 4, 0, 0, Math.PI * 2);
      c.fill();

      c.fillStyle = "#7b4728";
      c.fillRect(cx - 5, cy - 26, 10, 24);
      c.fillStyle = "#9c5e37";
      c.fillRect(cx - 3, cy - 26, 4, 24);

      c.fillStyle = "#e07a22";
      c.fillRect(cx - 4, cy - 22, 8, 3);
      c.fillStyle = "#38bdf8";
      c.fillRect(cx - 3, cy - 16, 6, 2.5);
      c.fillStyle = "#eab308";
      c.fillRect(cx - 4, cy - 10, 8, 2.5);

      c.fillStyle = "#b91c1c";
      c.beginPath();
      c.moveTo(cx, cy - 31);
      c.lineTo(cx - 9, cy - 27);
      c.lineTo(cx - 5, cy - 25);
      c.lineTo(cx, cy - 26);
      c.lineTo(cx + 5, cy - 25);
      c.lineTo(cx + 9, cy - 27);
      c.closePath();
      c.fill();

      const sway = Math.sin(tm * 3 + b.seed) * 2.5;
      c.strokeStyle = "#38bdf8"; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(cx - 6, cy - 25); c.lineTo(cx - 10 + sway, cy - 17); c.stroke();
      c.strokeStyle = "#facc15";
      c.beginPath(); c.moveTo(cx + 6, cy - 25); c.lineTo(cx + 10 + sway, cy - 17); c.stroke();

      const aura = 0.35 + 0.25 * Math.sin(tm * 3);
      c.strokeStyle = `rgba(56, 189, 248, ${aura})`;
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(cx, cy - 12, 14 + Math.sin(tm * 2) * 2, 0, Math.PI * 2);
      c.stroke();
      break;
    }
    case "garden":
      break; // painted flowerbed drawn via drawFarmPlot("tile_flowers")
    case "brazier": {
      const cx = x + w / 2, cy = y + h - 6;
      c.fillStyle = "#524d45";
      c.fillRect(cx - 8, cy, 16, 5);
      c.fillStyle = "#696359";
      c.fillRect(cx - 6, cy - 4, 12, 4);

      c.fillStyle = "#262626";
      c.beginPath();
      c.arc(cx, cy - 6, 8, 0, Math.PI);
      c.fill();
      c.strokeStyle = "#404040";
      c.lineWidth = 1.5;
      c.stroke();

      const flW = 7 + Math.sin(tm * 9) * 1.5;
      const flH = 14 + Math.sin(tm * 11) * 3;
      const fgr = c.createRadialGradient(cx, cy - 8, 1, cx, cy - 12, flH);
      fgr.addColorStop(0, "rgba(255, 255, 220, 1)");
      fgr.addColorStop(0.35, "rgba(251, 146, 60, 0.95)");
      fgr.addColorStop(0.75, "rgba(220, 38, 38, 0.7)");
      fgr.addColorStop(1, "rgba(153, 27, 27, 0)");
      c.fillStyle = fgr;
      c.beginPath();
      c.ellipse(cx, cy - 10, flW, flH, 0, 0, Math.PI * 2);
      c.fill();

      if (night) {
        const lgr = c.createRadialGradient(cx, cy - 10, 2, cx, cy - 10, 42);
        lgr.addColorStop(0, "rgba(254, 215, 170, 0.45)");
        lgr.addColorStop(1, "rgba(254, 215, 170, 0)");
        c.fillStyle = lgr;
        c.beginPath();
        c.arc(cx, cy - 10, 42, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case "shrine_decor": {
      const cx = x + w / 2, cy = y + h - 6;
      c.fillStyle = "#57534e";
      for (let i = -3; i <= 3; i++) {
        c.beginPath();
        c.arc(cx + i * 3.5, cy + (i % 2) * 1.5, 3.2, 0, Math.PI * 2);
        c.fill();
      }

      c.fillStyle = "#78716c";
      c.beginPath();
      c.moveTo(cx - 7, cy);
      c.lineTo(cx - 5, cy - 24);
      c.lineTo(cx, cy - 28);
      c.lineTo(cx + 6, cy - 23);
      c.lineTo(cx + 7, cy);
      c.closePath();
      c.fill();

      c.fillStyle = "#a8a29e";
      c.beginPath();
      c.moveTo(cx - 5, cy - 24);
      c.lineTo(cx, cy - 28);
      c.lineTo(cx + 1, cy);
      c.lineTo(cx - 4, cy);
      c.closePath();
      c.fill();

      const glow = 0.55 + 0.45 * Math.sin(tm * 3);
      c.strokeStyle = `rgba(56, 189, 248, ${glow})`;
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(cx - 2, cy - 22); c.lineTo(cx + 2, cy - 19); c.lineTo(cx - 1, cy - 15);
      c.moveTo(cx, cy - 14); c.lineTo(cx + 2, cy - 10); c.lineTo(cx - 2, cy - 8);
      c.stroke();
      break;
    }
    case "pasture": {
      c.fillStyle = "#477435";
      c.fillRect(x + 2, y + 2, w - 4, h - 4);

      c.fillStyle = "#5c9444";
      for (const [px, py] of [[x + 16, y + 20], [x + 50, y + 35], [x + 28, y + 65], [x + 65, y + 70]]) {
        c.beginPath(); c.arc(px, py, 7, 0, Math.PI * 2); c.fill();
      }

      hut(c, g, x + w - 38, y + 4, 34, 28, "#63472d", "#8f683a", "#5a3f24", night);

      c.fillStyle = "#5c3d22";
      c.fillRect(x + 10, y + 16, 26, 11);
      c.fillStyle = "#eab308";
      c.fillRect(x + 12, y + 18, 22, 6);
      c.fillStyle = "#facc15";
      for (let i = 0; i < 5; i++) c.fillRect(x + 13 + i * 4, y + 15, 2, 4);

      c.fillStyle = "#4a3520";
      c.beginPath(); c.arc(x + 20, y + 42, 6, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#38bdf8";
      c.beginPath(); c.arc(x + 20, y + 42, 4.5, 0, Math.PI * 2); c.fill();

      c.strokeStyle = "#5a3a1f";
      c.lineWidth = 2.5;
      c.strokeRect(x + 4, y + 4, w - 8, h - 8);
      c.lineWidth = 1.5;
      c.strokeRect(x + 6, y + 6, w - 12, h - 12);

      const posts = [
        [x + 4, y + 4], [x + w / 2, y + 4], [x + w - 4, y + 4],
        [x + 4, y + h / 2], [x + w - 4, y + h / 2],
        [x + 4, y + h - 4], [x + w / 2, y + h - 4], [x + w - 4, y + h - 4],
      ];
      for (const [px, py] of posts) {
        c.fillStyle = "#784f29";
        c.fillRect(px - 2.5, py - 4, 5, 8);
        c.fillStyle = "#452b14";
        c.fillRect(px - 2, py - 6, 4, 3);
      }
      break;
    }
    case "orchard": {
      c.fillStyle = "#543d26";
      c.fillRect(x + 2, y + 2, w - 4, h - 4);

      for (let r = 0; r < 4; r++) {
        const ry = y + 14 + r * 22;
        c.fillStyle = "#3f2d1b";
        c.fillRect(x + 4, ry, w - 8, 4);
      }

      const treePos = [
        [x + 24, y + 24], [x + w - 24, y + 24],
        [x + 24, y + h - 22], [x + w - 24, y + h - 22],
      ];
      for (let i = 0; i < treePos.length; i++) {
        const [tx, ty] = treePos[i];
        c.fillStyle = "#63472d";
        c.fillRect(tx - 2.5, ty - 2, 5, 12);

        const sw = Math.sin(tm * 1.5 + i * 1.2) * 1.2;
        c.fillStyle = "#365314";
        c.beginPath();
        c.arc(tx + sw, ty - 10, 15, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#4d7c0f";
        c.beginPath();
        c.arc(tx + sw - 2, ty - 12, 11, 0, Math.PI * 2);
        c.fill();

        for (let k = 0; k < 5; k++) {
          const fx = tx + sw - 8 + (k % 3) * 7;
          const fy = ty - 16 + Math.floor(k / 3) * 8;
          c.fillStyle = k % 2 === 0 ? "#ef4444" : "#eab308";
          c.beginPath(); c.arc(fx, fy, 2.2, 0, Math.PI * 2); c.fill();
        }
      }

      c.fillStyle = "#7c5535";
      c.fillRect(x + w / 2 - 8, y + h - 16, 16, 10);
      c.fillStyle = "#ef4444";
      c.beginPath();
      c.arc(x + w / 2 - 3, y + h - 15, 2.8, 0, Math.PI * 2);
      c.arc(x + w / 2 + 3, y + h - 15, 2.8, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case "vegGarden": {
      c.fillStyle = "#65492d";
      c.fillRect(x + 2, y + 2, w - 4, h - 4);

      c.fillStyle = "#52371e";
      c.fillRect(x + 4, y + 6, w - 8, 22);
      c.fillRect(x + 4, y + 34, w - 8, 22);

      c.fillStyle = "#332212";
      c.fillRect(x + 6, y + 8, w - 12, 18);
      c.fillRect(x + 6, y + 36, w - 12, 18);

      for (let i = 0; i < 4; i++) {
        const cx = x + 11 + i * 12;
        c.fillStyle = "#f97316";
        c.beginPath(); c.ellipse(cx, y + 18, 2.6, 2, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = "#4d7c0f";
        c.fillRect(cx - 1, y + 11, 2, 6);
      }

      for (let i = 0; i < 3; i++) {
        const px = x + 14 + i * 16;
        c.fillStyle = "#ea580c";
        c.beginPath(); c.arc(px, y + 46, 5, 0, Math.PI * 2); c.fill();
        c.fillStyle = "#65a30d";
        c.fillRect(px - 1, y + 40, 2, 3);
      }

      c.fillStyle = "#94a3b8";
      c.fillRect(x + w - 10, y + h - 12, 6, 7);
      break;
    }
    case "herbHut": {
      hut(c, g, x + 3, y + 4, w - 6, h - 10, "#61472e", "#557a46", "#3f5c32", night);

      c.fillStyle = "#4a3520";
      c.fillRect(x + 6, y + h - 12, 16, 7);
      c.fillStyle = "#e2e8f0";
      c.beginPath(); c.arc(x + 11, y + h - 11, 2.5, 0, Math.PI); c.fill();

      for (let i = 0; i < 4; i++) {
        const hx = x + 10 + i * 11;
        c.strokeStyle = "#713f12"; c.lineWidth = 1;
        c.beginPath(); c.moveTo(hx, y + 8); c.lineTo(hx, y + 13); c.stroke();
        c.fillStyle = i % 2 === 0 ? "#a855f7" : "#eab308";
        c.beginPath(); c.ellipse(hx, y + 15, 2.2, 3.5, 0, 0, Math.PI * 2); c.fill();
      }
      break;
    }
  }
}

type Vis = "idle" | "walk" | "gather" | "build";
const unitVis = new Map<number, { v: Vis; t: number; amp: number }>();
const TOOL: Record<string, "axe" | "pick" | "sickle" | "spear" | "shovel" | "hammer"> = { lumber: "axe", quarry: "pick", mine: "pick", farm: "sickle", hunter: "spear", clayPit: "shovel", kiln: "hammer", workshop: "hammer", market: "hammer" };

/** villager/soldier art with explicit animation states: idle (breathe), walk (stride, 0.15s blend), gather (0.9s swing), build (0.6s hammer). */
function drawUnitVector(c: C, u: Unit, tm: number, sel: boolean, jobType?: string) {
  if (u.sheltered) return; // Safely sheltered inside the Town Center!
  const { x, y } = u;
  const want: Vis = u.moving ? "walk" : u.state === "building" ? "build" : u.state === "working" ? "gather" : "idle";
  let st = unitVis.get(u.id);
  if (!st) { st = { v: want, t: tm, amp: want === "walk" ? 1 : 0 }; unitVis.set(u.id, st); }
  if (st.v !== want) { st.v = want; st.t = tm; }
  const since = tm - st.t;
  // ease stride amplitude toward target so stop/start never snaps
  st.amp += ((want === "walk" ? 1 : 0) - st.amp) * Math.min(1, 0.25);
  const amp = st.amp;
  const walk = Math.sin(u.anim) * amp;
  const breathe = Math.sin(tm * 2.2 + u.id) * 0.4 * (1 - amp);
  const bob = Math.abs(walk) * 1.6 + breathe;
  c.fillStyle = "rgba(0,0,0,0.3)"; c.beginPath(); c.ellipse(x, y + 1, 6 - Math.abs(walk) * 0.6, 2.6, 0, 0, Math.PI * 2); c.fill();
  if (sel) { c.strokeStyle = u.kind === "raider" ? "#ff5040" : "#7dff8a"; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, y + 1, 9, 4, 0, 0, Math.PI * 2); c.stroke(); }
  const dir = u.dir;
  // legs
  c.strokeStyle = "#3a2716"; c.lineWidth = 2;
  const crouch = want === "gather" || want === "build" ? 1 : 0;
  c.beginPath(); c.moveTo(x - 2, y - 5 + crouch); c.lineTo(x - 2 + walk * 3 - crouch, y); c.moveTo(x + 2, y - 5 + crouch); c.lineTo(x + 2 - walk * 3 + crouch, y); c.stroke();
  const tunic = u.kind === "soldier" ? "#2f5f9e" : u.kind === "archer" ? "#2a6639" : u.kind === "chieftain" ? "#9e251a" : u.kind === "raider" ? "#8e3324" : ["#8a6a3a", "#6a7a3a", "#7a4a3a", "#5a6a7a"][u.id % 4];
  // body leans into the stroke while working
  const phase = want === "gather" || want === "build" ? (since % 0.8) / 0.8 : 0;
  const strike = want === "gather" || want === "build" ? (phase < 0.7 ? -Math.sin((phase / 0.7) * Math.PI * 0.5) : -1 + ((phase - 0.7) / 0.3) * 2.2) : 0;
  const lean = (want === "gather" || want === "build") ? dir * Math.max(0, -strike) * -0.5 + dir * Math.max(0, strike) * 1.2 : walk * 0.3 * dir;
  const by = y - 9 - bob + crouch;
  c.fillStyle = tunic; c.beginPath(); c.ellipse(x + lean, by, 4.5, 5.5, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "rgba(0,0,0,0.18)"; c.beginPath(); c.ellipse(x + lean + 1.5, by + 1, 3, 4.5, 0, 0, Math.PI * 2); c.fill();
  const hx = x + lean * 1.3, hy = by - 7;
  c.fillStyle = "#d9a77a"; c.beginPath(); c.arc(hx, hy, 3.4, 0, Math.PI * 2); c.fill();
  if (u.kind === "villager") { c.fillStyle = "#3b2414"; c.beginPath(); c.arc(hx, hy - 1.5, 3.2, Math.PI, 0); c.fill(); }
  if (u.kind === "soldier") { c.fillStyle = "#8c8c8c"; c.beginPath(); c.arc(hx, hy - 1, 3.6, Math.PI, 0); c.fill(); }
  if (u.kind === "archer") {
    c.fillStyle = "#1e4726"; c.beginPath(); c.arc(hx, hy - 1.2, 3.8, Math.PI, 0); c.fill();
    c.strokeStyle = "#7a4d26"; c.lineWidth = 1.5; c.beginPath();
    c.arc(x + lean + dir * 5, by - 2, 6, -Math.PI * 0.4, Math.PI * 0.4); c.stroke();
    c.strokeStyle = "#e8dec5"; c.lineWidth = 0.8; c.beginPath();
    c.moveTo(x + lean + dir * 5 + Math.cos(-Math.PI * 0.4) * 6, by - 2 + Math.sin(-Math.PI * 0.4) * 6);
    c.lineTo(x + lean + dir * 5 + Math.cos(Math.PI * 0.4) * 6, by - 2 + Math.sin(Math.PI * 0.4) * 6); c.stroke();
  }
  if (u.kind === "chieftain") {
    c.fillStyle = "#c99a38"; c.beginPath(); c.arc(hx, hy - 1.2, 4.0, Math.PI, 0); c.fill();
    c.strokeStyle = "#e8c35a"; c.lineWidth = 1.8; c.beginPath();
    c.moveTo(hx - 3, hy - 2); c.lineTo(hx - 5, hy - 7);
    c.moveTo(hx + 3, hy - 2); c.lineTo(hx + 5, hy - 7); c.stroke();
    c.fillStyle = "#5c3d22"; c.fillRect(x + lean + dir * 4, by - 6, 3, 10);
    c.fillStyle = "#9c7042"; c.beginPath(); c.arc(x + lean + dir * 5, by - 7, 3.5, 0, Math.PI * 2); c.fill();
  }
  if (u.kind === "raider") {
    c.fillStyle = "#5b5b5b"; c.beginPath(); c.arc(hx, hy - 1, 3.8, Math.PI, 0); c.fill();
    c.strokeStyle = "#e8dcc0"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(hx - 3, hy - 2); c.lineTo(hx - 6, hy - 6); c.moveTo(hx + 3, hy - 2); c.lineTo(hx + 6, hy - 6); c.stroke();
  }
  if (u.kind === "villager") {
    if (want === "gather" || want === "build") {
      const tool = want === "build" ? "hammer" : TOOL[jobType ?? ""] ?? "pick";
      const ang = dir * (-0.4 + strike * 1.1);
      c.save(); c.translate(x + lean + dir * 3, by - 2); c.rotate(ang);
      c.strokeStyle = "#6b4a2a"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -10); c.stroke();
      c.fillStyle = tool === "axe" ? "#b8b8b8" : tool === "sickle" ? "#d0c070" : "#9a9a9a";
      if (tool === "axe") { c.beginPath(); c.moveTo(0, -10); c.lineTo(4, -12); c.lineTo(4, -7); c.closePath(); c.fill(); }
      else if (tool === "pick") { c.fillRect(-4, -11, 8, 2); }
      else if (tool === "sickle") { c.strokeStyle = "#d0c070"; c.beginPath(); c.arc(2, -10, 3, Math.PI, Math.PI * 2.2); c.stroke(); }
      else if (tool === "shovel") { c.fillStyle = "#8a7a6a"; c.fillRect(-2, -13, 4, 4); }
      else if (tool === "spear") { c.beginPath(); c.moveTo(0, -14); c.lineTo(-1.5, -10); c.lineTo(1.5, -10); c.fill(); }
      else c.fillRect(-2.5, -12, 5, 3);
      c.restore();
      // impact: spark/chip exactly at the end of each stroke
      if (phase > 0.7 && phase < 0.78) { c.fillStyle = want === "build" ? "#ffd27a" : "rgba(220,200,160,0.9)"; for (let i = 0; i < 3; i++) c.fillRect(x + dir * 9 + (i - 1) * 2, y - 4 - i * 2, 1.5, 1.5); }
    } else if (want === "idle" && Math.sin(tm * 0.7 + u.id * 3) > 0.92) {
      // occasional look-around
      c.fillStyle = "#2b1d12"; c.fillRect(hx - dir * 1.5 - 0.5, hy - 0.5, 1, 1);
    }
    if (u.carry > 0 && u.carryType) {
      c.fillStyle = RES_COLOR[u.carryType];
      c.fillRect(x - dir * 5 - 3 + lean, by - 6 - Math.abs(walk) * 0.8, 6, 6);
      c.strokeStyle = "rgba(0,0,0,0.35)"; c.lineWidth = 1; c.strokeRect(x - dir * 5 - 3 + lean, by - 6 - Math.abs(walk) * 0.8, 6, 6);
    }
  } else {
    const thrust = u.cd > 0.6 ? 4 : 0;
    c.strokeStyle = "#6b4a2a"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + dir * (4 + thrust), by + 4); c.lineTo(x + dir * (8 + thrust), by - 14); c.stroke();
    c.fillStyle = "#cfcfcf"; c.beginPath(); c.moveTo(x + dir * (8 + thrust), by - 14); c.lineTo(x + dir * (7 + thrust) - 1.5, by - 10); c.lineTo(x + dir * (9 + thrust) + 1.5, by - 10); c.fill();
    if (u.kind === "soldier") { c.fillStyle = "#c9a24a"; c.beginPath(); c.ellipse(x - dir * 4, by, 2.5, 4.5, 0, 0, Math.PI * 2); c.fill(); }
  }
  if (u.hp < u.maxHp) {
    c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(x - 8, by - 17, 16, 3);
    c.fillStyle = u.kind === "raider" ? "#e04a3a" : "#5fd35f"; c.fillRect(x - 8, by - 17, 16 * Math.max(0, u.hp / u.maxHp), 3);
  }
}

function drawAnimalVector(c: C, a: Animal, tm: number, sel = false) {
  const { x, y } = a;
  const dir = a.dir >= 0 ? 1 : -1;
  const walk = a.moving ? Math.sin(a.anim) * 2.8 : 0;
  const breathe = Math.sin(tm * 2.5 + a.id) * 0.5;
  const bob = a.moving ? Math.abs(walk) * 0.8 : breathe;
  const isGrazing = a.state === "graze";
  const isFleeing = a.state === "flee";
  const isHunting = a.state === "hunt";

  // Ground shadow
  c.fillStyle = "rgba(0,0,0,0.22)";
  c.beginPath();
  const radX = a.kind === "cow" ? 11 : a.kind === "deer" || a.kind === "boar" ? 9 : 7;
  c.ellipse(x, y + 1, radX, radX * 0.42, 0, 0, Math.PI * 2);
  c.fill();

  // Selection ring
  if (sel) {
    c.strokeStyle = a.domestic ? "#4ade80" : a.kind === "wolf" ? "#ef4444" : "#f59e0b";
    c.lineWidth = 1.5;
    c.beginPath();
    c.ellipse(x, y + 1, radX + 4, (radX + 4) * 0.45, 0, 0, Math.PI * 2);
    c.stroke();
  }

  // Draw per animal kind
  switch (a.kind) {
    case "sheep": {
      c.strokeStyle = "#2e231c";
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(x - 4, y - 3); c.lineTo(x - 4 + walk, y);
      c.moveTo(x - 1, y - 3); c.lineTo(x - 1 - walk, y);
      c.moveTo(x + 2, y - 3); c.lineTo(x + 2 + walk, y);
      c.moveTo(x + 5, y - 3); c.lineTo(x + 5 - walk, y);
      c.stroke();

      const by = y - 7 - bob;
      c.fillStyle = "#eae8dc";
      c.beginPath();
      c.ellipse(x, by, 7.5, 5.5, 0, 0, Math.PI * 2);
      c.ellipse(x - 3, by - 1, 5, 4.5, 0, 0, Math.PI * 2);
      c.ellipse(x + 3, by - 1, 5, 4.5, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.ellipse(x - 1, by - 2, 4.5, 3.5, 0, 0, Math.PI * 2);
      c.fill();

      const hx = x + dir * 6;
      const hy = isGrazing ? by + 3 : by - 2;
      c.fillStyle = "#33261d";
      c.beginPath();
      c.ellipse(hx, hy, 3.5, 2.8, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(hx - dir * 1.5, hy - 2, 1.5, 2.5, dir * 0.4, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case "cow": {
      c.strokeStyle = "#382c22";
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(x - 6, y - 5); c.lineTo(x - 6 + walk * 1.2, y);
      c.moveTo(x - 2, y - 5); c.lineTo(x - 2 - walk * 1.2, y);
      c.moveTo(x + 3, y - 5); c.lineTo(x + 3 + walk * 1.2, y);
      c.moveTo(x + 7, y - 5); c.lineTo(x + 7 - walk * 1.2, y);
      c.stroke();

      const by = y - 10 - bob;
      c.fillStyle = "#e2ded4";
      c.beginPath();
      c.ellipse(x, by, 11, 7, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#1e1e1e";
      c.beginPath();
      c.ellipse(x - 3, by - 1, 4.5, 3.8, 0, 0, Math.PI * 2);
      c.ellipse(x + 4, by + 1, 3.5, 3.2, 0, 0, Math.PI * 2);
      c.fill();

      c.strokeStyle = "#1e1e1e";
      c.lineWidth = 1.2;
      const tailSw = Math.sin(tm * 4 + a.id) * 3;
      c.beginPath();
      c.moveTo(x - dir * 10, by);
      c.lineTo(x - dir * 14, by + 6 + tailSw);
      c.stroke();

      const hx = x + dir * 10;
      const hy = isGrazing ? by + 5 : by - 3;
      c.fillStyle = "#e2ded4";
      c.beginPath();
      c.ellipse(hx, hy, 4.5, 4, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#f4a8b8";
      c.beginPath();
      c.ellipse(hx + dir * 2.5, hy + 1.5, 2.5, 2, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#d4ceb8";
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(hx, hy - 3); c.lineTo(hx - 2, hy - 7);
      c.moveTo(hx + 1, hy - 3); c.lineTo(hx + 3, hy - 7);
      c.stroke();
      break;
    }
    case "pig": {
      c.strokeStyle = "#db7486";
      c.lineWidth = 2.0;
      c.beginPath();
      c.moveTo(x - 5, y - 4); c.lineTo(x - 5 + walk, y);
      c.moveTo(x - 1, y - 4); c.lineTo(x - 1 - walk, y);
      c.moveTo(x + 2, y - 4); c.lineTo(x + 2 + walk, y);
      c.moveTo(x + 6, y - 4); c.lineTo(x + 6 - walk, y);
      c.stroke();

      const by = y - 7 - bob;
      c.fillStyle = "#fca5a5";
      c.beginPath();
      c.ellipse(x, by, 8.5, 6, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#f87171";
      c.beginPath();
      c.ellipse(x + 1, by + 1, 6, 4, 0, 0, Math.PI * 2);
      c.fill();

      c.strokeStyle = "#f43f5e";
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(x - dir * 8, by - 2, 2.5, 0, Math.PI * 1.7);
      c.stroke();

      const hx = x + dir * 7;
      const hy = isGrazing ? by + 3 : by - 1;
      c.fillStyle = "#fca5a5";
      c.beginPath();
      c.ellipse(hx, hy, 4, 3.5, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#f43f5e";
      c.beginPath();
      c.ellipse(hx + dir * 2.2, hy + 1, 2.2, 1.8, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#881337";
      c.fillRect(hx + dir * 2.2 - 0.7, hy + 0.8, 0.7, 0.7);
      c.fillRect(hx + dir * 2.2 + 0.2, hy + 0.8, 0.7, 0.7);
      c.fillStyle = "#fb7185";
      c.beginPath();
      c.moveTo(hx - dir * 1, hy - 3);
      c.lineTo(hx - dir * 3, hy - 6);
      c.lineTo(hx + dir * 1, hy - 4);
      c.fill();
      break;
    }
    case "deer": {
      c.strokeStyle = "#633c1a";
      c.lineWidth = 1.6;
      const legStride = isFleeing ? walk * 2.2 : walk;
      c.beginPath();
      c.moveTo(x - 5, y - 6); c.lineTo(x - 5 + legStride, y);
      c.moveTo(x - 2, y - 6); c.lineTo(x - 2 - legStride, y);
      c.moveTo(x + 3, y - 6); c.lineTo(x + 3 + legStride, y);
      c.moveTo(x + 6, y - 6); c.lineTo(x + 6 - legStride, y);
      c.stroke();

      const by = y - 11 - bob;
      c.fillStyle = "#b47b42";
      c.beginPath();
      c.ellipse(x, by, 8.5, 5, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#fdfbf7";
      c.beginPath();
      c.ellipse(x - 1, by + 2.5, 5, 2, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(x - dir * 8, by - 2, 2.2, 1.4, -dir * 0.5, 0, Math.PI * 2);
      c.fill();

      const hx = x + dir * 8;
      const hy = isGrazing ? by + 5 : by - 7;
      c.strokeStyle = "#b47b42";
      c.lineWidth = 3.5;
      c.beginPath();
      c.moveTo(x + dir * 5, by - 2);
      c.lineTo(hx, hy);
      c.stroke();

      c.fillStyle = "#9a6330";
      c.beginPath();
      c.ellipse(hx, hy, 3.2, 2.4, dir * 0.2, 0, Math.PI * 2);
      c.fill();

      c.fillStyle = "#b47b42";
      c.beginPath();
      c.ellipse(hx - dir * 1.5, hy - 3.5, 1.2, 2.5, dir * 0.3, 0, Math.PI * 2);
      c.fill();

      if (a.id % 2 === 0) {
        c.strokeStyle = "#5a3618";
        c.lineWidth = 1.3;
        c.beginPath();
        c.moveTo(hx, hy - 2); c.lineTo(hx - 2, hy - 9); c.lineTo(hx - 4, hy - 11);
        c.moveTo(hx - 2, hy - 6); c.lineTo(hx + 1, hy - 9);
        c.stroke();
      }
      break;
    }
    case "boar": {
      c.strokeStyle = "#27201a";
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(x - 5, y - 5); c.lineTo(x - 5 + walk, y);
      c.moveTo(x - 2, y - 5); c.lineTo(x - 2 - walk, y);
      c.moveTo(x + 2, y - 5); c.lineTo(x + 2 + walk, y);
      c.moveTo(x + 6, y - 5); c.lineTo(x + 6 - walk, y);
      c.stroke();

      const by = y - 9 - bob;
      c.fillStyle = "#4a3b30";
      c.beginPath();
      c.ellipse(x, by, 9, 6.5, 0, 0, Math.PI * 2);
      c.fill();

      c.fillStyle = "#1e1713";
      for (let i = -4; i <= 3; i++) {
        c.fillRect(x + i * 2, by - 7 - Math.abs(i) * 0.3, 1.6, 3.5);
      }

      const hx = x + dir * 8;
      const hy = isGrazing ? by + 4 : by - 1;
      c.fillStyle = "#382c23";
      c.beginPath();
      c.moveTo(hx - dir * 4, hy - 4);
      c.lineTo(hx + dir * 4, hy + 2);
      c.lineTo(hx - dir * 4, hy + 4);
      c.closePath();
      c.fill();

      c.strokeStyle = "#ffffff";
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(hx + dir * 2, hy + 2);
      c.lineTo(hx + dir * 4, hy - 1);
      c.stroke();
      break;
    }
    case "wolf": {
      c.strokeStyle = "#334155";
      c.lineWidth = 1.8;
      const stride = isHunting ? walk * 2.0 : walk;
      c.beginPath();
      c.moveTo(x - 6, y - 5); c.lineTo(x - 6 + stride, y);
      c.moveTo(x - 2, y - 5); c.lineTo(x - 2 - stride, y);
      c.moveTo(x + 3, y - 5); c.lineTo(x + 3 + stride, y);
      c.moveTo(x + 7, y - 5); c.lineTo(x + 7 - stride, y);
      c.stroke();

      const by = y - 9 - bob;
      c.fillStyle = "#64748b";
      c.beginPath();
      c.ellipse(x, by, 8.5, 5, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#475569";
      c.beginPath();
      c.ellipse(x - 1, by - 1.5, 6, 3, 0, 0, Math.PI * 2);
      c.fill();

      c.strokeStyle = "#475569";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(x - dir * 7, by);
      c.lineTo(x - dir * 13, by + 4);
      c.stroke();

      const hx = x + dir * 8;
      const hy = isHunting ? by + 1 : by - 3;
      c.fillStyle = "#64748b";
      c.beginPath();
      c.ellipse(hx, hy, 4, 3, dir * 0.1, 0, Math.PI * 2);
      c.fill();

      c.fillStyle = "#334155";
      c.beginPath();
      c.moveTo(hx - dir * 1.5, hy - 2);
      c.lineTo(hx - dir * 2, hy - 7);
      c.lineTo(hx + dir * 0.5, hy - 4);
      c.fill();

      c.fillStyle = "#facc15";
      c.fillRect(hx + dir * 1.5, hy - 1, 1.2, 1.2);
      break;
    }
  }

  // Floating HP bar if injured
  if (a.hp < a.maxHp) {
    const barW = 16;
    c.fillStyle = "rgba(0,0,0,0.65)";
    c.fillRect(x - barW / 2, y - 18, barW, 3);
    const hpFrac = Math.max(0, a.hp / a.maxHp);
    c.fillStyle = a.domestic ? "#4ade80" : "#ef4444";
    c.fillRect(x - barW / 2, y - 18, barW * hpFrac, 3);
  }

  // Fleeing or hunting indicator icon
  if (isFleeing) {
    c.fillStyle = "#f59e0b";
    c.font = "bold 9px sans-serif";
    c.textAlign = "center";
    c.fillText("!", x, y - 19);
  } else if (isHunting) {
    c.fillStyle = "#ef4444";
    c.font = "bold 9px sans-serif";
    c.textAlign = "center";
    c.fillText("⚔", x, y - 19);
  }
}


// ---------- painted unit & animal sprites (StoneAge2300 asset packs) ----------
const UF = unitFrames as unknown as Record<string, [number, number, number, number]>;
const AF = animalFrames as unknown as Record<string, [number, number, number, number]>;
const cyc = (n: number, ph: number) => Math.floor((ph / (Math.PI * 2)) * n + 0.0001) % n;

function unitSpriteFor(u: Unit, want: string, tm: number): string | null {
  switch (u.kind) {
    case "villager": {
      const female = u.id % 2 === 1;
      if (want === "walk") return (female ? "vf_walk" : "vm_walk") + cyc(8, u.anim);
      if (want === "gather" || want === "build") {
        const phase = (tm % 0.8) / 0.8;
        const k = phase < 0.3 ? 0 : phase < 0.7 ? 1 : 2;
        return female ? "vf_farm" + k : "vm_work" + k * 2;
      }
      const k = Math.floor(tm * 1.6 + u.id * 2.3) % (female ? 8 : 6);
      return (female ? "vf_idle" : "vm_idle") + k;
    }
    case "soldier": {
      if (u.cd > 0.6) return "soldier_attack0";
      if (want === "walk") return "soldier_walk" + cyc(2, u.anim);
      return "soldier_idle" + (Math.floor(tm * 1.5 + u.id * 1.7) % 3);
    }
    case "archer": {
      if (u.cd > 0.6) return "archer_a" + (2 + (Math.floor((1 - u.cd) * 4) % 4));
      if (want === "walk") return "archer_a" + cyc(8, u.anim);
      return "archer_a" + [0, 1, 7][Math.floor(tm * 1.4 + u.id * 2.1) % 3];
    }
    case "chieftain": {
      if (u.cd > 0.6) return "chieftain_atk" + (Math.floor((1 - u.cd) * 4) % 4);
      if (want === "walk") return "chieftain_walk" + cyc(4, u.anim);
      return "chieftain_idle" + (Math.floor(tm * 1.2 + u.id * 1.3) % 4);
    }
    case "raider": {
      if (u.wave >= 3 && u.id % 9 === 0) return "echief" + (u.id % 2);
      return "rival" + String((u.id * 7) % 26).padStart(2, "0");
    }
  }
  return null;
}

const UNIT_H: Record<Unit["kind"], number> = { villager: 30, soldier: 32, archer: 32, chieftain: 38, raider: 31 };

export function drawUnit(c: C, u: Unit, tm: number, sel: boolean, jobType?: string) {
  if (u.sheltered) return;
  if (!unitImgReady || !unitImg) { drawUnitVector(c, u, tm, sel, jobType); return; }
  const want = u.moving ? "walk" : u.state === "building" ? "build" : u.state === "working" ? "gather" : "idle";
  const name = unitSpriteFor(u, want, tm);
  const fr = name ? UF[name] : undefined;
  if (!fr) { drawUnitVector(c, u, tm, sel, jobType); return; }
  const [sx, sy, sw, sh] = fr;
  const striking = u.cd > 0.6 && u.kind !== "villager";
  const h = UNIT_H[u.kind] * (striking ? 1.06 : 1);
  const w = (sw / sh) * h;
  const { x, y } = u;
  const bob = u.moving ? Math.abs(Math.sin(u.anim)) * 1.4 : Math.sin(tm * 2.2 + u.id) * 0.4;
  c.fillStyle = "rgba(0,0,0,0.3)";
  c.beginPath();
  c.ellipse(x, y + 1, w * 0.3, 2.6, 0, 0, Math.PI * 2);
  c.fill();
  if (sel) {
    c.strokeStyle = u.kind === "raider" ? "#ff5040" : "#7dff8a";
    c.lineWidth = 1.5;
    c.beginPath();
    c.ellipse(x, y + 1, w * 0.38, 4, 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.save();
  c.translate(x + (striking ? u.dir * 2 : 0), y - bob);
  if (u.dir < 0) c.scale(-1, 1);
  c.drawImage(unitImg, sx, sy, sw, sh, -w / 2, -h, w, h);
  c.restore();
  if (u.carry > 0 && u.carryType) {
    c.fillStyle = RES_COLOR[u.carryType];
    c.fillRect(x - u.dir * 5 - 3, y - 24, 6, 6);
    c.strokeStyle = "rgba(0,0,0,0.35)";
    c.lineWidth = 1;
    c.strokeRect(x - u.dir * 5 - 3, y - 24, 6, 6);
  }
  if (u.hp < u.maxHp) {
    c.fillStyle = "rgba(0,0,0,0.6)";
    c.fillRect(x - 8, y - h - 3, 16, 3);
    c.fillStyle = u.kind === "raider" ? "#e04a3a" : "#5fd35f";
    c.fillRect(x - 8, y - h - 3, 16 * Math.max(0, u.hp / u.maxHp), 3);
  }
}

const ANI_H: Record<string, number> = { sheep: 14, cow: 22, pig: 13, deer: 23, boar: 15, wolf: 17, bear: 24, rabbit: 9, eagle: 18, raven: 10 };

function animalSpriteFor(a: Animal, tm: number): string | null {
  switch (a.kind) {
    case "sheep": return a.moving ? "sheep_walk" + cyc(6, a.anim) : "sheep_idle";
    case "cow": return a.moving ? "cow_walk" + cyc(7, a.anim) : "cow_walk0";
    case "pig": return a.moving ? "pig_walk" + cyc(5, a.anim) : "pig_idle";
    case "deer": return a.moving ? "deer_run" + cyc(4, a.anim) : "deer_idle";
    case "boar": return a.moving ? "boar_run" + cyc(5, a.anim) : "boar_idle";
    case "wolf": return a.moving ? "wolf" + cyc(4, a.anim) : "wolf_idle";
    case "bear": return a.moving ? "bear_walk" + cyc(3, a.anim) : "bear_idle" + cyc(4, tm * 0.6);
    case "rabbit": return a.moving ? (a.state === "flee" ? "rabbit_hop" : "rabbit_hop") : "rabbit_idle" + cyc(2, tm);
    case "eagle": return "eagle" + cyc(4, a.anim * 1.4);
    case "raven": return a.moving ? "raven" + cyc(2, a.anim * 1.6) : "raven0";
  }
  return null;
}

export function drawAnimal(c: C, a: Animal, tm: number, sel = false) {
  if (!animalImgReady || !animalImg) { drawAnimalVector(c, a, tm, sel); return; }
  const name = animalSpriteFor(a, tm);
  const fr = name ? AF[name] : undefined;
  if (!fr) { drawAnimalVector(c, a, tm, sel); return; }
  const [sx, sy, sw, sh] = fr;
  const h = ANI_H[a.kind] ?? 16;
  const w = (sw / sh) * h;
  const { x, y } = a;
  const radX = w * 0.4;
  c.fillStyle = "rgba(0,0,0,0.22)";
  c.beginPath();
  c.ellipse(x, y + 1, radX, radX * 0.42, 0, 0, Math.PI * 2);
  c.fill();
  if (sel) {
    c.strokeStyle = a.domestic ? "#4ade80" : a.kind === "wolf" ? "#ef4444" : "#f59e0b";
    c.lineWidth = 1.5;
    c.beginPath();
    c.ellipse(x, y + 1, radX + 4, (radX + 4) * 0.45, 0, 0, Math.PI * 2);
    c.stroke();
  }
  const bob = a.moving ? Math.abs(Math.sin(a.anim * 2)) * 0.9 : Math.sin(tm * 2.5 + a.id) * 0.4;
  const lift = a.kind === "eagle" ? 26 + Math.sin(tm * 1.8 + a.id) * 5 : 0;
  c.save();
  c.translate(x, y - bob - lift);
  if (a.dir < 0) c.scale(-1, 1);
  c.drawImage(animalImg, sx, sy, sw, sh, -w / 2, -h, w, h);
  c.restore();
  if (lift > 0) {
    c.fillStyle = "rgba(0,0,0,0.10)";
    c.beginPath();
    c.ellipse(x, y + 2, w * 0.3, w * 0.12, 0, 0, Math.PI * 2);
    c.fill();
  }
  if (a.hp < a.maxHp) {
    c.fillStyle = "rgba(0,0,0,0.6)";
    c.fillRect(x - 7, y - h - 2, 14, 3);
    c.fillStyle = "#5fd35f";
    c.fillRect(x - 7, y - h - 2, 14 * Math.max(0, a.hp / a.maxHp), 3);
  }
}


// ---------- rival camps, decor, painted overlays ----------
export function uiFrame(name: string): [number, number, number, number] | undefined { return UFR[name]; }

export function drawCamp(c: C, g: Game, camp: Camp, tm: number, sel: boolean) {
  if (!campsImgReady || !campsImg) return;
  const tr = g.tribes.find((t) => t.id === camp.tribeId);
  const atWar = g.isAtWar(camp.tribeId);
  const ordered = [...camp.buildings].sort((a, b) => (a.dy - b.dy));
  for (const bb of ordered) {
    const fr = CF[bb.img];
    if (!fr) continue;
    const [sx, sy, sw, sh] = fr;
    const h = sh * bb.scale, w = sw * bb.scale;
    const bx = camp.x + bb.dx - w / 2, by = camp.y + bb.dy - h;
    c.fillStyle = "rgba(0,0,0,0.25)";
    c.beginPath();
    c.ellipse(camp.x + bb.dx, camp.y + bb.dy, w * 0.42, w * 0.18, 0, 0, Math.PI * 2);
    c.fill();
    c.drawImage(campsImg, sx, sy, sw, sh, bx, by, w, h);
  }
  // banner: red when at war, amber banner otherwise
  const poleX = camp.x + 58, poleTop = camp.y - 86;
  c.strokeStyle = "#5a4326"; c.lineWidth = 3;
  c.beginPath(); c.moveTo(poleX, camp.y + 26); c.lineTo(poleX, poleTop); c.stroke();
  const wave = Math.sin(tm * 3) * 3;
  c.fillStyle = atWar ? "#b91c1c" : "#b4832f";
  c.beginPath();
  c.moveTo(poleX, poleTop);
  c.lineTo(poleX + 30 + wave, poleTop + 7);
  c.lineTo(poleX + 30 + wave, poleTop + 24);
  c.lineTo(poleX, poleTop + 18);
  c.closePath(); c.fill();
  c.fillStyle = "rgba(0,0,0,0.35)";
  c.fillRect(poleX + 4, poleTop + 5, 22 + wave, 1);
  if (sel) {
    c.strokeStyle = "#f59e0b"; c.lineWidth = 2;
    c.beginPath(); c.ellipse(camp.x, camp.y + 6, 78, 34, 0, 0, Math.PI * 2); c.stroke();
  }
  if (camp.hp < camp.maxHp) {
    c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(camp.x - 24, camp.y - 100, 48, 5);
    c.fillStyle = "#ef4444"; c.fillRect(camp.x - 24, camp.y - 100, 48 * Math.max(0, camp.hp / camp.maxHp), 5);
  }
  // hover label
  if (g.hover.sx >= 0) {
    const w = g.screenToWorld(g.hover.sx, g.hover.sy);
    if (Math.hypot(w.x - camp.x, w.y - camp.y) < 80) {
      c.font = "bold 11px sans-serif"; c.textAlign = "center";
      c.fillStyle = "rgba(0,0,0,0.65)";
      const label = (tr?.name ?? "Rival Camp") + (atWar ? " — AT WAR" : tr?.defenseAlliance ? " — ALLIED" : "");
      const tw = c.measureText(label).width + 10;
      c.fillRect(camp.x - tw / 2, camp.y - 118, tw, 15);
      c.fillStyle = atWar ? "#fca5a5" : tr?.defenseAlliance ? "#a7f3d0" : "#e8d9b0";
      c.fillText(label, camp.x, camp.y - 107);
    }
  }
}

export function drawDecor(c: C, g: Game) {
  if (!uiImgReady || !uiImg) return;
  for (const d of g.decor) {
    const fr = UFR[d.img];
    if (!fr) continue;
    const [sx, sy, sw, sh] = fr;
    const w = 56 * d.s, h = (sh / sw) * w;
    c.globalAlpha = 0.92;
    c.drawImage(uiImg, sx, sy, sw, sh, d.x - w / 2, d.y - h, w, h);
    c.globalAlpha = 1;
  }
}

export function drawFarmPlot(c: C, b: Building, def: { w: number; h: number }, img: string = "tile_farm") {
  if (!uiImgReady || !uiImg) return;
  const fr = UFR[img];
  if (!fr) return;
  const [sx, sy, sw, sh] = fr;
  const w = def.w * T * 1.35, h = (sh / sw) * w;
  c.globalAlpha = 0.95;
  c.drawImage(uiImg, sx, sy, sw, sh, b.x * T + (def.w * T - w) / 2, (b.y + def.h * 0.4) * T - h / 2, w, h);
  c.globalAlpha = 1;
}

export function drawRingFx(c: C, g: Game) {
  if (!vfxImgReady || !vfxImg) return;
  for (const r of g.ringFx) {
    const fr = VF[r.fr];
    if (!fr) continue;
    const [sx, sy, sw, sh] = fr;
    const k = r.life / r.max;
    const pop = k < 0.25 ? k / 0.25 : 1;
    const size = (30 + k * 90) * pop;
    c.globalAlpha = 0.85 * (1 - k);
    const h = size * (sh / sw) * 0.8;
    c.save();
    c.translate(r.x, r.y - 10 - k * 26);
    c.rotate(r.rot + k * 0.9);
    c.drawImage(vfxImg, sx, sy, sw, sh, -size / 2, -h / 2, size, h);
    c.restore();
    c.globalAlpha = 1;
  }
}

export function drawSpriteParts(c: C, g: Game) {
  if (!vfxImgReady || !vfxImg) return false;
  for (const p of g.parts) {
    if (p.kind !== "fire" && p.kind !== "smoke" && p.kind !== "debris") continue;
    const fr = VF[p.kind === "fire" ? "vfx_fire" : p.kind === "smoke" ? "vfx_smoke" : "vfx_rock" + (p.size % 3 | 0)];
    if (!fr) continue;
    const [sx, sy, sw, sh] = fr;
    const k = 1 - p.life / p.max;
    const grow = p.kind === "smoke" ? p.life * 10 : 0;
    const size = (p.kind === "fire" ? 18 + p.life * 22 : 16 + grow) * (0.5 + k * 0.5);
    c.globalAlpha = (p.kind === "smoke" ? 0.3 : 0.85) * k;
    const h = size * (sh / sw);
    c.save();
    c.translate(p.x, p.y);
    if (p.kind === "debris") c.rotate(p.life * 6 + p.size);
    c.drawImage(vfxImg, sx, sy, sw, sh, -size / 2, -h / 2, size, h);
    c.restore();
  }
  c.globalAlpha = 1;
  return true;
}
