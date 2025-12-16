/* Interactive per-character simulator with full Effect Management (Search / Add / Edit / Remove) */

/* =========================
   STATUS DEFINITIONS
========================= */
const statusDefinitions = {
  bleed: { key:'bleed', name:'Bleed', stackable:true, defaultDuration:2, trigger:'start', description:'-1 HP/turn per stack' },
  broken: { key:'broken', name:'Broken', stackable:true, defaultDuration:2, trigger:'start', description:'-2 HP/turn per stack and -1 dice/stack' },
  burn: { key:'burn', name:'Burn', stackable:true, defaultDuration:1, trigger:'start', description:'-2 HP/turn per stack' },
  poison: { key:'poison', name:'Poison', stackable:true, defaultDuration:2, trigger:'start', description:'-1% current HP/turn per stack' },
  mark_of_sin: { key:'mark_of_sin', name:'Mark of Sin', stackable:true, defaultDuration:0, trigger:'start', description:'-1 HP per stack/turn' },
  regen: { key:'regen', name:'Regen', stackable:true, defaultDuration:1, trigger:'start', description:'+3 HP/turn per stack' },
  shield: { key:'shield', name:'Shield', stackable:false, defaultDuration:0, trigger:'instant', description:'Absorb damage before HP' },
  injury: { key:'injury', name:'Injury', stackable:false, defaultDuration:1, trigger:'start', description:'Pause bleed duration' },
  fear: { key:'fear', name:'Fear', stackable:true, defaultDuration:2, trigger:'start', description:'+5% dmg taken, -10% dmg dealt' },
  goddess_form: { key:'goddess_form', name:'Goddess Form', stackable:false, defaultDuration:2, trigger:'start', description:'Goddess of Weapons (2 turns)' },
  moral: { key:'moral', name:'Moral', stackable:true, defaultDuration:0, trigger:'start', description:'+1 heal/stack, convert to Mark when goddess ends' }
};

/* =========================
   GLOBAL STATE
========================= */
let characters = [];
let activeIndex = null;
let gridSize = 8;
let moveMode = false;

/* =========================
   HELPERS
========================= */
const $ = id => document.getElementById(id);
const log = s => { $('log').textContent += s + '\n'; $('log').scrollTop = $('log').scrollHeight; };

/* =========================
   INIT
========================= */
function init(){
  $('addCharBtn').onclick = () => {
    const n = $('charName').value || `Char${characters.length+1}`;
    const hp = parseInt($('charHp').value||'100',10);
    const team = $('charTeam').value;
    addCharacter(n,hp,team);
  };

  $('grid').onclick = gridClickHandler;
  $('attackBtn').onclick = handleAttack;
  $('moveBtn').onclick = () => moveMode = true;
  $('cancelMoveBtn').onclick = () => moveMode = false;
  $('endTurnBtn').onclick = nextTurn;

  $('effectSearch').oninput = renderEffectResults;

  renderGrid();
  renderEffectResults();
  log('System ready.');
}

/* =========================
   CHARACTER MANAGEMENT
========================= */
function addCharacter(name,hp,team){
  characters.push({
    id:Date.now()+Math.random(),
    name,hp,maxHp:hp,shield:0,
    x:characters.length%gridSize,
    y:Math.floor(characters.length/gridSize),
    team,dead:false,statuses:[]
  });
  if(activeIndex===null) activeIndex=0;
  renderAll();
}

/* =========================
   EFFECT MANAGEMENT CORE
========================= */
function addStatusToCharacter(char,type,stacks=1,duration=null){
  const def = statusDefinitions[type];
  if(!def) return alert('Unknown effect');

  let existing = char.statuses.find(s=>s.type===type);

  if(existing && def.stackable){
    existing.stacks += stacks;
    if(existing.duration>0 && duration!==0)
      existing.duration = Math.max(existing.duration, duration ?? def.defaultDuration);
    return;
  }

  if(!def.stackable)
    char.statuses = char.statuses.filter(s=>s.type!==type);

  const entry = {
    id:Date.now()+Math.random(),
    type,
    stacks,
    duration: duration ?? def.defaultDuration
  };

  if(type==='shield'){
    const val = parseInt(prompt('Shield amount','20')||'0',10);
    char.shield += val;
  }

  char.statuses.push(entry);
}

