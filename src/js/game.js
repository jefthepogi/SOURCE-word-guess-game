const dom = {
  list: document.getElementById("list-container"),
  guessCount: document.getElementById("guess-count"),
  hintBanner: document.getElementById("hint-banner"),
  hintText: document.getElementById("hint-text"),
  winPanel: document.getElementById("win-panel"),
  feedback: document.getElementById("feedback"),
  input: document.getElementById("guess-input"),
};

let state = {
  targetKey: null,
  guesses: [],
  hintsShown: 0,
  targetHints: [],
};

let timerInterval = null;
let timeRemaining = 0;
let gameActive = true;
const GUESSES_TO_HINT = 8

async function initGame() {
  document.getElementById("date-display").textContent =
    new Date().toLocaleDateString();

  // 1. Fetch metadata
  const res = await fetch("./data/wordbank.json");
  const masterBank = await res.json();

  // 2. Pick a random target
  const keys = Object.keys(masterBank);
  state.targetKey = keys[Math.floor(Math.random() * keys.length)];
  state.targetHints = masterBank[state.targetKey];

  // 3. Load the semantic ranking data
  const loaded = await loadTargetDictionary(state.targetKey);
  if (loaded) {
    dom.input.disabled = false;
    dom.input.focus();
  }
}

// Listen for keyboard inputs
dom.input.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || !gameActive) return; // Block if game over
  const raw = dom.input.value.trim().toLowerCase();
  dom.feedback.textContent = "";

  if (!/^[a-z-]+$/.test(raw)) {
    dom.feedback.textContent = "Please enter a single word.";
    return;
  }
  if (state.guesses.some((g) => g.word === raw)) {
    dom.feedback.textContent = "Already guessed.";
    return;
  }

  // Start the timer when the first guess is submitted
  if (state.guesses.length === 0) {
    startTimer();
  }

  const rank = getWordRank(raw, state.targetKey);
  state.guesses.push({ word: raw, rank });
  dom.input.value = "";
  render();

  // Call endGame instead of showing panel directly
  if (rank === 1) {
    endGame(true);
  }
});

function render() {
  dom.guessCount.textContent = state.guesses.length;
  dom.list.innerHTML = "";

  const sorted = [...state.guesses].sort((a, b) => a.rank - b.rank);

  if (sorted[0]?.rank === 1) {
    document.getElementById(
      "win-text"
    ).textContent = `Solved in ${state.guesses.length} guesses!`;
    dom.winPanel.classList.add("show");
    dom.input.disabled = true;
  }

  const dueHints = Math.floor(state.guesses.length / GUESSES_TO_HINT);
  if (
    dueHints > state.hintsShown &&
    state.hintsShown < state.targetHints.length
  ) {
    state.hintsShown++;
    dom.hintText.textContent = state.targetHints[state.hintsShown - 1];
    dom.hintBanner.classList.add("show");
  }

  sorted.forEach((g, idx) => {
    const row = document.createElement("div");
    const progressPercent = getRankProgress(g.rank);

    if (idx == 0) {
      const label = document.createElement("div");
      label.className = "divider-label";
      label.textContent = "ALL GUESSES · CLOSEST FIRST";
      dom.list.append(label);
    }

    // Force label append
    if (idx == 1) {
      const label = document.createElement("div");
      label.className = "divider-label";
      label.textContent = "ALL GUESSES · CLOSEST FIRST";
      dom.list.append(label);
    }

    row.className = `guess-row ${getRankClass(g.rank)} ${
      g.rank === 1 ? "win" : ""
    }`;
    row.style.setProperty("--progress", `${progressPercent}%`);

    row.innerHTML = `<span class="word">${
      g.word
    }</span><span class="rank">${g.rank.toLocaleString()}</span>`;
    dom.list.appendChild(row);
  });
}

initGame();

// Timer Configuration

function startTimer() {
  const selectedTime = parseInt(document.getElementById("timer-select").value);
  if (selectedTime === 0) return; // Timer is off

  timeRemaining = selectedTime;
  document.getElementById("timer-config").style.display = "none";
  document.getElementById("timer-display").style.display = "inline-block";
  updateTimerUI();

  timerInterval = setInterval(() => {
    timeRemaining--;
    updateTimerUI();

    if (timeRemaining <= 0) {
      endGame(false);
    }
  }, 1000);
}

function updateTimerUI() {
  const timerEl = document.getElementById("timer-display");
  const m = Math.floor(timeRemaining / 60)
    .toString()
    .padStart(2, "0");
  const s = (timeRemaining % 60).toString().padStart(2, "0");
  timerEl.textContent = `${m}:${s}`;

  if (timeRemaining <= 30) {
    timerEl.classList.add("danger");
  }
}

function endGame(isWin) {
  clearInterval(timerInterval);
  gameActive = false;
  dom.input.disabled = true;

  const winHeading = dom.winPanel.querySelector("h2");

  if (isWin) {
    document.getElementById(
      "win-text"
    ).textContent = `Solved in ${state.guesses.length} guesses!`;
    winHeading.textContent = "SOLVED";
    winHeading.style.color = "var(--green)";
    dom.winPanel.style.borderColor = "var(--green)";
  } else {
    document.getElementById(
      "win-text"
    ).textContent = `Time's up! The word was "${state.targetKey}".`;
    winHeading.textContent = "GAME OVER";
    winHeading.style.color = "#e05656";
    dom.winPanel.style.borderColor = "#e05656";
  }
  dom.winPanel.classList.add("show");
}

function ResetStates() {
  // 1. Reset timer UI
  clearInterval(timerInterval);
  document.getElementById("timer-config").style.display = "inline-block";
  document.getElementById("timer-display").style.display = "none";
  document.getElementById("timer-display").classList.remove("danger");

  // 2. Reset game state
  gameActive = true;
  state.guesses = [];
  state.hintsShown = 0;
  state.targetHints = [];

  // 3. Clear all UI elements instantly
  dom.winPanel.classList.remove("show");
  dom.hintBanner.classList.remove("show");
  dom.hintText.textContent = "";
  dom.feedback.textContent = "";
  dom.input.value = "";

  // 4. Force the screen to clear before loading the new word
  render();
  initGame();
}

document.getElementById("new-game-btn").addEventListener("click", ResetStates)
document.getElementById("reset-btn").addEventListener("click", ResetStates) 
