import {PEEL_KEY, OPS, emptyPeel, randomInt, summarize, validatePeel, resetPeelProgress, drawKillSlot, drawMemberRounds} from './peel-model.js?v=29';
const $ = id => document.getElementById(id), fmt = value => BigInt(value).toLocaleString('ko-KR');
let state = emptyPeel(), busy = false, generation = 0, failed = false, blocked = false, displayedTarget = null, roundDraft = null, knownActive = new Set();
let skipRequested = false, wakeReel = null, memberDrawing = false, spinPhase = 'idle', dismissResult = false, memberPanelOpen = false, memberOpener = null;
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
function paintTarget(value) {
  const el = $('peelCurrent'), layout = document.querySelector('.peel-layout');
  el.textContent = value === '0' ? '000' : fmt(value);
  // Six-digit targets set the size; extra digits only increase the width.
  const width = layout.clientWidth;
  const size = Math.min(64, Math.max(38, (width > 756 ? (width-22)/2.13 : width-38)*.14));
  el.style.fontSize = size + 'px';
  const needed = el.scrollWidth + 52;
  layout.style.setProperty('--target-width', Math.max((width-22)/2.13,Math.min(needed,width)) + 'px');
  layout.classList.toggle('peel-wide-target', needed > width-342);
}
function roundTotal() {
  const total = roundDraft.reduce((n,p) => n + (Number.isFinite(Number(p.kills)) ? Number(p.kills) : 0), 0);
  $('peelRoundTotal').textContent = total.toLocaleString('ko-KR') + '킬';
}
function renderRoundInputs(s, locked) {
  const active = s.members.filter(m => !m.waiting && (m.fixed || m.remaining > 0)).map(m=>m.name);
  if (roundDraft === null) roundDraft = active.map(name=>({name,kills:''}));
  else for (const name of active) if (!knownActive.has(name) && !roundDraft.some(p=>p.name.trim() === name)) {
    const blank = roundDraft.find(p=>!p.name && p.kills === '');
    if (blank) blank.name = name; else roundDraft.push({name,kills:''});
  }
  roundDraft = roundDraft.filter(p => active.includes(p.name));
  knownActive = new Set(active);

  $('peelRoundPlayers').replaceChildren();
  $('peelPlayerNames').replaceChildren(...s.members.map(m=>{ const opt = document.createElement('option'); opt.value = m.name; return opt; }));
  roundDraft.forEach((player,index)=>{
    const row = line('div','','peel-player-input'), name = document.createElement('input'), kills = document.createElement('input'), remove = line('button','×','peel-remove');
    name.type = 'text'; name.maxLength = 30; name.value = player.name; name.placeholder = '함께한 이름'; name.setAttribute('list','peelPlayerNames'); name.setAttribute('aria-label',`${index+1}번 참가자 이름`); name.disabled = locked; name.readOnly = true;
    kills.type = 'number'; kills.min = 0; kills.max = 10000; kills.step = 1; kills.inputMode = 'numeric'; kills.placeholder = '0'; kills.value = player.kills; kills.setAttribute('aria-label',`${index+1}번 참가자 킬`); kills.disabled = locked;
    name.oninput = () => player.name = name.value;
    kills.oninput = () => { player.kills = kills.value; roundTotal(); };
    remove.type = 'button'; remove.disabled = locked; remove.setAttribute('aria-label',`${index+1}번 참가자 이번 판 제외`);
    remove.onclick = () => { roundDraft.splice(index,1); renderRoundInputs(summarize(state),false); };
    row.append(name,kills,remove); $('peelRoundPlayers').append(row);
  });
  $('peelAddPlayer').disabled = locked; roundTotal();
}
async function applyAnimated(event, token, keepBusy = false) {
  const from = BigInt(summarize(state).remaining);
  busy = true; displayedTarget = String(from); state.events.push(event); save(); render();
  const to = BigInt(summarize(state).remaining), el = $('peelCurrent');
  el.classList.remove('target-land'); el.classList.add('counting');
  el.style.setProperty('--count-direction', to >= from ? '1' : '-1');
  const steps = matchMedia('(prefers-reduced-motion: reduce)').matches || from === to ? 1 : 45;
  for (let i = 1; i <= steps; i++) {
    if (token !== generation) return;
    const eased = BigInt(Math.round((1-Math.pow(1-i/steps,3))*10000));
    displayedTarget = String(from + (to-from)*eased/10000n);
    paintTarget(displayedTarget);
    if (steps > 1) await sleep(20);
  }
  if (token !== generation) return;
  displayedTarget = null; busy = keepBusy; el.classList.remove('counting'); el.classList.add('target-land'); render();
}
function render() {
  const s = summarize(state), locked = busy || memberPanelOpen || s.clear || blocked;
  $('peelMemberPanel').hidden = !memberPanelOpen;
  $('peelTargetView').hidden = memberPanelOpen;
  const shown = displayedTarget ?? s.remaining;
  paintTarget(shown);
  $('peelHero').classList.toggle('is-clear', s.clear && !busy);
  $('peelMission').hidden = !s.clear || busy;
  $('peelSpin').disabled = locked;
  $('peelSpin').hidden = busy || s.clear;
  $('peelReels').hidden = !['rolling','result'].includes(spinPhase);
  $('peelSpinBroken').hidden = spinPhase !== 'fault';
  $('peelReels').setAttribute('aria-label',spinPhase === 'result' ? '슬롯 결과 닫기' : '추첨 건너뛰고 결과 바로 보기');
  $('peelReels').title = spinPhase === 'result' ? '클릭하면 결과 닫기' : '클릭하면 바로 결과 공개';
  $('peelSupport').disabled = locked;
  $('peelSaveMember').disabled = locked; $('peelRounds').disabled = locked;
  $('peelName').disabled = locked; $('peelFixed').disabled = locked;
  renderRoundInputs(s, locked);
  $('peelRecord').disabled = locked || !s.started || !roundDraft.length;
  $('peelResetRounds').disabled = busy || memberPanelOpen || blocked || !s.started;
  const last = s.members.filter(m => !m.waiting && !m.fixed && m.remaining === 1 && !s.clear);
  $('peelLast').replaceChildren(...last.map(m => line('p', `${m.name}님 막판!`, 'peel-last-name')));
  $('peelLast').hidden = !last.length;
  $('peelMembers').replaceChildren();
  if (!s.members.length) $('peelMembers').append(line('p', '함께할 이름을 추가해주세요.', 'peel-empty'));
  for (const m of s.members) {
    const row = line('div', '', 'peel-member'), info = line('div', '', 'peel-member-info');
    info.append(line('b', m.name), line('small', `${m.rounds}판 함께 · ${fmt(m.kills)}킬`));
    const fixed = line('label', '', 'peel-fixed-label'), input = document.createElement('input'); input.type = 'checkbox'; input.checked = m.fixed; input.disabled = locked; input.setAttribute('aria-label', `${m.name} 고정참가`);
    input.onchange = () => commit({type:'fixed',name:m.name,fixed:input.checked}); fixed.append(input,line('span','고정참가'));
    const edit = line('button','설정','peel-add'); edit.type = 'button'; edit.disabled = locked; edit.setAttribute('aria-label',`${m.name} 멤버 설정`);
    edit.onclick = () => { $('peelName').value = m.name; $('peelRounds').value = m.remaining; $('peelFixed').checked = m.fixed; $('peelName').focus(); };
    const waiting = line('label','','peel-fixed-label'), wait = document.createElement('input');
    wait.type = 'checkbox'; wait.checked = m.waiting; wait.disabled = locked || (!m.fixed && !m.remaining); wait.setAttribute('aria-label', m.name + ' 대기');
    wait.onchange = () => {
      if (!wait.checked && s.members.filter(p=>!p.waiting && (p.fixed || p.remaining>0)).length >= 4) { wait.checked = true; notice('현재 4명이 참가 중이에요. 다른 멤버를 대기로 바꾸면 합류할 수 있어요.'); return; }
      notice(''); commit({type:'waiting',name:m.name,waiting:wait.checked});
    };
    waiting.append(wait,line('span','대기')); row.classList.toggle('is-waiting',m.waiting);
    row.append(info, waiting, fixed, line('strong', m.fixed ? '∞' : `${m.remaining}판`, 'peel-left'), edit); $('peelMembers').append(row);
  }
  $('peelSummary').replaceChildren();
  for (const m of s.members) {
    const row = document.createElement('tr');
    row.append(line('th',m.name),line('td',`${m.rounds}판`),line('td',`${fmt(m.kills)}킬`),line('td',m.individualRounds ? `${fmt(m.personalKills)}킬` : '—'),line('td',s.clear ? '미션 종료' : m.waiting ? '대기 중' : m.fixed ? '고정참가' : m.remaining ? `${m.remaining}판 남음` : '참여 완료')); row.firstChild.scope = 'row'; $('peelSummary').append(row);
  }
  $('peelSummaryEmpty').hidden = !!$('peelSummary').children.length;
  $('peelHistory').replaceChildren();
  for (const event of s.history.slice(-30).reverse()) {
    const text = event.type === 'spin' ? (event.op === '=' ? `새 목표 · ${event.operand}킬` : `${fmt(event.before)} ${event.op} ${event.operand} → ${fmt(event.after)}킬`) : `${event.round}판 · ${event.kills}킬 · ${event.players ? event.players.map(p=>`${p.name} ${p.kills}킬`).join(', ') : event.names.join(', ') || '단독 플레이'} → ${fmt(event.after)}킬`;
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
  const steps = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : Math.ceil(duration / 100);
  el.classList.remove('landed');
  const weights = Array.from({length:steps},(_,i)=>1 + 1.5*Math.pow(i/steps,3)), total = weights.reduce((a,b)=>a+b,0);
  for (let i = 0; i < steps && !skipRequested; i++) {
    if (token !== generation) return;
    el.textContent = values[randomInt(0,values.length-1)];
    await new Promise(resolve => { const timer = setTimeout(()=>{wakeReel=null;resolve();},steps === 1 ? 30 : duration*weights[i]/total); wakeReel=()=>{clearTimeout(timer);wakeReel=null;resolve();}; });
  }
  if (token !== generation) return;
  el.textContent = result; el.classList.remove('rolling'); el.classList.remove('landed'); void el.offsetWidth; el.classList.add('landed');
}
$('peelSpin').onclick = async () => {
  if (busy || memberDrawing || blocked || summarize(state).clear) return;
  const s = summarize(state), outcome = drawKillSlot(), op = outcome?.op ?? '+', operand = outcome?.operand ?? 0, token = ++generation;
  busy = true; spinPhase = 'rolling'; skipRequested = false; dismissResult = false; notice(''); render();
  $('peelHundreds').textContent = '?'; $('peelTens').textContent = '?'; $('peelOnes').textContent = '?';
  await roll('peelOperator',BigInt(s.remaining) === 0n ? ['='] : OPS,BigInt(s.remaining) === 0n ? '=' : op,750,token);
  if (token !== generation) return;
  $('peelHundreds').textContent = operand === 100 ? '1' : '0';
  await roll('peelTens',['0','1','2','3','4','5','6','7','8','9'],String(Math.floor(operand / 10) % 10),750,token);
  await roll('peelOnes',['0','1','2','3','4','5','6','7','8','9'],String(operand % 10),750,token);
  if (token !== generation) return;
  spinPhase = outcome ? 'result' : 'fault'; const revealedAt = Date.now();
  if (outcome) await applyAnimated(outcome, token, true); else render();
  if (token !== generation) return;
  if (!dismissResult) await new Promise(resolve => {
    const timer = setTimeout(()=>{wakeReel=null;resolve();},Math.max(0,8000-(Date.now()-revealedAt)));
    wakeReel = () => { clearTimeout(timer); wakeReel=null; resolve(); };
  });
  if (token !== generation) return;
  spinPhase = 'idle'; busy = false; render();
  const next = summarize(state); $('peelEquation').textContent = BigInt(s.remaining) === 0n ? `새 목표 · ${operand}킬` : `${fmt(s.remaining)} ${op} ${operand} = ${fmt(next.remaining)}킬`;
};
$('peelReels').onclick = () => {
  if (spinPhase === 'rolling') { skipRequested = true; wakeReel?.(); }
  else if (spinPhase === 'result' || spinPhase === 'fault') { dismissResult = true; wakeReel?.(); }
};
$('peelSpinBroken').onclick = () => { dismissResult = true; wakeReel?.(); };
$('peelReels').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('peelReels').click(); } };
$('peelSupportForm').onsubmit = e => {
  e.preventDefault(); if (busy || memberDrawing || blocked || summarize(state).clear) return;
  const name = $('peelName').value.trim(), remaining = Number($('peelRounds').value), fixed = $('peelFixed').checked;
  if (!name || !Number.isInteger(remaining) || remaining < 0 || remaining > 999) return;
  roundDraft = null; knownActive.clear(); commit({type:'member',name,remaining,fixed});
  $('peelSupportResult').textContent = `${name}님 · ${fixed ? '고정참가 ∞' : remaining + '판'} 저장했어요.`;
};
$('peelSupport').onclick = () => openMemberDraw('', '판수 룰렛');
$('peelName').oninput = () => $('peelName').setCustomValidity('');
function selectEditor(settings, focus = false) {
  ['peelPlayTab','peelSettingsTab'].forEach((id,i) => { $(id).setAttribute('aria-selected',String(Boolean(i) === settings)); $(id).tabIndex = Boolean(i) === settings ? 0 : -1; });
  $('peelPlayPanel').hidden = settings; $('peelSettingsPanel').hidden = !settings;
  if (focus) $(settings ? 'peelSettingsTab' : 'peelPlayTab').focus();
}
$('peelPlayTab').onclick = () => selectEditor(false);
$('peelSettingsTab').onclick = () => selectEditor(true);
for (const id of ['peelPlayTab','peelSettingsTab']) $(id).onkeydown = e => {
  if (['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) { e.preventDefault(); selectEditor(e.key === 'End' || (e.key !== 'Home' && id === 'peelPlayTab'), true); }
};
$('peelAddPlayer').onclick = () => openMemberDraw();
function openMemberDraw(name = '', title = '새 멤버 추가') {
  if (busy || memberDrawing || blocked || summarize(state).clear) return;
  $('peelMemberTitle').textContent = title;
  $('peelNewName').value = name; $('peelNewName').disabled = false; $('peelNewName').setCustomValidity('');
  $('peelMemberResult').textContent = '0 ~ 5판';
  $('peelMemberDraw').hidden = false; $('peelMemberDraw').disabled = false;
  $('peelMemberClose').disabled = false; $('peelMemberDone').hidden = true;
  $('peelMemberWheel').style.transition = 'none'; $('peelMemberWheel').style.transform = 'rotate(0deg)';
  memberOpener = document.activeElement; memberPanelOpen = true; render(); $('peelNewName').focus();
}
$('peelNewName').oninput = () => $('peelNewName').setCustomValidity('');
$('peelMemberDrawForm').onsubmit = async e => {
  e.preventDefault(); if (busy || memberDrawing || blocked || summarize(state).clear) return;
  const name = $('peelNewName').value.trim(), fixed = false;
  if (!name) { $('peelNewName').setCustomValidity('이름을 입력해주세요.'); $('peelNewName').reportValidity(); return; }
  const outcome = drawMemberRounds(name), rounds = outcome?.rounds ?? 0, token = ++generation;
  memberDrawing = true; notice(''); render();
  for (const id of ['peelNewName','peelMemberDraw','peelMemberClose']) $(id).disabled = true;
  const wheel = $('peelMemberWheel'), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  void wheel.offsetWidth;
  wheel.style.transition = reduced ? 'none' : 'transform 3.2s cubic-bezier(.12,.74,.16,1)';
  wheel.style.transform = `rotate(${outcome ? 1800-rounds*60 : 1830}deg)`;
  await sleep(reduced ? 0 : 3200);
  if (token !== generation) return;
  memberDrawing = false; if (outcome) commit(outcome); else render();
  $('peelMemberResult').textContent = outcome ? `${name}님 +${rounds}판${summarize(state).members.find(m=>m.name===name)?.waiting ? ' · 대기' : ''}` : '룰렛 고장!\n다음 기회에';
  $('peelSupportResult').textContent = outcome ? `${name}님 +${rounds}판 · 멤버에 등록했어요.` : '';
  $('peelMemberDraw').hidden = true; $('peelMemberClose').disabled = false; $('peelMemberDone').hidden = false; $('peelMemberDone').focus();
};
function closeMemberDraw() {
  if (memberDrawing) return;
  memberPanelOpen = false; render(); memberOpener?.focus();
}
$('peelMemberClose').onclick = $('peelMemberDone').onclick = closeMemberDraw;
$('peelMemberPanel').addEventListener('keydown', e => { if(e.key === 'Escape') { e.preventDefault(); closeMemberDraw(); } });
$('peelRoundForm').onsubmit = async e => {
  e.preventDefault(); const s = summarize(state); if (busy || memberDrawing || blocked || s.clear || !s.started) return;
  const players = roundDraft.filter(p => p.name.trim() || p.kills !== '').map(p => ({name:p.name.trim(),kills:p.kills === '' ? 0 : Number(p.kills)}));
  const kills = players.reduce((n,p)=>n+p.kills,0);
  try { validatePeel({version:1,events:[...state.events,{type:'round',kills,players}]}); }
  catch { notice('이름은 중복 없이, 킬은 0~10,000의 정수로 입력해주세요. 한 판 합계는 10,000킬까지예요.'); return; }
  notice(''); const token = ++generation;
  await applyAnimated({type:'round',kills,players}, token);
  if (token !== generation) return;
  roundDraft = null; knownActive.clear(); render();
  $('peelEquation').textContent = fmt(s.remaining) + ' − ' + kills + ' = ' + fmt(summarize(state).remaining) + '킬';
};
$('peelResetRounds').onclick = () => {
  if (busy || memberDrawing || blocked || !summarize(state).started) return;
  $('peelProgressResetDialog').returnValue = '';
  $('peelProgressResetDialog').showModal();
};
$('peelProgressResetDialog').addEventListener('close', () => {
  if ($('peelProgressResetDialog').returnValue !== 'confirm' || busy || memberDrawing || blocked) return;
  state = resetPeelProgress(state); roundDraft = null; knownActive.clear();
  displayedTarget = null; spinPhase = 'idle'; $('peelCurrent').classList.remove('counting','target-land');
  $('peelSupportResult').textContent = ''; save(); render(); notice('판 기록을 초기화했어요.');
});
window.addEventListener('storage', e => {
  if (e.key !== PEEL_KEY) return;
  if ($('peelProgressResetDialog').open) $('peelProgressResetDialog').close('cancel');
  try { const incoming = e.newValue ? validatePeel(JSON.parse(e.newValue)) : emptyPeel(); generation++; spinPhase = 'idle'; wakeReel?.(); busy = false; memberDrawing = false; memberPanelOpen = false; displayedTarget = null; $('peelCurrent').classList.remove('counting'); blocked = false; state = incoming; roundDraft = null; knownActive.clear(); document.querySelectorAll('.peel-reel').forEach(el=>el.classList.remove('rolling')); render(); $('peelEquation').textContent = '다른 창의 기록을 반영했어요.'; }
  catch { notice('다른 창의 기록을 읽지 못했어요.'); }
});
window.addEventListener('beforeunload', e => { if (busy || memberDrawing || failed) { e.preventDefault(); e.returnValue = ''; } });
new ResizeObserver(() => paintTarget(displayedTarget ?? summarize(state).remaining)).observe(document.querySelector('.peel-studio'));
window.addEventListener('resize', () => paintTarget(displayedTarget ?? summarize(state).remaining));
render();
