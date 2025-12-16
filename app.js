/* Interactive per-character simulator with Goddess of Weapons & Heaven's Punishment */
const statusDefinitions = {
  bleed: { key:'bleed', name:'Bleed', stackable:true, defaultDuration:2, trigger:'start', description:'-1 HP/turn per stack' },
  broken: { key:'broken', name:'Broken', stackable:true, defaultDuration:2, trigger:'start', description:'-2 HP/turn per stack and -1 dice/stack' },
  burn: { key:'burn', name:'Burn', stackable:true, defaultDuration:1, trigger:'start', description:'-2 HP/turn per stack' },
  poison: { key:'poison', name:'Poison', stackable:true, defaultDuration:2, trigger:'start', description:'-1% current HP/turn per stack' },
  mark_of_sin: { key:'mark_of_sin', name:'Mark of Sin', stackable:true, defaultDuration:0, trigger:'start', description:'-1 HP per stack/turn' },
  regen: { key:'regen', name:'Regen', stackable:true, defaultDuration:1, trigger:'start', description:'+3 HP at start-of-turn' },
  shield: { key:'shield', name:'Shield', stackable:false, defaultDuration:0, trigger:'start', description:'absorbs damage before HP' },
  injury: { key:'injury', name:'Injury', stackable:false, defaultDuration:1, trigger:'start', description:'Prevents bleed countdown decrement' },
  fear: { key:'fear', name:'Fear', stackable:true, defaultDuration:2, trigger:'start', description:'+5% dmg taken and -10% dmg dealt' },
  goddess_form: { key:'goddess_form', name:"Goddess Form", stackable:false, defaultDuration:2, trigger:'start', description:'Active goddess of weapons (2 turns)' },
  moral: { key:'moral', name:'Moral', stackable:true, defaultDuration:0, trigger:'start', description:'+1 heal per stack at start-of-turn; converted to Mark of Sin when goddess ends' }
};

let characters = []; // {id,name,hp,maxHp,shield,statuses:[],x,y,team,dead:boolean}
let activeIndex = null;
let gridSize = 8;
let moveMode = false;

function $(id){return document.getElementById(id)}
function log(s){ $('log').textContent += s + '\n'; $('log').scrollTop = $('log').scrollHeight }

function init(){
  $('addCharBtn').addEventListener('click', () => {
    const n = $('charName').value.trim() || ('Char' + (characters.length+1));
    const hp = Math.max(1, parseInt($('charHp').value || '100',10));
    const team = $('charTeam').value || 'ally';
    addCharacter(n, hp, team);
    $('charName').value = '';
  });
  $('grid').addEventListener('click', gridClickHandler);
  $('attackBtn').addEventListener('click', handleAttack);
  $('moveBtn').addEventListener('click', () => {
    if(activeIndex === null) return alert('Select an active character');
    moveMode = true;
    $('moveBtn').classList.add('hidden'); $('cancelMoveBtn').classList.remove('hidden');
    log('Move mode: click a grid cell within range to move.');
  });
  $('cancelMoveBtn').addEventListener('click', () => { moveMode = false; $('moveBtn').classList.remove('hidden'); $('cancelMoveBtn').classList.add('hidden'); log('Move cancelled.'); });
  $('endTurnBtn').addEventListener('click', endTurn);
  $('nextTurnBtn').addEventListener('click', nextTurn);
  $('startGoddessBtn').addEventListener('click', startGoddessForActive);
  $('heavenBtn').addEventListener('click', triggerHeavenPunishment);
  $('simulateBtn')?.addEventListener('click', simulateBatch); // optional batch sim if present
  $('effectSearch').addEventListener('input', renderEffectResults);

  renderGrid();
  renderEffectResults();
  log('Ready. Add characters to start.');
}

function addCharacter(name, hp, team='ally'){
  const id = Date.now() + Math.random();
  const placed = { x: characters.length % gridSize, y: Math.floor(characters.length / gridSize) };
  characters.push({ id, name, hp, maxHp:hp, shield:0, statuses:[], x:placed.x, y:placed.y, team, dead:false });
  if(activeIndex === null) activeIndex = 0;
  renderAll();
  log(`Added ${name} HP:${hp} team:${team} at (${placed.x},${placed.y})`);
}

function renderAll(){ renderChars(); renderGrid(); renderActionPanel(); }

