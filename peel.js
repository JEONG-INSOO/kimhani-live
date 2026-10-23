import {PEEL_KEY, OPS, emptyPeel, randomInt, summarize, validatePeel} from './peel-model.js?v=23';
const $ = id => document.getElementById(id), fmt = value => BigInt(value).toLocaleString('ko-KR');
let state = emptyPeel(), busy = false, generation = 0, failed = false, blocked = false;
try { const saved = localStorage.getItem(PEEL_KEY); if (saved) state = validatePeel(JSON.parse(saved)); }
catch { blocked = true; }
function notice(text) { $('peelNotice').textContent = text; $('peelNotice').hidden = !text; }
function commit(event) {
  if (blocked) return;
  state.events.push(event);
  save(); render();
}
function save() {
  try { localStorage.setItem(PEEL_KEY, JSON.stringify(state)); failed = false; }
  catch { failed = true; notice('저장 공간을 사용할 수 없어요. 이 화면을 닫기 전에 기록을 확인해주세요.'); }
}
function line(tag, text, cls) { const el = document.createElement(tag); el.textContent = text; if (cls) el.className = cls; return el; }
function render() {
  const s = summarize(state), locked = busy || s.clear || blocked;
  $('peelCurrent').textContent = s.remaining === '0' ? '000' : fmt(s.remaining);
  $('peelCurrent').classList.toggle('peel-long', s.remaining.length > 7);
  $('peelHero').classList.toggle('is-clear', s.clear);
  $('peelMission').hidden = !s.clear;
  $('peelSpin').disabled = locked;
  $('peelSupport').disabled = locked;
  $('peelName').disabled = locked; $('peelFixed').disabled = locked;
  $('peelKills').disabled = locked || !s.started;
  $('peelRecord').disabled = locked || !s.started;
  $('peelUndo').disabled = busy || blocked || !state.events.length;
  $('peelReset').disabled = busy || blocked || !state.events.length;
  $('peelTotals').textContent = `${s.rounds}판 · 총 ${fmt(s.kills)}킬`;
  const last = s.members.filter(m => !m.fixed && m.remaining === 1 && !s.clear);
  $('peelLast').replaceChildren(...last.map(m => line('p', `${m.name}님 막판!`, 'peel-last-name')));
  $('peelLast').hidden = !last.length;
  const active = s.members.filter(m => m.fixed || m.remaining > 0);
  $('peelMembers').replaceChildren();
  if (!active.length) $('peelMembers').append(line('p', '함께할 이름을 추가해주세요.', 'peel-empty'));
  for (const m of active) {
    const row = line('div', '', 'peel-member'), info = line('div', '', 'peel-member-info');
    info.append(line('b', m.name), line('small', `${m.rounds}판 함께 · ${fmt(m.kills)}킬`));
    const fixed = line('label', '', 'peel-fixed-label'), input = document.createElement('input'); input.type = 'checkbox'; input.checked = m.fixed; input.disabled = locked; input.setAttribute('aria-label', `${m.name} 고정참가`);
    input.onchange = () => commit({type:'fixed',name:m.name,fixed:input.checked}); fixed.append(input,line('span','고정참가'));
    row.append(info, fixed, line('strong', m.fixed ? '∞' : `${m.remaining}판`, 'peel-left')); $('peelMembers').append(row);
  }
  $('peelSummary').replaceChildren();
  for (const m of s.members.filter(m => m.rounds || m.granted || m.fixed)) {
    const row = document.createElement('tr');
    row.append(line('th',m.name),line('td',`${m.rounds}판`),line('td',`${fmt(m.kills)}킬`),line('td',s.clear ? '미션 종료' : m.fixed ? '고정참가' : m.remaining ? `${m.remaining}판 남음` : '참여 완료')); row.firstChild.scope = 'row'; $('peelSummary').append(row);
  }
  $('peelSummaryEmpty').hidden = !!$('peelSummary').children.length;
  $('peelHistory').replaceChildren();
  for (const event of s.history.slice(-30).reverse()) {
    const text = event.type === 'spin' ? (event.op === '=' ? `새 목표 · ${event.operand}킬` : `${fmt(event.before)} ${event.op} ${event.operand} → ${fmt(event.after)}킬`) : `${event.round}판 · ${event.kills}킬 · ${event.names.join(', ') || '단독 플레이'} → ${fmt(event.after)}킬`;
    $('peelHistory').append(line('li',text));
  }
  if (!busy) {
    const lastSpin = [...s.history].reverse().find(event => event.type === 'spin');
    $('peelOperator').textContent = lastSpin?.op || '?';
    const digits = String(lastSpin?.operand || 0).padStart(3,'0');
    ['peelHundreds','peelTens','peelOnes'].forEach((id,i) => $(id).textContent = digits[i]);
    const last = s.history.at(-1);
    $('peelEquation').textContent = !last ? '첫 숫자는 20~100' : last.type === 'spin' ? (last.op === '=' ? `새 목표 · ${last.operand}킬` : `${fmt(last.before)} ${last.op} ${last.operand} = ${fmt(last.after)}킬`) : `${last.round}판 · ${last.kills}킬 차감 → ${fmt(last.after)}킬`;
  }
  if (blocked) notice('저장된 킬까기 기록을 읽지 못했어요. 기존 기록 보호를 위해 입력을 멈췄어요.');
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function roll(id, values, result, duration, token) {
  const el = $(id); el.classList.add('rolling');
  const steps = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : Math.ceil(duration / 65);
  for (let i = 0; i < steps; i++) { if (token !== generation) return; el.textContent = values[randomInt(0,values.length-1)]; await sleep(steps === 1 ? 50 : 65); }
  if (token !== generation) return;
  el.textContent = result; el.classList.remove('rolling'); el.classList.remove('landed'); void el.offsetWidth; el.classList.add('landed');
}
$('peelSpin').onclick = async () => {
  if (busy || blocked || summarize(state).clear) return;
  const s = summarize(state), op = OPS[randomInt(0,3)], operand = randomInt(20,100), token = ++generation;
  busy = true; notice(''); $('peelEquation').textContent = '운명의 기호를 뽑는 중…'; render();
  $('peelHundreds').textContent = '?'; $('peelTens').textContent = '?'; $('peelOnes').textContent = '?';
  await roll('peelOperator',BigInt(s.remaining) === 0n ? ['='] : OPS,BigInt(s.remaining) === 0n ? '=' : op,900,token);
  if (token !== generation) return;
  $('peelEquation').textContent = '숫자를 뽑는 중…';
  $('peelHundreds').textContent = operand === 100 ? '1' : '0';
  await roll('peelTens',['0','1','2','3','4','5','6','7','8','9'],String(Math.floor(operand / 10) % 10),700,token);
  await roll('peelOnes',['0','1','2','3','4','5','6','7','8','9'],String(operand % 10),850,token);
  if (token !== generation) return;
  busy = false; commit({type:'spin',op,operand});
  const next = summarize(state); $('peelEquation').textContent = BigInt(s.remaining) === 0n ? `새 목표 · ${operand}킬` : `${fmt(s.remaining)} ${op} ${operand} = ${fmt(next.remaining)}킬`;
};
$('peelSupportForm').onsubmit = e => {
  e.preventDefault(); if (busy || blocked || summarize(state).clear) return;
  const name = $('peelName').value.trim(); if (!name) { $('peelName').setCustomValidity('이름을 입력해주세요.'); $('peelName').reportValidity(); return; }
  const rounds = randomInt(0,5), fixed = $('peelFixed').checked;
  commit({type:'support',name,rounds,fixed});
  $('peelSupportResult').textContent = `${name}님 +${rounds}판${fixed ? ' · 고정참가 ∞' : rounds === 0 ? ' · 이번에는 추가 판수 없어요' : ''}`;
};
$('peelName').oninput = () => $('peelName').setCustomValidity('');
$('peelRoundForm').onsubmit = e => {
  e.preventDefault(); const s = summarize(state); if (busy || blocked || s.clear || !s.started) return;
  const kills = $('peelKills').valueAsNumber;
  if (!Number.isInteger(kills) || kills < 0 || kills > 10000) return;
  commit({type:'round',kills}); $('peelKills').value = ''; $('peelEquation').textContent = `${fmt(s.remaining)} − ${kills} = ${fmt(summarize(state).remaining)}킬`;
};
$('peelUndo').onclick = () => { if (busy || blocked || !state.events.length) return; state.events.pop(); save(); render(); $('peelEquation').textContent = '마지막 입력을 취소했어요.'; $('peelSupportResult').textContent = ''; };
$('peelReset').onclick = () => $('peelResetDialog').showModal();
$('peelResetDialog').addEventListener('close', () => {
  if ($('peelResetDialog').returnValue !== 'confirm') return;
  state = emptyPeel(); save(); render(); $('peelEquation').textContent = '첫 숫자는 20~100'; $('peelSupportResult').textContent = '';
  $('peelOperator').textContent = '?'; for (const id of ['peelHundreds','peelTens','peelOnes']) $(id).textContent = '0';
});
window.addEventListener('storage', e => {
  if (e.key !== PEEL_KEY) return;
  try { const incoming = e.newValue ? validatePeel(JSON.parse(e.newValue)) : emptyPeel(); generation++; busy = false; blocked = false; state = incoming; document.querySelectorAll('.peel-reel').forEach(el=>el.classList.remove('rolling')); render(); $('peelEquation').textContent = '다른 창의 기록을 반영했어요.'; }
  catch { notice('다른 창의 기록을 읽지 못했어요.'); }
});
window.addEventListener('beforeunload', e => { if (busy || failed) { e.preventDefault(); e.returnValue = ''; } });
render();
