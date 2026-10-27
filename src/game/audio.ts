/**
 * @license
 * Stone Age 2300 - Procedural Audio & Music Engine
 * Fully synthesized Web Audio API soundscape:
 * - Dynamic tribal ambient music (peaceful exploration)
 * - Intense war drum battle music (during Rustfang raids)
 * - Complete suite of stone-age SFX (crafting, building, horn alerts, cataclysms, upgrades)
 */

type SoundType =
  | "click"
  | "place_wood"
  | "place_stone"
  | "place_road"
  | "demolish"
  | "upgrade"
  | "horn"
  | "earthquake"
  | "wildfire"
  | "skyfire"
  | "flood"
  | "victory"
  | "defeat"
  | "rankup"
  | "harvest";

interface AudioSettings {
  muted: boolean;
  masterVol: number;
  musicVol: number;
  sfxVol: number;
}

const STORAGE_KEY = "stone_age_audio_settings_v1";

class AudioController {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private isBattle = false;
  private musicInterval: number | null = null;
  private ambientDroneOsc1: OscillatorNode | null = null;
  private ambientDroneOsc2: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private step = 0;

  public settings: AudioSettings = {
    muted: false,
    masterVol: 0.8,
    musicVol: 0.6,
    sfxVol: 0.8,
  };

  private listeners: Array<() => void> = [];

  constructor() {
    this.loadSettings();
  }

