import test from 'node:test';
import assert from 'node:assert/strict';
import {alphabet, newBoard, newState, progress, validateBingo, SIZES, shuffledLabels} from '../bingo-model.js';
test('모든 크기의 기본 글자와 숫자는 중복 없이 생성된다', () => {
  for (const size of SIZES) for (const mode of ['alphabet', 'number']) {
    const b = newBoard(size, mode); assert.equal(b.labels.length, size * size); assert.equal(new Set(b.labels).size, size * size); assert.equal(progress(b, size).clear, false);
  }
  assert.equal(alphabet(25), 'Z'); assert.equal(alphabet(26), 'AA'); assert.equal(alphabet(99), 'CV');
  assert.equal(newBoard(10, 'number').labels[99], '100');
});
test('가로, 세로, 양쪽 대각선은 각 크기에서 완성되고 취소된다', () => {
  for (const size of SIZES) for (const line of [Array.from({length:size},(_,i)=>i), Array.from({length:size},(_,i)=>i*size), Array.from({length:size},(_,i)=>i*(size+1)), Array.from({length:size},(_,i)=>(i+1)*(size-1))]) {
    const b = newBoard(size, 'number'); line.forEach(i => b.checked[i] = true);
    assert.equal(progress(b,size).lines, 1); assert.equal(progress(b,size).clear, false);
    b.checked[line[0]] = false; assert.equal(progress(b,size).lines, 0); assert.equal(progress(b,size).clear, false);
  }
});
test('모든 칸을 체크해야 완성되며 기존 줄 수 목표는 무시한다', () => {
  const b = newBoard(3, 'alphabet'); b.goal = 2; [0,1,2].forEach(i => b.checked[i] = true); assert.equal(progress(b,3).clear,false);
  [3,6].forEach(i => b.checked[i] = true); assert.equal(progress(b,3).clear,false); assert.equal(progress(b,3).count,5);
  b.goal = 'all'; assert.equal(progress(b,3).clear,false); b.checked.fill(true); assert.equal(progress(b,3).lines,8); assert.equal(progress(b,3).clear,true);
  for (const size of SIZES) { const full = newBoard(size,'number'); full.checked.fill(true); assert.equal(progress(full,size).lines,size*2+2); }
});
test('8개 빙고판의 수정한 글자와 진행 상황은 독립적으로 보존된다', () => {
  const state = newState(); for(const size of SIZES) for(const mode of ['alphabet','number']) state.boards[`${size}-${mode}`] = newBoard(size,mode);
  state.boards['3-alphabet'].labels[0] = '하니'; state.boards['3-alphabet'].checked[0] = true;
  const restored=validateBingo(JSON.parse(JSON.stringify(state))); assert.deepEqual(restored,state); assert.equal(restored.boards['3-number'].checked[0],false);
});
test('손상된 저장 값을 거부한다', () => {
  assert.throws(()=>validateBingo(null));
  for (const mutation of [b=>b.checked[0]='true',b=>b.labels[0]='',b=>b.labels.pop()]) { const state=newState(); const b=newBoard(3,'alphabet'); state.boards['3-alphabet']=b; mutation(b); assert.throws(()=>validateBingo(state)); }
});

test('Q/U와 숫자 전용 100빙고, 이전 기록의 목표를 마이그레이션한다', () => {
  for (const size of [3,4,5]) { const labels = newBoard(size,'alphabet').labels; assert.ok(labels.every(x => x === 'Q/U' || /^[A-PR-TV-Z]$/.test(x))); if(size === 5) { assert.ok(labels.includes('Z')); assert.ok(labels.includes('Q/U')); } }
  assert.equal(newBoard(10,'alphabet').labels[16], '17');
  const old = newState(); old.size=10; old.mode='alphabet';
  old.boards['5-alphabet']=newBoard(5,'alphabet'); old.boards['5-alphabet'].labels=Array.from({length:25},(_,i)=>alphabet(i)); old.boards['5-alphabet'].checked[16]=true; old.boards['5-alphabet'].goal=1;
  old.boards['10-number']=newBoard(10,'number'); old.boards['10-number'].checked[0]=true;
  const next=validateBingo(old); assert.equal(next.mode,'number'); assert.equal(next.boards['5-alphabet'].labels[20],'Z'); assert.equal(next.boards['5-alphabet'].labels[16],'Q/U'); assert.equal(next.boards['5-alphabet'].checked[16],true); assert.equal(next.boards['10-number'].checked[0],true); assert.equal('goal' in next.boards['5-alphabet'],false);
});

test('알파벳 풀은 Q/U와 Z를 포함한 25개이며 작은 판도 전체 풀에서 뽑는다', () => {
  const seen = new Set();
  for (const size of [3,4,5]) {
    for (let run=0; run<100; run++) {
      const b = newBoard(size,'alphabet');
      assert.equal(new Set(b.labels).size,size*size);
      assert.ok(!b.labels.includes('Q') && !b.labels.includes('U'));
      b.labels.forEach(x=>seen.add(x));
      if(size===5) { assert.ok(b.labels.includes('Q/U')); assert.ok(b.labels.includes('Z')); }
    }
  }
  assert.equal(seen.size,25);
});
test('저장된 U는 체크를 보존해 복구하고 재로딩해도 중복이 생기지 않는다', () => {
  const state=newState(); const b=newBoard(5,'alphabet'); b.labels=Array.from({length:25},(_,i)=>alphabet(i)); b.labels[16]='Q/U'; b.checked[20]=true;
  state.boards['5-alphabet']=b;
  const fixed=validateBingo(state);
  assert.equal(fixed.boards['5-alphabet'].labels[20],'Z');
  assert.equal(fixed.boards['5-alphabet'].checked[20],true);
  assert.equal(new Set(fixed.boards['5-alphabet'].labels).size,25);
  assert.deepEqual(validateBingo(fixed),fixed);
});

test('기존 A~I 판에서 글자 섞기는 전체 풀에서 다시 추첨한다', () => {
  for(const size of [3,4]) {
    const old={labels:Array.from({length:size*size},(_,i)=>alphabet(i)),checked:Array(size*size).fill(false)};
    const seen=new Set();
    for(let i=0;i<200;i++) { const labels=shuffledLabels(old,size,'alphabet'); assert.equal(new Set(labels).size,size*size); labels.forEach(x=>seen.add(x)); }
    assert.equal(seen.size,25); assert.ok(seen.has('Z')); assert.ok(seen.has('Q/U')); assert.ok(!seen.has('U'));
    const raw=newState();raw.boards[size+'-alphabet']=old;assert.equal(validateBingo(raw).boards[size+'-alphabet'].labels.length,size*size);
    old.labels[0]='하니';assert.deepEqual([...shuffledLabels(old,size,'alphabet')].sort(),[...old.labels].sort());
    old.checked[0]=true;assert.deepEqual(validateBingo(raw).boards[size+'-alphabet'].checked,old.checked);
  }
});
