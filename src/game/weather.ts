/**
 * Stone Age 2300 - Visual Weather & Environmental System
 * Features Rain, Snow, and Volcanic Ash Storms with realistic multi-layer particle simulations,
 * atmospheric color grading, dynamic resource yield modulation, and building durability wear.
 */

import type { Building } from "./engine";
import type { ResKey } from "./data";
import { audio } from "./audio";

export type WeatherType = "clear" | "rain" | "snow" | "ash_storm";

export interface WeatherMeta {
  type: WeatherType;
  name: string;
  subtitle: string;
  desc: string;
  bannerTitle: string;
  bannerText: string;
  themeColor: string;
  badgeBg: string;
  skyFilter: string;
  minDuration: number;
  maxDuration: number;
  buffs: string[];
  debuffs: string[];
  durabilityDesc: string;
}

export const WEATHER_CONFIGS: Record<WeatherType, WeatherMeta> = {
  clear: {
    type: "clear",
    name: "Fair Skies",
    subtitle: "Temperate & Calm",
    desc: "Gentle breezes and clear sunshine. Standard production rates across all settlements.",
    bannerTitle: "SKIES CLEAR",
    bannerText: "Fair weather settles over the valley. Normal operations resume.",
    themeColor: "#f5c542",
    badgeBg: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    skyFilter: "rgba(0,0,0,0)",
    minDuration: 65,
    maxDuration: 95,
    buffs: ["Normal harvest & crafting rates", "No environmental structural decay"],
    debuffs: [],
    durabilityDesc: "Buildings are safe from environmental erosion.",
  },
  rain: {
    type: "rain",
    name: "Heavy Rain",
    subtitle: "Torrential Downpour",
    desc: "Pouring rain drenches the soil, filling irrigation trenches and invigorating waterways.",
    bannerTitle: "RAINSTORM",
    bannerText: "Heavy rain rolls across the valley! Farm yields surge while open roads prevent muddy delays.",
    themeColor: "#60a5fa",
    badgeBg: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    skyFilter: "rgba(16, 28, 48, 0.18)",
    minDuration: 50,
    maxDuration: 75,
    buffs: [
      "Farms: +40% faster crop growth cycle",
      "Fishing Wharfs: +25% catch yield",
      "Clay Pits: +30% yield from saturated mud",
    ],
    debuffs: [
      "Quarries & Mines: 20% slower work on slick stone",
      "Unpaved travel: -10% walking speed in open mud",
    ],
    durabilityDesc: "Mild water erosion (-0.35 HP/s) wears thatched huts & clay pits unless protected by Wells or Shamans.",
  },
  snow: {
    type: "snow",
    name: "Bitter Blizzard",
    subtitle: "Subzero Freeze",
    desc: "Freezing winds blanket the valley in dense snow and frost. Rivers ice over and crops freeze.",
    bannerTitle: "BLIZZARD",
    bannerText: "A subzero frost descends! Farmlands freeze over; hunters track game in the snow.",
    themeColor: "#93c5fd",
    badgeBg: "bg-sky-500/20 text-sky-200 border-sky-400/40",
    skyFilter: "rgba(180, 215, 255, 0.16)",
    minDuration: 45,
    maxDuration: 70,
    buffs: [
      "Hunter's Lodges: +40% meat yield (tracks visible in fresh snow)",
      "Roads retain full transit speed against snow drifts",
    ],
    debuffs: [
      "Farms: -55% growth cycle (frozen topsoil)",
      "Fishing Wharfs: -40% yield (shoreline ice)",
      "Lumber Camps: 20% slower timber felling",
      "Unpaved travel: -15% walking speed in snowdrifts",
    ],
    durabilityDesc: "Heavy snow accumulation (-0.65 HP/s) on wooden roofs. Keep builders on repair duty or shelter under Shamans.",
  },
  ash_storm: {
    type: "ash_storm",
    name: "Ash Tempest",
    subtitle: "Volcanic Fallout",
    desc: "Choking clouds of soot, sulfur, and glowing volcanic embers rain from the turbulent heavens.",
    bannerTitle: "ASH STORM",
    bannerText: "Volcanic ash darkens the sun! High heat supercharges kilns & forges, but acidic soot attacks exposed wood.",
    themeColor: "#f97316",
    badgeBg: "bg-orange-500/25 text-orange-300 border-orange-500/50",
    skyFilter: "rgba(75, 28, 10, 0.24)",
    minDuration: 40,
    maxDuration: 65,
    buffs: [
      "Brick Kilns: +35% firing speed & yield",
      "Iron Forge & Armory: +30% tool & weapon crafting output",
      "Gold Mines: +15% ore exposed by seismic fallout",
    ],
    debuffs: [
      "Farms: -50% growth (sunlight choked by soot clouds)",
      "Lumber Camps: -30% yield from hazardous air",
      "Hunter Lodges: -40% yield (wildlife fled to deep caves)",
    ],
    durabilityDesc: "Corrosive fallout causes steady decay (-0.85 HP/s) to wood structures & palisades. Stone buildings are immune.",
  },
};

