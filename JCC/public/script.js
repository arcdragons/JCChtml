/* ============================================================
   🌙☀️  LUNE vs SOLEIL – Bataille Astrale
   Partie 1 : CONFIGURATION + CARTES + DECKS
   ============================================================ */

// =======================
//   CONFIGURATION GÉNÉRALE
// =======================
const ROWS = 5, COLS = 10;
const ATT = "p1"; // attaquant (Lune)
const DEF = "p2"; // défenseur (Soleil)
const MAX_ROUNDS = 20;
const STARTING_HAND = 4;
const MAX_MANA_CAP = 7;

let gameOver = false;
const lanes = document.getElementById("lanes");

const state = { hands: { p1: [], p2: [] } };
const decks = { p1: [], p2: [] };
const turn = { current: ATT, number: 1 };
const mana = {
  p1: { max: 1, current: 1 },
  p2: { max: 1, current: 1 }
};
const nextManaBonus = { p1: 0, p2: 0 };


// ============================================================
//   🃏  CARTES À DOUBLE FACE (15 inédites 🌙 / ☀️)
// ============================================================
const CARDS = [
  {
    nom: "Éclaireur Astral",
    indeck: 3,
    attacker: { cost: 2, attack: 2, hp: 6, attackType: "melee", keywords:["celerite:1","cooperation:2"], description:"Rapide et précis. +1 ATK s’il a des alliés sur la ligne." },
    defender: { cost: 2, attack: 1, hp: 8, attackType: "ranged", keywords:["paralysie:1"], description:"Tire à distance ; paralyse la cible 1 tour." }
  },
  {
    nom: "Guerrier d’Argent",
    indeck: 3,
    attacker: { cost: 3, attack: 3, hp: 9, attackType: "melee", keywords:["buff:row"], description:"Octroie +1 ATK aux alliés de la ligne ce tour." },
    defender: { cost: 3, attack: 2, hp: 10, attackType: "melee", keywords:["photosynthese:1"], description:"+1 mana / tour ; solide en défense." }
  },
  {
    nom: "Prêtresse Stellaire",
    indeck: 2,
    attacker: { cost: 3, attack: 2, hp: 9, attackType: "ranged", keywords:["photosynthese:1","heal:1"], description:"+1 mana / tour et soigne 1 PV à un allié proche." },
    defender: { cost: 3, attack: 3, hp: 10, attackType: "ranged", keywords:["photosynthese:2"], description:"+2 mana / tour tant qu’elle est en jeu." }
  },
  {
    nom: "Lame Spectrale",
    indeck: 2,
    attacker: { cost: 4, attack: 5, hp: 8, attackType: "melee", keywords:["percant"], description:"Ses attaques traversent les ennemis." },
    defender: { cost: 4, attack: 3, hp: 12, attackType: "melee", keywords:["paralysie:1"], description:"Frappe et ralentit l’adversaire." }
  },
  {
    nom: "Protecteur des Lunes",
    indeck: 2,
    attacker: { cost: 4, attack: 1, hp: 14, attackType: "melee", keywords:["buff:behind"], description:"+2 HP aux alliés derrière lui." },
    defender: { cost: 4, attack: 2, hp: 15, attackType: "melee", keywords:["buff:row"], description:"+1 HP à toute la ligne." }
  },
  {
    nom: "Messager d’Aurore",
    indeck: 3,
    attacker: { cost: 2, attack: 3, hp: 4, attackType: "melee", keywords:["celerite:2"], description:"Avance de 2 cases ; fragile." },
    defender: { cost: 2, attack: 2, hp: 6, attackType: "ranged", keywords:["paralysie:1"], description:"Tire à distance et ralentit." }
  },
  {
    nom: "Loup Stellaire",
    indeck: 2,
    attacker: { cost: 3, attack: 3, hp: 7, attackType: "melee", keywords:["celerite:1","selfbuff"], description:"+1 ATK après chaque élimination." },
    defender: { cost: 3, attack: 2, hp: 11, attackType: "melee", keywords:["coop:1"], description:"+1 HP si alliés sur la ligne." }
  },
  {
    nom: "Oracle des Marées",
    indeck: 2,
    attacker: { cost: 5, attack: 2, hp: 10, attackType: "ranged", keywords:["photosynthese:2","heal:row"], description:"Soigne toute la ligne (+2 HP) et +2 mana / tour." },
    defender: { cost: 5, attack: 3, hp: 12, attackType: "ranged", keywords:["mana:2"], description:"+2 mana instantané à l’entrée en jeu." }
  },
  {
    nom: "Arbalétrier Radieux",
    indeck: 2,
    attacker: { cost: 3, attack: 2, hp: 8, attackType: "ranged", keywords:["percant"], description:"Attaque à distance et traverse les cibles." },
    defender: { cost: 3, attack: 3, hp: 9, attackType: "ranged", keywords:["paralysie:1"], description:"Frappe à distance et paralyse sa cible." }
  },
  {
    nom: "Clerc de Lumière",
    indeck: 2,
    attacker: { cost: 3, attack: 1, hp: 10, attackType: "ranged", keywords:["heal:row"], description:"Soigne tous les alliés de la ligne (+1 HP)." },
    defender: { cost: 3, attack: 2, hp: 12, attackType: "ranged", keywords:["photosynthese:1"], description:"+1 mana par tour." }
  },
  {
    nom: "Champion Écliptique",
    indeck: 1,
    attacker: { cost: 5, attack: 5, hp: 12, attackType: "melee", keywords:["cooperation:3","percant"], description:"Si 3 alliés sur la ligne, attaque perçante." },
    defender: { cost: 5, attack: 4, hp: 15, attackType: "melee", keywords:["buff:row","paralysie:1"], description:"Paralyse et buff alliés de la ligne." }
  },
  {
    nom: "Défenseur Céleste",
    indeck: 2,
    attacker: { cost: 4, attack: 3, hp: 14, attackType: "melee", keywords:["tank"], description:"Bloque l’avancée ennemie." },
    defender: { cost: 4, attack: 2, hp: 18, attackType: "melee", keywords:["paralysie:1"], description:"Frappe et ralentit les assaillants." }
  },
  {
    nom: "Sorcier du Zénith",
    indeck: 2,
    attacker: { cost: 4, attack: 4, hp: 8, attackType: "ranged", keywords:["mana:1"], description:"+1 mana quand il entre en jeu." },
    defender: { cost: 4, attack: 3, hp: 10, attackType: "ranged", keywords:["photosynthese:1"], description:"+1 mana / tour." }
  },
  {
    nom: "Gardien du Zénith",
    indeck: 1,
    attacker: { cost: 6, attack: 6, hp: 14, attackType: "melee", keywords:["buff:row","percant"], description:"Buff toute la ligne (+1 ATK/+2 HP) et percant 1 tour." },
    defender: { cost: 6, attack: 4, hp: 18, attackType: "melee", keywords:["buff:row:perm"], description:"Buff permanent +1 ATK/+2 HP à la ligne." }
  },
  {
    nom: "Jugement Solaire",
    indeck: 1,
    attacker: { cost: 7, attack: 7, hp: 12, attackType: "ranged", keywords:["percant","doubleattaque"], description:"Frappe deux fois par tour ; attaque toute la ligne." },
    defender: { cost: 7, attack: 6, hp: 16, attackType: "ranged", keywords:["aoe:row"], description:"Inflige des dégâts à toute la ligne ennemie." }
  },
  {
    nom: "Protecteur Écliptique",
    indeck: 1,
    attacker: { cost: 7, attack: 3, hp: 20, attackType: "melee", keywords:["defense","buff:behind"], description:"Protège les alliés derrière et réduit les dégâts subis." },
    defender: { cost: 7, attack: 5, hp: 18, attackType: "melee", keywords:["percant"], description:"Attaque puissante qui traverse les défenses." }
  }
];