function renderChars(){
  const list = $('charList'); list.innerHTML = '';
  characters.forEach((c, i) => {
    const card = document.createElement('div'); card.className = 'char-card' + (i===activeIndex ? ' active' : '');
    const moral = (c.statuses.find(s=>s.type==='moral')||{stacks:0}).stacks;
    const mark = (c.statuses.find(s=>s.type==='mark_of_sin')||{stacks:0}).stacks;
    card.innerHTML = `<strong>${c.name}</strong>
      <div class="meta">Team: ${c.team}</div>
      <div class="meta">HP: ${c.hp}${c.maxHp?'/'+c.maxHp:''} ${c.shield? ' Shield:'+c.shield:''}</div>
      <div class="meta">Pos: (${c.x},${c.y})</div>
      <div class="meta">Statuses: ${c.statuses.map(s=>s.type+'x'+s.stacks).join(', ')||'—'}</div>
      <div class="meta">Moral: ${moral} ${mark>0? `<span class="mark-badge-inline">M:${mark}</span>` : ''}</div>
      <div class="buttons-row"><button data-index="${i}" class="selectBtn">${i===activeIndex?'Active':'Set Active'}</button> <button data-index="${i}" class="removeChar">Remove</button></div>`;
    list.appendChild(card);
  });
  list.querySelectorAll('.selectBtn').forEach(b => b.addEventListener('click', e => { activeIndex = parseInt(e.target.dataset.index,10); renderAll(); }));
  list.querySelectorAll('.removeChar').forEach(b => b.addEventListener('click', e => { characters.splice(parseInt(e.target.dataset.index,10),1); if(activeIndex>=characters.length) activeIndex = characters.length -1; if(characters.length===0) activeIndex = null; renderAll(); }));
}

function renderGrid(){
  const grid = $('grid'); grid.innerHTML = '';
  for(let y=0;y<gridSize;y++){
    for(let x=0;x<gridSize;x++){
      const cell = document.createElement('div'); cell.className = 'cell'; cell.dataset.x = x; cell.dataset.y = y;
      const c = characters.find(ch => ch.x === x && ch.y === y && !ch.dead);
      if(c){
        cell.classList.add('char');
        cell.textContent = c.name[0] || 'C';
        cell.title = `${c.name}\nHP:${c.hp}${c.shield? ' Shield:'+c.shield : ''}`;
        if(characters.indexOf(c)===activeIndex) cell.classList.add('target');
        // Mark-of-Sin badge on grid
        const markStacks = (c.statuses.find(s => s.type === 'mark_of_sin') || { stacks: 0 }).stacks;
        if(markStacks > 0){
          const badge = document.createElement('div');
          badge.className = 'mark-badge';
          badge.textContent = markStacks;
          cell.appendChild(badge);
        }
      } else {
        cell.textContent = `${x},${y}`;
      }
      grid.appendChild(cell);
    }
  }
}

function gridClickHandler(e){
  const cell = e.target.closest('.cell'); if(!cell) return;
  const x = parseInt(cell.dataset.x,10), y = parseInt(cell.dataset.y,10);
  if(moveMode && activeIndex !== null){
    const ch = characters[activeIndex]; const maxr = Math.max(1, parseInt($('moveRange').value || '3',10));
    const dist = Math.abs(ch.x - x) + Math.abs(ch.y - y);
    if(dist <= maxr){ ch.x = x; ch.y = y; log(`${ch.name} moved to (${x},${y})`); moveMode=false; $('moveBtn').classList.remove('hidden'); $('cancelMoveBtn').classList.add('hidden'); renderAll(); return; }
    alert('Out of range.');
    return;
  }
  const targetChar = characters.find(ch => ch.x===x && ch.y===y && !ch.dead);
  if(targetChar && activeIndex !== null){ $('attackTarget').value = targetChar.id; log(`Selected ${targetChar.name} as attack target.`); }
}

