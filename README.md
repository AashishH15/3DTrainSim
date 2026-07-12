# Overland: A Low-Poly 3D Train Network Builder

> Cannot promise your scores to remain, this is very early in development still trying to figure out its quirks.

A browser-based train tycoon game built with Three.js. Design, build, and operate
a passenger rail network across two scales:

- **USA National Map** - connect the 50 most-populated U.S. metro areas.
- **NYC City Map** - build a commuter network through low-poly NYC landmarks
  (Statue of Liberty, Empire State Building, Times Square, Central Park...).

https://github.com/user-attachments/assets/be84b52b-aa4e-4836-82bd-314ef60c97c5

## Play

**Play in your browser: https://overlandgame.netlify.app/**

Or run locally:

```bash
npm install
npm run dev
```

Then open the printed local URL (default http://localhost:5173).

## How to play

1. **Build stations:** pick the Station tool and click a stop. On the USA map you
   start in 12 major metros — click gray stops to **expand your network** into
   new cities (cost scales with metro size). On the NYC map every landmark is
   available from the start.
2. **Lay track:** pick a track type and click station-to-station. Water
   crossings in NYC cost x2.6 (bridges are rendered automatically).
   - Standard Track: cheap, Tier I trains only
   - High-Speed Track: Tier I & II
   - Maglev Guideway: Tier III only
3. **Buy a train** and click stations in order to set its loop route, then
   press Done (or Enter).
4. Passengers spawn at stations based on demand and rush-hour cycles, board
   trains heading to their destination, and pay fares scaled by distance and
   train tier. Track maintenance and train operating costs drain cash.
5. **New Game** opens a mode picker — see [Game modes](#game-modes) below.
6. Track can be **upgraded** in place (click it in Select mode) and demolished
   for a 25% refund. Trains can be sold for 50%.

### Game modes

Choose **Tycoon** or **Survival** when starting a new run (or from the mode picker
on load). Both modes share the same maps, tools, and economy basics; they differ
in pressure, scoring, and what “winning” means.

| | **Tycoon** | **Survival** |
|---|---|---|
| Goal | Milestones + win conditions | Badges + personal best time |
| Fail state | Bankruptcy below **−$250k** | **Network collapse** (sustained high Lost/min) |
| Demand growth | Linear, modest cap | Compound, higher cap |
| Crowding | Lighter platform limits | Pop-scaled, tighter limits |
| HUD timer | **Time elapsed** | **Survived** (sim-time) |
| Lost/min stat | Hidden | Always visible |

**Shared:** The sim clock does not start until the first passengers spawn — you
can lay track, buy trains, and assign routes without maintenance, debt pressure,
or timer counting against you. Once riders appear at a connected station, the
clock starts and the run is scored from there.

#### Tycoon

Classic empire builder. Open the medal button for **Milestones** — expand your
network, grow revenue, and hit win conditions (**all 50 US metros** or
**$5M cash**). You can keep playing after a win. Stay above **−$250k** or you
go bankrupt after a grace period.

#### Survival

Endurance mode — no bankruptcy, no win screen. Demand escalates over sim-time;
overcrowded stations cause riders to leave. If **Lost/min** stays at or above
**15** for too long (~4 sim-minutes sustained), the network **collapses**. Your
**Survived** time is the run score; a **personal best** is saved locally.

Open the medal button for **Survival badges** — 16 lifetime achievements across
five categories (unlocked once per browser, not per save):

| Category | Examples |
|---|---|
| **Duration** | Rush Hour Veteran (10m), Peak Operator (30m), Iron Rail (1h) |
| **Skill** | Clean sheet (20m zero lost), Minimalist (30m with ≤2 trains), Smooth operator (4 trains, no overcrowding) |
| **Network** | National network (50 metros), Mass transit / Nation moved / Main line (10k–100k delivered), City network (15 NYC stations) |
| **Expert** | Empire Grade (5h), Empire Ascendant (10h), Mass Transit Titan (1M delivered), Maglev Nation (all 50 metros on Maglev Guideway only) |
| **Capstone** | **Jack of all trades** — unlock every other Survival badge |

Badge progress uses **sim-time** (not wall-clock), so playing at 4× speed does
not shorten duration badges — you still survive the same amount of in-game time,
just with less real time to react.

### Controls

| Input | Action |
|---|---|
| Drag / scroll | Orbit / zoom the camera |
| `0` | Move / pan map |
| `1`-`6` | Select tools (select, station, tracks, bulldoze) |
| `B` | Train shop |
| `O` | Network overview (all stations) |
| `Space` | Pause |
| Right-click / `Esc` | Cancel current action |

Progress autosaves to localStorage; **New Game** resets the current run (Survival
badges and personal best persist in localStorage).

## Known quirks / troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Scores or badges reset unexpectedly | Early dev — leaderboard + local saves still evolving | See disclaimer at top; report via in-game **Report bug** |
| Leaderboard empty locally | Netlify Blobs only work on deployed site | Test leaderboard at https://overlandgame.netlify.app/ |
| Trains stuck or paths fail | Graph disconnected or invalid route order | Re-assign route; ensure stations are connected by track |
| NYC water crossing too expensive | Bridge multiplier (x2.6) | Plan shorter water hops or upgrade track later |
| Survival collapse at ~15 Lost/min | Sustained overcrowding | Add capacity, reroute trains, or pause to replan |
| Red GitHub Pages badge | Environment protection on `github-pages` | See [Fix the bot deploy](#fix-the-bot-deploy-optional--clears-the-red--badge) below |

### Leaderboard (Netlify)

Survival high scores post to `netlify/functions/leaderboard.js` using Netlify Blobs.
Local `npm run dev` does not persist global leaderboard entries — use the live deploy.

## Deployment

**Live site:** https://overlandgame.netlify.app/

Pushes to `main` build and push `dist/` to **`gh-pages`** via `.github/workflows/deploy.yml`.

### Pages settings

**Settings → Pages → Source:** **Deploy from a branch** → **`gh-pages`** → **`/ (root)`**

When **Deploy to GitHub Pages** is green, your site is updated. You may also see a
red **pages build and deployment** run from GitHub’s bot — that is optional to fix.

### Fix the bot deploy (optional — clears the red ❌ badge)

**Settings → Environments → `github-pages`**

1. Open the **`github-pages`** environment (not Pages — **Environments** in the left sidebar under Settings)
2. **Deployment branches** → **No restriction**  
   (or **Selected branches** and add both **`main`** and **`gh-pages`**)
3. Turn off **Required reviewers** if it is enabled
4. Save, then re-run the failed **pages build and deployment** job

The error `Branch "main" is not allowed to deploy to github-pages due to environment
protection rules` means step 2 is still blocking deploys. Our workflow does not
use that environment; only GitHub’s publish step does.

## Tech

- Three.js (vanilla), Vite
- d3-geo Albers-USA projection + us-atlas TopoJSON for the national map
- Graph-based track network (Dijkstra pathfinding for trains and fares)
- Tick-based passenger/economy simulation decoupled from the render loop
- UI icons: [Phosphor Icons](https://phosphoricons.com) (MIT license)
- Font: [Outfit](https://fonts.google.com/specimen/Outfit) (OFL) via Fontsource

## License

MIT — see [LICENSE](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
