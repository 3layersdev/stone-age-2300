export const T = 32;
export let MW = 128;
export let MH = 128;
export function setMapSize(n: number) { MW = n; MH = n; }
export const MAP_SIZES = { small: 128, large: 192, huge: 256 } as const;
export type MapSize = keyof typeof MAP_SIZES;

export type ResKey = "food" | "wood" | "stone" | "gold" | "tools" | "clay" | "bricks" | "meat" | "herbs" | "fruits" | "vegetables" | "wool";
export const RES_COLOR: Record<ResKey, string> = {
  food: "#f0d36b",
  wood: "#c98c4b",
  stone: "#c8c8c8",
  gold: "#ffd34d",
  tools: "#8fd0ff",
  clay: "#d9925e",
  bricks: "#d0563c",
  meat: "#e07a6a",
  herbs: "#72d572",
  fruits: "#ff6363",
  vegetables: "#ff9f43",
  wool: "#e2e8f0",
};
export const RES_NAME: Record<ResKey, string> = {
  food: "Food",
  wood: "Wood",
  stone: "Stone",
  gold: "Gold",
  tools: "Tools",
  clay: "Clay",
  bricks: "Bricks",
  meat: "Meat",
  herbs: "Herbs",
  fruits: "Fruits",
  vegetables: "Vegetables",
  wool: "Wool",
};
export type Res = Record<ResKey, number>;

export const TER = {
  GRASS: 0,
  FOREST: 1,
  STONE: 2,
  GOLD: 3,
  WATER: 4,
  SAND: 5,
  BERRY: 6,
  MOUNTAIN: 7,
  MARSH: 8,
  FRUIT_TREE: 9,
  VEG_PATCH: 10,
  HERB_PATCH: 11,
} as const;

export interface BDef {
  name: string;
  w: number;
  h: number;
  cost: Partial<Res>;
  build: number;
  hp: number;
  pop?: number;
  slots?: number;
  produce?: ResKey;
  need?: number;
  drop?: boolean;
  /** resources consumed per work cycle (crafting buildings) */
  recipe?: Partial<Res>;
  /** amount produced per cycle at tier 1 */
  yield?: number;
  /** protective radius in tiles (wells stop fire spreading, shamans heal, braziers warm) */
  guard?: number;
  age: number;
  desc: string;
  cat: "eco" | "mil" | "civ";
  subcat?: string;
  key: string;
  drag?: boolean;
  tiers?: { name: string; cost: Partial<Res> }[];
}

