import type { Res } from "./data";

export interface TechItem {
  id: string;
  name: string;
  age: number; // 0: Stone, 1: Bronze, 2: Iron
  category: "industry" | "military" | "civic" | "agriculture";
  cost: Partial<Res>;
  desc: string;
  effectLabel: string;
  iconName: string;
}

export const TECHNOLOGIES: TechItem[] = [
  // --- STONE AGE ---
  {
    id: "flint_knapping",
    name: "Flint Knapping",
    age: 0,
    category: "industry",
    cost: { stone: 35, wood: 20 },
    desc: "Sharpened flint edges for axes and picks.",
    effectLabel: "+25% Woodcutting & Stone Mining efficiency",
    iconName: "Pickaxe",
  },
  {
    id: "woven_baskets",
    name: "Woven Baskets",
    age: 0,
    category: "agriculture",
    cost: { wood: 30, herbs: 10 },
    desc: "Sturdy woven wicker vessels for haulers.",
    effectLabel: "+4 Resource carry capacity for all villagers",
    iconName: "Layers",
  },
  {
    id: "war_horns",
    name: "Tribal War Horns",
    age: 0,
    category: "military",
    cost: { wood: 40, meat: 15 },
    desc: "Hollowed ram horns that coordinate battle formations.",
    effectLabel: "+20% Movement speed and morale for warriors",
    iconName: "Shield",
  },
  {
    id: "fire_mastery",
    name: "Sacred Embers",
    age: 0,
    category: "civic",
    cost: { wood: 50, stone: 20 },
    desc: "Techniques to preserve embers during harsh winters and rainstorms.",
    effectLabel: "Fire braziers warm 35% larger area; cold storms dealt with easily",
    iconName: "Flame",
  },

  // --- BRONZE AGE ---
  {
    id: "bronze_plow",
    name: "Bronze Plowshare",
    age: 1,
    category: "agriculture",
    cost: { wood: 70, stone: 40, gold: 30, tools: 6 },
    desc: "Heavy bronze plows turning deep fertile soil.",
    effectLabel: "+35% Crop, vegetable, and fruit harvest speed",
    iconName: "Wheat",
  },
  {
    id: "wheel_sledge",
    name: "The Wheel & Ox Sledge",
    age: 1,
    category: "civic",
    cost: { wood: 80, stone: 30, tools: 8 },
    desc: "Spoked wooden wheels and draught yokes.",
    effectLabel: "+50% Movement speed on paved roads; spawns road hauling carts",
    iconName: "Route",
  },
  {
    id: "bronze_shields",
    name: "Bronze Round Shields",
    age: 1,
    category: "military",
    cost: { stone: 60, gold: 40, tools: 10 },
    desc: "Hammered bronze sheets riveted over oak frames.",
    effectLabel: "+40 Max HP and 25% damage resistance for soldiers",
    iconName: "ShieldCheck",
  },
  {
    id: "composite_bow",
    name: "Composite Horn Bows",
    age: 1,
    category: "military",
    cost: { wood: 80, meat: 25, tools: 8 },
    desc: "Horn and sinew recurve bows engineered for lethal range.",
    effectLabel: "+30% Archer attack range and +6 projectile damage",
    iconName: "Crosshair",
  },

  // --- IRON AGE ---
  {
    id: "iron_crucible",
    name: "Bellows & Blast Crucible",
    age: 2,
    category: "industry",
    cost: { stone: 120, bricks: 40, gold: 60, tools: 14 },
    desc: "Superheated draft ovens yielding tempered high-carbon steel.",
    effectLabel: "+100% Tool and weapon forging yield from armories",
    iconName: "Hammer",
  },
  {
    id: "war_chariots",
    name: "Iron Scythed Chariots",
    age: 2,
    category: "military",
    cost: { wood: 140, gold: 90, tools: 16 },
    desc: "Swift twin-horse bronze & iron war wagons.",
    effectLabel: "Spawns heavy combat chariots that sweep raiders aside",
    iconName: "Swords",
  },
  {
    id: "monumental_architecture",
    name: "Monumental Masonry",
    age: 2,
    category: "civic",
    cost: { stone: 150, bricks: 60, gold: 80 },
    desc: "Mortared ashlar blocks and aqueduct foundations.",
    effectLabel: "+50% Max HP to all structures; immune to rain erosion",
    iconName: "Landmark",
  },
];
