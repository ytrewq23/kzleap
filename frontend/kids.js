


let energy      = 0;
let stars       = 0;
let level       = 1;          
let currentGame = null;
let gameTimer   = null;

const ENERGY_MAX = 100;

const LEVEL_THRESHOLDS = [0, 35, 70];   
const LEVEL_LABELS     = ['🌱 Level 1', '🌿 Level 2', '🌳 Level 3'];
const LEVEL_HINTS      = [
  'Keep playing to level up!',
  'Almost there — keep going!',
  '🏆 Max level — you\'re a legend!',
];
const CITY_STAGES = [
  ['🏚️','🌲','🌲','🌲','🌲'],
  ['🏠','🌲','🌲','🌲','🌲'],
  ['🏠','🏠','🌳','🌲','🌲'],
  ['🏡','🏠','🌳','☀️','🌲'],
  ['🏡','🏡','🌳','☀️','🌿'],
  ['🏢','🏡','🌳','☀️','💨'],
  ['🏢','🏢','🌳','☀️','💨'],
  ['🌆','🏢','🌳','☀️','💨'],
  ['🌆','🌆','🌳','☀️','💨'],
  ['🌇','🌆','🌳','☀️','💨'],
  ['🌇','🌇','🌴','☀️','💨'],
];
const MASCOT_LINES = [
  "Great job! You\'re an eco-hero! 🌟",
  "Sun and wind are our best friends! ☀️💨",
  "Bikes save more energy than cars! 🚲",
  "Green energy is the future! 🌿",
  "You\'re saving the planet! 🌍",
  "Kazakhstan can be 100% green! 🇰🇿",
  "Every tree matters! 🌲",
  "Clean energy = clean air! 💨",
];
const ECO_FACTS = [
  "💡 One solar panel powers a whole room!",
  "🌳 One tree absorbs 22 kg of CO₂ per year!",
  "💨 A wind turbine can power 500 homes!",
  "🚲 Cycling saves 150g of CO₂ per km vs a car!",
  "☀️ Kazakhstan is one of the sunniest countries on Earth!",
  "♻️ Recycling 1 bottle = 4 hours of light!",
];


window.addEventListener('load', () => {
  updateUI();
  showGameSelect();
  document.getElementById('mascot').addEventListener('click', randomMascotLine);
});


function updateUI() {
  const pct = Math.min(energy / ENERGY_MAX * 100, 100);
  document.getElementById('energyBar').style.width = pct + '%';
  document.getElementById('energyNum').textContent = energy + ' / ' + ENERGY_MAX;
  document.getElementById('starsDisplay').textContent = '⭐ ' + stars;
  
  const lvlIdx = level - 1;
  document.getElementById('levelBadge').textContent = LEVEL_LABELS[lvlIdx];
  document.getElementById('levelHint').textContent  = LEVEL_HINTS[lvlIdx];
  updateCity();
}

function updateCity() {
  const stage = Math.min(Math.floor(energy / 10), CITY_STAGES.length - 1);
  CITY_STAGES[stage].forEach((e, i) => {
    const el = document.getElementById('bld' + i);
    if (el) el.textContent = e;
  });
}

function addEnergy(n) {
  energy = Math.min(energy + n, ENERGY_MAX);
  
  if (energy >= LEVEL_THRESHOLDS[2] && level < 3) { level = 3; speak('🏆 Level 3 unlocked! You\'re amazing!'); }
  else if (energy >= LEVEL_THRESHOLDS[1] && level < 2) { level = 2; speak('🌿 Level 2 unlocked! Games get harder!'); }
  updateUI();
}

function addStar(n) { stars += n; updateUI(); }

function speak(text) {
  document.getElementById('speechText').textContent = text;
  const b = document.getElementById('speechBubble');
  b.style.animation = 'none';
  requestAnimationFrame(() => b.style.animation = 'bubbleFade 0.3s ease');
}
function randomMascotLine() { speak(MASCOT_LINES[Math.floor(Math.random() * MASCOT_LINES.length)]); }


const ALL_SCREENS = ['gameSelect','gameQuiz','gameSort','gameSolar','gameMaze','resultScreen'];
function hideAll() {
  ALL_SCREENS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}
