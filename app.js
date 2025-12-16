/* ================= FIXED VERSION =================
   Add Effect / Search / Stack / Edit / Remove
   (patched to work with your current HTML/CSS)
================================================ */

// Interactive per-character simulator with Goddess of Weapons & Heaven's Punishment
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
  goddess_form: { key:'goddess_form', name:'Goddess Form', stackable:false, defaultDuration:2, trigger:'start', description:'Active goddess of weapons (2 turns)' },
  moral: { key:'moral', name:'Moral', stackable:true, defaultDuration:0, trigger:'start', description:'+1 heal per stack/turn' }
};

let characters = [];
let activeIndex = null;
let gridSize = 8;
let moveMode = false;

const $ = id => document.getElementById(id);
const log = s => { $('log').textContent += s + '\n'; $('log').scrollTop = $('log').scrollHeight; };

function init(){
  $('addCharBtn').onclick = () => {
    const n = $('charName').value || `Char${characters.length+1}`;
    const hp = parseInt($('charHp').value||'100',10);
    addCharacter(n,hp,$('charTeam').value);
  };

  $('grid').onclick = gridClickHandler;
  $('attackBtn').onclick = handleAttack;
  $('moveBtn').onclick = ()=>moveMode=true;
  $('cancelMoveBtn').onclick = ()=>moveMode=false;
  $('endTurnBtn').onclick = nextTurn;
  $('nextTurnBtn').onclick = nextTurn;

  // ✅ safe binding
  $('effectSearch')?.addEventListener('input', renderEffectResults);

  renderAll();
  renderEffectResults();
  log('Ready.');
}

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

/* ================= EFFECT CORE (FIXED) ================= */
function addStatusToCharacter(char,type,stacks=1,duration=null){
  const def = statusDefinitions[type];
  if(!def) return alert('Unknown status');

  const existing = char.statuses.find(s=>s.type===type);

  // stackable → merge
  if(existing && def.stackable){
    existing.stacks += stacks;
    if(existing.duration>0 && duration!==0){
      existing.duration = Math.max(existing.duration, duration ?? def.defaultDuration);
    }
    return;
  }

  // non-stackable → replace
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
    char.shield += Math.max(0,val);
    log(`${char.name} gained shield ${val}`);
  }

  char.statuses.push(entry);
}

function removeStatus(charIndex,statusId){
  characters[charIndex].statuses =
    characters[charIndex].statuses.filter(s=>s.id!==statusId);
  renderAll();
}

function editStatus(charIndex,statusId){
  const s = characters[charIndex].statuses.find(x=>x.id===statusId);
  if(!s) return;
  const st = parseInt(prompt('Stacks',s.stacks),10);
  const du = parseInt(prompt('Duration',s.duration),10);
  if(!isNaN(st)) s.stacks = st;
  if(!isNaN(du)) s.duration = du;
  renderAll();
}

/* ================= EFFECT SEARCH ================= */
function renderEffectResults(){
  const box = $('effectResults');
  if(!box) return;
  const q = $('effectSearch').value.toLowerCase();
  box.innerHTML='';

  Object.values(statusDefinitions)
    .filter(e=>e.name.toLowerCase().includes(q)||e.key.includes(q))
    .forEach(e=>{
      const row = document.createElement('div');
      row.className='effect-row';
      row.innerHTML = `<span><b>${e.name}</b> <small>${e.description}</small></span>`;
      const btn = document.createElement('button');
      btn.textContent='Add';
      btn.onclick=()=>{
        if(activeIndex===null) return alert('Select character');
        addStatusToCharacter(characters[activeIndex],e.key);
        renderAll();
      };
      row.appendChild(btn);
      box.appendChild(row);
    });
}

/* ================= RENDER ================= */
function renderAll(){ renderChars(); renderGrid(); }

function renderChars(){
  const list=$('charList'); list.innerHTML='';
  characters.forEach((c,i)=>{
    const d=document.createElement('div');
    d.className='char-card'+(i===activeIndex?' active':'');
    d.innerHTML=`<b>${c.name}</b> HP:${c.hp}/${c.maxHp} Shield:${c.shield}<br>
      ${c.statuses.map(s=>`${s.type} x${s.stacks} (${s.duration})
        <button onclick="editStatus(${i},'${s.id}')">✎</button>
        <button onclick="removeStatus(${i},'${s.id}')">✖</button>`).join('<br>')||'—'}
      <br><button onclick="activeIndex=${i};renderAll()">Active</button>`;
    list.appendChild(d);
  });
}

function renderGrid(){
  const g=$('grid'); g.innerHTML='';
  for(let y=0;y<gridSize;y++)for(let x=0;x<gridSize;x++){
    const c=characters.find(ch=>ch.x===x&&ch.y===y&&!ch.dead);
    const cell=document.createElement('div');
    cell.className='cell';
    cell.textContent=c?c.name[0]:`${x},${y}`;
    g.appendChild(cell);
  }
}

/* ================= MINIMAL STUBS ================= */
function handleAttack(){ log('Attack (unchanged)'); }
function gridClickHandler(){}
function nextTurn(){ activeIndex=(activeIndex+1)%characters.length; renderAll(); }

document.addEventListener('DOMContentLoaded',init);
