# GUESS THE SOURCE — Tech Word Guess

GUESS THE SOURCE is a semantic word-guessing browser game. The frontend is built with vanilla HTML/CSS/JS, while the backend relies on a Python script utilizing natural language processing (Gensim) to precompute semantic word relationships into lightweight JSON files for offline-capable gameplay.

## 📋 Prerequisites

Ensure you have the following installed on your machine before starting:

* **Node.js & npm** (used for task automation)
* **Python 3.8+** (used for building the semantic dictionaries)

## 🚀 Quick Start Setup

This project uses `package.json` scripts to bridge the Python and frontend environments seamlessly.

**1. Clone the repository**

```bash
git clone https://github.com/yourusername/GUESS THE SOURCE.git
cd GUESS THE SOURCE
```

**2. Set up a Python Virtual Environment (Recommended)**
To prevent the heavy language models from installing globally on your machine, create and activate a local virtual environment:

*On macOS/Linux:*

```bash
python3 -m venv venv
source venv/bin/activate

```

*On Windows:*

```bash
python -m venv venv
venv\Scripts\activate

```

**3. Install Dependencies & Build Data**
With your virtual environment active, run the automated setup. This will read `requirements.txt`, install `gensim`, and execute the Python build script to generate the JSON dictionary files in your `data/` folder:

```bash
npm run setup

```

**4. Start the Game**
Launch the local development server:

```bash
npm start

```

Open your browser and navigate to `http://localhost:8000` to play!

## 🛠️ Development & Structure

The repository is modularly designed to separate the data pipeline from the frontend logic.

**Available NPM Commands:**

* `npm run setup`: Installs dependencies and builds the initial data.
* `npm run build:data`: Regenerates the JSON files (run this anytime you add new target words to `data/wordBank.json`).
* `npm start`: Boots up the local HTTP server.

**Project Structure:**

* `/data/` - Holds the metadata (`wordbank.json`) and the generated semantic ranking dictionaries.
* `/src/js/` - Contains the frontend logic (`game.js`) and ranking calculations (`ranker.js`).
* `build_wordbank.py` - The Python script responsible for downloading the NLP model and computing word vectors.
* `index.html` & `style.css` - The primary user interface.