function handleAttack(){
  if(activeIndex===null) return alert('No active character');
  const attacker = characters[activeIndex];
  const targetId = $('attackTarget').value; if(!targetId) return alert('Choose a target');
  const dmg = Math.max(0, parseInt($('attackDmg').value || '0',10));
  const target = characters.find(c=>String(c.id)===String(targetId));
  if(!target) return alert('Invalid target');
  // apply base damage
  applyDamageToCharacter(target, dmg, `Attacked by ${attacker.name}`);
  // weapon effects
  const weapon = $('weaponChoice').value;
  const attackerMoral = (attacker.statuses.find(s=>s.type==='moral')||{stacks:0}).stacks;
  const targetMark = (target.statuses.find(s=>s.type==='mark_of_sin')||{stacks:0}).stacks;
  if(weapon === 'longsword' && attackerMoral>0){
    addStatusToCharacter(target, 'mark_of_sin', attackerMoral, 0);
    log(`${attacker.name} (longsword) applied Mark of Sin x${attackerMoral} to ${target.name}.`);
  } else if(weapon === 'spear' && attackerMoral>0){
    const count = attackerMoral;
    if(confirm(`Roll ${count} d4 automatically for spear extra damage?`)){
      let roll = 0; for(let i=0;i<count;i++) roll += (1 + Math.floor(Math.random()*4));
      applyDamageToCharacter(target, roll, `Spear extra (${count}d4 = ${roll})`);
    } else {
      const total = parseInt(prompt(`Enter total of ${count} d4 dice (sum):`, '0')||'0',10);
      applyDamageToCharacter(target, Math.max(0,total), `Spear extra manual`);
    }
  } else if(weapon === 'dagger'){
    addStatusToCharacter(attacker, 'moral', 2, 0);
    log(`${attacker.name} (dagger) gains +2 Moral.`);
  } else if(weapon === 'shortgun' && targetMark>0){
    const count = targetMark;
    if(confirm(`Roll ${count} d4 automatically for shortgun extra?`)){
      let roll=0; for(let i=0;i<count;i++) roll += (1 + Math.floor(Math.random()*4));
      applyDamageToCharacter(target, roll, `Shortgun extra (${count}d4 = ${roll})`);
    } else {
      const total = parseInt(prompt(`Enter total of ${count} d4 dice (sum):`, '0')||'0',10);
      applyDamageToCharacter(target, Math.max(0,total), `Shortgun extra manual`);
    }
  }
  // if target got attacked and has moral, it gains +1 moral (user rule)
  const targetMoral = (target.statuses.find(s=>s.type==='moral')||{stacks:0});
  if(targetMoral.stacks > 0){
    addStatusToCharacter(target, 'moral', 1, 0);
    log(`${target.name} had Moral and gains +1 Moral when attacked.`);
  }
  renderAll();
}

function applyDamageToCharacter(target, amount, reason=''){
  if(amount<=0) return;
  if(target.shield && target.shield>0){ const s = Math.min(amount, target.shield); target.shield -= s; amount -= s; log(`${target.name} shield absorbed ${s}.`); }
  if(amount>0){ target.hp -= amount; log(`${target.name} took ${amount} damage${reason? ' ('+reason+')':''}. HP=${target.hp}`); if(target.hp<=0){ target.dead=true; target.hp=0; log(`${target.name} is unconscious/dead.`); target.statuses=[]; } }
}

function addStatusToCharacter(char, type, stacks=1, duration=null){
  const def = statusDefinitions[type]; if(!def) { alert('Unknown status: '+type); return; }
  if(!def.stackable){ char.statuses = char.statuses.filter(s=>s.type !== type); }
  const entry = { id: Date.now()+Math.random(), type, stacks, duration: (duration===null?def.defaultDuration:duration), meta:{} };
  if(type==='shield'){ const val = parseInt(prompt('Enter shield amount','20')||'0',10); char.shield += Math.max(0,val); log(`${char.name} gained shield ${val}.`); }
  char.statuses.push(entry);
}

function startGoddessForActive(){
  if(activeIndex===null) return alert('Select active character');
  const ch = characters[activeIndex];
  const heads = Math.max(0, parseInt($('goddessHeads').value || '0',10));
  addStatusToCharacter(ch, 'goddess_form', 1, 2);
  if(heads>0) addStatusToCharacter(ch, 'moral', heads, 0);
  $('goddessInfo').textContent = `${ch.name} gained Goddess Form (2 turns) and Moral x${heads}.`;
  log(`${ch.name} started Goddess of Weapons with ${heads} heads (moral +${heads}).`);
  renderAll();
}

