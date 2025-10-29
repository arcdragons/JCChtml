// =======================
//   CONFIG / CONSTANTES
// =======================
const ROWS = 5, COLS = 10;     // 3 (ATT) + 2 (NEUTRAL) + 5 (DEF)
const ATT = "p1";              // attaquant (à GAUCHE, avance vers la DROITE)
const DEF = "p2";              // défenseur (à DROITE)
const MAX_ROUNDS = 20;         // ⚑ Victoire Défenseur à 20 manches
const STARTING_HAND = 4;       // ⚑ Main de départ
const MAX_MANA_CAP = 5;
let gameOver = false;

const lanes = document.getElementById("lanes");

const state = { hands: { p1: [], p2: [] } };
const decks = { p1: [], p2: [] };
const turn = { current: ATT, number: 1 }; // number = N° de manche (commence à 1)
const mana = {
  p1: { max: 1, current: 1 },
  p2: { max: 1, current: 1 }
};

// + Nouveau : bonus de mana appliqué au prochain tour de chaque joueur
const nextManaBonus = { p1: 0, p2: 0 };


// =======================
//   POOL DE CARTES (ex-JSON intégré)
//   Ajout: attackType = "melee" | "ranged"
// =======================
const CARDS = [
  { nom: "classique N°1", image: "", type: "placable", indeck: "5",
    attacker: { cost: 1, attack: 1, hp: 5, attackType: "melee", description: "Corps à corps." },
    defender: { cost: 1, attack: 1, hp: 1, attackType: "ranged",  description: "À distance." }
  },
  { nom: "classique N°2", image: "", type: "placable", indeck: "5",
    attacker: { cost: 2, attack: 2, hp: 9, attackType: "melee",  description: "Corps à corps." },
    defender: { cost: 2, attack: 2, hp: 2, attackType: "ranged", description: "À distance." }
  },
  { nom: "classique N°3", image: "", type: "placable", indeck: "5",
    attacker: { cost: 3, attack: 2, hp: 13, attackType: "melee", description: "Corps à corps." },
    defender: { cost: 3, attack: 3, hp: 2, attackType: "ranged",  description: "À distance." }
  },
  { nom: "classique N°4", image: "", type: "placable", indeck: "5",
    attacker: { cost: 4, attack: 4, hp: 17, attackType: "melee",  description: "Corps à corps." },
    defender: { cost: 4, attack: 4, hp: 3,  attackType: "ranged", description: "À distance." }
  },
  { nom: "classique N°5", image: "", type: "placable", indeck: "5",
    attacker: { cost: 5, attack: 3, hp: 21, attackType: "melee", description: "Corps à corps." },
    defender: { cost: 5, attack: 5, hp: 3,  attackType: "ranged",  description: "À distance." }
  }
];

// =======================
//   UTILS & UI
// =======================
const $ = (s, r=document)=>r.querySelector(s);
function deepClone(obj){ return JSON.parse(JSON.stringify(obj)); }
function shuffle(array){
  for(let i=array.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [array[i],array[j]] = [array[j],array[i]];
  }
  return array;
}
function getSlot(r,c){ return $(`.slot[data-row="${r}"][data-col="${c}"]`); }
function inBounds(c){ return c>=0 && c<COLS; }

function updateDeckLeft(p){
  const el = document.getElementById(`deck-left-${p}`);
  if(el) el.textContent = decks[p]?.length ?? 0;
}
function updateRoundUI(){
  const el = document.getElementById('round-num');
  if(el) el.textContent = `${turn.number} / ${MAX_ROUNDS}`;
}
function layoutHand(player){
  const hand = document.getElementById(`hand-${player}`);
  if(!hand) return;
  const cards = Array.from(hand.querySelectorAll('.card'));
  hand.style.setProperty('--count', String(cards.length || 1));
  cards.forEach((card, idx) => card.style.setProperty('--i', String(idx)));
}
function relayoutBothHands(){ layoutHand('p1'); layoutHand('p2'); }

// Helpers PV / ATK / Type
function readAtk(card){ return parseInt(card.querySelector('.atk')?.textContent || "0",10); }
function readHp(card){ return parseInt(card.querySelector('.hp')?.textContent || "0",10); }
function setHp(card, v){ const el = card.querySelector('.hp'); if(el){ el.textContent = String(Math.max(0,v)); } }
function readType(card){ return (card.dataset.range === "ranged") ? "ranged" : "melee"; }
function ownerOf(card){ return card?.dataset.owner || null; }

