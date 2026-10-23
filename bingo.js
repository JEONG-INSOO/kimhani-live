import {BINGO_KEY, newState, newBoard, boardKey, progress, validateBingo} from './bingo-model.js?v=21';
const $ = id => document.getElementById(id);
let state = newState(), editing = false, dismissed = false, saveFailed = false, pendingAction;
try { const saved = localStorage.getItem(BINGO_KEY); if (saved) state = validateBingo(JSON.parse(saved)); }
catch { saveFailed = true; }
function board() { const key = boardKey(state.size, state.mode); return state.boards[key] ||= newBoard(state.size, state.mode); }
function save() {
  try { localStorage.setItem(BINGO_KEY, JSON.stringify(state)); saveFailed = false; }
  catch { saveFailed = true; }
  $('bingoSave').textContent = saveFailed ? '저장하지 못했어요 · 이 화면을 닫기 전에 확인해주세요.' : '이 브라우저에 자동 저장돼요';
}
function switchGame(name, focus = false) {
  for (const game of ['kill', 'bingo']) {
    const active = game === name, tab = $(game + 'GameTab');
    tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
    $(game === 'kill' ? 'studio' : 'bingoStudio').hidden = !active;
  }
  if (focus) $(name + 'GameTab').focus();
}
$('killGameTab').onclick = () => switchGame('kill');
$('bingoGameTab').onclick = () => switchGame('bingo');
$('gameTabs').onkeydown = e => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  switchGame(e.key === 'Home' ? 'kill' : e.key === 'End' ? 'bingo' : $('bingoStudio').hidden ? 'bingo' : 'kill', true);
};
function paintCell(cell, index, stats, animate = false) {
  const checked = board().checked[index];
  cell.classList.toggle('is-checked', checked); cell.classList.toggle('is-line', stats.winning.has(index));
  cell.classList.toggle('just-checked', animate && checked);
  if (!editing) { cell.setAttribute('aria-pressed', String(checked)); cell.setAttribute('aria-label', `${index + 1}번 칸 ${board().labels[index]}`); }
}
function update(animateIndex = -1) {
  const stats = progress(board(), state.size);
  [...$('bingoGrid').children].forEach((cell, i) => paintCell(cell, i, stats, i === animateIndex));
  $('bingoLines').textContent = stats.lines;
  $('bingoCount').textContent = `${stats.count} / ${state.size * state.size}`;
  $('bingoRemaining').textContent = `${state.size * state.size - stats.count}칸 남았어요`;
  $('bingoClearBadge').hidden = !stats.clear;
  const wasHidden = $('bingoMission').hidden;
  $('bingoMission').hidden = !stats.clear || dismissed || editing;
  $('bingoMissionDetail').textContent = board().goal === 'all' ? '모든 칸을 완성했어요!' : `${stats.lines}줄 빙고! 오늘도 성공 ✦`;
  if (wasHidden && !$('bingoMission').hidden) {
    $('bingoMission').classList.remove('bingo-reveal'); void $('bingoMission').offsetWidth; $('bingoMission').classList.add('bingo-reveal');
    $('bingoContinue').focus();
  }
}
function render() {
  const current = board();
  document.querySelectorAll('[data-bingo-size]').forEach(el => el.setAttribute('aria-pressed', String(Number(el.dataset.bingoSize) === state.size)));
  document.querySelectorAll('[data-bingo-mode]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.bingoMode === state.mode)));
  $('bingoTitle').textContent = state.size === 10 ? '100 빙고' : `${state.size} × ${state.size} 빙고`;
  $('bingoSubtitle').textContent = `${state.mode === 'alphabet' ? 'ALPHABET' : 'NUMBER'} BINGO`;
  $('bingoHint').textContent = editing ? '칸의 글자를 수정하세요 · 최대 12자 · 빈칸은 이전 값으로 복원돼요' : state.size === 10 ? '클릭하면 색으로 체크 · 한 번 더 클릭하면 취소' : '클릭하면 빨간 색연필 X · 한 번 더 클릭하면 취소';
  $('bingoEdit').textContent = editing ? '✓ 수정 완료' : '✎ 글자 수정';
  $('bingoEdit').setAttribute('aria-pressed', String(editing));
  $('bingoGoal').replaceChildren();
  for (let i = 1; i <= state.size * 2 + 2; i++) { const option = document.createElement('option'); option.value = i; option.textContent = `${i}줄 완성`; $('bingoGoal').append(option); }
  const all = document.createElement('option'); all.value = 'all'; all.textContent = '전체 칸 완성'; $('bingoGoal').append(all); $('bingoGoal').value = current.goal;
  const grid = $('bingoGrid'); grid.replaceChildren(); grid.style.setProperty('--bingo-size', state.size); grid.classList.toggle('hundred', state.size === 10); grid.classList.toggle('editing', editing);
  current.labels.forEach((label, index) => {
    const cell = document.createElement(editing ? 'div' : 'button'); cell.className = 'bingo-cell';
    if (editing) {
      const input = document.createElement('input'); input.type = 'text'; input.value = label; input.maxLength = 12; input.setAttribute('aria-label', `${index + 1}번 칸 글자`);
      input.onchange = () => { const value = input.value.trim(); current.labels[index] = value || current.labels[index]; input.value = current.labels[index]; save(); };
      input.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); input.blur(); $('bingoEdit').focus(); } };
      cell.append(input);
    } else {
      cell.type = 'button'; const text = document.createElement('span'); text.className = 'bingo-letter'; text.textContent = label; text.classList.toggle('long-label', label.length > 3); cell.append(text);
      if (state.size !== 10) cell.insertAdjacentHTML('beforeend', '<svg class="pencil-x" viewBox="0 0 100 100" aria-hidden="true"><path pathLength="1" d="M24 20 Q48 43 78 80 M22 23 L74 81"/><path pathLength="1" d="M79 21 Q51 51 22 79 M77 19 L25 82"/></svg>');
      cell.onclick = () => { const wasClear = progress(current, state.size).clear; current.checked[index] = !current.checked[index]; if (!wasClear) dismissed = false; save(); update(index); };
    }
    grid.append(cell);
  });
  update();
}
document.querySelectorAll('[data-bingo-size]').forEach(el => el.onclick = () => { state.size = Number(el.dataset.bingoSize); editing = false; dismissed = false; render(); save(); });
document.querySelectorAll('[data-bingo-mode]').forEach(el => el.onclick = () => { state.mode = el.dataset.bingoMode; editing = false; dismissed = false; render(); save(); });
$('bingoEdit').onclick = () => { editing = !editing; render(); };
$('bingoGoal').onchange = () => { board().goal = $('bingoGoal').value === 'all' ? 'all' : Number($('bingoGoal').value); dismissed = false; save(); update(); };
$('bingoContinue').onclick = () => { dismissed = true; update(); $('bingoGrid').querySelector('button')?.focus(); };
function resetBoard(shuffle) {
  const current = board(); current.checked.fill(false);
  if (shuffle) for (let i = current.labels.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [current.labels[i], current.labels[j]] = [current.labels[j], current.labels[i]]; }
  dismissed = false; render(); save();
}
function requestReset(shuffle) {
  if (!board().checked.some(Boolean)) { resetBoard(shuffle); return; }
  pendingAction = shuffle;
  $('bingoResetDescription').textContent = shuffle ? '현재 빙고판의 체크를 지우고 글자 위치를 섞어요. 수정한 글자는 유지돼요.' : '현재 빙고판의 체크만 지워요. 글자와 다른 빙고판은 그대로 유지돼요.';
  $('bingoResetDialog').showModal();
}
$('bingoReset').onclick = () => requestReset(false);
$('bingoShuffle').onclick = () => requestReset(true);
$('bingoResetDialog').addEventListener('close', () => { if ($('bingoResetDialog').returnValue === 'confirm') resetBoard(pendingAction); });
window.addEventListener('storage', e => {
  if (e.key !== BINGO_KEY || !e.newValue) return;
  if (editing) { $('bingoSave').textContent = '다른 창에서 변경됐어요 · 이 창의 수정은 다음 저장 시 적용돼요'; return; }
  try { state = validateBingo(JSON.parse(e.newValue)); dismissed = false; render(); $('bingoSave').textContent = '다른 창의 빙고와 동기화됐어요'; }
  catch { $('bingoSave').textContent = '다른 창의 빙고를 읽지 못했어요'; }
});
window.addEventListener('beforeunload', e => { if (saveFailed) { e.preventDefault(); e.returnValue = ''; } });
render();
if (saveFailed) $('bingoSave').textContent = '저장 기록을 읽지 못했어요 · 새 입력 전 브라우저 저장 설정을 확인해주세요';
