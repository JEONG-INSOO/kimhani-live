const games = ['kill', 'bingo', 'peel'];
const panels = {kill: 'studio', bingo: 'bingoStudio', peel: 'peelStudio'};
function select(name, focus = false) {
  for (const game of games) {
    const tab = document.getElementById(game + 'GameTab'), active = game === name;
    tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
    document.getElementById(panels[game]).hidden = !active;
  }
  if (focus) document.getElementById(name + 'GameTab').focus();
}
for (const name of games) document.getElementById(name + 'GameTab').onclick = () => select(name);
document.getElementById('gameTabs').onkeydown = e => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault(); const index = games.findIndex(name => document.getElementById(name + 'GameTab').getAttribute('aria-selected') === 'true');
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? games.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + games.length) % games.length;
  select(games[next], true);
};