function showGameSelect() {
  stopTimer();
  cleanupMaze();
  cleanupSort();
  hideAll();
  document.getElementById('gameSelect').style.display = 'block';
  speak('Pick a game and help the city! 🏙️');
}

function startGame(game) {
  hideAll();
  stopTimer();
  currentGame = game;
  lastGame    = game;
  if (game === 'quiz')  initQuiz();
  else if (game === 'sort')  initSort();
  else if (game === 'solar') initSolar();
  else if (game === 'maze')  initMaze();
}


function startTimer(elementId, seconds, onEnd) {
  let sec = seconds;
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = '⏱ ' + sec;
  el.style.color = '#333';
  gameTimer = setInterval(() => {
    sec--;
    el.textContent = '⏱ ' + sec;
    if (sec <= 5) el.style.color = '#EB5757';
    if (sec <= 0) { stopTimer(); onEnd(); }
  }, 1000);
}
function stopTimer() {
  if (gameTimer) { clearInterval(gameTimer); gameTimer = null; }
}


let lastGame = null;

function showResult(score, max, label) {
  stopTimer();
  cleanupMaze();
  cleanupSort();
  hideAll();

  const ratio  = score / Math.max(max, 1);
  const earned = ratio >= 0.8 ? 3 : ratio >= 0.5 ? 2 : 1;

  addEnergy(earned * 7);
  addStar(earned);

  document.getElementById('resultEmoji').textContent = ratio >= 0.8 ? '🎉' : ratio >= 0.5 ? '😊' : '💪';
  document.getElementById('resultTitle').textContent = ratio >= 0.8 ? 'Awesome!' : ratio >= 0.5 ? 'Good job!' : 'Keep trying!';
  document.getElementById('resultText').textContent  = label + ': ' + score + ' / ' + max;
  document.getElementById('resultStars').textContent = '⭐'.repeat(earned);
  document.getElementById('resultFact').textContent  = ECO_FACTS[Math.floor(Math.random() * ECO_FACTS.length)];
  document.getElementById('resultScreen').style.display = 'flex';

  if (earned >= 2) launchConfetti();
  speak(earned === 3 ? 'Incredible! You\'re a true legend! 🏆' : 'Don\'t give up! 💪');
}

function playAgain() {
  if (lastGame) startGame(lastGame);
  else showGameSelect();
}




const QUIZ_PAIRS = [
  [{ emoji:'💡', name:'LED bulb',      watts:10  }, { emoji:'🔆', name:'Old bulb',       watts:60  }],
  [{ emoji:'📺', name:'TV (2h)',        watts:150 }, { emoji:'💻', name:'Laptop (2h)',    watts:45  }],
  [{ emoji:'🚿', name:'Hot shower',     watts:8000}, { emoji:'🛁', name:'Hot bath',       watts:5000}],
  [{ emoji:'❄️', name:'Fridge',         watts:150 }, { emoji:'💡', name:'LED lamp',       watts:10  }],
  [{ emoji:'🏭', name:'Coal plant',     watts:9e8 }, { emoji:'☀️', name:'Solar farm',     watts:1e7 }],
  [{ emoji:'🚗', name:'Electric car',   watts:11  }, { emoji:'🚗', name:'Petrol car',     watts:74  }],
  [{ emoji:'🎮', name:'Gaming PC',      watts:300 }, { emoji:'📱', name:'Phone charger',  watts:5   }],
  [{ emoji:'🫧', name:'Washing machine',watts:500 }, { emoji:'🍳', name:'Toaster',        watts:1200}],
  [{ emoji:'🌬️', name:'Hair dryer',     watts:1800}, { emoji:'💨', name:'Fan',            watts:50  }],
  [{ emoji:'🖨️', name:'Printer',        watts:400 }, { emoji:'🖥️', name:'Monitor',       watts:30  }],
  [{ emoji:'♨️', name:'Electric kettle',watts:2000}, { emoji:'☕', name:'Coffee maker',   watts:900 }],
  [{ emoji:'🎵', name:'Bluetooth speaker',watts:5 }, { emoji:'📢', name:'Home cinema',    watts:100 }],
];

