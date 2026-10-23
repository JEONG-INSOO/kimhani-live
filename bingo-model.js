export const BINGO_KEY = 'kimhani-bingo-v1';
export const SIZES = [3, 4, 5, 10];
export function alphabet(index) {
  let label = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(65 + (n - 1) % 26) + label;
  return label;
}
export function newBoard(size, mode) {
  return { labels: Array.from({length: size * size}, (_, i) => mode === 'alphabet' ? alphabet(i) : String(i + 1)), checked: Array(size * size).fill(false), goal: 1 };
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
  return { lines: completed.length, count, winning: new Set(completed.flat()), clear: board.goal === 'all' ? count === size * size : completed.length >= board.goal };
}
export function validateBingo(raw) {
  if (!raw || !SIZES.includes(raw.size) || !['alphabet', 'number'].includes(raw.mode) || !raw.boards || typeof raw.boards !== 'object') throw new Error('Invalid bingo state');
  const state = newState(); state.size = raw.size; state.mode = raw.mode;
  for (const size of SIZES) for (const mode of ['alphabet', 'number']) {
    const key = boardKey(size, mode), board = raw.boards[key];
    if (!board) continue;
    if (!Array.isArray(board.labels) || board.labels.length !== size * size || board.labels.some(x => typeof x !== 'string' || !x.trim() || x.length > 12) || !Array.isArray(board.checked) || board.checked.length !== size * size || board.checked.some(x => typeof x !== 'boolean') || !(board.goal === 'all' || Number.isInteger(board.goal) && board.goal >= 1 && board.goal <= 2 * size + 2)) throw new Error('Invalid bingo board');
    state.boards[key] = {labels: [...board.labels], checked: [...board.checked], goal: board.goal};
  }
  return state;
}