function removeStatus(char,id){
  char.statuses = char.statuses.filter(s=>s.id!==id);
}

function editStatus(char,id){
  const s = char.statuses.find(x=>x.id===id);
  if(!s) return;
  const stacks = parseInt(prompt('Stacks',s.stacks),10);
  const dur = parseInt(prompt('Duration',s.duration),10);
  s.stacks = isNaN(stacks)?s.stacks:stacks;
  s.duration = isNaN(dur)?s.duration:dur;
}

/* =========================
   EFFECT SEARCH + ADD UI
========================= */
function renderEffectResults(){
  const q = $('effectSearch').value.toLowerCase();
  const box = $('effectResults');
  box.innerHTML='';

  Object.values(statusDefinitions)
    .filter(e=>e.name.toLowerCase().includes(q)||e.key.includes(q))
    .forEach(e=>{
      const d = document.createElement('div');
      d.className='effect-item';
      d.innerHTML = `<b>${e.name}</b> <small>(${e.key})</small><br>${e.description}
        <button>Add</button>`;
      d.querySelector('button').onclick = ()=>{
        if(activeIndex===null) return alert('Select character');
        addStatusToCharacter(characters[activeIndex],e.key);
        renderAll();
      };
      box.appendChild(d);
    });
}

/* =========================
   RENDERING
========================= */
function renderAll(){ renderChars(); renderGrid(); }

function renderChars(){
  const list = $('charList'); list.innerHTML='';
  characters.forEach((c,i)=>{
    const d = document.createElement('div');
    d.className='char-card'+(i===activeIndex?' active':'');
    d.innerHTML = `<b>${c.name}</b> HP:${c.hp}/${c.maxHp} Shield:${c.shield}<br>
      ${c.statuses.map(s=>`
        <span>${s.type} x${s.stacks} (${s.duration})
        <button data-e='${s.id}'>✎</button>
        <button data-r='${s.id}'>✖</button></span>`).join('<br>')}
      <br><button data-i='${i}'>Active</button>`;
    list.appendChild(d);

    d.querySelectorAll('[data-r]').forEach(b=>
      b.onclick=()=>{ removeStatus(c,b.dataset.r); renderAll(); }
    );
    d.querySelectorAll('[data-e]').forEach(b=>
      b.onclick=()=>{ editStatus(c,b.dataset.e); renderAll(); }
    );
    d.querySelector('[data-i]').onclick=()=>{ activeIndex=i; renderAll(); };
  });
}

function renderGrid(){
  const g = $('grid'); g.innerHTML='';
  for(let y=0;y<gridSize;y++)for(let x=0;x<gridSize;x++){
    const c = characters.find(ch=>ch.x===x&&ch.y===y&&!ch.dead);
    const cell=document.createElement('div');
    cell.className='cell';
    cell.textContent=c?c.name[0]:`${x},${y}`;
    g.appendChild(cell);
  }
}

/* =========================
   COMBAT (MINIMAL)
========================= */
function handleAttack(){
  if(activeIndex===null) return;
  log('Attack triggered (logic unchanged)');
}

/* =========================
   TURN SYSTEM (SIMPLIFIED)
========================= */
function nextTurn(){
  if(characters.length===0) return;
  activeIndex=(activeIndex+1)%characters.length;
  const ch = characters[activeIndex];

  ch.statuses.slice().forEach(s=>{
    if(s.type==='bleed') ch.hp-=s.stacks;
    if(s.type==='burn') ch.hp-=2*s.stacks;
    if(s.type==='regen') ch.hp+=3*s.stacks;

    if(s.duration>0){ s.duration--; if(s.duration<=0) removeStatus(ch,s.id); }
  });

  renderAll();
  log(`${ch.name}'s turn.`);
}

/* =========================
   BOOT
========================= */
document.addEventListener('DOMContentLoaded',init);
<input id="effectSearch">
<div id="effectResults"></div>
