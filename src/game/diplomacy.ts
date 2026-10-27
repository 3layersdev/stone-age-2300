export type DiplomaticStance = "allied" | "neutral" | "unfriendly" | "war";

export interface RivalTribe {
  id: string;
  name: string;
  leader: string;
  title: string;
  ethos: string;
  bannerColor: string;
  relation: number; // -100 to +100
  tradePact: boolean;
  defenseAlliance: boolean;
  tributeGiven: number;
  tradeTimer: number;
  preferredGift: "food" | "gold" | "herbs" | "stone";
  desc: string;
}

export const INITIAL_TRIBES: RivalTribe[] = [
  {
    id: "sunwatchers",
    name: "The Sunwatchers",
    leader: "High Priestess Sola",
    title: "Keepers of the Dawn Terrace",
    ethos: "Peaceful Agricultural & Spiritual Clan",
    bannerColor: "text-amber-400 border-amber-500 bg-amber-950/40",
    relation: 15,
    tradePact: false,
    defenseAlliance: false,
    tributeGiven: 0,
    tradeTimer: 0,
    preferredGift: "herbs",
    desc: "A devout agrarian tribe cultivating hillside fruit terraces and medicinal groves. They eagerly exchange fresh provisions and blessings with peaceful neighbors.",
  },
  {
    id: "ironclads",
    name: "The Ironclad Dominion",
    leader: "Warlord Korath",
    title: "Ironforge High Chieftain",
    ethos: "Proud Martial & Metallurgy Syndicate",
    bannerColor: "text-red-400 border-red-500 bg-red-950/40",
    relation: -10,
    tradePact: false,
    defenseAlliance: false,
    tributeGiven: 0,
    tradeTimer: 0,
    preferredGift: "gold",
    desc: "Fierce highland warriors who control deep mineral veins. They respect strength, martial discipline, and heavy gold tributes.",
  },
  {
    id: "riverfolk",
    name: "The Riverfolk League",
    leader: "Master Helmsman Toren",
    title: "Grand Elder of the Estuary",
    ethos: "Mercantile Fishermen & River Traders",
    bannerColor: "text-cyan-400 border-cyan-500 bg-cyan-950/40",
    relation: 25,
    tradePact: false,
    defenseAlliance: false,
    tributeGiven: 0,
    tradeTimer: 0,
    preferredGift: "food",
    desc: "Clever canoe traders who navigate waterways and marshes. They supply abundant dried fish, pearls, and rare coastal clay in exchange for timber and grain.",
  },
];