// ============================================================
//   🔧  DECKS PRÉDÉFINIS
// ============================================================

const PREMADE_DECKS = {
  classique: CARDS, // deck standard (toutes les cartes)
  mana: CARDS.filter(c => c.attacker.keywords.some(k=>k.includes("photo")||k.includes("mana"))),
  coop: CARDS.filter(c => c.attacker.keywords.some(k=>k.includes("coop")||k.includes("buff")))
};

// Fonction utilitaire : construit un deck à partir d’un pool de cartes
function buildDeckFromPool(pool){
  const deck = [];
  for(const base of pool){
    const count = Math.max(1, parseInt(base.indeck,10)||1);
    for(let i=0;i<count;i++) deck.push(JSON.parse(JSON.stringify(base)));
  }
  return deck;
}

/* ============================================================
   🌙☀️  LUNE vs SOLEIL – Bataille Astrale
   Partie 2 : MOTEUR DU JEU
   ============================================================ */

// =======================
//   UTILITAIRES
// =======================
const $ = (s, r=document)=>r.querySelector(s);
function deepClone(obj){ return JSON.parse(JSON.stringify(obj)); }
function shuffle(array){
  for(let i=array.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [array[i],array[j]]=[array[j],array[i]];
  }
  return array;
}
function getSlot(r,c){ return $(`.slot[data-row="${r}"][data-col="${c}"]`); }
function inBounds(c){ return c>=0 && c<COLS; }
function ownerOf(card){ return card?.dataset.owner||null; }