let quizScore   = 0;
let quizErrors  = 0;
let quizRound   = 0;
let quizMax     = 8;
let quizAnswered= false;
let quizQTimer  = null;
let quizPool    = [];

function initQuiz() {
  quizScore    = 0;
  quizErrors   = 0;
  quizRound    = 0;
  quizAnswered = false;
  quizMax      = 6 + (level - 1) * 2;   
  quizPool     = [...QUIZ_PAIRS].sort(() => Math.random() - 0.5);

  document.getElementById('gameQuiz').style.display = 'block';
  document.getElementById('quizScore').textContent  = '0';
  document.getElementById('quizErrors').textContent = '0';
  document.getElementById('quizFeedback').innerHTML = '&nbsp;';

  const secPerQ = Math.max(6, 10 - (level - 1) * 2);  
  startTimer('quizTimer', secPerQ * quizMax, endQuiz);
  nextQuizQuestion();
  speak('Which one uses more power? Tap it! ⚡');
}

function nextQuizQuestion() {
  if (quizRound >= quizMax) { endQuiz(); return; }
  quizAnswered = false;

  
  if (quizQTimer) clearTimeout(quizQTimer);
  const secPerQ = Math.max(6, 10 - (level - 1) * 2);
  quizQTimer = setTimeout(() => {
    if (!quizAnswered) {
      quizErrors++;
      document.getElementById('quizErrors').textContent = quizErrors;
      document.getElementById('quizFeedback').textContent = '⏰ Time\'s up!';
      
      document.getElementById('quizCardA').classList.add('disabled');
      document.getElementById('quizCardB').classList.add('disabled');
      quizRound++;
      setTimeout(nextQuizQuestion, 900);
    }
  }, secPerQ * 1000);

  const pair = quizPool[quizRound % quizPool.length];
  
  const swapped = Math.random() < 0.5;
  const [a, b]  = swapped ? [pair[1], pair[0]] : [pair[0], pair[1]];

  document.getElementById('quizEmojiA').textContent = a.emoji;
  document.getElementById('quizNameA').textContent  = a.name;
  document.getElementById('quizEmojiB').textContent = b.emoji;
  document.getElementById('quizNameB').textContent  = b.name;
  document.getElementById('quizFeedback').innerHTML = '&nbsp;';

  
  document.getElementById('quizCardA').dataset.watts = a.watts;
  document.getElementById('quizCardB').dataset.watts = b.watts;
  ['quizCardA','quizCardB'].forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('correct','wrong','disabled');
  });
}

function answerQuiz(idx) {
  if (quizAnswered) return;
  quizAnswered = true;
  if (quizQTimer) clearTimeout(quizQTimer);

  const wa = parseFloat(document.getElementById('quizCardA').dataset.watts);
  const wb = parseFloat(document.getElementById('quizCardB').dataset.watts);
  const correctIdx = wa >= wb ? 0 : 1;   

  if (idx === correctIdx) {
    quizScore++;
    document.getElementById('quizScore').textContent = quizScore;
    document.getElementById('quizFeedback').textContent = '✅ Correct! Great thinking!';
    flashCards(idx === 0 ? 'A' : 'B', true);
    speak(MASCOT_LINES[Math.floor(Math.random() * MASCOT_LINES.length)]);
  } else {
    quizErrors++;
    document.getElementById('quizErrors').textContent = quizErrors;
    const winner = correctIdx === 0
      ? document.getElementById('quizEmojiA').textContent
      : document.getElementById('quizEmojiB').textContent;
    document.getElementById('quizFeedback').textContent = '❌ Nope! ' + winner + ' uses more!';
    flashCards(idx === 0 ? 'A' : 'B', false);
  }

  quizRound++;
  if (quizRound >= quizMax) {
    setTimeout(endQuiz, 1100);
  } else {
    setTimeout(nextQuizQuestion, 1100);
  }
}

function flashCards(picked, correct) {
  
  const pickedId = picked === 'A' ? 'quizCardA' : 'quizCardB';
  document.getElementById(pickedId).classList.add(correct ? 'correct' : 'wrong');
  document.getElementById('quizCardA').classList.add('disabled');
  document.getElementById('quizCardB').classList.add('disabled');
}