/** Dedicated realistic rain streak */
interface RainStreak {
  x: number;
  y: number;
  speed: number;
  length: number;
  alpha: number;
  layer: 0 | 1; // 0 = background (finer, softer), 1 = foreground (longer, sharper)
}

/** Ground water splash / ripple */
interface RainSplash {
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
}

/** Drifting snowflake with depth */
interface SnowFlake {
  x: number;
  y: number;
  radius: number;
  vy: number;
  swaySpeed: number;
  swayPhase: number;
  swayAmp: number;
  alpha: number;
  layer: 0 | 1;
}

/** Volcanic soot and ember particle */
interface AshParticle {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  swaySpeed: number;
  swayPhase: number;
  alpha: number;
  isEmber: boolean;
  pulsePhase: number;
}

export class WeatherSystem {
  current: WeatherType = "clear";
  nextWeather: WeatherType = "rain";
  timer: number = 70;
  duration: number = 70;
  windSpeed: number = -38;
  windTarget: number = -38;

  // Particle systems
  private rainStreaks: RainStreak[] = [];
  private rainSplashes: RainSplash[] = [];
  private snowFlakes: SnowFlake[] = [];
  private ashParticles: AshParticle[] = [];

  // Ambient lighting & storm shimmer
  private lightningTimer = 22;
  private lightningFlash = 0; // 0..1 pulse
  private mistOffset = 0;

  constructor() {
    this.initParticles();
  }