// =======================
//   CONSTRUCTION DU PLATEAU
// =======================
function colOwner(c){
  if(c<=2) return ATT;
  if(c<=4) return "neutral";
  return DEF;
}
function buildBoard(){
  lanes.innerHTML="";
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const slot=document.createElement('div');
      slot.className='slot';
      slot.dataset.row=r; slot.dataset.col=c; slot.dataset.owner=colOwner(c);
      bindSlot(slot);
      lanes.appendChild(slot);
    }
  }
}
buildBoard();

// =======================
//   CREATION DES CARTES VISUELLES
// =======================
function createCard(data){
  const card=document.createElement('div');
  card.className=`card ${data.owner===ATT?'att':'def'}`;
  const overlay=document.createElement('div'); overlay.className='overlay'; card.appendChild(overlay);
  const cost=document.createElement('div'); cost.className='cost'; cost.textContent=data.cost; card.appendChild(cost);
  const atk=document.createElement('div'); atk.className='atk'; atk.textContent=data.attack; card.appendChild(atk);
  const hp=document.createElement('div'); hp.className='hp'; hp.textContent=data.hp; card.appendChild(hp);
  const info=document.createElement('div'); info.className='info'; info.innerHTML=`<strong>${data.name}</strong><br>${data.description}`; card.appendChild(info);
  card.dataset.owner=data.owner;
  card.dataset.range=data.attackType;
  card.draggable=true;
  card.addEventListener('dragstart',()=>{ if(gameOver)return; dragData.card=card; dragData.from=card.parentElement; card.classList.add('dragging'); setAllSlotsHighlight('ok'); });
  card.addEventListener('dragend',cleanupDrag);
  return card;
}

// =======================
//   DRAG & DROP
// =======================
let dragData={card:null,from:null};
function isSlotEmpty(slot){return slot && !slot.firstElementChild;}
function setAllSlotsHighlight(mode){
  document.querySelectorAll('.slot').forEach(s=>{
    if(!mode){s.removeAttribute('data-highlight');return;}
    s.setAttribute('data-highlight',isSlotEmpty(s)?'ok':'bad');
  });
}
function cleanupDrag(){
  document.querySelectorAll('.slot').forEach(s=>s.removeAttribute('data-highlight'));
  if(dragData.card)dragData.card.classList.remove('dragging');
  dragData.card=null; dragData.from=null;
}
function bindSlot(slot){
  slot.addEventListener('dragover',e=>{
    if(!dragData.card||gameOver)return;
    e.preventDefault();
    slot.setAttribute('data-highlight',isSlotEmpty(slot)?'ok':'bad');
  });
  slot.addEventListener('dragleave',()=>slot.removeAttribute('data-highlight'));
  slot.addEventListener('drop',e=>{
    e.preventDefault();
    if(!dragData.card||gameOver)return;
    const to=slot,from=dragData.from;
    const fromHand=from && (from.id==='hand-p1'||from.id==='hand-p2');
    if(fromHand){
      const owner=dragData.card.dataset.owner;
      if(to.dataset.owner!==owner){alert("Tu ne peux poser une carte que dans ta zone !"); cleanupDrag(); return;}
      if(owner!==turn.current){alert("Ce n'est pas ton tour !"); cleanupDrag(); return;}
      const cost=parseInt(dragData.card.querySelector('.cost').textContent);
      if(cost>mana[owner].current){alert("Mana insuffisant !"); cleanupDrag(); return;}
      mana[owner].current-=cost;
      refreshManaUI();
      state.hands[owner]=state.hands[owner].filter(x=>x!==dragData.card);
    }
    if(!isSlotEmpty(to)){cleanupDrag();return;}
    to.appendChild(dragData.card);
    cleanupDrag();
  });
}

