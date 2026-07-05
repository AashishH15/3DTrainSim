# 3DTrainSim: A Low-Poly 3D Train Network Builder

A browser-based train tycoon game built with Three.js. Design, build, and operate
a passenger rail network across two scales:

- **USA National Map** - connect the 50 most-populated U.S. metro areas.
- **NYC City Map** - build a commuter network through low-poly NYC landmarks
  (Statue of Liberty, Empire State Building, Times Square, Central Park...).

## Play

**Play in your browser: https://aashishh15.github.io/3DTrainSim/**

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
   train tier. Track maintenance and train operating costs drain cash - stay
   above -$250k or you go bankrupt.
5. **Milestones** track your progress (medal button in the HUD). Expand your
   network, grow revenue, and hit win conditions — all **50 US metros** or
   **$5M cash**. You can keep playing after a win.
6. Track can be **upgraded** in place (click it in Select mode) and demolished
   for a 25% refund. Trains can be sold for 50%.

### Controls

| Input | Action |
|---|---|
| Drag / scroll | Orbit / zoom the camera |
| `0` | Move / pan map |
| `1`-`6` | Select tools (select, station, tracks, bulldoze) |
| `B` | Train shop |
| `M` | Switch between USA and NYC maps |
| `Space` | Pause |
| Right-click / `Esc` | Cancel current action |

Progress autosaves to localStorage; "New Game" resets.

## Deployment

**Live site:** https://aashishh15.github.io/3DTrainSim/

Pushes to `main` build and deploy via `.github/workflows/deploy.yml` (Vite `base`
is `/3DTrainSim/` in CI).

### One-time GitHub setup (required for green deploys)

Use **one** deploy path only — do not mix branch deploy with Actions deploy.

1. **Settings → Pages → Build and deployment**
   - **Source:** **GitHub Actions** (not “Deploy from a branch”)
2. **Settings → Environments → github-pages**
   - **Deployment branches:** **No restriction** (or add **`main`**)
   - Remove any required reviewers if present
3. Push to `main` or re-run the latest **Deploy to GitHub Pages** workflow

You should see a single workflow with **build** + **deploy** jobs both green. The
old **`pages build and deployment`** bot runs stop mattering once Pages source is
**GitHub Actions** and you are no longer publishing to the `gh-pages` branch.

## Tech

- Three.js (vanilla), Vite
- d3-geo Albers-USA projection + us-atlas TopoJSON for the national map
- Graph-based track network (Dijkstra pathfinding for trains and fares)
- Tick-based passenger/economy simulation decoupled from the render loop
- UI icons: [Phosphor Icons](https://phosphoricons.com) (MIT license)
- Font: [Outfit](https://fonts.google.com/specimen/Outfit) (OFL) via Fontsource
