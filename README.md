# DECODE: SOURCE — Tech Word Guess

A semantic word-guessing game (in-app title: **FIND THE SOURCE**). Guess words related to technology, and each guess is ranked by how close it is to a hidden target word. Rank 1 is the answer.

The game itself is plain HTML/CSS/JavaScript, and it runs three ways:

- as a **desktop app** with Electron (recommended),
- in a **browser** through a local server,
- as a **packaged Windows app** (installer or single portable `.exe`).

The semantic rankings are precomputed with Python (Gensim) into JSON files in `data/`, so the game works offline. **You only need Python if you want to add or rebuild words.**

---

## 📋 Prerequisites

| Tool | Needed for | Notes |
| --- | --- | --- |
| **Node.js 18+** (includes `npm` and `npx`) | Running and packaging the app | https://nodejs.org |
| **Python 3.12** | Rebuilding word data only | Python 3.14 has no prebuilt `gensim` package yet, so pip tries to compile it and fails. Use 3.12. |

---

## 🚀 Quick Start (desktop app)

**1. Get the project**

```bash
git clone https://github.com/yourusername/SOURCE-word-guess-game.git
cd SOURCE-word-guess-game
```

**2. Install the npm packages** (Electron and the packaging tool)

```bash
npm install
```

**3. Run the game with Electron**

```bash
npm run electron
```

`npm run electron` is a shortcut for the `npx` command below. Both do exactly the same thing:

```bash
npx electron .
```

The game window opens. You'll see an "Electron Security Warning" in the terminal. It is harmless in development and disappears in the packaged app.

---

## 🌐 Run in a browser instead

```bash
npm start
```

Then open `http://localhost:8000`. This uses Python's built-in web server, so `python` must be on your PATH. (Opening `index.html` directly by double-clicking will not work, because browsers block loading the JSON files from `file://`.)

---

## 📦 Create the Electron package (Windows)

```bash
npm run dist
```

This runs `electron-builder --win` and writes the results to the `dist/` folder:

| File | What it is |
| --- | --- |
| `Find The Source Setup 1.0.0.exe` | Installer. Lets the player choose an install folder and adds a shortcut. |
| `Find The Source 1.0.0.exe` | Portable version. One file, no install. Easiest to share. |

Everything else in `dist/` (`win-unpacked/`, `.blockmap`, `.yaml`, `.yml`) is build leftovers and does not need to be shared.

Good to know:

- **First build is slow.** It downloads Electron and the installer tools once, then reuses them.
- **Developer Mode.** If the build fails with `Cannot create symbolic link : A required privilege is not held`, turn on Windows Developer Mode (Settings → System → For developers) or run the terminal as administrator, then run `npm run dist` again.
- **Only game files are packaged.** The `"files"` list in `package.json` includes just `main.js`, `index.html`, `style.css`, `src/` and `data/*.json`. Python tools, `venv/` and `node_modules/` are left out.
- **App icon.** It comes from `build/icon.png` (square, 512×512). Replace that file to change it.
- **Version number.** Change `"version"` in `package.json` before building a new release.
- **Unsigned app warning.** Windows may show "Windows protected your PC" the first time. Click **More info → Run anyway**.
- **macOS / Linux.** Packaging must be done on that operating system, with `npx electron-builder --mac` or `npx electron-builder --linux`. This has not been tested for this project.

---

## 🐍 Python environment (only for rebuilding word data)

Create a virtual environment so the language libraries stay inside this project.

**Windows (PowerShell):**

```powershell
py -3.12 -m venv venv
venv\Scripts\python.exe -m pip install -r tools/requirements.txt
```

Calling `venv\Scripts\python.exe` directly avoids PowerShell's script-execution restrictions, so you don't need to "activate" the environment.

**macOS / Linux:**

```bash
python3.12 -m venv venv
source venv/bin/activate
pip install -r tools/requirements.txt
```

`tools/requirements.txt` just contains `gensim`. Pip pulls in `numpy` and `scipy` on its own.

---

## ➕ Adding or changing words

**1. Add the word and its hints** to `data/wordbank.json`. Use a lowercase word as the key and a list of hint strings, ordered from vague to obvious:

```json
"router": [
  "This word comes from a verb meaning to send along a path.",
  "It sits between your devices and the internet.",
  "It usually has small antennas and blinking lights.",
  "It shares one internet connection across a home network."
]
```

A hint is revealed every 8 guesses. Four hints per word is the convention.

**2. Build the ranking data.** Run this from the **project root**, because the script reads `data/` relative to where you run it:

```powershell
venv\Scripts\python.exe tools\build_wordbank.py
```

(macOS/Linux with the venv active: `python tools/build_wordbank.py`.)

The first run downloads a ~128 MB language model, which is cached afterwards. It regenerates `data/<word>.json` for every word in the bank and takes a few minutes.

**Words the model doesn't know.** If the script prints `Skipping 'word', not in the model's vocabulary`, no data file is created for it. The game skips any word without a data file, so it simply never appears. To include such a word (for example `selfie`), copy `tools/make_selfie.py`, change `TARGET` and `FALLBACK_WORDS` at the top to related words the model does know, and run it from the project root. It blends the related words to approximate the target.

---

## 🗂️ Project structure

```
SOURCE-word-guess-game-master/
├── main.js              Electron entry point (serves the game over app://)
├── index.html           Game page
├── style.css            Styles
├── package.json         Scripts, dependencies and packaging settings
├── build/
│   └── icon.png         App icon used when packaging
├── src/
│   ├── assets/          Logo and icons
│   └── js/
│       ├── game.js      Game logic, timer, hints, leaderboard
│       └── ranker.js    Loads ranking data and scores guesses
├── data/
│   ├── wordbank.json    Target words and their hints
│   └── <word>.json      Precomputed ranking for each target word
├── tools/               Python scripts for rebuilding word data
│   ├── build_wordbank.py
│   ├── make_selfie.py
│   └── requirements.txt
└── dist/                Packaged app output (created by npm run dist)
```

---

## 🧰 npm commands

| Command | What it does |
| --- | --- |
| `npm install` | Installs Electron and electron-builder |
| `npm run electron` | Runs the desktop app (same as `npx electron .`) |
| `npm start` | Runs the game in a browser at `http://localhost:8000` |
| `npm run dist` | Builds the Windows installer and portable `.exe` into `dist/` |
| `npm run install:python` | Installs `gensim` (run with your venv active) |
| `npm run build:data` | Regenerates the ranking JSON files (run with your venv active) |

---

## 🩹 Troubleshooting

| Problem | Fix |
| --- | --- |
| `npm error Missing script: "dist"` | You are in the wrong folder, or `package.json` is out of date. Run commands from the project root. |
| `Failed to build wheel for gensim` | Your Python is too new. Install Python 3.12 and create the venv with `py -3.12 -m venv venv`. |
| `Cannot create symbolic link` while packaging | Enable Windows Developer Mode, then run `npm run dist` again. |
| `Dictionary failed to load` in the console | A word in `wordbank.json` has no matching `data/<word>.json`. The game skips it and picks another word, but run the build step above to fix it properly. |
| Packaged app shows the default Electron icon | Make sure `build/icon.png` exists, then rebuild. |