// =======================
//   PIOCHE
// =======================
function draw(player){
  if(gameOver)return false;
  if(!decks[player]||decks[player].length===0){return false;}
  const base=decks[player].pop();
  const face=(player===ATT)?base.attacker:base.defender;
  const cardData={...deepClone(face),owner:player,name:base.nom};
  const card=createCard(cardData);
  state.hands[player].push(card);
  const hand=document.getElementById(`hand-${player}`);
  hand.appendChild(card);
  layoutHand(player);
  updateDeckLeft(player);
  return true;
}
function drawMany(player,n){for(let i=0;i<n;i++) if(!draw(player)) break;}

// =======================
//   LAYOUTS / UI
// =======================
function updateDeckLeft(p){const el=document.getElementById(`deck-left-${p}`); if(el) el.textContent=decks[p]?.length??0;}
function layoutHand(player){
  const hand=document.getElementById(`hand-${player}`);
  if(!hand)return;
  const cards=Array.from(hand.querySelectorAll('.card'));
  hand.style.setProperty('--count',String(cards.length||1));
  cards.forEach((card,idx)=>card.style.setProperty('--i',String(idx)));
}
function relayoutBothHands(){layoutHand('p1');layoutHand('p2');}
function refreshManaUI(){
  const j1=$("#mana-p1"), j2=$("#mana-p2");
  if(j1)j1.textContent=`${mana.p1.current}/${mana.p1.max}`;
  if(j2)j2.textContent=`${mana.p2.current}/${mana.p2.max}`;
}

// =======================
//   COMBAT
// =======================
function findTarget(row,col,owner,type){
  const dir=(owner===ATT)?+1:-1;
  if(type==="melee"){
    const tc=col+dir;
    if(!inBounds(tc))return null;
    const tslot=getSlot(row,tc);
    const tcard=tslot?.firstElementChild;
    if(tcard && ownerOf(tcard)!==owner)return tcard;
    return null;
  }
  for(let c=col+dir; inBounds(c); c+=dir){
    const s=getSlot(row,c);
    const card=s?.firstElementChild;
    if(card){
      if(ownerOf(card)!==owner)return card;
      return null;
    }
  }
  return null;
}
function damageCard(card,dmg){
  const hpEl=card.querySelector('.hp');
  let hp=parseInt(hpEl.textContent);
  hp-=dmg; if(hp<0)hp=0; hpEl.textContent=hp;
  if(hp<=0){card.parentElement?.removeChild(card); return true;}
  return false;
}
function resolveCombat(side){
  const fired=new Set();
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const slot=getSlot(r,c);
      const card=slot?.firstElementChild;
      if(!card||ownerOf(card)!==side)continue;
      const atk=parseInt(card.querySelector('.atk').textContent);
      const type=card.dataset.range;
      const target=findTarget(r,c,side,type);
      if(target){
        damageCard(target,atk);
        fired.add(card);
      }
    }
  }
  return fired;
}

// =======================
//   MOUVEMENT AUTOMATIQUE
// =======================
function advanceSelective(excludeSet){
  if(gameOver)return;
  for(let r=0;r<ROWS;r++){
    for(let c=COLS-2;c>=0;c--){
      const cur=getSlot(r,c);
      const card=cur?.firstElementChild;
      if(!card||ownerOf(card)!==ATT)continue;
      if(excludeSet && excludeSet.has(card))continue;
      const right=getSlot(r,c+1);
      if(!right)continue;
      if(!right.firstElementChild){right.appendChild(card);}
    }
  }
}

// =======================
//   TOUR / MANA / VICTOIRE
// =======================
function startTurn(player){
  const m=mana[player];
  m.max=Math.min(MAX_MANA_CAP,m.max+1);
  m.current=m.max;
  refreshManaUI();
  draw(player);
}
function declareWinner(winner){
  gameOver=true;
  alert(winner===DEF?"☀️ Victoire du Soleil (Défenseur) !":"🌙 Victoire de la Lune (Attaquant) !");
}
function endTurn(){
  if(gameOver)return;
  turn.current=(turn.current===ATT)?DEF:ATT;
  if(turn.current===ATT){
    const fired=resolveCombat(ATT);
    advanceSelective(fired);
    turn.number++;
    if(turn.number>MAX_ROUNDS){declareWinner(DEF);return;}
  } else {
    resolveCombat(DEF);
  }
  startTurn(turn.current);
}

