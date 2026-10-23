import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyPeel, randomInt, calculate, summarize, validatePeel, resetPeelProgress} from '../peel-model.js';
const spin = (operand = 100, op = '+') => ({type:'spin',operand,op});
const support = (name,rounds,fixed = false) => ({type:'support',name,rounds,fixed});
const round = kills => ({type:'round',kills});
test('전체 판 초기화는 진행 기록을 비우고 멤버와 현재 참가 설정을 보존한다', () => {
  const state={version:1,events:[spin(),{type:'member',name:'A',remaining:999,fixed:false},support('A',5),support('고정',0,true),{type:'round',kills:101,players:[{name:'A',kills:100},{name:'고정',kills:1}]}]};
  const before=JSON.stringify(state), reset=resetPeelProgress(state), s=summarize(validatePeel(reset));
  assert.equal(JSON.stringify(state),before); assert.equal(s.remaining,'0'); assert.equal(s.started,false); assert.equal(s.clear,false); assert.equal(s.rounds,0); assert.equal(s.kills,0); assert.equal(s.history.length,0);
  assert.equal(s.members[0].remaining,1003); assert.equal(s.members[0].personalKills,0); assert.equal(s.members[0].rounds,0); assert.equal(s.members[1].fixed,true);
});
test('첫 슬롯은 숫자를 대입하고 이후 사칙연산과 정수 나눗셈을 적용한다', () => {
  assert.equal(summarize({events:[spin(20,'×')]}).remaining,'20');
  assert.equal(calculate('70','+',20),'90'); assert.equal(calculate('70','−',20),'50');
  assert.equal(calculate('70','×',20),'1400'); assert.equal(calculate('70','÷',20),'3');
  assert.equal(calculate('9007199254740993','×',100),'900719925474099300');
});
test('0에서는 종료하지 않고 다음 슬롯으로 다시 시작하며 음수에서만 종료한다', () => {
  const state=emptyPeel(); state.events.push(spin(20),round(20));
  assert.equal(summarize(state).clear,false); assert.equal(summarize(state).remaining,'0');
  state.events.push(spin(30,'÷')); assert.equal(summarize(state).remaining,'30');
  state.events.push(spin(40,'−')); assert.equal(summarize(state).clear,true);
});
test('경기 저장이 모든 일반 참가자의 판수를 줄이고 2→1 막판, 1→0 종료를 만든다', () => {
  const state={events:[spin(),support('하니',2),support('고정',0,true)]};
  state.events.push(round(7)); let s=summarize(state);
  assert.equal(s.remaining,'93'); assert.equal(s.members[0].remaining,1); assert.equal(s.members[0].kills,7);
  state.events.push(round(3)); s=summarize(state);
  assert.equal(s.members[0].remaining,0); assert.equal(s.members[0].rounds,2); assert.equal(s.members[0].kills,10);
  state.events.push(round(4)); s=summarize(state);
  assert.equal(s.members[0].kills,10); assert.equal(s.members[1].kills,14); assert.equal(s.members[1].rounds,3);
});
test('0킬 경기에도 판수는 줄며 0판 후원자는 참가하지 않고 같은 이름은 누적된다', () => {
  const state={events:[spin(),support('A',0),support('B',1),round(0),support('B',2),support('B',3)]};
  const s=summarize(state); assert.equal(s.members[0].rounds,0); assert.equal(s.members[1].remaining,5); assert.equal(s.members[1].rounds,1);
});
test('고정참가는 무제한이고 해제하면 남은 일반 판수로 돌아간다', () => {
  const state={events:[spin(),support('A',1,true),round(1),round(2),{type:'fixed',name:'A',fixed:false},round(3)]};
  const m=summarize(state).members[0]; assert.equal(m.remaining,0); assert.equal(m.rounds,3); assert.equal(m.kills,6);
});
test('마지막 경기 취소 시 목표, 참가 명단, 누적 기록이 함께 복원된다', () => {
  const state={events:[spin(20),support('A',1)]}; const before=summarize(state);
  state.events.push(round(21)); assert.equal(summarize(state).clear,true);
  state.events.pop(); assert.deepEqual(summarize(state),before);
});
test('랜덤 값의 양 끝인 20·100과 0·5를 포함한다', () => {
  assert.equal(randomInt(20,100,()=>0),20); assert.equal(randomInt(20,100,()=>.999999),100);
  assert.equal(randomInt(0,5,()=>0),0); assert.equal(randomInt(0,5,()=>.999999),5);
});
test('새로고침 기록을 보존하고 잘못된 입력과 종료 후 기록을 거부한다', () => {
  const state={version:1,events:[spin(),support('A',3),round(5)]}; assert.deepEqual(validatePeel(JSON.parse(JSON.stringify(state))),state);
  for (const events of [[round(1)],[spin(19)],[spin(101)],[spin(),round(-1)],[spin(),round(1.2)],[support('',1)],[support('A',6)],[spin(20),round(21),round(1)]]) assert.throws(()=>validatePeel({version:1,events}));
});
test('개인 킬 합계를 한 번만 차감하고 실제 참가자의 판수만 줄인다', () => {
  const state={version:1,events:[spin(),support('하니',2),support('잉수',1),support('대기',3),{type:'round',kills:7,players:[{name:'하니',kills:3},{name:'잉수',kills:4}]}]};
  assert.deepEqual(validatePeel(state),state);
  const s=summarize(state); assert.equal(s.remaining,'93'); assert.equal(s.rounds,1); assert.equal(s.kills,7);
  const [a,b,c]=s.members; assert.equal(a.remaining,1); assert.equal(b.remaining,0); assert.equal(c.remaining,3);
  assert.equal(a.personalKills,3); assert.equal(b.personalKills,4); assert.equal(a.kills,7); assert.equal(b.kills,7); assert.equal(c.rounds,0);
});
test('기존 공동 킬 기록은 보존하고 신규 개인 킬과 구분한다', () => {
  const state={version:1,events:[spin(),support('하니',3),round(5),{type:'round',kills:2,players:[{name:'하니',kills:2}]}]};
  const m=summarize(validatePeel(JSON.parse(JSON.stringify(state)))).members[0];
  assert.equal(m.kills,7); assert.equal(m.personalKills,2); assert.equal(m.individualRounds,1); assert.equal(m.rounds,2);
  state.events.pop(); assert.equal(summarize(state).members[0].remaining,2);
});
test('직접 입력한 이름의 기록과 0킬 참가도 저장한다', () => {
  const state={version:1,events:[spin(),{type:'round',kills:3,players:[{name:'새 참가자',kills:3},{name:'0킬 참가',kills:0}]}]};
  const s=summarize(validatePeel(state)); assert.equal(s.remaining,'97'); assert.equal(s.members[1].rounds,1); assert.equal(s.members[0].remaining,0);
});
test('중복 이름, 개인 킬 오류, 합계 불일치와 빈 명단을 거부한다', () => {
  for (const players of [[],[{name:'A',kills:1},{name:' A ',kills:2}],[{name:'',kills:3}],[{name:'A',kills:-3}],[{name:'A',kills:1.5}],[{name:'A',kills:4}]]) assert.throws(()=>validatePeel({version:1,events:[spin(),{type:'round',kills:3,players}]}));
});

test('멤버 설정은 남은 판수를 지정하고 기존 킬 기록을 보존한다', () => {
  const events=[spin(),{type:'member',name:'하니',remaining:2,fixed:false},{type:'round',kills:3,players:[{name:'하니',kills:3}]},{type:'member',name:'하니',remaining:5,fixed:true}];
  const state=validatePeel({version:1,events}); const s=summarize(state);
  assert.equal(s.remaining,'97'); assert.equal(s.members[0].remaining,5); assert.equal(s.members[0].personalKills,3); assert.equal(s.members[0].rounds,1); assert.equal(s.members[0].fixed,true);
  state.events.pop(); assert.equal(summarize(state).members[0].remaining,1);
  for (const remaining of [-1,1.5,1000]) assert.throws(()=>validatePeel({version:1,events:[{type:'member',name:'A',remaining,fixed:false}]}));
});
