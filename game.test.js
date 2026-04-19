const { validate, checkTezaurs, _setState } = require('./game');

// Test word: "aborts" (a, b, o, r, t, s) — present in words.js
// Tiles simulate the missing letter being 'a': known tiles = b,o,r,t,s + '?'
const TILES = ['b', 'o', 'r', 't', 's', '?'];

beforeEach(() => {
  _setState({
    tiles: [...TILES],
    currentWord: 'aborts',
    wordSet: new Set(),
  });
});

// ── 1. Word found in local word list ─────────────────────────────────────────

test('accepts word found in local word list', () => {
  _setState({ wordSet: new Set(['aborts']) });

  const result = validate('aborts');

  expect(result.ok).toBe(true);
  expect(result.api).toBe(false);
  expect(result.msg).toContain('Pareizi');
});

// ── 2. Word validated by Tezaurs API ─────────────────────────────────────────

test('accepts word confirmed as noun by Tezaurs API', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => [
      { 'Vārdšķira': 'Lietvārds', 'Locījums': 'Nominatīvs', 'Skaitlis': 'Vienskaitlis' }
    ],
  });

  const result = await checkTezaurs('aborts');

  expect(fetch).toHaveBeenCalledWith(
    'https://api.tezaurs.lv:8182/analyze/aborts'
  );
  expect(result.ok).toBe(true);
  expect(result.msg).toContain('Pareizi');
});

// ── 3. Word does not exist in either source ───────────────────────────────────

test('rejects word that is not a noun in Tezaurs API', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => [],   // no morphological analyses → not a noun
  });

  const result = await checkTezaurs('aborts');

  expect(result.ok).toBe(false);
  expect(result.msg).toContain('nav lietvārds');
});
