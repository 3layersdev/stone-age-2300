import type { CSSProperties } from "react";
import uiAtlasUrl from "@/assets/ui-atlas.webp";
import uiFrames from "./ui.json";

type Frame = [number, number, number, number];
const F = uiFrames as unknown as Record<string, Frame>;
export const UI_ATLAS_URL = uiAtlasUrl;

/** Render a named frame from the painted UI atlas at a given CSS width. */
export function uiSpriteStyle(name: string, width: number): CSSProperties | null {
  const fr = F[name];
  if (!fr) return null;
  const [sx, sy, sw, sh] = fr;
  const height = (sh / sw) * width;
  return {
    width,
    height,
    backgroundImage: `url(${uiAtlasUrl})`,
    backgroundSize: `${(2000 / sw) * width}px auto`,
    backgroundPosition: `-${(sx / sw) * width}px -${(sy / sw) * width}px`,
    imageRendering: "auto",
  };
}

export const PAINTED_RES: Partial<Record<string, string>> = {
  food: "res_food",
  wood: "res_wood",
  stone: "res_stone",
  gold: "res_gold",
  tools: "res_tools",
  clay: "res_clay",
  bricks: "res_bricks",
  meat: "res_meat",
  herbs: "res_herbs",
  fruits: "res_fruits",
  vegetables: "res_veg",
  wool: "res_hide",
};

export const AGE_BADGE = ["age_stone", "age_bronze", "age_iron"];
