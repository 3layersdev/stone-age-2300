import type { Game } from "./engine";
import type { Res } from "./data";

export interface Mission {
  chapter: string;
  title: string;
  story: string;
  goal: string;
  progress: (g: Game) => [number, number];
  reward: Partial<Res>;
}

const count = (g: Game, t: string) => g.buildings.filter((b) => b.type === t && b.progress >= 1).length;

export const MISSIONS: Mission[] = [
  {
    chapter: "Chapter I — Ashes",
    title: "Shelter from the Storm",
    story:
      "Year 2300. Three centuries after the Great Collapse, the glass towers of the old world rot in the jungle. Your tribe, the Emberkin, has found a fertile valley. Elder Ura raises her staff: \"Here we rebuild. Here the fire never dies.\"",
    goal: "Build 2 Huts",
    progress: (g) => [count(g, "house"), 2],
    reward: { wood: 60 },
  },
  {
    chapter: "Chapter I — Ashes",
    title: "Bread and Timber",
    story: "Hungry mouths and cold nights. The tribe needs grain fields and timber before the rains.",
    goal: "Build a Farm and a Lumber Camp",
    progress: (g) => [Math.min(1, count(g, "farm")) + Math.min(1, count(g, "lumber")), 2],
    reward: { food: 100 },
  },
  {
    chapter: "Chapter I — Ashes",
    title: "Waters of Life",
    story: "Grain alone is not enough when summer heat scorches the valley. Build a Fisherman's Wharf by the river to haul fresh catch.",
    goal: "Build a Fisherman's Wharf by the water",
    progress: (g) => [Math.min(1, count(g, "fishery")), 1],
    reward: { wood: 75, food: 80 },
  },
  {
    chapter: "Chapter I — Ashes",
    title: "A Growing Fire",
    story: "Word spreads of the Emberkin valley. Families arrive from the ruins. Train villagers at the Town Center.",
    goal: "Reach 12 population",
    progress: (g) => [g.villagers().length + g.soldiers().length, 12],
    reward: { food: 120, wood: 80 },
  },
  {
    chapter: "Chapter II — Roads of Stone",
    title: "Paths of the Ancestors",
    story: "The elders remember 'highways'. Pave paths between your fields and homes — your people will move like the wind.",
    goal: "Pave 20 road tiles",
    progress: (g) => [g.roadCount(), 20],
    reward: { stone: 80 },
  },
  {
    chapter: "Chapter II — Roads of Stone",
    title: "Riches of the Earth",
    story: "Scouts found grey rock and glittering ore in the hills. Stone for walls, gold for trade.",
    goal: "Build a Quarry and a Gold Mine",
    progress: (g) => [Math.min(1, count(g, "quarry")) + Math.min(1, count(g, "mine")), 2],
    reward: { gold: 60 },
  },
  {
    chapter: "Chapter II — Roads of Stone",
    title: "Hub of the Empire",
    story: "Villagers waste daylight carrying heavy stone across the map. Erect a Storehouse depot near your mines and camps.",
    goal: "Build a Storehouse depot",
    progress: (g) => [Math.min(1, count(g, "stockpile")), 1],
    reward: { wood: 100, stone: 60 },
  },
  {
    chapter: "Chapter II — Roads of Stone",
    title: "Tools of Progress",
    story: "Old Bek remembers how the ancestors shaped tools. A workshop will turn timber and stone into tools — the key to stronger buildings.",
    goal: "Build a Workshop and stock 20 tools",
    progress: (g) => [Math.min(1, count(g, "workshop")) + Math.min(20, g.res.tools) / 20, 2],
    reward: { stone: 60 },
  },
  {
    chapter: "Chapter II — Roads of Stone",
    title: "Homes of Stone",
    story: "Mud and thatch will not survive the storms. Upgrade a hut into a stone house.",
    goal: "Upgrade any building to tier 2",
    progress: (g) => [g.buildings.some((b) => b.level >= 2 && b.progress >= 1) ? 1 : 0, 1],
    reward: { tools: 10 },
  },
  {
    chapter: "Chapter III — The Rustfang",
    title: "Smoke on the Horizon",
    story: "Hunters return bloodied. The Rustfang raiders — scavengers wearing armor stripped from the old machines — are coming. Prepare warriors.",
    goal: "Build Barracks and train 3 warriors",
    progress: (g) => [Math.min(1, count(g, "barracks")) + Math.min(3, g.stats.soldiersTrained), 4],
    reward: { food: 150, gold: 40 },
  },
  {
    chapter: "Chapter III — The Rustfang",
    title: "Bow and Arrow",
    story: "Spears are fierce, but arrows strike before the enemy breaches the line. Construct an Archery Range.",
    goal: "Build an Archery Range and train 2 Tribal Archers",
    progress: (g) => [Math.min(1, count(g, "range")) + Math.min(2, g.archers().length), 3],
    reward: { wood: 120, meat: 30 },
  },
  {
    chapter: "Chapter III — The Rustfang",
    title: "Hold the Line",
    story: "Horns echo through the valley. Defend the fire!",
    goal: "Repel a Rustfang raid",
    progress: (g) => [Math.min(1, g.stats.raidsDefeated), 1],
    reward: { wood: 150, stone: 100 },
  },
  {
    chapter: "Chapter IV — Bronze Dawn",
    title: "Secrets of Bronze",
    story: "A wandering smith teaches the old craft of bronze. Gather offerings and advance your civilization.",
    goal: "Advance to the Bronze Age",
    progress: (g) => [Math.min(1, g.age), 1],
    reward: { gold: 100 },
  },
  {
    chapter: "Chapter IV — Bronze Dawn",
    title: "Wards of the Spirits",
    story: "Earthquakes and skyfire plague the valley. The Shamans chant around ceremonial fires, healing wounded defenders and blessing the settlement.",
    goal: "Build a Shaman Hut sanctuary",
    progress: (g) => [Math.min(1, count(g, "shaman")), 1],
    reward: { gold: 80, tools: 10 },
  },
  {
    chapter: "Chapter IV — Bronze Dawn",
    title: "Eyes on the Walls",
    story: "The Rustfang will return in greater numbers. Raise watchtowers to guard the valley.",
    goal: "Build 2 Watchtowers",
    progress: (g) => [count(g, "tower"), 2],
    reward: { stone: 150 },
  },
  {
    chapter: "Chapter IV — Bronze Dawn",
    title: "Arsenal of the Legion",
    story: "Bronze equipment turns militia into an organized military force. Build an Armory to manufacture advanced arms.",
    goal: "Build an Armory and train a War Chieftain",
    progress: (g) => [Math.min(1, count(g, "armory")) + Math.min(1, g.chieftains().length), 2],
    reward: { gold: 150, tools: 20 },
  },
  {
    chapter: "Chapter IV — Bronze Dawn",
    title: "From Village to Town",
    story: "Traders speak your valley's name with respect. Grow until the Emberkin are a true town.",
    goal: "Grow into a Town (35 people)",
    progress: (g) => [Math.min(2, g.rank), 2],
    reward: { gold: 120, tools: 15 },
  },
  {
    chapter: "Chapter V — Fired Earth",
    title: "Clay and Flame",
    story: "Mira found red clay along the shore. Baked in fire it becomes brick — stronger than timber, and the stuff of temples. Dig clay and build a kiln.",
    goal: "Build a Clay Pit and Brick Kiln, stock 30 bricks",
    progress: (g) => [Math.min(1, count(g, "clayPit")) + Math.min(1, count(g, "kiln")) + Math.min(30, g.res.bricks) / 30, 3],
    reward: { stone: 100, tools: 8 },
  },
  {
    chapter: "Chapter V — Fired Earth",
    title: "Water Against Fire",
    story: "Last summer's wildfire took half the camp. Stone wells will keep the flames from leaping roof to roof.",
    goal: "Build 2 Stone Wells",
    progress: (g) => [Math.min(2, count(g, "well")), 2],
    reward: { food: 150, clay: 30 },
  },
  {
    chapter: "Chapter VI — The Sun Temple",
    title: "Faith of the Emberkin",
    story: "The earth trembles, the sky burns. The people need hope. Build a temple to the Sun that never fell.",
    goal: "Build the Sun Temple",
    progress: (g) => [count(g, "temple"), 1],
    reward: { food: 300, gold: 150 },
  },
  {
    chapter: "Chapter VII — Iron Will",
    title: "Forge the Future",
    story: "Elder Ura speaks her last words: \"Iron, not glass. Become what the old world could not.\" Reach the Iron Age with 40 souls.",
    goal: "Iron Age & 40 population",
    progress: (g) => [Math.min(1, g.age >= 2 ? 1 : 0) + Math.min(40, g.villagers().length + g.soldiers().length) / 40, 2],
    reward: { gold: 500 },
  },
];