function endQuiz() {
  if (quizQTimer) clearTimeout(quizQTimer);
  showResult(quizScore, quizMax, 'Correct answers');
}




const TOKEN_DATA = [
  { emoji:'☀️',  label:'Solar',   type:'green' },
  { emoji:'💨',  label:'Wind',    type:'green' },
  { emoji:'💧',  label:'Hydro',   type:'green' },
  { emoji:'🌿',  label:'Bio',     type:'green' },
  { emoji:'⚡',  label:'Clean',   type:'green' },
  { emoji:'🌊',  label:'Wave',    type:'green' },
  { emoji:'🪨',  label:'Coal',    type:'dirty' },
  { emoji:'🛢️', label:'Oil',     type:'dirty' },
  { emoji:'🏭',  label:'Factory', type:'dirty' },
  { emoji:'🚗',  label:'Cars',    type:'dirty' },
  { emoji:'🔥',  label:'Burn',    type:'dirty' },
  { emoji:'💣',  label:'Gas',     type:'dirty' },
];

let sortScore    = 0;
let sortErrors   = 0;
let sortInterval = null;
let sortBatchSize = 4;
let _dragEl = null, _dragClone = null;

function initSort() {
  sortScore = 0; sortErrors = 0;
  sortBatchSize = 4 + (level - 1) * 2;   
  document.getElementById('gameSort').style.display = 'flex';
  document.getElementById('gameSort').style.flexDirection = 'column';
  document.getElementById('sortScore').textContent  = '0';
  document.getElementById('sortErrors').textContent = '0';
  document.getElementById('fallingZone').innerHTML  = '';
  spawnTokenBatch();
  const sec = 50 - (level - 1) * 10;
  startTimer('sortTimer', sec, endSort);
  speak('Drag clean energy to 🌿, dirty to 🏭!');
}

function spawnTokenBatch() {
  const zone = document.getElementById('fallingZone');
  if (!zone) return;
  zone.innerHTML = '';
  const pool = [...TOKEN_DATA].sort(() => Math.random() - 0.5).slice(0, sortBatchSize);
  pool.forEach(t => {
    const tok = document.createElement('div');
    tok.className = 'energy-token';
    tok.innerHTML = t.emoji + '<span class="tok-label">' + t.label + '</span>';
    tok.draggable = true;
    tok.dataset.type = t.type;
    tok.addEventListener('dragstart', e => e.dataTransfer.setData('text', t.type));
    tok.addEventListener('touchstart', onTouchStart, { passive: true });
    tok.addEventListener('touchmove',  onTouchMove,  { passive: false });
    tok.addEventListener('touchend',   onTouchEnd);
    zone.appendChild(tok);
  });
}

function onTouchStart(e) {
  _dragEl = e.currentTarget;
  const t = e.touches[0];
  _dragClone = _dragEl.cloneNode(true);
  _dragClone.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;font-size:48px;transform:translate(-50%,-50%);opacity:0.85;';
  _dragClone.style.left = t.clientX + 'px';
  _dragClone.style.top  = t.clientY + 'px';
  document.body.appendChild(_dragClone);
}
function onTouchMove(e) {
  e.preventDefault();
  if (!_dragClone) return;
  const t = e.touches[0];
  _dragClone.style.left = t.clientX + 'px';
  _dragClone.style.top  = t.clientY + 'px';
}
function onTouchEnd(e) {
  if (!_dragEl || !_dragClone) return;
  const t   = e.changedTouches[0];
  document.body.removeChild(_dragClone);
  _dragClone = null;
  const el  = document.elementFromPoint(t.clientX, t.clientY);
  const bin = el && el.closest('.sort-bin');
  if (bin) handleDrop(bin.id === 'binGreen' ? 'green' : 'dirty', _dragEl.dataset.type, _dragEl);
  _dragEl = null;
}
function allowDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}
function dropToken(e, binType) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  handleDrop(binType, e.dataTransfer.getData('text'), null);
}
function handleDrop(binType, tokType, el) {
  if (binType === tokType) {
    sortScore++;
    document.getElementById('sortScore').textContent = sortScore;
    speak(sortScore % 4 === 0 ? '🌟 Amazing sorting!' : '✅ Correct!');
  } else {
    sortErrors++;
    document.getElementById('sortErrors').textContent = sortErrors;
    speak('Oops! Try again! 😅');
  }
  
  const zone = document.getElementById('fallingZone');
  
  if (el) {
    el.remove();
  } else {
    
    const match = zone && zone.querySelector('[data-type="' + tokType + '"]');
    if (match) match.remove();
  }
  
  if (zone && zone.children.length === 0) spawnTokenBatch();
}
function endSort() {
  showResult(sortScore, sortScore + sortErrors, 'Correct sorts');
}
function cleanupSort() {
  
}




