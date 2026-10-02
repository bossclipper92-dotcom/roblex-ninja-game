# KAGE RUSH : Ninja Survival

KAGE RUSH : Ninja Survival is a 3D ninja survival action game that runs in the browser. Fight endless waves of the Shadow Clan, dodge meteors and spike traps, escape the closing Oni Mist, and defeat the boss every 5th wave.

Built with **React 19**, **Three.js**, **Tailwind CSS 4** and **Vite**. It builds to a single HTML file, works offline, and installs as a PWA (so it can be packaged for the Google Play Store).

## Features

- 3D combat with a 3-hit combo, guard and parry, dodge dash and three special skills
- Endless waves with a boss every 5th wave
- Animated ninja intro cutscene (tap or press any key to skip, replay from the menu)
- Touch controls on phones and tablets
- Offline play through a service worker
- Best score saved in the browser

## Controls

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Move | W A S D | On-screen move pad |
| Jump | Space | JUMP |
| Attack (3-hit combo) | Left click or J | ATK |
| Guard / parry | Right click or K | GUARD |
| Dodge dash | Shift | DASH |
| Skills | Q, E, R | Q, E, R |
| Camera | Mouse (click to lock) or arrow keys | ↶ ↷ |
| Pause | P or Esc | II |

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the address shown in the terminal (usually http://localhost:5173).

## Build

```bash
npm run build      # outputs a single-file game in dist/
npm run preview    # test the production build locally
```

## Deploy to GitHub Pages

1. Push this repository to GitHub (branch `main`).
2. In the repository go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Every push to `main` builds and publishes the game automatically (see `.github/workflows/deploy.yml`).

Your game will be live at `https://<your-username>.github.io/<repo-name>/`.

## Publish on Google Play

1. Deploy the game to HTTPS hosting (GitHub Pages works).
2. Go to [pwabuilder.com](https://www.pwabuilder.com), enter your game's URL and choose **Package for Stores → Android**.
3. Upload the generated `.aab` file in Google Play Console. You will need a developer account, a privacy policy link, screenshots and a 1024×500 feature graphic.

Before publishing, make sure the game's name, characters and skill names do not use anyone else's trademarks. Stores reject apps that do.

## Project structure

```
├── index.html            # entry page
├── public/               # PWA files copied as-is into the build
│   ├── manifest.json     # app name, icons, fullscreen landscape
│   ├── sw.js             # offline service worker
│   └── icon-*.png        # app icons
├── src/
│   ├── main.tsx          # app entry, service worker registration
│   ├── App.tsx           # menu, HUD, pause and game-over screens
│   ├── Intro.tsx         # ninja intro cutscene
│   ├── Touch.tsx         # on-screen touch controls
│   └── game/
│       ├── engine.ts     # Three.js game engine
│       └── models.ts     # character and enemy models
├── vite.config.ts
└── .github/workflows/deploy.yml
```
