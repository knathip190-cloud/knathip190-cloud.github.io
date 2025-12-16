/* ================= FINAL CLEAN VERSION =================
   Board Game Status → HP Simulator
   - Active selection (IN ACTIVE)
   - Grid target select
   - Attack target dropdown
   - Turn / End Turn feedback
   - Add / Search / Edit / Remove Effects
======================================================== */

/* ================= STATUS DEFINITIONS ================= */
const statusDefinitions = {
  bleed:{key:'bleed',name:'Bleed',stackable:true,defaultDuration:2,description:'-1 HP/turn per stack'},
  burn:{key:'burn',name:'Burn',stackable:true,defaultDuration:1,description:'-2 HP/turn per stack'},
  poison:{key:'poison',name:'Poison',stackable:true,defaultDuration:2,description:'-1% HP/turn per stack'},
  regen:{key:'regen',name:'Regen',stackable:true,defaultDuration:1,description:'+3 HP/turn per stack'},
  shield:{key:'shield',name:'Shield',stackable:false,defaultDuration:0,description:'Absorb damage'},
  mark_of_sin:{key:'mark_of_sin',name:'Mark of Sin',stackable:true,defaultDuration:0,description:'Special mark'},
  moral:{key:'moral',name:'Moral',stackable:true,defaultDuration:0,description:'Heal on turn start'}
};

/* ================= CORE STATE ================= */
let characters = [];
let activeIndex = null;
let gridSize = 8;
let moveMode = false;

const $ = id => document.getElementById(id);
const log = msg => {
  $('log').textContent += msg + '\n';
  $('log').scrollTop = $('log').scrollHeight;
};

/* ================= INIT ================= */
document.addEventListener('DOMContentLoaded', init);

function init(){
  $('addCharBtn').onclick = () => {
    addCharacter(
      $('charName').value || `Char${characters.length+1}`,
      parseInt($('charHp').value||'100',10),
      $('charTeam').value
    );
    $('charName').value='';
  };

  $('grid').onclick = gridClickHandler;
  $('attackBtn').onclick = handleAttack;
  $('moveBtn').onclick = ()=>{moveMode=true;log('Move mode');};
  $('cancelMoveBtn').onclick = ()=>{moveMode=false;log('Move cancelled');};
  $('endTurnBtn').onclick = endTurn;
  $('nextTurnBtn').onclick = endTurn;

  $('effectSearch').addEventListener('input', renderEffectResults);

  renderAll();
  renderEffectResults();
  log('Ready.');
}

/* ================= CHARACTER ================= */
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

/* ================= STATUS ================= */
function addStatusToCharacter(char,type,stacks=1){
  const def=statusDefinitions[type]; if(!def) return;
  const ex=char.statuses.find(s=>s.type===type);
  if(ex && def.stackable){ ex.stacks+=stacks; return; }
  if(!def.stackable) char.statuses=char.statuses.filter(s=>s.type!==type);
  if(type==='shield'){
    const v=parseInt(prompt('Shield amount','20'),10)||0;
    char.shield+=v; log(`${char.name} gained shield ${v}`);
    return;
  }
  char.statuses.push({id:Date.now()+Math.random(),type,stacks,duration:def.defaultDuration});
}

function editStatus(ci,id){
  const s=characters[ci].statuses.find(x=>x.id===id); if(!s) return;
  const st=parseInt(prompt('Stacks',s.stacks),10);
  if(!isNaN(st)) s.stacks=st;
  renderAll();
}

function removeStatus(ci,id){
  characters[ci].statuses=characters[ci].statuses.filter(s=>s.id!==id);
  renderAll();
}

/* ================= EFFECT SEARCH ================= */
function renderEffectResults(){
  const box=$('effectResults'); box.innerHTML='';
  const q=$('effectSearch').value.toLowerCase();
  Object.values(statusDefinitions)
    .filter(e=>e.name.toLowerCase().includes(q))
    .forEach(e=>{
      const r=document.createElement('div'); r.className='effect-row';
      r.innerHTML=`<b>${e.name}</b> <small>${e.description}</small>`;
      const b=document.createElement('button'); b.textContent='Add';
      b.onclick=()=>{
        if(activeIndex===null) return alert('Select Active');
        addStatusToCharacter(characters[activeIndex],e.key);
        renderAll();
      };
      r.appendChild(b); box.appendChild(r);
    });
}

