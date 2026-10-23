import test from 'node:test';
import assert from 'node:assert/strict';
import {alphabet, newBoard, newState, progress, validateBingo, SIZES} from '../bingo-model.js';
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
    assert.equal(progress(b,size).lines, 1); assert.equal(progress(b,size).clear, true);
    b.checked[line[0]] = false; assert.equal(progress(b,size).lines, 0); assert.equal(progress(b,size).clear, false);
  }
});
test('중복 교차점을 세지 않고 줄 수 목표와 전체 칸 목표를 구분한다', () => {
  const b = newBoard(3, 'alphabet'); b.goal = 2; [0,1,2].forEach(i => b.checked[i] = true); assert.equal(progress(b,3).clear,false);
  [3,6].forEach(i => b.checked[i] = true); assert.equal(progress(b,3).clear,true); assert.equal(progress(b,3).count,5);
  b.goal = 'all'; assert.equal(progress(b,3).clear,false); b.checked.fill(true); assert.equal(progress(b,3).lines,8); assert.equal(progress(b,3).clear,true);
  for (const size of SIZES) { const full = newBoard(size,'number'); full.checked.fill(true); assert.equal(progress(full,size).lines,size*2+2); }
});
test('8개 빙고판의 수정한 글자와 진행 상황은 독립적으로 보존된다', () => {
  const state = newState(); for(const size of SIZES) for(const mode of ['alphabet','number']) state.boards[`${size}-${mode}`] = newBoard(size,mode);
  state.boards['3-alphabet'].labels[0] = '하니'; state.boards['3-alphabet'].checked[0] = true;
  const restored=validateBingo(JSON.parse(JSON.stringify(state))); assert.deepEqual(restored,state); assert.equal(restored.boards['3-number'].checked[0],false);
});
test('손상된 저장 값과 유효하지 않은 목표를 거부한다', () => {
  assert.throws(()=>validateBingo(null));
  for (const mutation of [b=>b.checked[0]='true',b=>b.labels[0]='',b=>b.labels.pop(),b=>b.goal=9,b=>b.goal=0,b=>b.goal=1.5]) { const state=newState(); const b=newBoard(3,'alphabet'); state.boards['3-alphabet']=b; mutation(b); assert.throws(()=>validateBingo(state)); }
});