let solarCharge   = 0;
let totalClouds   = 0;
let cloudInterval = null;
const PANEL_COUNT = 6;

function initSolar() {
  solarCharge = 0;
  totalClouds = 0;
  document.getElementById('gameSolar').style.display = 'block';
  document.getElementById('batteryFill').style.width = '0%';
  document.getElementById('batteryPct').textContent  = '0%';

  
  const row = document.getElementById('solarPanels');
  row.innerHTML = '';
  for (let i = 0; i < PANEL_COUNT; i++) {
    const p = document.createElement('div');
    p.className = 'sol-panel';
    p.id = 'sp' + i;
    p.textContent = '⬛';
    row.appendChild(p);
  }

  document.getElementById('cloudsLayer').innerHTML = '';
  const initialClouds = 6 + (level - 1) * 3;
  spawnClouds(initialClouds);

  const respawnSec = Math.max(3000, 5000 - (level - 1) * 1000);
  cloudInterval = setInterval(() => spawnClouds(2 + level), respawnSec);

  const sec = 35 - (level - 1) * 5;
  startTimer('solarTimer', sec, endSolar);
  speak('Tap the clouds to let the sun shine! ☀️');
}

function spawnClouds(n) {
  const layer = document.getElementById('cloudsLayer');
  if (!layer) return;
  for (let i = 0; i < n; i++) {
    totalClouds++;
    const c = document.createElement('div');
    c.className = 'cloud-item';
    c.textContent = '☁️';
    c.style.top  = (8  + Math.random() * 52) + '%';
    c.style.left = (4  + Math.random() * 82) + '%';
    c.style.animationDelay = (Math.random() * 3) + 's';
    c.addEventListener('click',      () => removeCloud(c));
    c.addEventListener('touchstart', () => removeCloud(c), { passive: true });
    layer.appendChild(c);
  }
  recalcSolar();
}

function removeCloud(el) {
  if (el.classList.contains('vanish')) return;
  el.classList.add('vanish');
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); recalcSolar(); }, 280);
  recalcSolar();
}

function recalcSolar() {
  const layer     = document.getElementById('cloudsLayer');
  if (!layer) return;
  const remaining = layer.querySelectorAll('.cloud-item:not(.vanish)').length;
  const total     = layer.querySelectorAll('.cloud-item').length;
  
  const clarity   = total === 0 ? 1 : 1 - remaining / total;
  solarCharge     = Math.round(clarity * 100);

  document.getElementById('batteryFill').style.width = solarCharge + '%';
  document.getElementById('batteryPct').textContent  = solarCharge + '%';

  
  const litCount = Math.round((solarCharge / 100) * PANEL_COUNT);
  for (let i = 0; i < PANEL_COUNT; i++) {
    const p = document.getElementById('sp' + i);
    if (!p) continue;
    if (i < litCount) {
      p.textContent = '🟨';
      p.classList.add('charged');
    } else {
      p.textContent = '⬛';
      p.classList.remove('charged');
    }
  }

  if (solarCharge >= 100) { stopTimer(); setTimeout(endSolar, 400); }
  else if (solarCharge > 0 && solarCharge % 25 === 0) speak('⚡ Battery charging!');
}

function endSolar() {
  if (cloudInterval) { clearInterval(cloudInterval); cloudInterval = null; }
  showResult(solarCharge, 100, 'Battery charge %');
}




