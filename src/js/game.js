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
  previousTarget: null,
  round: 0,
  urgentAudioTriggered: false,
};

let timerInterval = null;
let timeRemaining = 0;
let timerDeadline = 0;
let gameActive = true;
const GUESSES_TO_HINT = 5;
const DEFAULT_TIME = 120; // 2 minutes, fixed
const LEADERBOARD_KEY = "gts_leaderboard";
const LEADERBOARD_MAX = 10;
const PLAYER_NAME_KEY = "gts_player_name";
const WORD_COOLDOWN_KEY = "gts_word_cooldowns";
const ROUND_KEY = "gts_round";
const WORD_COOLDOWN_ROUNDS = 10;

function loadWordCooldowns() {
  try {
    const saved = JSON.parse(localStorage.getItem(WORD_COOLDOWN_KEY) || "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch (err) {
    return {};
  }
}

function getNextRound() {
  const nextRound = Number(localStorage.getItem(ROUND_KEY) || 0) + 1;
  try {
    localStorage.setItem(ROUND_KEY, String(nextRound));
  } catch (err) {
    console.error("Round counter failed to save:", err);
  }
  return nextRound;
}

function markWordGuessed(word, round) {
  try {
    const cooldowns = loadWordCooldowns();
    cooldowns[word] = round;
    localStorage.setItem(WORD_COOLDOWN_KEY, JSON.stringify(cooldowns));
  } catch (err) {
    console.error("Word cooldown failed to save:", err);
  }
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function getNextTargetOrder(allWords, round, previousWord) {
  const cooldowns = loadWordCooldowns();
  const isAvailable = (word) => {
    const lastGuessed = Number(cooldowns[word] || 0);
    return round - lastGuessed >= WORD_COOLDOWN_ROUNDS;
  };

  let available = allWords.filter((word) => isAvailable(word));
  if (available.length === 0) {
    // The bank can be small: use the words guessed longest ago.
    const oldestRound = Math.min(...allWords.map((word) => Number(cooldowns[word] || 0)));
    available = allWords.filter((word) => Number(cooldowns[word] || 0) === oldestRound);
  }

  // Never repeat the immediately previous word when another choice exists.
  const notPrevious = available.filter((word) => word !== previousWord);
  const pool = notPrevious.length ? notPrevious : available;
  return shuffle(pool);
}

async function initGame() {
  document.getElementById("date-display").textContent =
    new Date().toLocaleDateString();

  // 1. Fetch metadata
  const res = await fetch("./data/wordbank.json");
  const masterBank = await res.json();

  // 2 & 3. Pick a word outside its cooldown whenever possible.
  state.round = getNextRound();
  const keys = getNextTargetOrder(Object.keys(masterBank), state.round, state.previousTarget);
  let loaded = false;
  while (!loaded && keys.length) {
    state.targetKey = keys.shift();
    state.targetHints = masterBank[state.targetKey];
    loaded = await loadTargetDictionary(state.targetKey);
  }
  if (loaded) {
    state.previousTarget = state.targetKey;
    dom.input.disabled = false;
    dom.input.focus();
  }

  updateHintProgress();
}

// Listen for keyboard inputs
dom.input.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || !gameActive) return; // Block if game over
  const raw = dom.input.value.trim().toLowerCase();
  dom.feedback.textContent = "";

  if (!/^[a-z-]+$/.test(raw)) {
    showFeedback("Please enter a single word.", true);
    return;
  }
  if (state.guesses.some((g) => g.word === raw)) {
    showFeedback("Already guessed.", true);
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

function showFeedback(msg, isError) {
  dom.feedback.textContent = msg;
  dom.feedback.classList.toggle("error", !!isError);
  dom.feedback.classList.remove("shake");
  // Force reflow so the animation can replay on repeated errors
  void dom.feedback.offsetWidth;
  dom.feedback.classList.add("shake");
}

function render() {
  dom.guessCount.textContent = state.guesses.length;
  dom.list.innerHTML = "";

  const sorted = [...state.guesses].sort((a, b) => a.rank - b.rank);

  const isSolved = sorted[0]?.rank === 1;

  if (isSolved) {
    document.getElementById(
      "win-text"
    ).textContent = `Solved in ${state.guesses.length} guesses!`;
    dom.winPanel.classList.add("show");
    dom.input.disabled = true;
  }

  const dueHints = Math.floor(state.guesses.length / GUESSES_TO_HINT);
  if (
    gameActive &&
    !isSolved &&
    dueHints > state.hintsShown &&
    state.hintsShown < state.targetHints.length
  ) {
    state.hintsShown++;
    dom.hintText.textContent = state.targetHints[state.hintsShown - 1];
    dom.hintBanner.classList.remove("show");
    void dom.hintBanner.offsetWidth;
    dom.hintBanner.classList.add("show");
  }

  updateHintProgress();

  sorted.forEach((g, idx) => {
    const row = document.createElement("div");
    const progressPercent = getRankProgress(g.rank);

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

function updateHintProgress() {
  const progressEl = document.getElementById("hint-progress");
  if (!progressEl) return;

  // No indicator once solved, game over, or all hints already used
  if (!gameActive || state.hintsShown >= state.targetHints.length) {
    progressEl.classList.remove("show");
    return;
  }

  const nextHintAt = (state.hintsShown + 1) * GUESSES_TO_HINT;
  const remaining = nextHintAt - state.guesses.length;

  progressEl.textContent =
    remaining === 1
      ? "1 GUESS UNTIL NEXT HINT"
      : `${remaining} GUESSES UNTIL NEXT HINT`;
  progressEl.classList.add("show");
}

initGame();

// ---------- Timer (fixed 3-minute default) ----------

function lockPlayerName() {
  if (!playerNameInput) return;
  playerNameInput.disabled = true;
  playerNameInput.readOnly = true;
  playerNameInput.setAttribute("aria-disabled", "true");
}

function unlockPlayerName() {
  if (!playerNameInput) return;
  playerNameInput.disabled = false;
  playerNameInput.readOnly = false;
  playerNameInput.removeAttribute("aria-disabled");
}

function startTimer() {
  lockPlayerName();
  if (window.Soundtrack) window.Soundtrack.beginRound();
  timeRemaining = DEFAULT_TIME;
  timerDeadline = Date.now() + DEFAULT_TIME * 1000;
  updateTimerUI();

  timerInterval = setInterval(() => {
    // Use a wall-clock deadline so a delayed tab/window cannot skip the urgent
    // transition or make the round longer than two minutes.
    timeRemaining = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
    updateTimerUI();

    if (timeRemaining <= 0) {
      endGame(false);
    }
  }, 250);
}

function updateTimerUI() {
  const timerEl = document.getElementById("timer-display");
  const m = Math.floor(timeRemaining / 60)
    .toString()
    .padStart(2, "0");
  const s = (timeRemaining % 60).toString().padStart(2, "0");
  timerEl.textContent = `${m}:${s}`;

  timerEl.classList.toggle("danger", timeRemaining <= 30);
  if (timeRemaining <= 30 && !state.urgentAudioTriggered && window.Soundtrack) {
    state.urgentAudioTriggered = true;
    window.Soundtrack.startUrgentSection();
  }
}

function endGame(isWin) {
  clearInterval(timerInterval);
  if (window.Soundtrack) {
    window.Soundtrack.stop();
    if (isWin) window.Soundtrack.playSolved();
    else window.Soundtrack.playGameOver();
  }
  gameActive = false;
  dom.input.disabled = true;
  dom.hintBanner.classList.remove("show");

  const winHeading = dom.winPanel.querySelector("h2");

  if (isWin) {
    document.getElementById(
      "win-text"
    ).textContent = `Solved in ${state.guesses.length} guesses!`;
    winHeading.textContent = "SOLVED";
    winHeading.style.color = "var(--green)";
    dom.winPanel.style.borderColor = "var(--green)";
    markWordGuessed(state.targetKey, state.round);
    saveLeaderboardEntry(state.targetKey, state.guesses.length, DEFAULT_TIME - timeRemaining);
  } else {
    document.getElementById(
      "win-text"
    ).textContent = `Time's up! The word was "${state.targetKey}".`;
    winHeading.textContent = "GAME OVER";
    winHeading.style.color = "#e05656";
    dom.winPanel.style.borderColor = "#e05656";
  }
  dom.winPanel.classList.remove("show");
  void dom.winPanel.offsetWidth;
  dom.winPanel.classList.add("show");
  updateHintProgress();
}

function ResetStates() {
  // 1. Reset timer UI
  clearInterval(timerInterval);
  timeRemaining = DEFAULT_TIME;
  const timerEl = document.getElementById("timer-display");
  updateTimerUI();
  timerEl.classList.remove("danger");

  // 2. Reset game state
  gameActive = true;
  state.guesses = [];
  state.hintsShown = 0;
  state.targetHints = [];
  state.urgentAudioTriggered = false;

  // 3. Clear all UI elements instantly
  dom.winPanel.classList.remove("show");
  dom.hintBanner.classList.remove("show");
  dom.hintText.textContent = "";
  dom.feedback.textContent = "";
  dom.feedback.classList.remove("error", "shake");
  dom.input.value = "";
  if (playerNameInput) {
    playerNameInput.value = getPlayerName();
    resizePlayerNameInput();
    unlockPlayerName();
  }
  document.getElementById("hint-progress").classList.remove("show");

  // 4. Force the screen to clear before loading the new word
  render();
  initGame();
  if (window.Soundtrack) window.Soundtrack.prepare();
}

document.getElementById("new-game-btn").addEventListener("click", ResetStates);
document.getElementById("reset-btn").addEventListener("click", ResetStates);

// ---------- Leaderboard ----------

function loadLeaderboard() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Leaderboard failed to load:", err);
    return [];
  }
}

function saveLeaderboardEntry(word, guesses, seconds) {
  const board = loadLeaderboard();
  board.push({
    word,
    guesses,
    seconds,
    player: getPlayerName(),
    date: new Date().toISOString(),
  });
  // Best entries first: fewer guesses, then less time taken
  board.sort((a, b) => a.guesses - b.guesses || a.seconds - b.seconds);
  const trimmed = board.slice(0, LEADERBOARD_MAX);
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error("Leaderboard failed to save:", err);
  }
}

function clearLeaderboard() {
  try {
    localStorage.removeItem(LEADERBOARD_KEY);
  } catch (err) {
    console.error("Leaderboard failed to clear:", err);
  }
}

function formatSeconds(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderLeaderboard() {
  const listEl = document.getElementById("leaderboard-list");
  const board = loadLeaderboard();

  if (board.length === 0) {
    listEl.innerHTML = `<div class="empty-state">No solved words yet. Solve one to make the board!</div>`;
    return;
  }

  listEl.innerHTML = "";
  board.forEach((entry, i) => {
    const row = document.createElement("div");
    row.className = "leaderboard-row";
    row.style.animationDelay = `${i * 0.03}s`;
    const dateLabel = new Date(entry.date).toLocaleDateString();
    const playerLabel = escapeHtml(entry.player ? entry.player : "Anonymous");
    row.innerHTML = `
      <span class="lb-rank">#${i + 1}</span>
      <span class="lb-word">${escapeHtml(entry.word)}<br><span class="lb-player">${playerLabel}</span></span>
      <span class="lb-meta">${entry.guesses} guesses · ${formatSeconds(entry.seconds)}<br>${dateLabel}</span>
    `;
    listEl.appendChild(row);
  });
}

const leaderboardOverlay = document.getElementById("leaderboard-overlay");

function openLeaderboard() {
  renderLeaderboard();
  leaderboardOverlay.classList.add("show");
}

function closeLeaderboard() {
  leaderboardOverlay.classList.remove("show");
}

document.getElementById("leaderboard-btn").addEventListener("click", openLeaderboard);
document.getElementById("leaderboard-close").addEventListener("click", closeLeaderboard);
leaderboardOverlay.addEventListener("click", (e) => {
  if (e.target === leaderboardOverlay) closeLeaderboard();
});

// Reset leaderboard requires a confirming second click within 4 seconds
const resetBtn = document.getElementById("leaderboard-reset");
let resetConfirmTimeout = null;

resetBtn.addEventListener("click", () => {
  if (resetBtn.classList.contains("confirm-pending")) {
    clearLeaderboard();
    renderLeaderboard();
    resetBtn.textContent = "Reset Leaderboard";
    resetBtn.classList.remove("confirm-pending");
    clearTimeout(resetConfirmTimeout);
    return;
  }

  resetBtn.textContent = "Click again to confirm";
  resetBtn.classList.add("confirm-pending");
  clearTimeout(resetConfirmTimeout);
  resetConfirmTimeout = setTimeout(() => {
    resetBtn.textContent = "Reset Leaderboard";
    resetBtn.classList.remove("confirm-pending");
  }, 4000);
});

// ---------- Player Name ----------

function getPlayerName() {
  try {
    const name = localStorage.getItem(PLAYER_NAME_KEY);
    return name && name.trim() ? name.trim() : "";
  } catch (err) {
    return "";
  }
}

function setPlayerName(name) {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name.trim());
  } catch (err) {
    console.error("Player name failed to save:", err);
  }
}

const playerNameInput = document.getElementById("player-name-input");
playerNameInput.value = getPlayerName();

function resizePlayerNameInput() {
  const length = playerNameInput.value.length || playerNameInput.placeholder.length;
  playerNameInput.style.width = `${Math.min(18, Math.max(8, length + 1))}ch`;
  playerNameInput.title = playerNameInput.value;
}
resizePlayerNameInput();
unlockPlayerName();

playerNameInput.addEventListener("input", () => {
  resizePlayerNameInput();
  // Save continuously so starting a round can never clear the player's name.
  setPlayerName(playerNameInput.value);
});
playerNameInput.addEventListener("change", () => {
  setPlayerName(playerNameInput.value);
});
playerNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") playerNameInput.blur();
});