  private initParticles() {
    const w = typeof window !== "undefined" ? window.innerWidth : 1280;
    const h = typeof window !== "undefined" ? window.innerHeight : 720;

    // --- Rain Streaks (360 total drops: 220 fine background + 140 crisp foreground) ---
    this.rainStreaks = [];
    for (let i = 0; i < 360; i++) {
      const isForeground = i >= 220;
      this.rainStreaks.push({
        x: Math.random() * (w + 240) - 120,
        y: Math.random() * (h + 100) - 50,
        speed: isForeground ? 1150 + Math.random() * 350 : 850 + Math.random() * 250,
        length: isForeground ? 20 + Math.random() * 10 : 12 + Math.random() * 6,
        alpha: isForeground ? 0.42 + Math.random() * 0.22 : 0.22 + Math.random() * 0.18,
        layer: isForeground ? 1 : 0,
      });
    }

    // --- Snowflakes (220 flakes with realistic turbulent float) ---
    this.snowFlakes = [];
    for (let i = 0; i < 220; i++) {
      const isForeground = i >= 150;
      this.snowFlakes.push({
        x: Math.random() * (w + 160) - 80,
        y: Math.random() * (h + 80) - 40,
        radius: isForeground ? 2.2 + Math.random() * 1.6 : 1.1 + Math.random() * 1.0,
        vy: isForeground ? 65 + Math.random() * 40 : 38 + Math.random() * 30,
        swaySpeed: 1.2 + Math.random() * 2.2,
        swayPhase: Math.random() * Math.PI * 2,
        swayAmp: 18 + Math.random() * 26,
        alpha: isForeground ? 0.75 + Math.random() * 0.25 : 0.4 + Math.random() * 0.35,
        layer: isForeground ? 1 : 0,
      });
    }

    // --- Ash Storm (170 soot flakes + 50 glowing embers) ---
    this.ashParticles = [];
    for (let i = 0; i < 220; i++) {
      const isEmber = i >= 170;
      this.ashParticles.push({
        x: Math.random() * (w + 160) - 80,
        y: Math.random() * (h + 80) - 40,
        size: isEmber ? 1.8 + Math.random() * 1.6 : 1.4 + Math.random() * 2.0,
        vx: 0,
        vy: isEmber ? 35 + Math.random() * 40 : 80 + Math.random() * 55,
        swaySpeed: 1.5 + Math.random() * 2.5,
        swayPhase: Math.random() * Math.PI * 2,
        alpha: 0.5 + Math.random() * 0.45,
        isEmber,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  update(dt: number, vw: number, vh: number): { changed: boolean; previous: WeatherType } {
    this.timer -= dt;
    let changed = false;
    let previous = this.current;

    // Wind shifts gently over time with natural momentum
    if (Math.random() < dt * 0.25) {
      if (this.current === "ash_storm") {
        this.windTarget = -95 - Math.random() * 60;
      } else if (this.current === "snow") {
        this.windTarget = -20 + (Math.random() - 0.5) * 40;
      } else if (this.current === "rain") {
        this.windTarget = -45 - Math.random() * 35;
      } else {
        this.windTarget = -15 + (Math.random() - 0.5) * 25;
      }
    }
    this.windSpeed += (this.windTarget - this.windSpeed) * Math.min(1, dt * 1.4);
    this.mistOffset = (this.mistOffset + dt * 14) % 1000;

    // Weather transition check
    if (this.timer <= 0) {
      previous = this.current;
      this.current = this.nextWeather;
      changed = true;

      // Natural atmospheric cycle
      const cycle: Record<WeatherType, WeatherType[]> = {
        clear: ["rain", "snow", "ash_storm"],
        rain: ["clear", "clear", "snow"],
        snow: ["clear", "clear", "rain"],
        ash_storm: ["clear", "rain"],
      };
      const choices = cycle[this.current] || ["clear"];
      this.nextWeather = choices[Math.floor(Math.random() * choices.length)];

      const meta = WEATHER_CONFIGS[this.current];
      this.duration = meta.minDuration + Math.random() * (meta.maxDuration - meta.minDuration);
      this.timer = this.duration;
    }

    // --- Weather Specific Physics ---
    if (this.current === "rain") {
      // Distant atmospheric thunder shimmer
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 22 + Math.random() * 26;
        this.lightningFlash = 1.0;
        // Trigger subtle ambient thunderclap
        audio.play("earthquake");
      }
      if (this.lightningFlash > 0) {
        this.lightningFlash = Math.max(0, this.lightningFlash - dt * 5.5);
      }

      // Consistent natural slant angle matching the wind (all drops fall in parallel)
      const windSlant = this.windSpeed * 0.0032 - 0.15;

      // Update rain streaks
      for (const p of this.rainStreaks) {
        p.x += (windSlant * p.speed) * dt;
        p.y += p.speed * dt;

        // Ground splash trigger when drop reaches lower viewport area
        if (p.y > vh - 60 && Math.random() < 0.045 && this.rainSplashes.length < 35) {
          this.rainSplashes.push({
            x: p.x,
            y: p.y,
            r: 1,
            maxR: 3.5 + Math.random() * 3.5,
            alpha: 0.45 + Math.random() * 0.35,
          });
        }

        // Wrap around viewport boundaries cleanly
        if (p.y > vh + 30 || p.x < -100 || p.x > vw + 100) {
          p.y = -p.length - Math.random() * 40;
          p.x = Math.random() * (vw + 240) - 60;
        }
      }

      // Update ground water splashes / ripples
      for (let i = this.rainSplashes.length - 1; i >= 0; i--) {
        const s = this.rainSplashes[i];
        s.r += dt * 16;
        if (s.r >= s.maxR) {
          this.rainSplashes.splice(i, 1);
        }
      }
    } else if (this.current === "snow") {
      for (const p of this.snowFlakes) {
        p.swayPhase += dt * p.swaySpeed;
        p.x += (this.windSpeed * 0.6 + Math.sin(p.swayPhase) * p.swayAmp) * dt;
        p.y += p.vy * dt;

        if (p.y > vh + 20 || p.x < -60 || p.x > vw + 60) {
          p.y = -15 - Math.random() * 20;
          p.x = Math.random() * (vw + 160) - 80;
        }
      }
    } else if (this.current === "ash_storm") {
      for (const p of this.ashParticles) {
        p.swayPhase += dt * p.swaySpeed;
        p.pulsePhase += dt * 4;
        if (p.isEmber) {
          p.x += (this.windSpeed * 1.15 + Math.sin(p.swayPhase * 1.8) * 35) * dt;
          p.y += (p.vy + Math.cos(p.swayPhase) * 20) * dt;
        } else {
          p.x += (this.windSpeed + Math.sin(p.swayPhase) * 25) * dt;
          p.y += p.vy * dt;
        }

        if (p.y > vh + 20 || p.x < -80 || p.x > vw + 80) {
          p.y = -15 - Math.random() * 20;
          p.x = Math.random() * (vw + 180) - 90;
        }
      }
    }

    return { changed, previous };
  }

  setWeather(w: WeatherType) {
    this.current = w;
    const meta = WEATHER_CONFIGS[w];
    this.duration = meta.minDuration + Math.random() * (meta.maxDuration - meta.minDuration);
    this.timer = this.duration;
  }

  /**
   * Render high-fidelity weather atmosphere overlays and particles over the canvas.
   * Completely eliminates cross-screen polygon connection bugs by strictly drawing
   * isolated, parallel raindrop subpaths with distinct ground ripple pools.
   */
  render(ctx: CanvasRenderingContext2D, vw: number, vh: number, dpr: number) {
    if (this.current === "clear") return;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const meta = WEATHER_CONFIGS[this.current];

    // 1. Atmospheric color grading wash (overcast sky)
    ctx.fillStyle = meta.skyFilter;
    ctx.fillRect(0, 0, vw, vh);

    if (this.current === "rain") {
      // -------------------------------------------------------------
      // REALISTIC ISOMETRIC RAIN CURTAIN
      // -------------------------------------------------------------
      const slant = this.windSpeed * 0.0032 - 0.15; // Parallel wind slant

      // A. Soft Horizon Rain Mist (delicate atmospheric humidity gradient)
      const mistGrad = ctx.createLinearGradient(0, vh * 0.65, 0, vh);
      mistGrad.addColorStop(0, "rgba(140, 180, 220, 0)");
      mistGrad.addColorStop(1, "rgba(120, 160, 205, 0.09)");
      ctx.fillStyle = mistGrad;
      ctx.fillRect(0, vh * 0.65, vw, vh * 0.35);

      // B. Background Rain Layer (fine, softer, numerous translucent drops)
      ctx.strokeStyle = "rgba(185, 215, 245, 0.28)";
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      for (const p of this.rainStreaks) {
        if (p.layer === 0) {
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + slant * p.length, p.y + p.length);
        }
      }
      ctx.stroke();

      // C. Foreground Rain Layer (sharper, faster, silver-blue drops with depth)
      ctx.strokeStyle = "rgba(220, 240, 255, 0.48)";
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      for (const p of this.rainStreaks) {
        if (p.layer === 1) {
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + slant * p.length, p.y + p.length);
        }
      }
      ctx.stroke();

      // D. Ground Water Splashes / Concentric Ripples (rendered cleanly with individual beginPath)
      for (const s of this.rainSplashes) {
        const progress = Math.min(1, s.r / s.maxR);
        const alpha = (1 - progress) * s.alpha;
        ctx.strokeStyle = `rgba(205, 230, 255, ${alpha})`;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        // Isometric flat ellipse
        ctx.ellipse(s.x, s.y, s.r, s.r * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // E. Distant Ambient Lightning Flash (subtle, dramatic, cinematic illumination)
      if (this.lightningFlash > 0.01) {
        const flashAlpha = Math.sin((this.lightningFlash / 1.0) * Math.PI) * 0.14;
        ctx.fillStyle = `rgba(225, 240, 255, ${flashAlpha})`;
        ctx.fillRect(0, 0, vw, vh);
      }
    } else if (this.current === "snow") {
      // -------------------------------------------------------------
      // SUBZERO BLIZZARD WITH SOFT FROSTY VIGNETTE
      // -------------------------------------------------------------
      const frostGrad = ctx.createRadialGradient(
        vw / 2,
        vh / 2,
        Math.min(vw, vh) * 0.35,
        vw / 2,
        vh / 2,
        Math.max(vw, vh) * 0.75
      );
      frostGrad.addColorStop(0, "rgba(220, 240, 255, 0)");
      frostGrad.addColorStop(1, "rgba(195, 230, 255, 0.22)");
      ctx.fillStyle = frostGrad;
      ctx.fillRect(0, 0, vw, vh);

      // Background snowflakes (softer, smaller)
      ctx.fillStyle = "rgba(240, 248, 255, 0.55)";
      ctx.beginPath();
      for (const p of this.snowFlakes) {
        if (p.layer === 0) {
          ctx.moveTo(p.x + p.radius, p.y);
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        }
      }
      ctx.fill();

      // Foreground snowflakes (larger, bright crystalline white)
      for (const p of this.snowFlakes) {
        if (p.layer === 1) {
          ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (this.current === "ash_storm") {
      // -------------------------------------------------------------
      // VOLCANIC ASH TEMPEST & GLOWING EMBERS
      // -------------------------------------------------------------
      const ashGrad = ctx.createRadialGradient(
        vw / 2,
        vh / 2,
        Math.min(vw, vh) * 0.28,
        vw / 2,
        vh / 2,
        Math.max(vw, vh) * 0.72
      );
      ashGrad.addColorStop(0, "rgba(25, 10, 5, 0)");
      ashGrad.addColorStop(1, "rgba(55, 18, 6, 0.36)");
      ctx.fillStyle = ashGrad;
      ctx.fillRect(0, 0, vw, vh);

      // Soot flakes
      ctx.fillStyle = "rgba(55, 50, 48, 0.65)";
      ctx.beginPath();
      for (const p of this.ashParticles) {
        if (!p.isEmber) {
          ctx.moveTo(p.x + p.size, p.y);
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        }
      }
      ctx.fill();

      // Glowing volcanic embers with burning cores
      for (const p of this.ashParticles) {
        if (p.isEmber) {
          const glow = 0.7 + 0.3 * Math.sin(p.pulsePhase);
          ctx.fillStyle = `rgba(255, 130, 25, ${p.alpha * glow})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 1.3, 0, Math.PI * 2);
          ctx.fill();

          // Hot incandescent core
          ctx.fillStyle = `rgba(255, 240, 160, ${p.alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  // --- Gameplay Modifiers ---

  /** Yield multiplier when workers deposit harvested resources */
  getYieldMultiplier(produce?: ResKey, buildingType?: string): number {
    if (!produce) return 1;

    if (this.current === "rain") {
      if (produce === "food") return buildingType === "fishery" ? 1.25 : 1.15;
      if (produce === "clay") return 1.3;
      if (produce === "stone") return 0.85;
      return 1;
    }

    if (this.current === "snow") {
      if (produce === "food") return buildingType === "fishery" ? 0.6 : 0.65;
      if (produce === "meat") return 1.4;
      if (produce === "wood") return 0.85;
      return 1;
    }

    if (this.current === "ash_storm") {
      if (produce === "bricks") return 1.35;
      if (produce === "tools") return 1.3;
      if (produce === "gold") return 1.15;
      if (produce === "food") return 0.65;
      if (produce === "wood") return 0.75;
      if (produce === "meat") return 0.6;
      return 1;
    }

    return 1;
  }

  /** Work cycle time multiplier (lower is faster) */
  getCycleTimeMultiplier(buildingType: string, produce?: ResKey): number {
    if (this.current === "rain") {
      if (buildingType === "farm") return 0.7; // 30% faster harvest!
      if (buildingType === "quarry" || buildingType === "mine") return 1.2;
      return 1;
    }

    if (this.current === "snow") {
      if (buildingType === "farm") return 1.7; // crops freeze
      if (buildingType === "lumber") return 1.2;
      return 1;
    }

    if (this.current === "ash_storm") {
      if (buildingType === "farm") return 1.6;
      if (buildingType === "kiln" || buildingType === "forge" || buildingType === "armory") return 0.75; // supercharged heat!
      return 1;
    }

    return 1;
  }

  /** Movement speed penalty on open terrain (paved roads bypass this!) */
  getOpenGroundSpeedMultiplier(): number {
    if (this.current === "snow") return 0.85; // deep snow
    if (this.current === "rain") return 0.9; // mud
    return 1;
  }

  /**
   * Environmental wear applied to building durability per second.
   * Stone Wells, Shaman Groves, and advanced stone/brick buildings have natural immunity or strong resistance.
   */
  getDurabilityWear(b: Building, isGuarded: boolean): number {
    if (this.current === "clear") return 0;
    if (b.progress < 1) return 0; // Don't wear unfinished scaffoldings
    if (b.type === "townCenter") return 0; // TC is the core capital

    // Guarded by Shaman or Stone Well completely mitigates rain & cuts snow/ash wear by 80%
    const guardFactor = isGuarded ? 0.2 : 1.0;

    // Upgraded stone/brick buildings (level >= 2 or stone nature) resist environmental damage
    const isStone =
      b.type === "quarry" ||
      b.type === "tower" ||
      b.type === "temple" ||
      b.type === "well" ||
      b.level >= 2;

    if (this.current === "rain") {
      if (isGuarded || isStone) return 0;
      // Thatched huts, farms, and clay pits suffer water erosion
      if (b.type === "house" || b.type === "farm" || b.type === "clayPit" || b.type === "fishery") {
        return 0.35;
      }
      return 0;
    }

    if (this.current === "snow") {
      if (isStone && isGuarded) return 0;
      // Roof load on huts, farms, lumber camps
      if (b.type === "house" || b.type === "farm" || b.type === "lumber") {
        return (isStone ? 0.25 : 0.65) * guardFactor;
      }
      return 0;
    }

    if (this.current === "ash_storm") {
      if (isStone) return 0.1 * guardFactor; // stone stands strong
      // Acidic soot attacks all exposed wooden structures & palisades
      return (b.type === "wall" ? 0.5 : 0.85) * guardFactor;
    }

    return 0;
  }
}
