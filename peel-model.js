export const PEEL_KEY = 'kimhani-kill-peel-v1';
export const OPS = ['+', '−', '×', '÷'];
export const emptyPeel = () => ({version: 1, events: []});
export function randomInt(min, max, rng = Math.random) { return min + Math.floor(rng() * (max - min + 1)); }
export function calculate(value, op, operand) {
  const a = BigInt(value), b = BigInt(operand);
  if (op === '=') return String(b);
  if (op === '+') return String(a + b);
  if (op === '−') return String(a - b);
  if (op === '×') return String(a * b);
  if (op === '÷') return String(a / b);
  throw new Error('Unknown operation');
}
export function summarize(state) {
  let remaining = '0', started = false, rounds = 0, kills = 0;
  const members = new Map(), history = [];
  const member = name => {
    if (!members.has(name)) members.set(name, {name, remaining: 0, fixed: false, rounds: 0, kills: 0, granted: 0});
    return members.get(name);
  };
  for (const event of state.events) {
    if (event.type === 'support') {
      const m = member(event.name); m.remaining += event.rounds; m.granted += event.rounds;
      if (event.fixed) m.fixed = true;
    } else if (event.type === 'fixed') member(event.name).fixed = event.fixed;
    else if (event.type === 'spin') {
      const before = remaining, op = BigInt(remaining) === 0n ? '=' : event.op;
      remaining = calculate(remaining, op, event.operand); started = true;
      history.push({type: 'spin', before, op, operand: event.operand, after: remaining});
    } else if (event.type === 'round') {
      const participants = [...members.values()].filter(m => m.fixed || m.remaining > 0);
      for (const m of participants) { m.rounds++; m.kills += event.kills; if (!m.fixed) m.remaining--; }
      remaining = String(BigInt(remaining) - BigInt(event.kills)); rounds++; kills += event.kills;
      history.push({type: 'round', round: rounds, kills: event.kills, names: participants.map(m => m.name), after: remaining});
    }
  }
  return {remaining, started, clear: BigInt(remaining) < 0n, rounds, kills, members: [...members.values()], history};
}
export function validatePeel(raw) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.events)) throw new Error('잘못된 킬까기 기록');
  const events = raw.events.map(e => {
    if (!e || typeof e !== 'object') throw new Error('잘못된 기록');
    if (e.type === 'spin' && OPS.includes(e.op) && Number.isInteger(e.operand) && e.operand >= 20 && e.operand <= 100) return {type:e.type,op:e.op,operand:e.operand};
    if (e.type === 'round' && Number.isInteger(e.kills) && e.kills >= 0 && e.kills <= 10000) return {type:e.type,kills:e.kills};
    if (['support','fixed'].includes(e.type) && typeof e.name === 'string' && e.name.trim() && e.name.length <= 30 && typeof e.fixed === 'boolean') {
      if (e.type === 'fixed') return {type:e.type,name:e.name.trim(),fixed:e.fixed};
      if (Number.isInteger(e.rounds) && e.rounds >= 0 && e.rounds <= 5) return {type:e.type,name:e.name.trim(),rounds:e.rounds,fixed:e.fixed};
    }
    throw new Error('잘못된 기록');
  });
  let remaining = '0', started = false;
  for (const e of events) {
    if (BigInt(remaining) < 0n) throw new Error('종료 후 기록');
    if (e.type === 'spin') { remaining = calculate(remaining, BigInt(remaining) === 0n ? '=' : e.op, e.operand); started = true; }
    if (e.type === 'round') { if (!started) throw new Error('시작 전 경기'); remaining = String(BigInt(remaining) - BigInt(e.kills)); }
  }
  return {version:1,events};
}