/* ============================================================
   🌙☀️  LUNE vs SOLEIL – Bataille Astrale
   Partie 3 : INTERFACE + MENU + INITIALISATION
   ============================================================ */

// =======================
//   INTERFACE / NAVIGATION
// =======================
function showScreen(id){
  ["menu-screen","deck-select","gallery","rules","credits","game"].forEach(x=>{
    document.getElementById(x)?.classList.add("hidden");
  });
  document.getElementById(id)?.classList.remove("hidden");
}

// =======================
//   GALERIE DES CARTES
// =======================
function populateGallery(){
  const container=document.getElementById("card-gallery");
  if(!container)return;
  container.innerHTML="";
  CARDS.forEach(c=>{
    const div=document.createElement("div");
    div.className="gallery-card";
    div.innerHTML=`
      <h4>${c.nom}</h4>
      <div class="gallery-sides">
        <div class="gallery-side">
          <h5>🌙 Lune</h5>
          <ul>
            <li><b>Coût:</b> ${c.attacker.cost}</li>
            <li><b>ATK:</b> ${c.attacker.attack}</li>
            <li><b>HP:</b> ${c.attacker.hp}</li>
            <li><b>Type:</b> ${c.attacker.attackType}</li>
            <li><b>Mots-clés:</b> ${c.attacker.keywords.join(", ")}</li>
            <li>${c.attacker.description}</li>
          </ul>
        </div>
        <div class="gallery-side">
          <h5>☀️ Soleil</h5>
          <ul>
            <li><b>Coût:</b> ${c.defender.cost}</li>
            <li><b>ATK:</b> ${c.defender.attack}</li>
            <li><b>HP:</b> ${c.defender.hp}</li>
            <li><b>Type:</b> ${c.defender.attackType}</li>
            <li><b>Mots-clés:</b> ${c.defender.keywords.join(", ")}</li>
            <li>${c.defender.description}</li>
          </ul>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

// =======================
//   SÉLECTION DE DECKS
// =======================
let selectedDecks={p1:"classique",p2:"classique"};

function bindDeckSelection(){
  document.querySelectorAll("input[name='deck-p1']").forEach(r=>{
    r.addEventListener("change",()=>selectedDecks.p1=r.value);
  });
  document.querySelectorAll("input[name='deck-p2']").forEach(r=>{
    r.addEventListener("change",()=>selectedDecks.p2=r.value);
  });
  $("#btn-launch-game").onclick=()=>{
    startGameWithDecks(selectedDecks.p1,selectedDecks.p2);
  };
}

// =======================
//   INITIALISATION DE LA PARTIE
// =======================
function startGameWithDecks(deck1,deck2){
  decks.p1=shuffle(buildDeckFromPool(PREMADE_DECKS[deck1]));
  decks.p2=shuffle(buildDeckFromPool(PREMADE_DECKS[deck2]));
  showScreen("game");
  initGame();
}

function initGame(){
  buildBoard();
  state.hands.p1=[]; state.hands.p2=[];
  turn.current=ATT; turn.number=1;
  mana.p1={max:1,current:1};
  mana.p2={max:1,current:1};
  gameOver=false;
  drawMany(ATT,STARTING_HAND);
  drawMany(DEF,STARTING_HAND);
  updateDeckLeft("p1"); updateDeckLeft("p2");
  refreshManaUI();
  relayoutBothHands();
  $("#end-turn").onclick=endTurn;
}

// =======================
//   BIND DES BOUTONS DU MENU
// =======================
function bindMenu(){
  $("#btn-gallery").onclick=()=>{ populateGallery(); showScreen("gallery"); };
  $("#btn-rules").onclick=()=>showScreen("rules");
  $("#btn-start").onclick=()=>{ showScreen("deck-select"); bindDeckSelection(); };
  $("#btn-credits").onclick=()=>showScreen("credits");
  $("#btn-build").onclick=()=>alert("🛠️ Éditeur de deck bientôt disponible !");
}
bindMenu();

// =======================
//   LANCEMENT INITIAL
// =======================
showScreen("menu-screen");
refreshManaUI();