export const BUILDINGS: Record<string, BDef> = {
  townCenter: { name: "Town Center", w: 4, h: 4, cost: {}, build: 60, hp: 2400, pop: 10, drop: true, age: 99, desc: "Heart of your tribe. Trains villagers and advances ages.", cat: "civ", subcat: "living", key: "" },
  house: { name: "Hut", w: 2, h: 2, cost: { wood: 30 }, build: 10, hp: 300, pop: 5, age: 0, desc: "Shelter for 5 people.", cat: "civ", subcat: "living", key: "H", tiers: [{ name: "Hut", cost: {} }, { name: "Stone House", cost: { stone: 40, tools: 5 } }, { name: "Manor", cost: { stone: 60, bricks: 25, gold: 30, tools: 12 } }] },
  farm: { name: "Farm", w: 3, h: 3, cost: { wood: 40 }, build: 8, hp: 200, slots: 2, produce: "food", age: 0, desc: "Grows grain. 2 farmers.", cat: "eco", subcat: "food", key: "F", tiers: [{ name: "Farm", cost: {} }, { name: "Irrigated Farm", cost: { wood: 60, tools: 6 } }, { name: "Plantation", cost: { wood: 100, gold: 40, tools: 14 } }] },
  pasture: { name: "Livestock Pasture", w: 3, h: 3, cost: { wood: 55, stone: 15 }, build: 14, hp: 450, slots: 2, produce: "wool", drop: true, yield: 5, age: 0, desc: "Corral for domestic sheep, cows, and pigs. Herders collect warm wool, milk, and meat.", cat: "eco", subcat: "food", key: "P", tiers: [{ name: "Livestock Pen", cost: {} }, { name: "Ranch Estate", cost: { wood: 75, stone: 35, tools: 6 } }] },
  orchard: { name: "Fruit Orchard", w: 2, h: 2, cost: { wood: 45 }, build: 10, hp: 300, slots: 2, produce: "fruits", need: TER.FRUIT_TREE, drop: true, yield: 6, age: 0, desc: "Tends apple and fruit groves. Harvesters bring sweet fruits.", cat: "eco", subcat: "food", key: "R", tiers: [{ name: "Fruit Orchard", cost: {} }, { name: "Royal Grove", cost: { wood: 60, tools: 6 } }] },
  vegGarden: { name: "Vegetable Garden", w: 2, h: 2, cost: { wood: 40 }, build: 8, hp: 250, slots: 2, produce: "vegetables", drop: true, yield: 7, age: 0, desc: "Grows carrots, cabbages, and plump pumpkins for wholesome food.", cat: "eco", subcat: "food", key: "V" },
  herbHut: { name: "Herbalist Hut", w: 2, h: 2, cost: { wood: 45, stone: 20 }, build: 11, hp: 320, slots: 2, produce: "herbs", drop: true, yield: 5, age: 0, desc: "Gathers wild lavender and curative roots for healing and shaman remedies.", cat: "eco", subcat: "extract", key: "H" },
  fishery: { name: "Fishing Wharf", w: 2, h: 2, cost: { wood: 45 }, build: 10, hp: 350, slots: 2, produce: "food", need: TER.WATER, drop: true, yield: 7, age: 0, desc: "Place along water shores. Fishers haul fresh fish for reliable food.", cat: "eco", subcat: "food", key: "I", tiers: [{ name: "Fishing Wharf", cost: {} }, { name: "Harbor Pier", cost: { wood: 65, tools: 6 } }] },
  lumber: { name: "Lumber Camp", w: 2, h: 2, cost: { wood: 50 }, build: 10, hp: 350, slots: 3, produce: "wood", need: TER.FOREST, drop: true, age: 0, desc: "Place near forest. 3 woodcutters.", cat: "eco", subcat: "extract", key: "L", tiers: [{ name: "Lumber Camp", cost: {} }, { name: "Sawmill", cost: { stone: 50, tools: 6 } }, { name: "Timber Works", cost: { stone: 90, gold: 30, tools: 14 } }] },
  quarry: { name: "Quarry", w: 2, h: 2, cost: { wood: 60 }, build: 12, hp: 400, slots: 3, produce: "stone", need: TER.STONE, drop: true, age: 0, desc: "Place near grey rocks. 3 masons.", cat: "eco", subcat: "extract", key: "Q", tiers: [{ name: "Quarry", cost: {} }, { name: "Stoneworks", cost: { wood: 60, tools: 6 } }, { name: "Deep Quarry", cost: { wood: 100, gold: 30, tools: 14 } }] },
  mine: { name: "Gold Mine", w: 2, h: 2, cost: { wood: 60, stone: 20 }, build: 14, hp: 400, slots: 3, produce: "gold", need: TER.GOLD, drop: true, age: 0, desc: "Place near gold ore. 3 miners.", cat: "eco", subcat: "extract", key: "M", tiers: [{ name: "Gold Mine", cost: {} }, { name: "Shaft Mine", cost: { wood: 80, tools: 8 } }, { name: "Royal Mine", cost: { stone: 120, tools: 16 } }] },
  granary: { name: "Granary", w: 2, h: 2, cost: { wood: 60 }, build: 12, hp: 400, drop: true, age: 0, desc: "Drop-off depot for food, meat, fruits, and vegetables.", cat: "eco", subcat: "industry", key: "G" },
  stockpile: { name: "Storehouse", w: 2, h: 2, cost: { wood: 70, stone: 30 }, build: 12, hp: 450, drop: true, age: 0, desc: "Central storehouse depot for wood, stone, gold, clay, bricks, tools, and wool.", cat: "eco", subcat: "industry", key: "S", tiers: [{ name: "Storehouse", cost: {} }, { name: "Vaulted Warehouse", cost: { stone: 70, bricks: 25, tools: 8 } }] },
  road: { name: "Road", w: 1, h: 1, cost: { stone: 1 }, build: 0, hp: 1, age: 0, desc: "Drag to pave. Villagers walk 70% faster.", cat: "civ", subcat: "decor", key: "D", drag: true },
  fence: { name: "Wattle Fence", w: 1, h: 1, cost: { wood: 2 }, build: 2, hp: 180, age: 0, desc: "Drag to place connected fences. Encloses animals and deters beasts. Upgradable!", cat: "civ", subcat: "decor", key: "G", drag: true, tiers: [{ name: "Wattle Fence", cost: {} }, { name: "Timber Palisade Fence", cost: { wood: 4, stone: 2 } }, { name: "Fortified Iron Fence", cost: { stone: 8, tools: 1 } }] },
  totem: { name: "Tribal Totem", w: 1, h: 1, cost: { wood: 25, stone: 10 }, build: 5, hp: 350, guard: 6, age: 0, desc: "Carved spirit totem. Inspires villagers with vigor (+15% speed in 6-tile radius).", cat: "civ", subcat: "culture", key: "T" },
  garden: { name: "Flower Garden", w: 1, h: 1, cost: { wood: 15, herbs: 5 }, build: 4, hp: 150, age: 0, desc: "Vibrant flowerbed with blooming red poppies, lavender, and fluttering butterflies.", cat: "civ", subcat: "decor", key: "F" },
  brazier: { name: "Fire Brazier", w: 1, h: 1, cost: { stone: 25, wood: 10 }, build: 5, hp: 350, guard: 5, age: 0, desc: "Ceremonial fire brazier. Illuminates the night and keeps villagers warm during harsh storms.", cat: "civ", subcat: "decor", key: "Z" },
  shrine_decor: { name: "Ancient Megalith", w: 1, h: 1, cost: { stone: 40, gold: 15 }, build: 7, hp: 600, age: 0, desc: "Standing rune stone monument of ancient power and tribal pride.", cat: "civ", subcat: "decor", key: "M" },
  workshop: { name: "Workshop", w: 2, h: 2, cost: { wood: 80, stone: 30 }, build: 14, hp: 450, slots: 2, produce: "tools", recipe: { wood: 4, stone: 2 }, yield: 2, drop: true, age: 0, desc: "Crafts tools from 4 wood + 2 stone. Tools unlock upgrades.", cat: "eco", subcat: "industry", key: "W", tiers: [{ name: "Workshop", cost: {} }, { name: "Guild Workshop", cost: { stone: 80, gold: 20 } }] },
  hunter: { name: "Hunter's Lodge", w: 2, h: 2, cost: { wood: 45 }, build: 9, hp: 300, slots: 2, produce: "meat", need: TER.FOREST, drop: true, yield: 6, age: 0, desc: "Hunters stalk deer and wild boars across forests and plains for meat.", cat: "eco", subcat: "food", key: "O", tiers: [{ name: "Hunter's Lodge", cost: {} }, { name: "Trapper's Hall", cost: { wood: 60, tools: 5 } }] },
  clayPit: { name: "Clay Pit", w: 2, h: 2, cost: { wood: 50 }, build: 10, hp: 300, slots: 3, produce: "clay", need: TER.SAND, drop: true, yield: 6, age: 0, desc: "Place on sandy shores. Diggers gather clay.", cat: "eco", subcat: "extract", key: "X", tiers: [{ name: "Clay Pit", cost: {} }, { name: "Clay Works", cost: { wood: 60, tools: 6 } }] },
  kiln: { name: "Brick Kiln", w: 2, h: 2, cost: { wood: 60, stone: 40 }, build: 14, hp: 500, slots: 2, produce: "bricks", recipe: { wood: 2, clay: 3 }, yield: 3, drop: true, age: 0, desc: "Fires 3 clay + 2 wood into bricks for grand buildings.", cat: "eco", subcat: "industry", key: "K", tiers: [{ name: "Brick Kiln", cost: {} }, { name: "Twin Kiln", cost: { bricks: 30, tools: 8 } }] },
  well: { name: "Stone Well", w: 1, h: 1, cost: { stone: 30 }, build: 6, hp: 250, pop: 2, guard: 5, age: 0, desc: "Fresh water: +2 housing. Fires can't spread within 5 tiles and burn out faster.", cat: "civ", subcat: "living", key: "E" },
  shaman: { name: "Shaman Hut", w: 2, h: 2, cost: { wood: 75, stone: 35, gold: 25 }, build: 16, hp: 550, slots: 1, pop: 3, guard: 7, age: 0, desc: "Spiritual sanctuary: heals nearby units and shields buildings against cataclysms.", cat: "civ", subcat: "culture", key: "Y", tiers: [{ name: "Shaman Hut", cost: {} }, { name: "Sacred Grove", cost: { stone: 90, gold: 50, tools: 10 } }] },
  barracks: { name: "Barracks", w: 3, h: 3, cost: { wood: 120, stone: 40 }, build: 20, hp: 900, age: 0, desc: "Trains spear warriors and heroic chieftains.", cat: "mil", subcat: "combat", key: "B", tiers: [{ name: "Barracks", cost: {} }, { name: "War Hall", cost: { stone: 100, tools: 10 } }] },
  range: { name: "Archery Range", w: 3, h: 3, cost: { wood: 100, stone: 35 }, build: 18, hp: 750, age: 0, desc: "Trains Tribal Archers who attack raiders with ranged bows.", cat: "mil", subcat: "combat", key: "A", tiers: [{ name: "Archery Range", cost: {} }, { name: "Marksman Yard", cost: { stone: 80, tools: 8 } }] },
  wall: { name: "Palisade", w: 1, h: 1, cost: { wood: 4 }, build: 3, hp: 450, age: 0, desc: "Drag to build defensive palisade walls.", cat: "mil", subcat: "defense", key: "L", drag: true },
  tower: { name: "Watchtower", w: 2, h: 2, cost: { wood: 40, stone: 80 }, build: 18, hp: 800, age: 1, desc: "Shoots arrows at raiders. Bronze Age.", cat: "mil", subcat: "defense", key: "T", tiers: [{ name: "Watchtower", cost: {} }, { name: "Stone Tower", cost: { stone: 100, tools: 8 } }, { name: "Bastion", cost: { stone: 140, bricks: 40, gold: 60, tools: 16 } }] },
  armory: { name: "Armory", w: 2, h: 2, cost: { wood: 110, stone: 70, gold: 40, tools: 8 }, build: 22, hp: 850, slots: 2, produce: "tools", recipe: { wood: 4, stone: 3, gold: 1 }, yield: 4, drop: true, age: 1, desc: "Produces advanced tools and unlocks weapons upgrades. Bronze Age.", cat: "mil", subcat: "defense", key: "U", tiers: [{ name: "Armory", cost: {} }, { name: "Master Arsenal", cost: { bricks: 45, gold: 80, tools: 14 } }] },
  market: { name: "Market", w: 3, h: 3, cost: { wood: 150, gold: 30 }, build: 22, hp: 700, slots: 2, produce: "gold", age: 1, desc: "Traders generate gold. Bronze Age.", cat: "eco", subcat: "industry", key: "N" },
  temple: { name: "Sun Temple", w: 3, h: 3, cost: { stone: 160, bricks: 40, gold: 100 }, build: 30, hp: 1200, pop: 10, age: 1, desc: "Sacred monument built of fired brick. +10 population.", cat: "civ", subcat: "culture", key: "J" },
  forge: { name: "Iron Forge", w: 3, h: 3, cost: { wood: 200, stone: 150, gold: 150 }, build: 28, hp: 1000, age: 2, desc: "Doubles warrior and archer combat power. Iron Age.", cat: "mil", subcat: "combat", key: "C" },
};