let mazeRAF    = null;
let mazeDodged = 0;
let mazeHits   = 0;
let mazeRunning= false;


const LANE_COUNT = 3;
let laneWidth, roadLeft, roadRight, canvasW, canvasH;
let bikeX, bikeY, bikeLane;
let cars = [];
let stars3 = [];   
let frame3 = 0;
let carSpawnInterval, carSpeedBase, maxHits;
let swipeStartX = null;

function initMaze() {
  const canvas = document.getElementById('mazeCanvas');
  const ctx    = canvas.getContext('2d');
  canvasW = canvas.width;
  canvasH = canvas.height;

  mazeDodged   = 0;
  mazeHits     = 0;
  mazeRunning  = true;
  frame3       = 0;
  cars         = [];
  stars3       = [];
  bikeLane     = 1;   
  bikeY        = canvasH - 70;

  document.getElementById('mazeScore').textContent = '0';
  document.getElementById('mazeHits').textContent  = '0';
  document.getElementById('gameMaze').style.display = 'block';

  
  carSpeedBase     = 2.5 + (level - 1) * 1.5;
  carSpawnInterval = Math.max(40, 80 - (level - 1) * 20);
  maxHits          = 4 - (level - 1);   

  
  roadLeft  = canvasW * 0.1;
  roadRight = canvasW * 0.9;
  laneWidth = (roadRight - roadLeft) / LANE_COUNT;

  
  document.addEventListener('keydown', onKeyDown);
  
  canvas.addEventListener('touchstart', onSwipeStart, { passive: true });
  canvas.addEventListener('touchend',   onSwipeEnd);
  
  canvas.addEventListener('click', onTapCanvas);

  const sec = 35 - (level - 1) * 5;
  startTimer('mazeTimer', sec, endMaze);

  mazeLoop(ctx);
  speak('Use arrows or tap sides to dodge cars! 🚲');
}

function laneCenterX(lane) {
  return roadLeft + laneWidth * lane + laneWidth / 2;
}

function mazeLoop(ctx) {
  if (!mazeRunning) return;
  frame3++;
  ctx.clearRect(0, 0, canvasW, canvasH);

  
  const sky = ctx.createLinearGradient(0, 0, 0, canvasH * 0.55);
  sky.addColorStop(0, '#87CEEB');
  sky.addColorStop(1, '#c8e6f5');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvasW, canvasH * 0.55);

  
  ctx.fillStyle = '#4CAF50';
  ctx.fillRect(0, canvasH * 0.55, canvasW, canvasH);

  
  const road = ctx.createLinearGradient(roadLeft, 0, roadRight, 0);
  road.addColorStop(0,   '#555');
  road.addColorStop(0.5, '#666');
  road.addColorStop(1,   '#555');
  ctx.fillStyle = road;
  ctx.fillRect(roadLeft, 0, roadRight - roadLeft, canvasH);

  
  ctx.setLineDash([18, 14]);
  ctx.lineWidth   = 2;
  ctx.strokeStyle = 'rgba(255,255,200,0.5)';
  for (let l = 1; l < LANE_COUNT; l++) {
    const x = roadLeft + laneWidth * l;
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x, canvasH);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  
  ctx.lineWidth = 4; ctx.strokeStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(roadLeft,  0); ctx.lineTo(roadLeft,  canvasH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(roadRight, 0); ctx.lineTo(roadRight, canvasH); ctx.stroke();

  
  drawTree(ctx, 20,  canvasH * 0.3, 22);
  drawTree(ctx, 20,  canvasH * 0.6, 18);
  drawTree(ctx, canvasW - 22, canvasH * 0.35, 22);
  drawTree(ctx, canvasW - 22, canvasH * 0.65, 18);

  
  ctx.font = '28px serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏫', canvasW / 2, 32);

  
  if (frame3 % carSpawnInterval === 0) {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    cars.push({
      lane, y: -60,
      speed: carSpeedBase + Math.random() * 1.5,
      emoji: ['🚗','🚕','🚙','🚌'][Math.floor(Math.random() * 4)],
      hit: false,
    });
  }

  
  bikeX = laneCenterX(bikeLane);
  for (let i = cars.length - 1; i >= 0; i--) {
    const c = cars[i];
    c.y += c.speed;

    
    if (!c.hit &&
        c.lane === bikeLane &&
        c.y + 50 > bikeY - 20 &&
        c.y < bikeY + 20) {
      c.hit = true;
      mazeHits++;
      document.getElementById('mazeHits').textContent = mazeHits;
      speak('Ouch! Watch out! 🚧');
      if (mazeHits >= maxHits) { stopTimer(); setTimeout(endMaze, 600); return; }
    }

    
    if (c.y > bikeY + 30 && !c.scored) {
      c.scored = true;
      mazeDodged++;
      document.getElementById('mazeScore').textContent = mazeDodged;
    }

    ctx.font = '32px serif';
    ctx.textAlign = 'center';
    ctx.fillText(c.emoji, laneCenterX(c.lane), c.y);

    if (c.y > canvasH + 80) cars.splice(i, 1);
  }

  
  ctx.font = '36px serif';
  ctx.textAlign = 'center';
  ctx.fillText('🚲', bikeX, bikeY);

  
  if (mazeHits > 0 && frame3 % 20 < 6) {
    ctx.fillStyle = 'rgba(235,87,87,0.18)';
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  mazeRAF = requestAnimationFrame(() => mazeLoop(ctx));
}