// =======================
//   DECKS
// =======================
function buildDeckFromPool(pool){
  const deck = [];
  for(const base of pool){
    const count = Math.max(0, parseInt(base.indeck,10) || 0);
    for(let i=0;i<count;i++) deck.push(deepClone(base));
  }
  return shuffle(deck);
}
function initDecks(){
  decks.p1 = buildDeckFromPool(CARDS);
  decks.p2 = buildDeckFromPool(CARDS);
}

// =======================
//   DRAG & DROP (défini AVANT usage)
// =======================
let dragData = { card:null, from:null };

function isSlotEmpty(slot){ return slot && !slot.firstElementChild; }

function setAllSlotsHighlight(mode){ // "ok" | "bad" | null
  document.querySelectorAll('.slot').forEach(s=>{
    if(!mode){ s.removeAttribute('data-highlight'); return; }
    s.setAttribute('data-highlight', isSlotEmpty(s) ? 'ok' : 'bad');
  });
}

function bindSlot(slot){
  slot.addEventListener('dragover', (e)=>{
    if(!dragData.card || gameOver) return;
    e.preventDefault();
    slot.setAttribute('data-highlight', isSlotEmpty(slot) ? 'ok' : 'bad');
  });
  slot.addEventListener('dragleave', ()=>{
    slot.removeAttribute('data-highlight');
  });
  slot.addEventListener('drop', (e)=>{
    e.preventDefault();
    if(!dragData.card || gameOver) return;

    const to = slot;
    const from = dragData.from;

    // Si on vient d'une main, restreindre à la zone du joueur + coût + tour
    const fromHand = from && (from.id === 'hand-p1' || from.id === 'hand-p2');
    if(fromHand){
      const owner = dragData.card.dataset.owner;      // "p1" ou "p2"
      if(to.dataset.owner !== owner){
        alert("Tu ne peux poser une carte que dans ta zone !");
        cleanupDrag();
        return;
      }
      if(owner !== turn.current){
        alert("Ce n'est pas ton tour !");
        cleanupDrag();
        return;
      }
      const cost = parseInt(dragData.card.querySelector('.cost')?.textContent || "0", 10);
      if(cost > mana[owner].current){
        alert("Mana insuffisant !");
        cleanupDrag();
        return;
      }
      mana[owner].current -= cost;
      refreshManaUI();

      state.hands[owner] = state.hands[owner].filter(x=>x !== dragData.card);
      layoutHand(owner);
    }

    if(!isSlotEmpty(to)){ cleanupDrag(); return; } // pas de swap pour l’instant
    to.appendChild(dragData.card);
    cleanupDrag();
  });
}

function cleanupDrag(){
  document.querySelectorAll('.slot').forEach(s=> s.removeAttribute('data-highlight'));
  if(dragData.card) dragData.card.classList.remove('dragging');
  dragData.card = null;
  dragData.from = null;
}

// =======================
//   CONSTRUCTION DU PLATEAU (orientation horizontale)
//   Zones : 0..2 ATT | 3..4 NEUTRE | 5..9 DEF
// =======================
function colOwner(c){
  if(c <= 2) return ATT;
  if(c <= 4) return "neutral";
  return DEF;
}
for(let r=0;r<ROWS;r++){
  for(let c=0;c<COLS;c++){
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.row = r;
    slot.dataset.col = c;
    slot.dataset.owner = colOwner(c);
    lanes.appendChild(slot);
  }
}
document.querySelectorAll('.slot').forEach(bindSlot);

// =======================
//   FABRICATION VISUELLE D'UNE CARTE
// =======================
function createCard(data){
  const card = document.createElement('div');
  card.className = `card ${data.owner === ATT ? 'att' : 'def'}`;
  if(data.image){
    const img = document.createElement('img');
    img.src = data.image; card.appendChild(img);
  }
  const overlay = document.createElement('div'); overlay.className='overlay'; card.appendChild(overlay);
  const cost = document.createElement('div'); cost.className='cost'; cost.textContent = data.cost; card.appendChild(cost);
  const atk = document.createElement('div'); atk.className='atk'; atk.textContent = data.attack; card.appendChild(atk);
  const hp  = document.createElement('div'); hp.className ='hp';  hp.textContent  = data.hp;  card.appendChild(hp);
  const info= document.createElement('div'); info.className='info'; info.innerHTML = `<strong>${data.name}</strong><br>${data.description}`; card.appendChild(info);

  card.dataset.owner = data.owner;
  card.dataset.range = (data.attackType === "ranged") ? "ranged" : "melee"; // store type
  card.draggable = true;

  // Drag start / end
  card.addEventListener('dragstart', ()=>{
    if(gameOver) return; // bloqué si fin de partie
    dragData.card = card;
    dragData.from = card.parentElement;
    card.classList.add('dragging');
    setAllSlotsHighlight('ok');
  });
  card.addEventListener('dragend', ()=>{
    cleanupDrag();
  });

  return card;
}

