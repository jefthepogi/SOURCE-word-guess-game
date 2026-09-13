let currentDictionary = {};

async function loadTargetDictionary(targetWord) {
  try {
    const response = await fetch(`./data/${targetWord}.json`);
    currentDictionary = await response.json();
    return true;
  } catch (err) {
    console.error("Dictionary failed to load:", err);
    return false;
  }
}

function getWordRank(word, targetKey) {
  // O(1) instant dictionary lookup
  if (currentDictionary[word]) return currentDictionary[word];
  
  // Deterministic fallback for highly unrelated guesses
  let hash = 0;
  const str = targetKey + "::" + word;
  for(let i = 0; i < str.length; i++){
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return 10000 + 1500 + (hash % 63500);
}

function getRankClass(rank) {
  if (rank === 1) return "rank-win";
  if (rank <= 250) return "rank-hot";
  if (rank <= 1500) return "rank-warm";
  if (rank <= 5000) return "rank-mid";
  return "rank-cold";
}

function getRankProgress(rank) {
    if (rank === 1) return 100;
    if (rank <= 100) return 90 + ((100 - rank) / 100) * 10;   // 90% - 100%
    if (rank <= 1000) return 60 + ((1000 - rank) / 900) * 30;  // 60% - 90%
    if (rank <= 5000) return 25 + ((5000 - rank) / 4000) * 35; // 25% - 60%
    if (rank <= 10000) return 10 + ((10000 - rank) / 5000) * 15; // 10% - 25%
    return 5; // Minimum indicator width for far guesses
}