  private loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
  }

  public saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      this.applyGains();
      this.notify();
    } catch {
      // ignore
    }
  }

  public subscribe(fn: () => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.applyGains();
      this.startMusic();
    } catch (e) {
      console.warn("Web Audio initialization skipped:", e);
    }
  }

  public setMuted(muted: boolean) {
    this.settings.muted = muted;
    this.saveSettings();
  }

  public toggleMute() {
    this.setMuted(!this.settings.muted);
  }

  public setMasterVol(vol: number) {
    this.settings.masterVol = Math.max(0, Math.min(1, vol));
    this.saveSettings();
  }

  public setMusicVol(vol: number) {
    this.settings.musicVol = Math.max(0, Math.min(1, vol));
    this.saveSettings();
  }

  public setSfxVol(vol: number) {
    this.settings.sfxVol = Math.max(0, Math.min(1, vol));
    this.saveSettings();
  }

  private applyGains() {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const targetMaster = this.settings.muted ? 0 : this.settings.masterVol;
    this.masterGain.gain.setTargetAtTime(targetMaster, now, 0.05);
    this.musicGain.gain.setTargetAtTime(this.settings.musicVol, now, 0.05);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfxVol, now, 0.05);
  }

  // ------------------ SFX SYNTHESIS ------------------

  public play(type: SoundType) {
    this.init();
    if (!this.ctx || !this.sfxGain || this.settings.muted || this.settings.sfxVol === 0) return;

    try {
      switch (type) {
        case "click":
          this.synthClick();
          break;
        case "place_wood":
          this.synthWoodPlace();
          break;
        case "place_stone":
          this.synthStonePlace();
          break;
        case "place_road":
          this.synthRoadPlace();
          break;
        case "demolish":
          this.synthDemolish();
          break;
        case "upgrade":
          this.synthUpgrade();
          break;
        case "horn":
          this.synthHorn();
          break;
        case "earthquake":
          this.synthRumble(1.8, 45);
          break;
        case "wildfire":
          this.synthFire();
          break;
        case "skyfire":
          this.synthSkyfire();
          break;
        case "flood":
          this.synthFlood();
          break;
        case "victory":
          this.synthVictory();
          break;
        case "defeat":
          this.synthDefeat();
          break;
        case "rankup":
          this.synthRankUp();
          break;
        case "harvest":
          this.synthHarvest();
          break;
      }
    } catch {
      // Audio node failure gracefully caught
    }
  }

  /** Subtle wooden clack for UI */
  private synthClick() {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.04);

    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(g);
    g.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  /** Heavy wood thud and hammer echo */
  private synthWoodPlace() {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Body thud
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.12);

    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.13);

    // Wood snap
    this.synthNoiseBurst(0.05, 1200, 0.2);
  }

  /** Deep stone thud */
  private synthStonePlace() {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.18);

    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.19);

    // Stone clack noise
    this.synthNoiseBurst(0.08, 600, 0.25);
  }

  /** Earthy dirt/gravel placement for roads */
  private synthRoadPlace() {
    this.synthNoiseBurst(0.09, 450, 0.2);
  }

  /** Crumbling rumble and stone debris */
  private synthDemolish() {
    this.synthRumble(0.4, 70);
    this.synthNoiseBurst(0.3, 350, 0.35);
  }

  /** Resonant bronze chimes for building upgrades */
  private synthUpgrade() {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const notes = [293.66, 369.99, 440.0, 587.33]; // D4, F#4, A4, D5

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const start = t + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      g.gain.setValueAtTime(0.2, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.45);

      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  }

  /** Ominous ancient war horn warning of incoming raiders */
  private synthHorn() {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    osc.type = "sawtooth";
    // Pitch swell into deep brass horn
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.linearRampToValueAtTime(110, t + 0.4);
    osc.frequency.linearRampToValueAtTime(105, t + 1.6);
    osc.frequency.exponentialRampToValueAtTime(65, t + 2.2);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(250, t);
    filter.frequency.linearRampToValueAtTime(650, t + 0.5);
    filter.frequency.exponentialRampToValueAtTime(180, t + 2.2);

    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.45, t + 0.3);
    g.gain.linearRampToValueAtTime(0.4, t + 1.5);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.2);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 2.25);

    // Accompanying war drum impact
    this.synthWarDrum(t + 0.2);
  }

  /** Heavy war drum / taiko strike */
  private synthWarDrum(startTime?: number) {
    if (!this.ctx || !this.sfxGain) return;
    const t = startTime ?? this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.35);

    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  /** Low rumbling earthquake / rockslide */
  private synthRumble(duration = 1.2, baseFreq = 50) {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.linearRampToValueAtTime(baseFreq * 0.7, t + duration);

    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + duration + 0.05);

    this.synthNoiseBurst(duration * 0.8, 180, 0.3);
  }

  /** Wildfire crackle & whoosh */
  private synthFire() {
    if (!this.ctx || !this.sfxGain) return;
    this.synthNoiseBurst(0.6, 900, 0.3);
  }

  /** Descending metallic skyfire impact */
  private synthSkyfire() {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Screaming descent
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.6);

    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.58);
    g.gain.linearRampToValueAtTime(0.6, t + 0.62);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);

    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 1.55);

    // Blast impact at t + 0.6
    setTimeout(() => {
      this.synthRumble(1.0, 40);
    }, 580);
  }

  /** Torrential flood surge */
  private synthFlood() {
    this.synthNoiseBurst(1.2, 300, 0.35);
  }

  /** Triumphant pentatonic tribal fanfare */
  private synthVictory() {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const melody = [220, 293.66, 329.63, 440, 587.33]; // A3, D4, E4, A4, D5

    melody.forEach((freq, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const st = t + i * 0.16;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, st);

      const dur = i === melody.length - 1 ? 0.9 : 0.35;
      g.gain.setValueAtTime(0.25, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + dur);

      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(st);
      osc.stop(st + dur + 0.05);
    });
  }

  /** Somber low defeat gong */
  private synthDefeat() {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(98, t); // G2
    osc.frequency.exponentialRampToValueAtTime(45, t + 1.8);

    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.9);

    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 2.0);
  }

  /** Settlement rank promotion flourish */
  private synthRankUp() {
    if (!this.ctx || !this.sfxGain) return;
    this.synthWarDrum();
    setTimeout(() => {
      this.synthUpgrade();
    }, 200);
  }

  /** Pleasant gathering/harvest chime */
  private synthHarvest() {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, t); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, t + 0.1); // E5

    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  /** Utility: filtered noise burst (debris, gravel, wind) */
  private synthNoiseBurst(duration: number, cutoff = 600, gainLevel = 0.2) {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, t);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainLevel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);

    noise.start(t);
    noise.stop(t + duration);
  }

  // ------------------ DYNAMIC BACKGROUND MUSIC ------------------

  public setBattleMode(active: boolean) {
    if (this.isBattle === active) return;
    this.isBattle = active;
  }

  private startMusic() {
    if (!this.ctx || !this.musicGain) return;

    this.startAmbientDrone();

    // Loop interval for procedural rhythm and pentatonic melody
    if (this.musicInterval !== null) {
      clearInterval(this.musicInterval);
    }

    // Step every 500ms (120 BPM 8th notes)
    this.musicInterval = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || this.settings.muted || this.settings.musicVol === 0) return;
      this.tickMusicStep();
    }, 500);
  }

  /** Continuous organic drone in D minor */
  private startAmbientDrone() {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(73.42, t); // D2

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(110.0, t); // A2 (Fifth)

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(200, t);

    g.gain.setValueAtTime(0.12, t);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(g);
    g.connect(this.musicGain);

    osc1.start(t);
    osc2.start(t);

    this.ambientDroneOsc1 = osc1;
    this.ambientDroneOsc2 = osc2;
    this.droneGain = g;
  }

  /** Step sequencer: ambient pentatonic melody vs intense battle percussion */
  private tickMusicStep() {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    this.step = (this.step + 1) % 32;

    if (this.isBattle) {
      // BATTLE MODE: driving tribal war drums and tense stabs
      // Heavy kick on beats 0, 4, 8, 12, 16, 20, 24, 28
      if (this.step % 4 === 0) {
        this.playMusicDrum(80, 0.35, 0.25);
      }
      // Offbeat syncopations
      if (this.step % 8 === 2 || this.step % 8 === 6 || this.step % 16 === 14) {
        this.playMusicDrum(120, 0.22, 0.15);
      }
      // Rattling shaker
      if (this.step % 2 === 1) {
        this.playMusicShaker(0.08);
      }
      // Low brass pulse every 16 steps
      if (this.step === 0 || this.step === 16) {
        this.playWarDrone();
      }
    } else {
      // PEACEFUL AMBIENT MODE: gentle tribal heartbeat + bone flute/marimba
      // Gentle heartbeat pulse on steps 0 and 16
      if (this.step === 0 || this.step === 16) {
        this.playMusicDrum(55, 0.18, 0.4);
        if (Math.random() > 0.4) {
          this.playBronzeBell(440, 0.08); // A4 temple bell chime
        }
      }
      // Soft wood shaker on step 8 and 24
      if (this.step === 8 || this.step === 24) {
        this.playMusicShaker(0.04);
        if (Math.random() > 0.5) {
          this.playLyreString(293.66, 0.07); // D4 lyre pluck
        }
      }

      // Pentatonic melody (D minor pentatonic: D, F, G, A, C)
      const melodySteps = [2, 6, 10, 14, 18, 22, 28];
      if (melodySteps.includes(this.step) && Math.random() > 0.25) {
        const scale = [
          146.83, // D3
          174.61, // F3
          196.0,  // G3
          220.0,  // A3
          261.63, // C4
          293.66, // D4
          349.23, // F4
          392.0,  // G4
          440.0,  // A4
        ];
        const freq = scale[Math.floor(Math.random() * scale.length)];
        if (Math.random() > 0.4) {
          this.playFluteNote(freq);
        } else {
          this.playLyreString(freq, 0.09);
        }
      }
    }
  }

  private playBronzeBell(freq: number, volume: number) {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(freq, t);

    // Inharmonic bell overtone (2.76x)
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(freq * 2.76, t);

    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 2.2);

    osc1.connect(g);
    osc2.connect(g);
    g.connect(this.musicGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 2.3);
    osc2.stop(t + 2.3);
  }

  private playLyreString(freq: number, volume: number) {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(freq * 3.5, t);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.2, t + 0.8);

    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.musicGain);

    osc.start(t);
    osc.stop(t + 0.95);
  }

  private playMusicDrum(freq: number, volume: number, decay: number) {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + decay);

    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);

    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  }

  private playMusicShaker(volume: number) {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.06);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(3200, t);
    filter.Q.setValueAtTime(2.5, t);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    noise.connect(filter);
    filter.connect(g);
    g.connect(this.musicGain);

    noise.start(t);
    noise.stop(t + 0.065);
  }

  private playFluteNote(freq: number) {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(freq * 2.5, t);

    // Warm breath envelope
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.musicGain);

    osc.start(t);
    osc.stop(t + 0.75);
  }

  private playWarDrone() {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(65.41, t); // C2

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(320, t);

    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.musicGain);

    osc.start(t);
    osc.stop(t + 1.85);
  }
}

export const audio = new AudioController();