export const AGES = [
  { name: "Stone Age", cost: {} as Partial<Res> },
  { name: "Bronze Age", cost: { food: 300, wood: 200, stone: 100, gold: 50 } as Partial<Res> },
  { name: "Iron Age", cost: { food: 600, wood: 400, stone: 300, gold: 200 } as Partial<Res> },
];

export const UNITS = {
  villager: { name: "Villager", cost: { food: 50 } as Partial<Res>, time: 10, hp: 40, desc: "Worker, builder and gatherer" },
  soldier: { name: "Spear Warrior", cost: { food: 40, meat: 15, gold: 25 } as Partial<Res>, time: 14, hp: 110, desc: "Melee defender armed with spear" },
  archer: { name: "Tribal Archer", cost: { food: 45, wood: 25, meat: 15 } as Partial<Res>, time: 13, hp: 75, desc: "Ranged hunter armed with bow and flint arrows" },
  chieftain: { name: "War Chieftain", cost: { food: 90, meat: 35, gold: 60, tools: 5 } as Partial<Res>, time: 22, hp: 280, desc: "Heroic commander; war banner aura boosts nearby units" },
};

export const NAMES = ["Ura", "Tok", "Mira", "Bek", "Zola", "Kai", "Nema", "Oro", "Tavi", "Rhun", "Sela", "Garo", "Ilka", "Dov", "Yara", "Fen", "Lio", "Asha", "Brok", "Vena", "Kael", "Thorn", "Brin", "Kora", "Dakar", "Vael", "Sari", "Torin"];

export const RANKS = [
  { name: "Camp", pop: 0 },
  { name: "Village", pop: 15 },
  { name: "Town", pop: 35 },
  { name: "City", pop: 70 },
  { name: "Metropolis", pop: 120 },
];

export const SUBCATS: Record<"eco" | "mil" | "civ", { id: string; label: string }[]> = {
  eco: [
    { id: "all", label: "All Items" },
    { id: "food", label: "Food & Crops" },
    { id: "extract", label: "Raw Extraction" },
    { id: "industry", label: "Industry & Depots" },
  ],
  mil: [
    { id: "all", label: "All Items" },
    { id: "combat", label: "Barracks & Army" },
    { id: "defense", label: "Fortifications" },
  ],
  civ: [
    { id: "all", label: "All Items" },
    { id: "living", label: "Housing & Water" },
    { id: "culture", label: "Faith & Spirits" },
    { id: "decor", label: "Decor & Roads" },
  ],
};
