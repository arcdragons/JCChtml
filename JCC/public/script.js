// =======================
//   CONFIG / CONSTANTES
// =======================
const ROWS = 5, COLS = 10;     // 3 (ATT) + 2 (NEUTRAL) + 5 (DEF)
const ATT = "p1";              // attaquant (à GAUCHE, avance vers la DROITE)
const DEF = "p2";              // défenseur (à DROITE)
const MAX_ROUNDS = 20;         // Victoire Défenseur à 20 manches
const STARTING_HAND = 4;       // Main de départ
const MAX_MANA_CAP = 5;
let gameOver = false;

const lanes = document.getElementById("lanes");

const state = { hands: { p1: [], p2: [] } };
const decks = { p1: [], p2: [] };
const turn = { current: ATT, number: 1 };
const mana = {
  p1: { max: 1, current: 1 },
  p2: { max: 1, current: 1 }
};

// Bonus mana différé (kills, photosynthèse onBoard, etc.)
const nextManaBonus = { p1: 0, p2: 0 };

// =======================
//  LEXIQUE MOTS-CLÉS (affichage)
// =======================
const KEYWORD_LEXICON = {
  celerite: x => `Se déplace de ${x} case(s) supplémentaire(s) lorsqu’elle avance (si elle n’a pas attaqué).`,
  paralysie: x => `Empêche la cible d’agir pendant ${x} tour(s).`,
  deplacement: () => `Peut se déplacer manuellement : 1 case adjacente par tour.`,
  photosynthese: x => `+${x} mana au début du tour du propriétaire (tant que la carte n'est pas paralysée).`,
  cooperation: x => `Condition : au moins ${x} allié(s) derrière sur la même ligne.`,
  percant: () => `Inflige aussi ses dégâts aux autres ennemis de la ligne.`
};

