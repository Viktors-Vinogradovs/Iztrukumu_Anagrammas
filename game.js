// ── Utilities ────────────────────────────────────────────────────────────────

function shuffle(arr) {
  // Fisher-Yates
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function letterFreq(word) {
  const freq = {};
  for (const ch of [...word]) {
    freq[ch] = (freq[ch] || 0) + 1;
  }
  return freq;
}

// Check whether `guess` uses exactly the letters in `availableLetters` array
// (which contains the 5 known letters and whatever the player proposes for ?)
function letterMultisetMatch(guess, availableLetters) {
  if ([...guess].length !== availableLetters.length) return false;
  const available = letterFreq(availableLetters.join(''));
  for (const ch of [...guess]) {
    if (!available[ch]) return false;
    available[ch]--;
  }
  return true;
}

// ── Game state ───────────────────────────────────────────────────────────────

let wordArray = [];
let wordSet = new Set();
let streak = 0;

let currentWord = '';       // the original word (lowercase)
let missingIndex = -1;      // which position was removed
let missingLetter = '';     // the letter that was removed
let tiles = [];             // shuffled display array (5 letters + '?')
let roundOver = false;

// ── Validation ───────────────────────────────────────────────────────────────

function validate(rawInput) {
  const guess = rawInput.trim().normalize('NFC').toLowerCase();
  const guessChars = [...guess];

  if (guessChars.length !== 6) {
    return { ok: false, msg: 'Vārdam jābūt 6 burtiem.' };
  }

  // Find which tile is '?' and what letter the player put in that position
  // Strategy: the player's word must be an anagram of the tiles with '?'
  // replaced by exactly one letter of their choosing.
  // We check all possible replacements (i.e. each letter in the guess
  // that could be the missing one) and accept if any works.

  const knownLetters = tiles.filter(t => t !== '?');

  // Build frequency of guess chars; subtract known letters to find the
  // candidate for '?'
  const guessFreq = letterFreq(guess);
  for (const ch of knownLetters) {
    if (!guessFreq[ch]) {
      return { ok: false, msg: 'Burti nesakrīt ar dotajiem.' };
    }
    guessFreq[ch]--;
    if (guessFreq[ch] === 0) delete guessFreq[ch];
  }

  const remaining = Object.keys(guessFreq);
  if (remaining.length !== 1 || guessFreq[remaining[0]] !== 1) {
    return { ok: false, msg: 'Burti nesakrīt ar dotajiem.' };
  }

  // Letters match structurally — check local list first, then API fallback
  if (wordSet.has(guess)) {
    return { ok: true, api: false, guess, msg: guess === currentWord
      ? `Pareizi! Vārds bija "${currentWord.toUpperCase()}".`
      : `Pareizi! "${guess.toUpperCase()}" arī der. (Domātais vārds: "${currentWord.toUpperCase()}")` };
  }

  // Not in local list — signal that the API should be tried
  return { ok: null, api: true, guess };
}

// ── Tezaurs.lv API check ─────────────────────────────────────────────────────

async function checkTezaurs(word) {
  const url = `http://api.tezaurs.lv:8182/analyze/${encodeURIComponent(word)}`;
  let data;
  try {
    const response = await fetch(url);
    if (!response.ok) return { ok: false, msg: `"${word.toUpperCase()}" nav atrasts vārdnīcā.` };
    data = await response.json();
  } catch {
    return { ok: false, msg: 'Nevar pārbaudīt — nav savienojuma.' };
  }

  // Response is a flat array of morphological analyses
  const isNoun = data.some(e =>
    e['Vārdšķira'] === 'Lietvārds' &&
    e['Locījums']  === 'Nominatīvs' &&
    (e['Skaitlis'] === 'Vienskaitlis' || e['Skaitlis'] === 'Daudzskaitlis')
  );

  if (!isNoun) {
    return { ok: false, msg: `"${word.toUpperCase()}" nav lietvārds nominatīvā.` };
  }

  return { ok: true, msg: word === currentWord
    ? `Pareizi! Vārds bija "${currentWord.toUpperCase()}".`
    : `Pareizi! "${word.toUpperCase()}" arī der (tezaurs.lv). (Domātais vārds: "${currentWord.toUpperCase()}")` };
}

// ── Rendering ────────────────────────────────────────────────────────────────

function renderTiles() {
  const container = document.getElementById('tiles');
  container.innerHTML = '';
  for (const ch of tiles) {
    const div = document.createElement('div');
    div.className = 'tile' + (ch === '?' ? ' missing' : '');
    div.textContent = ch.toUpperCase();
    container.appendChild(div);
  }
}

function setFeedback(msg, type) {
  const el = document.getElementById('feedback');
  el.textContent = msg;
  el.className = type;
}

function updateStreak() {
  document.getElementById('streak').textContent = streak;
}

// ── Event wiring ─────────────────────────────────────────────────────────────

function endRound() {
  roundOver = true;
  document.getElementById('giveup-btn').classList.add('hidden');
  document.getElementById('next-btn').classList.remove('hidden');
  document.getElementById('guess-input').disabled = true;
  document.getElementById('submit-btn').disabled = true;
}

async function handleSubmit() {
  if (roundOver) return;
  const raw = document.getElementById('guess-input').value;
  const result = validate(raw);

  if (result.ok === true) {
    streak++;
    setFeedback(result.msg, 'correct');
    updateStreak();
    endRound();
  } else if (result.ok === null && result.api) {
    // Letters match but word not in local list — check tezaurs.lv
    document.getElementById('submit-btn').disabled = true;
    document.getElementById('guess-input').disabled = true;
    setFeedback('Pārbauda vārdnīcā…', '');
    const apiResult = await checkTezaurs(result.guess);
    document.getElementById('submit-btn').disabled = false;
    document.getElementById('guess-input').disabled = false;
    if (apiResult.ok) {
      streak++;
      setFeedback(apiResult.msg, 'correct');
      updateStreak();
      endRound();
    } else {
      streak = 0;
      setFeedback(apiResult.msg, 'wrong');
      updateStreak();
      document.getElementById('guess-input').focus();
    }
  } else {
    streak = 0;
    setFeedback(result.msg, 'wrong');
    updateStreak();
  }
}

function handleGiveUp() {
  if (roundOver) return;
  streak = 0;
  updateStreak();
  setFeedback(`Atbilde: "${currentWord.toUpperCase()}"`, 'wrong');
  endRound();
}

function newRound() {
  roundOver = false;
  currentWord = wordArray[Math.floor(Math.random() * wordArray.length)].toLowerCase();
  const letters = [...currentWord];
  missingIndex = Math.floor(Math.random() * 6);
  missingLetter = letters[missingIndex];
  letters[missingIndex] = '?';
  tiles = shuffle(letters);

  renderTiles();
  setFeedback('', '');
  const input = document.getElementById('guess-input');
  input.value = '';
  input.disabled = false;
  document.getElementById('submit-btn').disabled = false;
  document.getElementById('giveup-btn').classList.remove('hidden');
  document.getElementById('next-btn').classList.add('hidden');
  input.focus();
}

document.addEventListener('DOMContentLoaded', () => {
  wordArray = WORDS;
  wordSet = new Set(wordArray);

  document.getElementById('submit-btn').addEventListener('click', handleSubmit);
  document.getElementById('next-btn').addEventListener('click', newRound);
  document.getElementById('giveup-btn').addEventListener('click', handleGiveUp);
  document.getElementById('guess-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSubmit();
  });

  newRound();
});