function triggerHeavenPunishment(){
  if(activeIndex===null) return alert('Select active caster');
  const caster = characters[activeIndex];
  const base = Math.max(0, parseInt($('hpEventDmgLocal').value || '0',10));
  const targets = characters.filter(c=>c.id!==caster.id && !c.dead).map(c => {
    return { char:c, mark:(c.statuses.find(s=>s.type==='mark_of_sin')||{stacks:0}).stacks };
  }).sort((a,b)=>b.mark - a.mark).slice(0,2).map(x=>x.char);
  if(targets.length===0) return alert('No valid targets for Heaven\'s Punishment.');
  log(`${caster.name} triggers Heaven's Punishment (base ${base}) on ${targets.map(t=>t.name).join(', ')}`);
  for(const t of targets){
    if(t.dead) continue;
    let dmg = base;
    const markStacks = (t.statuses.find(s=>s.type==='mark_of_sin')||{stacks:0}).stacks;
    const inj = t.statuses.some(s=>s.type==='injury');
    if(t.team === caster.team){
      const half = Math.floor(dmg/2);
      applyDamageToCharacter(t, half, `Heaven's Punishment (teammate half)`);
      const enemiesWithMark = characters.filter(c=>c.team !== caster.team && (c.statuses.find(s=>s.type==='mark_of_sin')||{stacks:0}).stacks>0);
      if(enemiesWithMark.length>0){
        const per = Math.floor((dmg-half)/enemiesWithMark.length);
        enemiesWithMark.forEach(e => applyDamageToCharacter(e, per, `Heaven's Punishment (split)`));
      }
      continue;
    }
    if(inj) { dmg = Math.ceil(dmg * 1.2); log(`${t.name} has Injury: +20% dmg`); }
    if(markStacks >= 5){ dmg = Math.ceil(dmg * (1 + 0.10 * markStacks)); log(`${t.name} has ${markStacks} Mark(s) => +${10*markStacks}% dmg`); }
    applyDamageToCharacter(t, dmg, `Heaven's Punishment (enemy)`);
    if(markStacks >= 3){
      const splash = Math.floor(dmg * 0.5);
      log(`${t.name} had ${markStacks} marks -> explosion ${splash} to nearby and clearing marks.`);
      characters.forEach(c => {
        if(c.id===t.id || c.dead) return;
        const dist = Math.abs(c.x - t.x) + Math.abs(c.y - t.y);
        if(dist <= 1) applyDamageToCharacter(c, splash, `Mark explosion from ${t.name}`);
      });
      t.statuses = t.statuses.filter(s => s.type !== 'mark_of_sin');
    }
  }
  renderAll();
}

function endTurn(){ nextTurn(); }

function nextTurn(){
  if(characters.length===0){ activeIndex = null; renderAll(); return; }
  if(activeIndex===null) activeIndex = 0; else activeIndex = (activeIndex + 1) % characters.length;
  let tries = 0;
  while(characters[activeIndex] && characters[activeIndex].dead && tries < characters.length){ activeIndex = (activeIndex +1) % characters.length; tries++; }
  const ch = characters[activeIndex];
  if(ch){
    const moral = ch.statuses.find(s=>s.type==='moral');
    if(moral && moral.stacks>0){ applyHealToCharacter(ch, moral.stacks, 'Moral heal at start-of-turn'); }
    const gf = ch.statuses.find(s=>s.type==='goddess_form');
    if(gf){
      gf.duration -=1;
      if(gf.duration <=0){
        const moralSt = (ch.statuses.find(s=>s.type==='moral')||{stacks:0}).stacks;
        if(moralSt > 0){
          const enemies = characters.filter(c=>c.team !== ch.team && !c.dead);
          if(enemies.length>0){
            let best = enemies[0]; let bestD = Math.abs(best.x-ch.x)+Math.abs(best.y-ch.y);
            for(const e of enemies.slice(1)){ const d = Math.abs(e.x-ch.x)+Math.abs(e.y-ch.y); if(d < bestD){ best = e; bestD = d; } }
            addStatusToCharacter(best, 'mark_of_sin', moralSt, 0);
            log(`Goddess ended: ${moralSt} Moral converted to Mark of Sin on ${best.name}.`);
          } else {
            log('Goddess ended: no enemies to convert Moral into Mark of Sin.');
          }
        }
        ch.statuses = ch.statuses.filter(s => s.type !== 'goddess_form' && s.type !== 'moral');
        log(`${ch.name}'s Goddess Form ended.`);
      }
    }
  }
  renderAll();
  log(`It's now ${characters[activeIndex] ? characters[activeIndex].name+"'s" : 'no one'} turn.`);
}

