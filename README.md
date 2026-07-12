<div align="center">

# Overland

**A low-poly 3D train tycoon in your browser.**  
Design stations, lay track, run passenger service across the USA — then unlock a detailed NYC map.

[![Play](https://img.shields.io/badge/▶_Play-overlandgame.netlify.app-1d4ed8?style=for-the-badge)](https://overlandgame.netlify.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)

<br>

![Overland gameplay — build a rail network across the USA](docs/assets/demo.gif)

*Survival badges · Tycoon milestones · Global leaderboard · Autosave · Mobile-friendly*

<br>

[**Play now →**](https://overlandgame.netlify.app/) &nbsp;·&nbsp; [**Run locally**](#run-locally) &nbsp;·&nbsp; [**Report a bug**](https://github.com/AashishH15/3DTrainSim/issues/new)

</div>

---

> **Early development** — cannot promise scores will remain; balance and features are still evolving. Saves, badges, and leaderboard entries are stored locally in your browser.

## Features

| | |
|---|---|
| **Two maps** | **USA** — 50 major metros. **NYC** — landmark stops with water crossings and bridges. |
| **Two modes** | **Tycoon** — milestones and win conditions. **Survival** — endure escalating demand and climb the leaderboard. |
| **Deep building** | Standard, high-speed, and maglev track · mid-line junctions · station capacity upgrades · train tiers. |
| **Living network** | Rush-hour demand, transfers, overcrowding pressure, demand surges, share cards, and run history. |

## Run locally

```bash
npm install
npm run dev
```

Open the printed URL (default `http://localhost:5173`).

## How to play

1. **Build stations** — Station tool → click a stop. On the USA map, expand into gray metros (cost scales with city size).
2. **Lay track** — Pick a track type, click station to station. Tracks auto-connect through stationed cities on the line. Click an existing segment to branch via a junction.
3. **Buy a train** (`B`) — Click stops in order to set a loop route, then **Done**.
4. **Earn & reinvest** — Passengers pay fares; maintenance and ops drain cash. Upgrade track and trains in **Select** mode.

**Track types:** Standard (Tier I) · High-Speed (Tier I–II) · Maglev (Tier III only)  
**Tips:** Network overview (`O`) · Past runs (clock icon) · Share your network from the HUD

## Game modes

| | **Tycoon** | **Survival** |
|---|---|---|
| **Goal** | Milestones + win conditions | Badges + personal best time |
| **Fail state** | Bankruptcy below **−$250k** | **Network collapse** (sustained high Lost/min) |
| **Pressure** | Linear demand growth | Compound growth, tighter crowding |
| **HUD** | Time elapsed | Survived + Lost/min + strikes |

The sim clock starts when the **first passengers spawn** — build freely until riders appear.

### Tycoon

Open **Milestones** (medal icon). Expand to all **50 US metros** or reach **$5M cash** to win. Stay above **−$250k** or face bankruptcy after a grace period.

### Survival

No bankruptcy — survive as long as you can. **Lost/min** above **15** for too long triggers **network collapse**. **16 badges** across duration, skill, network, expert, and a **Jack of all trades** capstone. Sim-time counts (4× speed does not shorten duration badges).

## Controls

| Input | Action |
|---|---|
| Drag / scroll | Orbit / zoom |
| `0` | Pan map |
| `1`–`6` | Tools (select, station, tracks, bulldoze) |
| `B` | Train shop |
| `O` | Network overview |
| `Space` | Pause |
| `Esc` / right-click | Cancel |

Progress autosaves to `localStorage`. **New Game** resets the current run; Survival badges and personal best persist.

## Known quirks / troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Scores or badges reset unexpectedly | Early dev — leaderboard + local saves still evolving | See disclaimer at top; report via in-game **Report bug** |
| Leaderboard empty locally | Netlify Blobs only work on deployed site | Test leaderboard at https://overlandgame.netlify.app/ |
| Trains stuck or paths fail | Graph disconnected or invalid route order | Re-assign route; ensure stations are connected by track |
| NYC water crossing too expensive | Bridge multiplier (x2.6) | Plan shorter water hops or upgrade track later |
| Survival collapse at ~15 Lost/min | Sustained overcrowding | Add capacity, reroute trains, or pause to replan |
| Red GitHub Pages badge | Environment protection on `github-pages` | See deployment troubleshooting below |

### Leaderboard (Netlify)

Survival high scores post to `netlify/functions/leaderboard.js` using Netlify Blobs.
Local `npm run dev` does not persist global leaderboard entries — use the live deploy.

## Deployment

**Live:** [overlandgame.netlify.app](https://overlandgame.netlify.app/)

Pushes to `main` also build `dist/` and deploy to **`gh-pages`** via `.github/workflows/deploy.yml`.

<details>
<summary>GitHub Pages setup & troubleshooting</summary>

**Settings → Pages → Source:** Deploy from branch **`gh-pages`** / **`/ (root)`**

If you see `Branch "main" is not allowed to deploy to github-pages`:

1. **Settings → Environments → `github-pages`**
2. **Deployment branches** → **No restriction** (or add `main` and `gh-pages`)
3. Disable **Required reviewers** if enabled
4. Re-run the failed deploy

The red **pages build and deployment** bot job is optional; the workflow deploy is what updates the site.

</details>

## Tech

- **Three.js** + Vite — low-poly 3D maps
- **d3-geo** Albers-USA + us-atlas TopoJSON
- Graph network with Dijkstra pathfinding
- Tick-based passenger simulation (decoupled from render loop)
- Icons: [Phosphor](https://phosphoricons.com) (MIT) · Font: [Outfit](https://fonts.google.com/specimen/Outfit) (OFL)

## License

MIT — see [LICENSE](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
