// MP3 audio flow for DECODE: SOURCE.
(() => {
  const STORAGE_KEY = "gts_music_muted";
  const VOLUME = 0.18;
  const CROSSFADE_MS = 300;
  const button = document.getElementById("music-toggle");
  const normal = document.getElementById("music-normal");
  const urgent = document.getElementById("music-urgent");
  const solved = document.getElementById("music-solved");
  const gameOver = document.getElementById("music-game-over");
  const backgrounds = [normal, urgent];
  const effects = [solved, gameOver];
  const allTracks = [...backgrounds, ...effects];
  const wantedPlayback = new Set();
  const reloadTimers = new Map();
  const reloadAttempts = new Map();
  let muted = false;
  let phase = "normal";
  let roundStarted = false;
  let fadeTimer = null;
  let fadeToken = 0;

  try {
    muted = localStorage.getItem(STORAGE_KEY) === "true";
  } catch (err) {
    muted = false;
  }

  function updateButton() {
    if (!button) return;
    button.textContent = muted ? "🔇" : "♫";
    button.title = muted ? "Unmute music" : "Mute music";
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-pressed", String(!muted));
    button.classList.toggle("muted", muted);
  }

  function setTrackVolume(track, value) {
    if (track) track.volume = Math.max(0, Math.min(1, value));
  }

  function stopFade() {
    fadeToken += 1;
    if (fadeTimer) clearInterval(fadeTimer);
    fadeTimer = null;
  }

  function fadeTracks(fades, duration = CROSSFADE_MS, onComplete) {
    stopFade();
    const activeFades = fades.filter(({ track }) => track);
    if (!activeFades.length) {
      if (onComplete) onComplete();
      return;
    }

    const token = fadeToken;
    const started = performance.now();
    activeFades.forEach(({ track, from, to }) => {
      setTrackVolume(track, Math.max(0, Math.min(1, from)));
    });

    // All tracks share one animation, so a crossfade cannot leave an orphaned
    // timer running after a reset, mute, win, or loss.
    fadeTimer = setInterval(() => {
      const progress = Math.min(1, (performance.now() - started) / duration);
      activeFades.forEach(({ track, from, to }) => {
        setTrackVolume(track, from + (to - from) * progress);
      });
      if (progress >= 1 && token === fadeToken) {
        clearInterval(fadeTimer);
        fadeTimer = null;
        if (onComplete) onComplete();
      }
    }, 16);
  }

  function tryPlay(track) {
    if (!track || !wantedPlayback.has(track)) return;
    if (!track.paused && !track.ended) return;
    const playback = track.play();
    if (!playback || typeof playback.catch !== "function") return;

    playback.catch((error) => {
      wantedPlayback.delete(track);
      console.warn(`[audio] ${track.id} could not start:`, error.name, error.message);
    });
  }

  function safePlay(track) {
    if (!track) return;
    wantedPlayback.add(track);

    // Recover immediately if a previous round left an element in an errored
    // state; load() reissues the range requests for the same MP3.
    if (track.error) {
      track.load();
      return;
    }

    // preload="auto" is not a guarantee. If Chromium has not buffered the track
    // yet (common when New Word follows another round), wait for the data and
    // start it as soon as it is ready.
    if (track.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      tryPlay(track);
    }
  }

  function cancelReloads() {
    reloadTimers.forEach((timer) => clearTimeout(timer));
    reloadTimers.clear();
    reloadAttempts.clear();
  }

  function stopAllAudio() {
    stopFade();
    cancelReloads();
    wantedPlayback.clear();
    allTracks.forEach((track) => {
      if (!track) return;
      track.pause();
      track.currentTime = 0;
      track.muted = muted;
    });
  }

  function start() {
    if (muted || !roundStarted) return;
    if (phase === "urgent") {
      setTrackVolume(urgent, VOLUME);
      safePlay(urgent);
    } else {
      setTrackVolume(normal, VOLUME);
      safePlay(normal);
    }
  }

  function prepare() {
    stopAllAudio();
    phase = "normal";
    roundStarted = false;
    setTrackVolume(normal, VOLUME);
    setTrackVolume(urgent, 0);
  }

  function beginRound() {
    roundStarted = true;
    start();
  }

  function restart() {
    prepare();
    beginRound();
  }

  function startUrgentSection() {
    if (!roundStarted || phase === "urgent") return;
    phase = "urgent";
    if (muted) return;

    stopFade();
    wantedPlayback.delete(normal);
    urgent.currentTime = 0;
    setTrackVolume(urgent, 0);
    safePlay(urgent);
    fadeTracks(
      [
        { track: normal, from: normal.volume, to: 0 },
        { track: urgent, from: 0, to: VOLUME },
      ],
      CROSSFADE_MS,
      () => normal.pause()
    );
  }

  function stopBackgrounds() {
    backgrounds.forEach((track) => wantedPlayback.delete(track));
    fadeTracks(
      backgrounds.map((track) => ({ track, from: track.volume, to: 0 })),
      150,
      () => {
        backgrounds.forEach((track) => {
          track.pause();
          track.currentTime = 0;
        });
      }
    );
  }

  function playEffect(track) {
    if (!track || muted) return;
    track.pause();
    track.currentTime = 0;
    setTrackVolume(track, VOLUME);
    safePlay(track);
  }

  function playSolved() {
    stopBackgrounds();
    playEffect(solved);
  }

  function playGameOver() {
    stopBackgrounds();
    playEffect(gameOver);
  }

  function setMuted(value, persist = true) {
    muted = value;
    [...backgrounds, ...effects].forEach((track) => {
      if (track) track.muted = muted;
    });
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, String(muted));
      } catch (err) {
        console.error("Music preference failed to save:", err);
      }
    }
    updateButton();
  }

  function stop() {
    roundStarted = false;
    stopAllAudio();
  }

  function toggle() {
    setMuted(!muted);
    if (!muted) start();
  }

  if (button) {
    button.addEventListener("click", toggle);
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle();
      }
    });
  }

  // Audio is deliberately started by beginRound(), after the first valid guess.
  allTracks.forEach((track) => {
    if (!track) return;
    track.preload = "auto";
    track.volume = VOLUME;
    track.muted = muted;

    track.addEventListener("canplay", () => {
      if (wantedPlayback.has(track)) tryPlay(track);
    });

    track.addEventListener("error", () => {
      console.warn(`[audio] failed to load ${track.id}:`, track.error && track.error.message);
      if (!wantedPlayback.has(track) || reloadTimers.has(track)) return;

      // Recover from a failed range request without replacing the audio element.
      // This keeps the same MP3 available for every new word.
      const attempt = (reloadAttempts.get(track) || 0) + 1;
      if (attempt > 3) return;
      reloadAttempts.set(track, attempt);
      const timer = setTimeout(() => {
        reloadTimers.delete(track);
        if (wantedPlayback.has(track)) track.load();
      }, 200 * attempt);
      reloadTimers.set(track, timer);
    });
  });
  setMuted(muted, false);
  window.Soundtrack = { start, stop, prepare, beginRound, restart, startUrgentSection, playSolved, playGameOver, toggle, isMuted: () => muted };
})();