// =======================
//   PIOCHE / DEFAUSSE
// =======================
function draw(player){
  if(gameOver) return false;
  // Aucune limite de cartes en main
  if(!decks[player] || decks[player].length === 0){ 
    alert(`Deck ${player.toUpperCase()} vide !`); 
    return false; 
  }

  const base = decks[player].pop();
  const face = (player === ATT) ? base.attacker : base.defender;
  const cardData = { ...deepClone(face), owner: player, image: base.image, name: base.nom };
  const card = createCard(cardData);

  state.hands[player].push(card);
  const hand = document.getElementById(`hand-${player}`);
  hand.appendChild(card);
  layoutHand(player);

  updateDeckLeft(player);
  return true;
}

function drawMany(player, n){
  for(let i=0;i<n;i++){ if(!draw(player)) break; }
}

function discardHand(player){
  if(gameOver) return;
  state.hands[player] = [];
  document.getElementById(`hand-${player}`).innerHTML = "";
  layoutHand(player);
}

// =======================
//   COMBAT
// =======================
// Retourne la première cible dans la ligne, selon type et direction
function findTarget(row, col, owner, type){
  const dir = (owner === ATT) ? +1 : -1;

  if(type === "melee"){
    const tc = col + dir;
    if(!inBounds(tc)) return null;
    const tslot = getSlot(row, tc);
    const tcard = tslot?.firstElementChild;
    if(tcard && ownerOf(tcard) && ownerOf(tcard) !== owner) return tcard;
    return null;
  }

  // ranged
  for(let c = col + dir; inBounds(c); c += dir){
    const s = getSlot(row, c);
    const card = s?.firstElementChild;
    if(card){
      // ligne de vue bloquée par la première unité rencontrée
      if(ownerOf(card) !== owner) return card; // ennemi -> cible
      return null; // allié -> tir bloqué
    }
  }
  return null;
}

function damageCard(card, dmg){
  const hp = readHp(card);
  const after = hp - dmg;
  setHp(card, after);
  if(after <= 0){
    const parent = card.parentElement;
    if(parent) parent.removeChild(card);
    return true; // ← mort
  }
  return false;  // ← encore vivant
}
function makeToast(msg){
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `
    position:fixed; left:50%; top:18px; transform:translateX(-50%);
    background:#0b1324; color:#f3f7ff; border:1px solid #1d2b4a;
    padding:8px 12px; border-radius:10px; font-weight:700; z-index:9999;
    box-shadow:0 10px 30px rgba(0,0,0,.35); opacity:.98;`;
  document.body.appendChild(t);
  setTimeout(()=>{ t.style.transition='opacity .3s'; t.style.opacity='0'; }, 900);
  setTimeout(()=> t.remove(), 1300);
}

function logBonus(player, inc){
  console.log(`[BONUS] ${player} +${inc} mana pour le prochain tour`);
  makeToast(`+${inc} mana prochain tour (${player === 'p1' ? 'ATT' : 'DEF'})`);
}


function resolveCombat(side){
  const fired = new Set();

  for(let r=0; r<ROWS; r++){
    for(let c=0; c<COLS; c++){
      const slot = getSlot(r,c);
      const card = slot?.firstElementChild;
      if(!card) continue;
      if(ownerOf(card) !== side) continue;

      const type = readType(card);
      const atk  = readAtk(card) || 0;

      const target = findTarget(r, c, side, type);
      if(target){
        const targetOwner = ownerOf(target);
        const killed = damageCard(target, atk);
        fired.add(card);

        // Bonus mana pour ATT quand il tue DEF
        if (killed && side === ATT && targetOwner === DEF) {
          nextManaBonus.p1 = (nextManaBonus.p1 || 0) + 1;
          logBonus('p1', 1);
        }
      }
    }
  }
  return fired;
}