/* ================= RENDER ================= */
function renderAll(){ renderChars(); renderGrid(); renderActionPanel(); }

function renderChars(){
  const l=$('charList'); l.innerHTML='';
  characters.forEach((c,i)=>{
    const d=document.createElement('div');
    d.className='char-card'+(i===activeIndex?' active':'');
    d.innerHTML=`<b>${c.name}</b> ${i===activeIndex?'(IN ACTIVE)':''}<br>
      HP:${c.hp}/${c.maxHp} Shield:${c.shield}<br>
      ${c.statuses.map(s=>`${s.type} x${s.stacks}
        <button onclick="editStatus(${i},'${s.id}')">✎</button>
        <button onclick="removeStatus(${i},'${s.id}')">✖</button>`).join('<br>')||'—'}
      <br><button onclick="activeIndex=${i};log('Active → ${c.name}');renderAll()">Active</button>`;
    l.appendChild(d);
  });
}

function renderGrid(){
  const g=$('grid'); g.innerHTML='';
  for(let y=0;y<gridSize;y++)for(let x=0;x<gridSize;x++){
    const c=characters.find(ch=>ch.x===x&&ch.y===y&&!ch.dead);
    const cell=document.createElement('div');
    cell.className='cell';
    cell.dataset.x=x; cell.dataset.y=y;
    cell.textContent=c?c.name[0]:`${x},${y}`;
    g.appendChild(cell);
  }
}

function renderActionPanel(){
  const info=$('activeInfo'), panel=$('actionButtons');
  if(activeIndex===null||!characters[activeIndex]){
    info.textContent='No active character'; panel.classList.add('hidden'); return;
  }
  const ch=characters[activeIndex];
  info.innerHTML=`<b>${ch.name}</b> <span style="color:green">(IN ACTIVE)</span>`;
  panel.classList.remove('hidden');
  const sel=$('attackTarget'); sel.innerHTML='<option value="">Select target</option>';
  characters.forEach(c=>{ if(c.id!==ch.id&&!c.dead){
    const o=document.createElement('option'); o.value=c.id; o.textContent=c.name;
    sel.appendChild(o);
  }});
}

/* ================= COMBAT / TURN ================= */
function gridClickHandler(e){
  const cell=e.target.closest('.cell'); if(!cell) return;
  const x=parseInt(cell.dataset.x), y=parseInt(cell.dataset.y);
  if(moveMode&&activeIndex!==null){
    const ch=characters[activeIndex]; ch.x=x; ch.y=y;
    moveMode=false; log(`${ch.name} moved`); renderAll(); return;
  }
  const t=characters.find(c=>c.x===x&&c.y===y&&!c.dead);
  if(t&&activeIndex!==null){ $('attackTarget').value=t.id; log(`Target → ${t.name}`); }
}

function handleAttack(){
  if(activeIndex===null) return;
  const tId=$('attackTarget').value; if(!tId) return alert('Select target');
  const t=characters.find(c=>String(c.id)===String(tId));
  const dmg=parseInt($('attackDmg').value||'0',10);
  if(!t) return;
  applyDamage(t,dmg); renderAll();
}

function applyDamage(t,amt){
  if(t.shield>0){ const s=Math.min(t.shield,amt); t.shield-=s; amt-=s; }
  if(amt>0){ t.hp-=amt; log(`${t.name} took ${amt} dmg`); }
  if(t.hp<=0){ t.hp=0; t.dead=true; t.statuses=[]; log(`${t.name} defeated`); }
}

function endTurn(){ log('() End Turn'); nextTurn(); }

function nextTurn(){
  if(!characters.length) return;
  activeIndex=(activeIndex+1)%characters.length;
  const ch=characters[activeIndex];
  ch.statuses.forEach(s=>{
    if(s.type==='bleed') ch.hp-=s.stacks;
    if(s.type==='burn') ch.hp-=2*s.stacks;
    if(s.type==='regen') ch.hp+=3*s.stacks;
  });
  log(`() Turn → ${ch.name}`);
  renderAll();
}

