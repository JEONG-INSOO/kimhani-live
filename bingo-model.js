export const BINGO_KEY = 'kimhani-bingo-v1';
export const SIZES = [3, 4, 5, 10];
export function alphabet(index) {
  let label = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(65 + (n - 1) % 26) + label;
  return label;
}
export const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTVWXYZ'].map(letter => letter === 'Q' ? 'Q/U' : letter);
export function newBoard(size, mode) {
  const pool = [...LETTERS];
  if (size !== 10 && mode === 'alphabet') {
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
  }
  return { labels: Array.from({length: size * size}, (_, i) => size !== 10 && mode === 'alphabet' ? pool[i] : String(i + 1)), checked: Array(size * size).fill(false) };
}
export function shuffledLabels(board, size, mode) {
  if ([3,4].includes(size) && mode === 'alphabet' && board.labels.every(label => LETTERS.includes(label))) return newBoard(size, mode).labels;
  let labels = [...board.labels];
  for (let i = labels.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [labels[i], labels[j]] = [labels[j], labels[i]];
  }
  return labels;
}
export function newState() { return { size: 3, mode: 'alphabet', boards: {} }; }
export function boardKey(size, mode) { return `${size}-${mode}`; }
export function progress(board, size) {
  const lines = [];
  for (let n = 0; n < size; n++) {
    lines.push(Array.from({length: size}, (_, i) => n * size + i));
    lines.push(Array.from({length: size}, (_, i) => i * size + n));
  }
  lines.push(Array.from({length: size}, (_, i) => i * size + i), Array.from({length: size}, (_, i) => (i + 1) * (size - 1)));
  const completed = lines.filter(line => line.every(i => board.checked[i]));
  const count = board.checked.filter(Boolean).length;
  return { lines: completed.length, count, winning: new Set(completed.flat()), clear: count === size * size };
}
export function validateBingo(raw) {
  if (!raw || !SIZES.includes(raw.size) || !['alphabet', 'number'].includes(raw.mode) || !raw.boards || typeof raw.boards !== 'object') throw new Error('Invalid bingo state');
  const state = newState(); state.size = raw.size; state.mode = raw.size === 10 ? 'number' : raw.mode;
  for (const size of SIZES) for (const mode of ['alphabet', 'number']) {
    const key = boardKey(size, mode), board = raw.boards[key];
    if (!board) continue;
    if (!Array.isArray(board.labels) || board.labels.length !== size * size || board.labels.some(x => typeof x !== 'string' || !x.trim() || x.length > 12) || !Array.isArray(board.checked) || board.checked.length !== size * size || board.checked.some(x => typeof x !== 'boolean')) throw new Error('Invalid bingo board');
    let labels = [...board.labels];
    if (size !== 10 && mode === 'alphabet') {
      let hasPair = labels.includes('Q/U');
      for (let i = 0; i < labels.length; i++) {
        if (!['Q', 'U'].includes(labels[i])) continue;
        if (!hasPair) { labels[i] = 'Q/U'; hasPair = true; }
        else { labels[i] = ['Z', ...LETTERS].find(letter => !labels.includes(letter)); }
      }
    }
    const legacySmall = [3,4].includes(size) && mode === 'alphabet' && !board.checked.some(Boolean) && labels.every((label, i) => label === alphabet(i));
    if (legacySmall) labels = newBoard(size, mode).labels;
    state.boards[key] = {labels: labels.map((label, i) => size === 10 && mode === 'number' ? (/^\d+$/.test(label) ? label : String(i + 1)) : label), checked: [...board.checked]};
  }
  return state;
}
