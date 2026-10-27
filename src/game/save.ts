export const SLOTS = [1, 2, 3] as const;
const key = (s: number) => `sa2300_save_${s}`;

export interface SaveMeta { slot: number; date: number; age: number; pop: number; mission: number; time: number; }

export function writeSave(slot: number, data: string, meta: Omit<SaveMeta, "slot" | "date">) {
  localStorage.setItem(key(slot), data);
  localStorage.setItem(key(slot) + "_meta", JSON.stringify({ ...meta, slot, date: Date.now() }));
  localStorage.setItem("sa2300_last", String(slot));
}
export function readSave(slot: number) { return localStorage.getItem(key(slot)); }
export function readMeta(slot: number): SaveMeta | null {
  const m = localStorage.getItem(key(slot) + "_meta");
  return m ? JSON.parse(m) : null;
}
export function lastSlot() { const v = localStorage.getItem("sa2300_last"); return v ? Number(v) : null; }
export function deleteSave(slot: number) { localStorage.removeItem(key(slot)); localStorage.removeItem(key(slot) + "_meta"); }

export function getChapters(): string[] { try { return JSON.parse(localStorage.getItem("sa2300_chapters") || "[]"); } catch { return []; } }
export function unlockChapter(c: string) { const cs = getChapters(); if (!cs.includes(c)) { cs.push(c); localStorage.setItem("sa2300_chapters", JSON.stringify(cs)); } }
