# Contributing to Overland

Thanks for playing and contributing to [Overland](https://overlandgame.netlify.app/).

## Run locally

```bash
git clone https://github.com/AashishH15/Overland-TrainSim.git
cd Overland-TrainSim
npm install
npm run dev
```

## Pull requests

1. Fork or branch from `main`
2. Keep changes focused (one bug fix or doc update per PR)
3. Test in browser (`npm run dev`) for UI/sim changes
4. Open a PR with a short description and screenshots for visual changes

## Reporting bugs

Use **Report bug** in the in-game shop or open a [bug report issue](https://github.com/AashishH15/Overland-TrainSim/issues/new?template=bug_report.md).

Include map (USA / NYC), game mode (Tycoon / Survival), and steps to reproduce.

## Scope notes

- Leaderboard requires the Netlify deploy (Blobs backend)
- Survival badges and personal best are stored in `localStorage`