function drawTree(ctx, x, y, size) {
  ctx.font = size + 'px serif';
  ctx.textAlign = 'center';
  ctx.fillText('🌲', x, y);
}

function onKeyDown(e) {
  if (!mazeRunning) return;
  if (e.key === 'ArrowLeft'  && bikeLane > 0)              bikeLane--;
  if (e.key === 'ArrowRight' && bikeLane < LANE_COUNT - 1) bikeLane++;
}
function onSwipeStart(e) { swipeStartX = e.touches[0].clientX; }
function onSwipeEnd(e) {
  if (swipeStartX === null) return;
  const dx = e.changedTouches[0].clientX - swipeStartX;
  if (Math.abs(dx) > 30) {
    if (dx < 0 && bikeLane > 0)              bikeLane--;
    if (dx > 0 && bikeLane < LANE_COUNT - 1) bikeLane++;
  }
  swipeStartX = null;
}
function onTapCanvas(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  const x    = e.clientX - rect.left;
  if (x < rect.width / 2 && bikeLane > 0)              bikeLane--;
  if (x >= rect.width / 2 && bikeLane < LANE_COUNT - 1) bikeLane++;
}

function cleanupMaze() {
  mazeRunning = false;
  if (mazeRAF) { cancelAnimationFrame(mazeRAF); mazeRAF = null; }
  document.removeEventListener('keydown', onKeyDown);
  const canvas = document.getElementById('mazeCanvas');
  if (canvas) {
    canvas.removeEventListener('touchstart', onSwipeStart);
    canvas.removeEventListener('touchend',   onSwipeEnd);
    canvas.removeEventListener('click',      onTapCanvas);
  }
}

function endMaze() {
  cleanupMaze();
  showResult(mazeDodged, Math.max(mazeDodged + mazeHits, 1), 'Cars dodged');
}




function launchConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  const ctx    = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const COLORS  = ['#F2C94C','#27AE60','#2F80ED','#EB5757','#9B51E0','#F2994A','#6FCF97'];
  const pieces  = Array.from({ length: 130 }, () => ({
    x: Math.random() * canvas.width,
    y: -20,
    r: 5 + Math.random() * 8,
    d: Math.random() * 40 + 10,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    tilt: Math.random() * 10 - 10,
    tiltAngle: 0,
    tiltSpeed: Math.random() * 0.1 + 0.05,
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      ctx.beginPath();
      ctx.lineWidth   = p.r / 2;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 4, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 4);
      ctx.stroke();
      p.y += Math.cos(frame + p.d) + 3 + p.r / 2;
      p.x += Math.sin(frame) * 2;
      p.tilt = Math.sin(p.tiltAngle) * 15;
      p.tiltAngle += p.tiltSpeed;
    });
    frame += 0.01;
    if (frame < 3) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}