function simulateBatch(){
  $('log').textContent = '';
  const turns = Math.max(1, parseInt($('turns').value || '3',10));
  for(let t=1;t<=turns;t++){
    log(`\n-- Batch Turn ${t} start`);
    for(const ch of characters){
      if(ch.dead) continue;
      const moral = ch.statuses.find(s=>s.type==='moral');
      if(moral && moral.stacks>0) applyHealToCharacter(ch, moral.stacks, 'Moral heal start-of-turn');
      for(const s of ch.statuses.slice()){
        if(s.type === 'bleed') applyDamageToCharacter(ch, s.stacks*1, `Bleed x${s.stacks}`);
        if(s.type === 'broken') applyDamageToCharacter(ch, s.stacks*2, `Broken x${s.stacks}`);
        if(s.type === 'burn') applyDamageToCharacter(ch, s.stacks*2, `Burn x${s.stacks}`);
        if(s.type === 'poison'){ const dmg = Math.max(1, Math.floor((ch.hp * (1*s.stacks))/100)); applyDamageToCharacter(ch, dmg, `Poison ${1*s.stacks}%`); }
        if(s.type === 'regen') applyHealToCharacter(ch, 3*s.stacks, `Regen`);
        if(s.duration > 0){
          const hasInjury = ch.statuses.some(x => x.type === 'injury' && x.duration > 0);
          if(!(s.type === 'bleed' && hasInjury)) s.duration -= 1;
          else log(`${ch.name}: Bleed duration paused by Injury.`);
          if(s.duration <= 0){ ch.statuses = ch.statuses.filter(x => x.id !== s.id); log(`${ch.name}: ${s.type} expired.`); }
        }
      }
      const gf = ch.statuses.find(s=>s.type==='goddess_form');
      if(gf){
        gf.duration -= 1;
        if(gf.duration <= 0){
          const moralSt = (ch.statuses.find(s=>s.type==='moral')||{stacks:0}).stacks;
          if(moralSt > 0){
            const enemies = characters.filter(c => c.team !== ch.team && !c.dead);
            if(enemies.length>0){
              let best = enemies[0]; let bestD = Math.abs(best.x-ch.x)+Math.abs(best.y-ch.y);
              for(const e of enemies.slice(1)){ const d = Math.abs(e.x-ch.x)+Math.abs(e.y-ch.y); if(d < bestD){ best = e; bestD = d; } }
              addStatusToCharacter(best, 'mark_of_sin', moralSt, 0);
              log(`Goddess ended (batch): ${moralSt} Moral -> Mark of Sin on ${best.name}.`);
            }
          }
          ch.statuses = ch.statuses.filter(s => s.type !== 'goddess_form' && s.type !== 'moral');
          log(`${ch.name}'s Goddess Form ended (batch).`);
        }
      }
    }
    log(`-- Batch Turn ${t} end`);
  }
  renderAll();
}

function applyHealToCharacter(ch, amount, reason=''){
  if(amount<=0) return;
  if(ch.maxHp){
    const space = Math.max(0, ch.maxHp - ch.hp); const toHp = Math.min(space, amount); ch.hp += toHp; const left = amount - toHp;
    if(toHp>0) log(`${ch.name} healed ${toHp} HP (${reason}).`);
    if(left>0){ ch.shield += left; log(`${ch.name} excess heal ${left} -> shield.`); }
  } else { ch.hp += amount; log(`${ch.name} healed ${amount} HP (${reason}).`); }
}

function renderActionPanel(){
  const panel = $('actionButtons');
  const info = $('activeInfo');
  if(activeIndex === null || !characters[activeIndex]){ info.textContent = 'No active character selected.'; panel.classList.add('hidden'); return; }
  const ch = characters[activeIndex];
  info.innerHTML = `<strong>${ch.name}</strong> &middot; HP: ${ch.hp}${ch.maxHp?'/'+ch.maxHp:''} ${ch.shield? ' Shield:'+ch.shield:''}<br><small>Team: ${ch.team} — Statuses: ${ch.statuses.map(s=>s.type+'x'+s.stacks).join(', ') || '—'}</small>`;
  panel.classList.remove('hidden');
  const sel = $('attackTarget'); sel.innerHTML = '<option value="">Select target</option>'; characters.forEach(c=>{ if(c.id!==ch.id && !c.dead){ const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.name + ' (HP:'+c.hp+')'; sel.appendChild(opt);} });
  const gf = ch.statuses.find(s=>s.type==='goddess_form'); const moral = (ch.statuses.find(s=>s.type==='moral')||{stacks:0}).stacks;
  $('goddessInfo').textContent = gf ? `Goddess active (${gf.duration} turns left). Moral: ${moral}` : `No Goddess active. Moral: ${moral}`;
}

document.addEventListener('DOMContentLoaded', init);