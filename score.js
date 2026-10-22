export const MAPS = ['맵 선택','에란겔','미라마','론도','데스텐','사녹','태이고','비켄디'];
export const STORAGE_KEY = 'kimhani-live:v1';
export const emptyRound = () => ({map:'맵 선택',players:Array.from({length:4},()=>({kills:'',damage:'',dead:false})),bonus:true,chicken:false});
export const defaultState = () => ({version:1,config:{target:70,names:['하니','으리','잉수','숙자'],penalties:[100,100,100,0]},rounds:Array.from({length:60},emptyRound),selected:0});
const number = v => Number(v || 0);
export function scoreRound(round, penalties) {
  let kills=0,rawDamage=0,damage=0,death=0;
  round.players.forEach((p,i)=>{kills+=number(p.kills);rawDamage+=number(p.damage);damage+=Math.floor(number(p.damage)/100);death-=p.dead?Math.abs(penalties[i])/100:0;});
  const bonus=Math.floor(rawDamage/100)-damage,chicken=round.chicken?(round.map==='사녹'?5:8):0;
  return {kills,damage,death,bonus,chicken,total:Math.round((kills+damage+death+(round.bonus?bonus:0)+chicken)*100)/100};
}
export function totals(state) {
  let score=0;const members=Array.from({length:4},()=>({killDamage:0,death:0,total:0}));
  state.rounds.forEach(r=>{score+=scoreRound(r,state.config.penalties).total;r.players.forEach((p,i)=>{members[i].killDamage+=number(p.kills)+Math.floor(number(p.damage)/100);members[i].death+=p.dead?Math.floor(-Math.abs(state.config.penalties[i])/100):0;});});
  members.forEach(m=>m.total=m.killDamage+m.death);return {score:Math.round(score*100)/100,members};
}
export function isUsed(r){return r.chicken||r.players.some(p=>p.kills!==''&&number(p.kills)!==0||p.damage!==''&&number(p.damage)!==0||p.dead);}
const finiteRange=(v,max,integer=false)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max&&(!integer||Number.isInteger(v));
export function validateState(s){
  if(!s||s.version!==1||!s.config||!finiteRange(s.config.target,1e9)||!Array.isArray(s.config.names)||s.config.names.length!==4||!s.config.names.every(n=>typeof n==='string'&&n.length<=40)||!s.config.names.some(n=>n.trim())||!Array.isArray(s.config.penalties)||s.config.penalties.length!==4||!s.config.penalties.every(n=>finiteRange(n,1e6))||!Number.isInteger(s.selected)||s.selected<0||s.selected>=60||!Array.isArray(s.rounds)||s.rounds.length!==60)throw new Error('저장된 기록의 형식을 확인할 수 없어요.');
  for(const r of s.rounds){if(!r||!MAPS.includes(r.map)||typeof r.bonus!=='boolean'||typeof r.chicken!=='boolean'||!Array.isArray(r.players)||r.players.length!==4||!r.players.every(p=>p&&typeof p.dead==='boolean'&&(p.kills===''||finiteRange(p.kills,1000,true))&&(p.damage===''||finiteRange(p.damage,1e6))))throw new Error('저장된 판 기록을 확인할 수 없어요.');}
  return s;
}