// =======================
//   CARTES (exemples)
// =======================
const CARDS = [
  {
    nom: "Éclaireur coordonné", image: "", type: "placable", indeck: "4",
    attacker: {
      cost: 2, attack: 2, hp: 6, attackType: "melee",
      description: "Se place vite, profite du groupe.",
      keywords: ["celerite:1","cooperation:2","deplacement"],
      triggers: [
        { when:"onPlay", if:{ cooperationAtLeast:2 }, do:[
          { type:"draw", amount:1 },
          { type:"buff", scope:"row", duration:"turn", atk:1, hp:2 }
        ] }
      ]
    },
    defender: {
      cost: 2, attack: 2, hp: 5, attackType: "ranged",
      description: "Tir de soutien.",
      keywords: ["photosynthese:1","deplacement"]
    }
  },
  {
    nom: "Archer paralysant", image: "", type: "placable", indeck: "4",
    attacker: {
      cost: 3, attack: 2, hp: 8, attackType: "ranged",
      description: "Neutralise temporairement.",
      keywords: ["paralysie:1"]
    },
    defender: {
      cost: 3, attack: 2, hp: 7, attackType: "ranged",
      description: "Perce les lignes.",
      keywords: ["percant","paralysie:1"]
    }
  },
  {
    nom: "Capitaine endurci", image: "", type: "placable", indeck: "3",
    attacker: {
      cost: 3, attack: 2, hp: 10, attackType: "melee",
      description: "Se renforce si bien entouré.",
      keywords: ["cooperation:2"],
      triggers: [
        { when:"onPlay", if:{ cooperationAtLeast:2 }, do:[
          { type:"buff", scope:"self", duration:"permanent", atk:2, hp:3 }
        ] }
      ]
    },
    defender: {
      cost: 4, attack: 3, hp: 9, attackType: "ranged",
      description: "Soutien de ligne.",
      keywords: ["deplacement"]
    }
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

function readAtk(card){ return parseInt(card.querySelector('.atk')?.textContent || "0",10); }
function readHp(card){ return parseInt(card.querySelector('.hp')?.textContent || "0",10); }
function setHp(card, v){
  const el = card.querySelector('.hp');
  if(el){ el.textContent = String(Math.max(0,v)); }
  syncInspectorIfSelected(card);
}
function setAtk(card, v){
  const el = card.querySelector('.atk');
  if(el){ el.textContent = String(Math.max(0, v)); }
  syncInspectorIfSelected(card);
}
function readType(card){ return (card.dataset.range === "ranged") ? "ranged" : "melee"; }
function ownerOf(card){ return card?.dataset.owner || null; }

function syncInspectorIfSelected(card){
  const inspTitle = document.querySelector('#inspector .insp-title')?.textContent;
  const cardName = card.querySelector('.info strong')?.textContent;
  if(inspTitle && cardName && inspTitle===cardName){ renderInspector(card); }
}

// Keywords parsing
function normalizeKeywords(list){
  const out = {};
  (list||[]).forEach(k=>{
    if(typeof k === "string"){
      const [name, val] = k.split(":");
      out[name.toLowerCase()] = val!==undefined ? Number(val) : true;
    }else if(k && typeof k === "object" && k.name){
      out[k.name.toLowerCase()] = (k.value!==undefined ? Number(k.value) : true);
    }
  });
  return out;
}
function getKW(card, name){
  try {
    const obj = JSON.parse(card?.dataset?.keywords || "{}");
    return obj[name.toLowerCase()];
  } catch(e){ return undefined; }
}
function hasKW(card, name){ return getKW(card, name) !== undefined; }

function isParalyzed(card){ return (parseInt(card.dataset.paralyzed||"0",10) > 0); }
function addParalysis(card, turns){
  const cur = parseInt(card.dataset.paralyzed||"0",10);
  card.dataset.paralyzed = String(cur + Math.max(0, turns||0));
}
function tickParalysisForOwner(player){
  document.querySelectorAll(`.slot .card[data-owner="${player}"]`).forEach(card=>{
    const cur = parseInt(card.dataset.paralyzed||"0",10);
    if(cur>0) card.dataset.paralyzed = String(cur-1);
  });
}

// =======================
//   INSPECTEUR
// =======================
function ensureInspector(){
  if(document.getElementById('inspector')) return;
  const wrap = document.createElement('div');
  wrap.id = 'inspector';
  wrap.innerHTML = `
    <div class="insp-title">Aucune carte sélectionnée</div>
    <div class="insp-body">
      <div class="insp-desc muted">Survole une carte pour voir ses détails…</div>
      <div class="insp-kw"></div>
    </div>
  `;
  document.body.appendChild(wrap);
}
ensureInspector();

function clearInspector(){
  const box = document.getElementById('inspector');
  if(!box) return;
  box.querySelector('.insp-title').textContent = 'Aucune carte sélectionnée';
  const body = box.querySelector('.insp-body');
  body.innerHTML = `<div class="insp-desc muted">Survole une carte pour voir ses détails…</div><div class="insp-kw"></div>`;
}

function formatCondition(cond){
  if(!cond) return "—";
  const parts = [];
  if(cond.cooperationAtLeast !== undefined){
    parts.push(`Coopération ≥ ${Number(cond.cooperationAtLeast)}`);
  }
  return parts.length ? parts.join(" · ") : "—";
}
function formatEffect(e){
  if(!e || !e.type) return "Effet inconnu";
  switch(e.type){
    case "draw":      return `Pioche ${Number(e.amount||1)}`;
    case "manaGain":  return `+${Number(e.amount||1)} mana (immédiat)`;
    case "buff":
    case "buffSelf": {
      const scope = (e.type==="buffSelf" ? "self" : (e.scope||"self")).toLowerCase();
      const duration = (e.duration||"permanent").toLowerCase();
      const atk = (e.atk!==undefined) ? `ATK ${e.atk>0?'+':''}${e.atk}` : null;
      const hp  = (e.hp !==undefined) ? `HP ${e.hp>0?'+':''}${e.hp}`   : null;
      const stats = [atk,hp].filter(Boolean).join(" · ") || "stat(s)";
      const scopeTxt = {self:"soi", row:"ligne", column:"colonne", allies:"alliés"}[scope] || scope;
      const durTxt = duration==="turn" ? "temporaire" : "permanent";
      return `Buff ${scopeTxt} (${durTxt}) : ${stats}`;
    }
    default:          return `Effet ${e.type}`;
  }
}

function renderInspector(card){
  const box = document.getElementById('inspector');
  if(!box || !card) return;

  const titleEl = box.querySelector('.insp-title');
  const body = box.querySelector('.insp-body');
  const info = card.querySelector('.info')?.innerHTML || '';
  let name = 'Carte', desc = '';
  const tmp = document.createElement('div'); tmp.innerHTML = info;
  const strong = tmp.querySelector('strong');
  if(strong){ name = strong.textContent.trim(); strong.remove(); }
  desc = tmp.textContent.replace(/^\s*\n?/, '').trim();

  titleEl.textContent = name || 'Carte';
  body.innerHTML = `<div class="insp-desc">${desc || '—'}</div><div class="insp-kw"></div>`;

  // Type + Stats
  const atk = card.querySelector('.atk')?.textContent || '?';
  const hp  = card.querySelector('.hp')?.textContent  || '?';
  const typeRaw = (card.dataset.range === 'ranged') ? 'Distance' : 'Mêlée';

  const statsBlock = document.createElement('div');
  statsBlock.className = 'insp-stats';
  statsBlock.innerHTML = `
    <div class="typeline">
      <span class="type-label">Type</span> <span class="type-val">${typeRaw}</span>
    </div>
    <div class="statline" style="margin-top:6px">
      <span class="atk-label">ATK</span> <span class="atk-val">${atk}</span>
      <span class="hp-label">HP</span> <span class="hp-val">${hp}</span>
    </div>
  `;
  body.querySelector('.insp-desc').insertAdjacentElement('afterend', statsBlock);

  // Barre de PV
  const maxHp = Math.max(1, parseInt(card.dataset.maxHp || hp || "1", 10));
  const curHp = Math.max(0, parseInt(hp || "0", 10));
  const pct = Math.max(0, Math.min(100, Math.round(curHp * 100 / maxHp)));
  const hpBar = document.createElement('div');
  hpBar.className = 'hpbar';
  hpBar.innerHTML = `<div class="inner" style="width:${pct}%"></div>`;
  statsBlock.insertAdjacentElement('afterend', hpBar);

  // Keywords
  const kwEl = body.querySelector('.insp-kw');
  kwEl.innerHTML = '<div class="sep"></div><div class="muted" style="margin:4px 0 6px">Mots-clés actifs :</div>';

  let kws = {};
  try { kws = JSON.parse(card.dataset.keywords||'{}'); } catch(e){ kws = {}; }
  const entries = Object.entries(kws);
  if(entries.length === 0){
    kwEl.innerHTML += `<div class="muted">Aucun mot-clé.</div>`;
  } else {
    for(const [key, val] of entries){
      const pretty = key.charAt(0).toUpperCase()+key.slice(1);
      const explain = KEYWORD_LEXICON[key]
        ? KEYWORD_LEXICON[key](val===true?1:val)
        : 'Effet inconnu.';
      const suffix = (val===true || val===undefined) ? '' : ` (${val})`;
      const block = document.createElement('div');
      block.className = 'kw';
      block.innerHTML = `<b>${pretty}${suffix}</b><div>${explain}</div>`;
      kwEl.appendChild(block);
    }
  }

  // Triggers (affichage informatif, pas de onEndTurn auto)
  kwEl.appendChild(document.createElement('div')).className = 'sep';
  const trigHeader = document.createElement('div');
  trigHeader.className = 'muted';
  trigHeader.style.margin = '8px 0 6px';
  trigHeader.textContent = 'Triggers définis :';
  kwEl.appendChild(trigHeader);

  let trigs = [];
  try { trigs = JSON.parse(card.dataset.triggers || "[]"); } catch(e){ trigs = []; }
  if(!trigs.length){
    const none = document.createElement('div');
    none.className = 'muted';
    none.textContent = 'Aucun trigger.';
    kwEl.appendChild(none);
  } else {
    trigs.forEach(t=>{
      const box2 = document.createElement('div');
      box2.className = 'kw';
      const when = t?.when || '—';
      const condTxt = formatCondition(t?.if);
      const effects = (Array.isArray(t?.do)? t.do : []).map(formatEffect).join('<br>• ');
      box2.innerHTML = `
        <b>Quand :</b> ${when}<br>
        <b>Condition :</b> ${condTxt}<br>
        <b>Effets :</b><br>• ${effects || '—'}
      `;
      kwEl.appendChild(box2);
    });
  }
}

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
//   DRAG & DROP
// =======================
let dragData = { card:null, from:null };
function isSlotEmpty(slot){ return slot && !slot.firstElementChild; }

function setAllSlotsHighlight(mode){
  document.querySelectorAll('.slot').forEach(s=>{
    if(!mode){ s.removeAttribute('data-highlight'); return; }
    s.setAttribute('data-highlight', isSlotEmpty(s) ? 'ok' : 'bad');
  });
}

// Terrain strict : on ne joue QUE sur son terrain
function isOwnTerrain(slotOwner, player){
  return slotOwner === player;
}

function bindSlot(slot){
  slot.addEventListener('dragover', (e)=>{
    if(!dragData.card || gameOver) return;
    e.preventDefault();
    slot.setAttribute('data-highlight', isSlotEmpty(slot) ? 'ok' : 'bad');
  });
  slot.addEventListener('dragleave', ()=>{ slot.removeAttribute('data-highlight'); });

  slot.addEventListener('drop', (e)=>{
    e.preventDefault();
    if(!dragData.card || gameOver) return;

    const to   = slot;
    const from = dragData.from;
    const owner = dragData.card.dataset.owner;

    const fromHand  = from && (from.id === 'hand-p1' || from.id === 'hand-p2');
    const fromBoard = from && from.classList.contains('slot');

    if(!isSlotEmpty(to)){ cleanupDrag(); return; }

    // --- Pose depuis la MAIN → uniquement sur SON terrain
    if(fromHand){
      if(!isOwnTerrain(to.dataset.owner, owner)){
        alert("Tu ne peux poser une carte que sur TON terrain.");
        cleanupDrag(); return;
      }
      if(owner !== turn.current){
        alert("Ce n'est pas ton tour !");
        cleanupDrag(); return;
      }
      const cost = parseInt(dragData.card.querySelector('.cost')?.textContent || "0", 10);
      if(cost > mana[owner].current){
        alert("Mana insuffisant !");
        cleanupDrag(); return;
      }
      mana[owner].current -= cost;
      refreshManaUI();

      state.hands[owner] = state.hands[owner].filter(x=>x !== dragData.card);
      layoutHand(owner);

      to.appendChild(dragData.card);

      // marquage tour de pose + quota de déplacement
      dragData.card.dataset.placedTurn = String(turn.number);
      dragData.card.dataset.movesLeft  = hasKW(dragData.card, "deplacement") ? "1" : "0";

      // on-play triggers
      handleOnPlay(dragData.card);

      // draggabilité selon règles
      setBoardDraggingFor(owner);
    }

    // --- Déplacement manuel depuis PLATEAU → seulement adjacente et terrain propre
    else if(fromBoard){
      if(owner !== turn.current){ cleanupDrag(); return; }
      if(!isOwnTerrain(to.dataset.owner, owner)){ cleanupDrag(); return; }

      // Adjacent (haut/bas/gauche/droite)
      const fr = parseInt(from.dataset.row, 10), fc = parseInt(from.dataset.col, 10);
      const tr = parseInt(to.dataset.row,   10), tc = parseInt(to.dataset.col,   10);
      const manhattan = Math.abs(fr - tr) + Math.abs(fc - tc);
      if(manhattan !== 1){ cleanupDrag(); return; }

      // Eligibilité déplacement
      if(!canCardBeMoved(dragData.card, owner)){ cleanupDrag(); return; }

      to.appendChild(dragData.card);

      if(hasKW(dragData.card, "deplacement")){
        const left = parseInt(dragData.card.dataset.movesLeft || "0", 10);
        dragData.card.dataset.movesLeft = String(Math.max(0, left - 1));
      }

      setBoardDraggingFor(owner);
    }

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
//   CONSTRUCTION DU PLATEAU
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
//   CARTE VISUELLE
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

  card.dataset.owner   = data.owner;
  card.dataset.range   = (data.attackType === "ranged") ? "ranged" : "melee";
  card.dataset.keywords= JSON.stringify(normalizeKeywords(data.keywords||[]));
  card.dataset.triggers= JSON.stringify(data.triggers || []);
  card.dataset.paralyzed = "0";
  card.dataset.tempBuffs = "[]";
  card.dataset.placedTurn = "-1";
  card.dataset.movesLeft = "0";
  card.dataset.maxHp = String(data.hp);

  // Drag depuis main (si tour) ou plateau (si autorisé)
  card.draggable = true;
  card.addEventListener('dragstart', (e)=>{
    if(gameOver){ e.preventDefault(); return; }
    const parent = card.parentElement;
    const fromHand  = parent && (parent.id === 'hand-p1' || parent.id === 'hand-p2');
    const fromBoard = parent && parent.classList.contains('slot');

    if(fromHand){
      if(card.dataset.owner !== turn.current){ e.preventDefault(); return; }
    } else if(fromBoard){
      if(!canCardBeMoved(card, turn.current)){ e.preventDefault(); return; }
    } else {
      e.preventDefault(); return;
    }

    dragData.card = card;
    dragData.from = parent;
    card.classList.add('dragging');
    setAllSlotsHighlight('ok');
  });
  card.addEventListener('dragend', ()=>{ cleanupDrag(); });

  // Inspecteur
  card.addEventListener('mouseenter', ()=> renderInspector(card));
  card.addEventListener('mouseleave', ()=> clearInspector());
  card.addEventListener('click', (e)=> { e.stopPropagation(); renderInspector(card); });

  return card;
}

// =======================
//   PIOCHE / DEFAUSSE
// =======================
function draw(player){
  if(gameOver) return false;
  if(!decks[player] || decks[player].length === 0){
    alert(`Deck ${player.toUpperCase()} vide !`);
    return false;
  }
  const base = decks[player].pop();
  const face = (player === ATT) ? base.attacker : base.defender;

  const cardData = {
    ...deepClone(face),
    owner: player, image: base.image, name: base.nom,
    keywords: face.keywords || [],
    triggers: face.triggers || []
  };
  const card = createCard(cardData);

  state.hands[player].push(card);
  const hand = document.getElementById(`hand-${player}`);
  hand.appendChild(card);
  layoutHand(player);
  updateDeckLeft(player);
  return true;
}
function drawMany(player, n){ for(let i=0;i<n;i++){ if(!draw(player)) break; } }
function discardHand(player){
  if(gameOver) return;
  state.hands[player] = [];
  document.getElementById(`hand-${player}`).innerHTML = "";
  layoutHand(player);
}

// =======================
//   BUFFS & TRIGGERS (onPlay / onStartTurn) + onBoard
// =======================
function collectScopeTargets(sourceCard, scope){
  const owner = ownerOf(sourceCard);
  const row = parseInt(sourceCard.parentElement?.dataset.row||"0",10);
  const col = parseInt(sourceCard.parentElement?.dataset.col||"0",10);

  if(scope === "self") return [sourceCard];

  const results = [];
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const card = getSlot(r,c)?.firstElementChild;
      if(!card) continue;
      if(ownerOf(card)!==owner) continue;

      if(scope === "row" && r===row) results.push(card);
      else if(scope === "column" && c===col) results.push(card);
      else if(scope === "allies") results.push(card);
    }
  }
  if(scope!=="self" && !results.includes(sourceCard)) results.push(sourceCard);
  return results;
}
function addTempBuffVisual(card){ if(!card.classList.contains('buff-temp')) card.classList.add('buff-temp'); }
function removeTempBuffVisualIfNone(card){
  try{
    const arr = JSON.parse(card.dataset.tempBuffs || "[]");
    if(!arr || arr.length===0) card.classList.remove('buff-temp');
  }catch(e){ card.classList.remove('buff-temp'); }
}
function addPermBuffVisual(card){ if(!card.classList.contains('buff-perm')) card.classList.add('buff-perm'); }

function applyBuffToCard(card, da, dh, duration){
  da = Number(da||0); dh = Number(dh||0);
  if(da) setAtk(card, (readAtk(card) || 0) + da);
  if(dh) setHp(card,  (readHp(card)  || 0) + dh);

  if(duration === "turn"){
    let arr = [];
    try { arr = JSON.parse(card.dataset.tempBuffs || "[]") } catch(e){ arr = []; }
    arr.push({ atk: da, hp: dh });
    card.dataset.tempBuffs = JSON.stringify(arr);
    addTempBuffVisual(card);
  }else{
    addPermBuffVisual(card);
    if(dh){
      const oldMax = parseInt(card.dataset.maxHp || readHp(card) || "0", 10);
      card.dataset.maxHp = String(Math.max(1, oldMax + Number(dh)));
    }
  }
}

function applyEffect(owner, effect, card){
  switch(effect.type){
    case "draw": {
      const n = Math.max(1, Number(effect.amount||1));
      for(let i=0;i<n;i++) draw(owner);
      makeToast(`${owner.toUpperCase()} pioche ${n}`);
      break;
    }
    case "manaGain": {
      const n = Math.max(1, Number(effect.amount||1));
      mana[owner].max += n; mana[owner].current += n; refreshManaUI();
      makeToast(`${owner.toUpperCase()} gagne +${n} mana`);
      break;
    }
    case "buffSelf": {
      const da = Number(effect.atk||0);
      const dh = Number(effect.hp||0);
      applyBuffToCard(card, da, dh, effect.duration==="turn" ? "turn" : "permanent");
      makeToast(`Buff (self) : ${da?`ATK ${da>0?'+':''}${da} `:''}${dh?`HP ${dh>0?'+':''}${dh}`:''}`.trim());
      break;
    }
    case "buff": {
      const scope = (effect.scope||"self").toLowerCase();
      const duration = (effect.duration||"permanent").toLowerCase();
      const da = Number(effect.atk||0);
      const dh = Number(effect.hp||0);
      const targets = collectScopeTargets(card, scope);
      targets.forEach(t => applyBuffToCard(t, da, dh, duration));

      const scopeTxt = {self:"soi",row:"ligne",column:"colonne",allies:"alliés"}[scope] || scope;
      const durTxt = duration==="turn" ? " (temporaire)" : " (permanent)";
      makeToast(`Buff ${scopeTxt}${durTxt} : ${da?`ATK ${da>0?'+':''}${da} `:''}${dh?`HP ${dh>0?'+':''}${dh}`:''}`.trim());
      break;
    }
    default:
      console.warn("Effet inconnu:", effect);
  }
}

function clearTempBuffs(player){
  document.querySelectorAll(`.slot .card[data-owner="${player}"]`).forEach(card=>{
    let arr = [];
    try { arr = JSON.parse(card.dataset.tempBuffs || "[]"); } catch(e){ arr = []; }
    if(!arr || arr.length===0) return;

    arr.forEach(({atk, hp})=>{
      if(atk){ setAtk(card, (readAtk(card)||0) - Number(atk)); }
      if(hp){
        setHp(card,  (readHp(card)||0) - Number(hp));
        if(readHp(card) <= 0){
          const parent = card.parentElement;
          if(parent) parent.removeChild(card);
        }
      }
    });

    card.dataset.tempBuffs = "[]";
    removeTempBuffVisualIfNone(card);
  });
}

function countAlliesBehind(card){
  const owner = ownerOf(card);
  const row = parseInt(card.parentElement?.dataset.row||"0",10);
  const col = parseInt(card.parentElement?.dataset.col||"0",10);
  const dir = (owner===ATT)? +1 : -1;
  let count = 0;
  for(let c = col - dir; inBounds(c); c -= dir){
    const s = getSlot(row, c);
    const k = s?.firstElementChild;
    if(k && ownerOf(k)===owner) count++;
    if(k && ownerOf(k)!==owner) break;
  }
  return count;
}
function evalCondition(card, cond){
  if(!cond) return true;
  if(cond.cooperationAtLeast !== undefined){
    return countAlliesBehind(card) >= Number(cond.cooperationAtLeast||0);
  }
  return true;
}
function runTriggers(card, eventName){
  const owner = ownerOf(card);
  let triggers = [];
  try { triggers = JSON.parse(card.dataset.triggers || "[]"); } catch(e){}
  (triggers||[])
    .filter(t => (t?.when||"") === eventName)
    .forEach(t => {
      if(evalCondition(card, t.if)){
        const dos = Array.isArray(t?.do) ? t.do : [];
        dos.forEach(eff => applyEffect(owner, eff, card));
      }
    });
}
function handleOnPlay(card){ runTriggers(card, "onPlay"); }

// --- Début de tour : bonus (ignorent les cartes paralysées)
function processStartTurnBonuses(player){
  document.querySelectorAll(`.slot .card[data-owner="${player}"]`).forEach(card=>{
    if(isParalyzed(card)) return;
    runTriggers(card, "onStartTurn");
  });
}

// --- Effets continus "tant que sur le plateau"
function processOnBoardEffects(){
  if(gameOver) return;
  document.querySelectorAll('.slot .card').forEach(card=>{
    if(isParalyzed(card)) return; // une carte paralysée n'émet aucun effet continu

    const owner = ownerOf(card);

    // Photosynthèse (continu) : +X mana différé par tour (une seule fois par tour et par carte)
    const ps = Number(getKW(card, "photosynthese")||0);
    if(ps>0){
      const stamp = `ps:${turn.number}`;
      if(card.dataset.lastPs !== stamp){
        nextManaBonus[owner] = (nextManaBonus[owner]||0) + ps;
        card.dataset.lastPs = stamp;
      }
    }

    // Exemple d'aura Coop (léger) : si assez d'alliés derrière, buff temporaire ligne
    const coop = Number(getKW(card, "cooperation")||0);
    if(coop>0 && countAlliesBehind(card) >= coop){
      const stamp2 = `coop:${turn.number}`;
      if(card.dataset.lastCoop !== stamp2){
        // buff léger ligne (ATK+1 temporaire) — tu peux ajuster
        collectScopeTargets(card,"row").forEach(t=> applyBuffToCard(t, 1, 0, "turn"));
        card.dataset.lastCoop = stamp2;
      }
    }
  });
}

// =======================
//   COMBAT (simultané) — alliés transparents
// =======================
function findTarget(row, col, owner, type){
  const dir = (owner === ATT) ? +1 : -1;

  if(type === "melee"){
    const tc = col + dir;
    if(!inBounds(tc)) return null;
    const tcard = getSlot(row, tc)?.firstElementChild;
    return (tcard && ownerOf(tcard)!==owner) ? tcard : null;
  }

  // Distance : ignorer les ALLIÉS, s'arrêter au 1er ENNEMI
  for(let c = col + dir; inBounds(c); c += dir){
    const card = getSlot(row, c)?.firstElementChild;
    if(!card) continue;
    if(ownerOf(card) === owner) continue;
    return card;
  }
  return null;
}

function canRiposte(targetCard, attackerCard){
  if(!targetCard || !attackerCard) return false;

  const tr = +targetCard.parentElement.dataset.row;
  const tc = +targetCard.parentElement.dataset.col;
  const ar = +attackerCard.parentElement.dataset.row;
  const ac = +attackerCard.parentElement.dataset.col;

  if(tr !== ar) return false;
  const tOwner = ownerOf(targetCard);
  const tType  = readType(targetCard);

  if(tType === "melee"){
    return Math.abs(ac - tc) === 1;
  } else {
    const dir = (tOwner === ATT) ? +1 : -1;
    for(let c = tc + dir; inBounds(c); c += dir){
      const first = getSlot(tr, c)?.firstElementChild;
      if(!first) continue;
      if(first === attackerCard) return true;
      if(ownerOf(first) !== tOwner) return false;
    }
    return false;
  }
}

function damageCard(card, dmg){
  const hp = readHp(card);
  const after = hp - dmg;
  setHp(card, after);
  if(after <= 0){
    const parent = card.parentElement;
    if(parent) parent.removeChild(card);
    return true;
  }
  return false;
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
  console.log(`[BONUS] ${player} +${inc} mana`);
  makeToast(`+${inc} mana (${player === 'p1' ? 'ATT' : 'DEF'})`);
}

// (Option ATT seulement) pré-reposition pour tenter d'avoir une cible (haut/bas)
function preCombatReposition(side){
  if(side !== ATT) return; // on ne déplace pas la DEF automatiquement
  for(let r=0;r<ROWS;r++){
    for(let c=0; c<COLS; c++){
      const slot = getSlot(r,c);
      const card = slot?.firstElementChild;
      if(!card) continue;
      if(ownerOf(card)!==side) continue;
      if(!hasKW(card,"deplacement")) continue;
      if(isParalyzed(card)) continue;

      const type = readType(card);
      if(findTarget(r,c,side,type)) continue;

      const tryRows = [r-1, r+1].filter(rr=> rr>=0 && rr<ROWS);
      for(const rr of tryRows){
        const targetSlot = getSlot(rr,c);
        if(targetSlot && !targetSlot.firstElementChild){
          if(findTarget(rr,c,side,type)){
            targetSlot.appendChild(card);
            break;
          }
        }
      }
    }
  }
}

// Combat simultané — renvoie le Set des cartes de ce camp qui ont attaqué
function resolveCombat(side){
  const fired = new Set();
  for(let r=0; r<ROWS; r++){
    for(let c=0; c<COLS; c++){
      const slot = getSlot(r,c);
      const card = slot?.firstElementChild;
      if(!card) continue;
      if(ownerOf(card) !== side) continue;
      if(isParalyzed(card)) continue;

      const type = readType(card);
      const atk  = readAtk(card) || 0;

      const target = findTarget(r, c, side, type);
      if(!target) continue;
      if(ownerOf(target) === side) continue;

      fired.add(card);

      const targetAtk = readAtk(target) || 0;

      const targetDead = damageCard(target, atk);

      let attackerDead = false;
      if(canRiposte(target, card)){
        attackerDead = damageCard(card, targetAtk);
      }

      // Perçant
      if(hasKW(card, "percant")){
        for(let cc=0; cc<COLS; cc++){
          const s2 = getSlot(r, cc);
          const victim = s2?.firstElementChild;
          if(victim && ownerOf(victim)!==side && victim!==target){
            damageCard(victim, atk);
          }
        }
      }

      // Paralysie (des deux côtés si présents)
      const para = getKW(card,"paralysie");
      if(para && !targetDead){ addParalysis(target, Number(para)||1); }
      const para2 = getKW(target,"paralysie");
      if(para2 && !attackerDead){ addParalysis(card, Number(para2)||1); }

      // Bonus mana sur kill (ex: pour l'ATT)
      if(targetDead && side===ATT && ownerOf(target)===DEF){
        nextManaBonus.p1 = (nextManaBonus.p1||0) + 1;
        logBonus('p1', 1);
      }
      if(attackerDead && side===DEF && ownerOf(card)===DEF && ownerOf(target)===ATT){
        nextManaBonus.p2 = (nextManaBonus.p2||0) + 1;
        logBonus('p2', 1);
      }
    }
  }
  return fired;
}

// =======================
//   AVANCÉE AUTO (attaquants n'ayant PAS attaqué) + ANIMATION
// =======================
function moveCardToSlotAnimated(card, destSlot, duration=200){
  return new Promise(resolve=>{
    if(!card || !destSlot) return resolve();

    const fromRect = card.getBoundingClientRect();
    destSlot.appendChild(card);
    const toRect = card.getBoundingClientRect();
    const dx = fromRect.left - toRect.left;
    const dy = fromRect.top  - toRect.top;

    card.style.transition = 'none';
    card.style.transform = `translate(${dx}px, ${dy}px)`;
    void card.offsetHeight; // reflow
    card.style.transition = `transform ${duration}ms ease`;
    card.style.transform = 'translate(0,0)';

    setTimeout(()=>{
      card.style.transform = ''; card.style.transition = '';
      resolve();
    }, duration + 20);
  });
}

async function advanceRightForAll(excludeSet){
  if(gameOver) return;
  const moves = [];
  for(let r=0; r<ROWS; r++){
    for(let c=COLS-2; c>=0; c--){
      const cur = getSlot(r, c);
      const card = cur?.firstElementChild;
      if(!card) continue;
      if(ownerOf(card) !== ATT) continue;
      if(isParalyzed(card)) continue;

      if (excludeSet && excludeSet.has(card)) continue;

      const next = getSlot(r, c+1);
      if(!next || next.firstElementChild) continue;

      // Célérité (avance +X cases de plus si libres)
      const cel = Number(getKW(card,"celerite")||0);
      let dest = next;
      let step = 0;
      while(step < cel){
        const tryNext = getSlot(r, parseInt(dest.dataset.col,10)+1);
        if(!tryNext || tryNext.firstElementChild) break;
        dest = tryNext;
        step++;
      }
      moves.push( moveCardToSlotAnimated(card, dest, 200) );
    }
  }
  if(moves.length){ await Promise.all(moves); }
}

// =======================
//   UI TOUR / BANNIÈRE / OVERLAY / CONTROLES ACTIFS
// =======================
function refreshManaUI(){
  const j1 = document.getElementById('mana-p1');
  const j2 = document.getElementById('mana-p2');
  const cap1 = MAX_MANA_CAP, cap2 = MAX_MANA_CAP;
  if (j1) {
    const max = mana.p1.max, cur = mana.p1.current;
    j1.textContent = `${cur}/${cap1}${max > cap1 ? ` (+${max - cap1})` : ""}`;
  }
  if (j2) {
    const max = mana.p2.max, cur = mana.p2.current;
    j2.textContent = `${cur}/${cap2}${max > cap2 ? ` (+${max - cap2})` : ""}`;
  }
  document.querySelector('.hand-att')?.classList.toggle('turn-active', turn.current===ATT);
  document.querySelector('.hand-def')?.classList.toggle('turn-active', turn.current===DEF);
}
function photosynthBonusNow(player){
  let sum = 0;
  document.querySelectorAll(`.slot .card[data-owner="${player}"]`).forEach(card=>{
    if(isParalyzed(card)) return;
    const x = Number(getKW(card, "photosynthese")||0);
    if(x>0) sum += x;
  });
  return sum;
}
function updateHandsVisibility(){
  const attHand = document.getElementById('hand-p1');
  const defHand = document.getElementById('hand-p2');
  if(!attHand || !defHand) return;
  if(turn.current === ATT){
    attHand.style.opacity = "1";  attHand.style.pointerEvents = "auto";
    defHand.style.opacity = "0";  defHand.style.pointerEvents = "none";
  } else {
    defHand.style.opacity = "1";  defHand.style.pointerEvents = "auto";
    attHand.style.opacity = "0";  attHand.style.pointerEvents = "none";
  }
}
function updatePlayerUIVisibility() {
  const attControls = document.getElementById("controls-p1");
  const defControls = document.getElementById("controls-p2");
  if (!attControls || !defControls) return;
  if (turn.current === ATT) {
    attControls.style.opacity = "1";     attControls.style.pointerEvents = "auto";
    defControls.style.opacity = "0.25";  defControls.style.pointerEvents = "none";
  } else {
    defControls.style.opacity = "1";     defControls.style.pointerEvents = "auto";
    attControls.style.opacity = "0.25";  attControls.style.pointerEvents = "none";
  }
}

function ensureTurnBanner(){
  if(document.getElementById('turn-banner')) return;
  const el = document.createElement('div');
  el.id = 'turn-banner';
  el.textContent = 'Préparation…';
  document.body.appendChild(el);
}
function updateTurnBanner(){
  const el = document.getElementById('turn-banner');
  if(!el) return;
  const who = (turn.current === ATT) ? 'Attaquant (Lune)' : 'Défenseur (Soleil)';
  el.textContent = `Tour ${turn.number}/${MAX_ROUNDS} — ${who}`;
  el.classList.remove('show');
  requestAnimationFrame(()=> requestAnimationFrame(()=> el.classList.add('show')));
}

// Combat overlay
function ensureCombatOverlay(){
  if(document.getElementById('combat-overlay')) return;
  const el = document.createElement('div');
  el.id = 'combat-overlay';
  el.innerHTML = `<div class="label">⚔️ Phase de combat ⚔️</div>`;
  document.body.appendChild(el);
}
function flashCombatOverlay(duration=800){
  ensureCombatOverlay();
  const el = document.getElementById('combat-overlay');
  return new Promise(resolve=>{
    el.classList.add('show');
    el.style.pointerEvents = 'auto';
    setTimeout(()=>{
      el.classList.remove('show');
      el.style.pointerEvents = 'none';
      resolve();
    }, duration);
  });
}

// Déplacement : éligibilité (règles deplacement / tour de pose)
function canCardBeMoved(card, player){
  if(ownerOf(card) !== player) return false;
  const hasDepl = hasKW(card, "deplacement");
  const placedTurn = parseInt(card.dataset.placedTurn || "-1", 10);
  const movesLeft = parseInt(card.dataset.movesLeft || "0", 10);
  if(hasDepl){
    return movesLeft > 0;               // 1 déplacement adj. par tour
  } else {
    return placedTurn === turn.number;  // seulement le tour de pose
  }
}
function setBoardDraggingFor(player){
  document.querySelectorAll('.slot .card').forEach(card=>{
    const movable = canCardBeMoved(card, player);
    card.draggable = movable;
    card.classList.toggle('locked', !movable);
  });
}

// =======================
//   TOUR
// =======================
function startTurn(player){
  // Paralysie (compte à rebours)
  tickParalysisForOwner(player);

  // Croissance naturelle (cap) + photosynthèse + bonus différé (des tours précédents)
  const m = mana[player];
  m.max = Math.min(MAX_MANA_CAP, m.max + 1);

  const ps = photosynthBonusNow(player); // cartes paralysées ignorées ici
  if(ps>0){ m.max += ps; logBonus(player, ps); }

  if(nextManaBonus[player] > 0){
    m.max += nextManaBonus[player];
    logBonus(player, nextManaBonus[player]);
    nextManaBonus[player] = 0;
  }

  // Déclenche les bonus "début de tour" des cartes non paralysées
  processStartTurnBonuses(player);

  // Reset quota déplacement pour le propriétaire actif
  document.querySelectorAll(`.slot .card[data-owner="${player}"]`).forEach(card=>{
    if(hasKW(card, "deplacement")) card.dataset.movesLeft = "1";
    else card.dataset.movesLeft = "0";
  });

  m.current = m.max;
  refreshManaUI();
  draw(player);

  // Effets continus
  processOnBoardEffects();

  // UI
  updateHandsVisibility();
  updateTurnBanner();
  setBoardDraggingFor(player);
  updatePlayerUIVisibility();
}

// Victoire Attaquant si 2+ unités atteignent la dernière colonne
function checkAttackerBreachWin(){
  if (gameOver) return;
  let count = 0;
  for (let r = 0; r < ROWS; r++){
    const lastSlot = getSlot(r, COLS - 1);
    const card = lastSlot?.firstElementChild;
    if (card && ownerOf(card) === ATT) count++;
    if (count >= 2){
      declareWinner(ATT);
      return;
    }
  }
}

// Victoire
function declareWinner(winner){
  gameOver = true;
  const msg = (winner === DEF)
    ? "Victoire des Défenseurs ! (limite de 20 tours atteinte)"
    : "Victoire de l’Attaquant !";
  alert(msg);
}

// Fin de tour — Résolution après tour DEF, avance animée des attaquants (non-tireurs)
async function endTurn(){
  if(gameOver) return;

  const endingPlayer = turn.current;

  // Retire les buffs temporaires du joueur qui termine son tour
  clearTempBuffs(endingPlayer);

  if (endingPlayer === DEF) {
    // Combat
    await flashCombatOverlay(800);

    // Pré-reposition : ATT seulement
    preCombatReposition(ATT);

    // Simultané
    const attFired = resolveCombat(ATT);
    resolveCombat(DEF);

    // Avance auto animée (exclut ceux qui ont tiré)
    await advanceRightForAll(attFired);

    // ✅ Nouvelle vérification de percée
    checkAttackerBreachWin();

    // Effets continus post-mouvements
    processOnBoardEffects();

    // Fin de manche
    turn.number++;
    updateRoundUI();

    // +1 mana max global à la fin de la résolution
    mana.p1.max += 1; mana.p2.max += 1;
    mana.p1.current = mana.p1.max; mana.p2.current = mana.p2.max;
    refreshManaUI();
    makeToast("💠 +1 Mana maximum pour chaque joueur (fin de résolution)");

    if (turn.number > MAX_ROUNDS) {
      declareWinner(DEF);
      return;
    }

    // Repart sur Attaquant
    turn.current = ATT;
  } else {
    // Passe au Défenseur (pas de combat)
    turn.current = DEF;
  }

  startTurn(turn.current);
}

// =======================
//   INIT + BOUTONS
// =======================
function initGame(){
  initDecks();

  drawMany(ATT, STARTING_HAND);
  drawMany(DEF, STARTING_HAND);

  const btnAdvance = document.getElementById('advance');
  if (btnAdvance) {
    btnAdvance.disabled = true;
    btnAdvance.style.opacity = "0.5";
    btnAdvance.style.cursor = "not-allowed";
    btnAdvance.title = "Avance automatique après la phase de combat";
  }

  document.getElementById('end-turn').onclick = endTurn;

  updateDeckLeft('p1'); updateDeckLeft('p2');
  updateRoundUI();

  ensureTurnBanner();
  startTurn(turn.current);
  relayoutBothHands();
  clearInspector();
  setBoardDraggingFor(turn.current);
  updatePlayerUIVisibility();
}
initGame();
