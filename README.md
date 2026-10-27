# Stone Age 2300

A professional-grade stone-age real-time strategy / city-builder. Grow a small
band of survivors into a thriving tribe: assign work, extract resources, build a
settlement, trade with (or raid) rival tribes, and survive escalating raid waves,
disasters, and changing weather.

**Tech stack:** React + TypeScript + Vite + Tailwind CSS. All art is custom
painted sprite atlases (units, animals, buildings, UI), rendered on canvas with
an isometric-ish tile world, procedural WebAudio SFX, and a hand-rolled engine
(simulation, pathing-lite, AI fauna, raids, diplomacy, weather, events).

## Play

- **Hosted (GitHub Pages):** https://3layersdev.github.io/stone-age-2300/
- Or run locally:

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build -> dist/
npm run lint       # type-check
```

A single-file, fully offline build is also available:
`npm run build && npx vite build --config vite.singlefile.config.ts`

## Gameplay

- **Citizens** automatically seek work and haul goods; you zone production
  (farms, livestock, lumber, quarry, gold, fishery, herbalist...) via the
  build deck.
- **Resources deplete** when over-harvested and regenerate slowly — don't
  strip-mine your valley.
- **Rival tribes** (Sunwatchers, Ironclads, Riverfolk) hold camps on the map.
  Send gifts to form trade pacts, or raze their camps. Raids escalate in waves.
- **Wildlife** (deer, boar, wolves, bears, rabbits, eagles, ravens) roams,
  flees, and can be hunted.
- **Weather and events**: blizzards, storms, earthquakes, skyfire.
- **Campaign missions** with chapter progression, plus sandbox play.
- Multiplayer lobby via Firebase (optional; needs your own config).

## Project structure

```
src/
  game/           # engine: simulation, render, audio, data, missions, weather
  components/     # React UI shell (menus, HUD, modals)
  assets/         # sprite atlases + frame maps (webp) and painted art
  lib/            # firebase setup (multiplayer lobby)
```

## Deploy

Pushing to `main` triggers the GitHub Actions workflow that builds and publishes
the game to GitHub Pages (`gh-pages` branch).