function advanceSelective(excludeSet){
  if(gameOver) return;
  for(let r=0; r<ROWS; r++){
    for(let c=COLS-2; c>=0; c--){ // partir de l'avant-dernière colonne
      const cur = getSlot(r,c);
      const card = cur?.firstElementChild;
      if(!card || ownerOf(card) !== ATT) continue;

      // Si la carte a attaqué pendant la résolution, elle N'AVANCE PAS
      if(excludeSet && excludeSet.has(card)) continue;

      const right = getSlot(r, c+1);
      if(!right) continue;

      if(!right.firstElementChild){
        right.appendChild(card);
      }
    }
  }
}


// =======================
//   TOUR / MANA / VICTOIRE
// =======================
function refreshManaUI(){
  const j1 = document.getElementById('mana-p1');
  const j2 = document.getElementById('mana-p2');

  const cap1 = MAX_MANA_CAP;
  const cap2 = MAX_MANA_CAP;

  if (j1) {
    const max = mana.p1.max;
    const cur = mana.p1.current;
    j1.textContent = `${cur}/${cap1}${max > cap1 ? ` (+${max - cap1})` : ""}`;
  }

  if (j2) {
    const max = mana.p2.max;
    const cur = mana.p2.current;
    j2.textContent = `${cur}/${cap2}${max > cap2 ? ` (+${max - cap2})` : ""}`;
  }

  document.querySelector('.hand-att')?.classList.toggle('turn-active', turn.current===ATT);
  document.querySelector('.hand-def')?.classList.toggle('turn-active', turn.current===DEF);
}


function startTurn(player){
  const m = mana[player];

  // 1) croissance naturelle : limitée au cap
  m.max = Math.min(MAX_MANA_CAP, m.max + 1);

  // 2) bonus : ajoute librement au-dessus du cap
  if (nextManaBonus[player] > 0) {
    const applied = nextManaBonus[player];
    m.max += applied;        // ← dépassement autorisé
    logBonus(player, applied);
    nextManaBonus[player] = 0;
  }

  m.current = m.max;
  refreshManaUI();
  draw(player);
}




function declareWinner(winner){
  gameOver = true;
  const msg = (winner === DEF)
    ? "Victoire des Défenseurs ! (limite de 20 tours atteinte)"
    : "Victoire de l’Attaquant !";
  alert(msg);
}

function endTurn(){
  if(gameOver) return;

  // Alterne le joueur
  turn.current = (turn.current === ATT) ? DEF : ATT;

  if (turn.current === ATT) {
    // Le tour du Défenseur vient de se terminer
    // 1) PHASE DE RÉSOLUTION : les Attaquants attaquent
    const attackersWhoFired = resolveCombat(ATT);

    // 2) MOUVEMENT : seuls les Attaquants qui N'ONT PAS attaqué avancent
    advanceSelective(attackersWhoFired);

    // Nouvelle manche
    turn.number++;
    updateRoundUI();

    // Condition de victoire Défenseur
    if (turn.number > MAX_ROUNDS) {
      declareWinner(DEF);
      return;
    }
  } else {
    // Le tour de l'Attaquant vient de se terminer
    // → Défenseurs attaquent (résolution côté Défense)
    resolveCombat(DEF);
  }

  // Démarre le tour du joueur actif (pioche auto incluse)
  startTurn(turn.current);
}


// =======================
//   INIT + BOUTONS
// =======================
function initGame(){
  initDecks();

  // Mains de départ
  drawMany(ATT, STARTING_HAND);
  drawMany(DEF, STARTING_HAND);

  // Boutons de jeu
  $("#draw-p1").onclick = ()=> draw(ATT);
  $("#draw-p2").onclick = ()=> draw(DEF);
  $("#discard-p1").onclick = ()=> discardHand(ATT);
  $("#discard-p2").onclick = ()=> discardHand(DEF);

  // ⚠️ Désactivation du bouton “Avancer” et du raccourci clavier
  const btnAdvance = document.getElementById('advance');
  if (btnAdvance) {
    btnAdvance.disabled = true;
    btnAdvance.style.opacity = "0.5";
    btnAdvance.style.cursor = "not-allowed";
    btnAdvance.title = "Avance automatique après le tour du défenseur";
  }

  document.getElementById('end-turn').onclick = endTurn;

  // UI init
  updateDeckLeft('p1');
  updateDeckLeft('p2');
  updateRoundUI();

  // Démarre le premier tour (pioche automatique incluse)
  startTurn(turn.current);

  relayoutBothHands();
}
initGame();
